// investimentos.js
// Visão dedicada aos lançamentos de investimento: continuam gravados na mesma
// coleção "carteira" (classificacao_saida = "INVESTIMENTO"), então aportes
// seguem contando normalmente no saldo do Extrato/Dashboard. Essa tela filtra
// e agrupa esses lançamentos por dois campos novos e opcionais no documento:
// `investimento` (nome do investimento, ex: "CDB BRADESCO" — é por ele que o
// sistema soma aporte + resgate do mesmo investimento, mesmo que a Descrição
// de cada lançamento seja diferente) e `dono_carteira` (de quem é a fatia do
// valor, ex: "EU"/"MAYARA" — pra não confundir quando o investimento é
// compartilhado com outra pessoa).
//
// obterTransacoes() não tem filtro de período nenhum (só por userId), então
// esta tela já busca o histórico inteiro por padrão — sem recorte de data.
import { exigirLogin } from "./auth-guard.js";
import { renderizarNav } from "./nav.js";
import { mostrarToast, confirmarAcao } from "./ui.js";
import { BANCOS_SUGERIDOS, mesclarSugestoes } from "./dados-comuns.js";
import { isoParaBR, formatarReais } from "./utils.js";
import { ativarOrdenacao, compararValores } from "./tabela-ordenavel.js";
import { obterTransacoes, criarTransacao, excluirTransacaoPorId, atualizarTransacao } from "./dados-carteira.js";
import { abrirEditorTransacao } from "./editor-transacao.js";

const CLASSIFICACAO_INVESTIMENTO = "INVESTIMENTO";
const SEM_DONO = "Sem dono definido";

const usuario = await exigirLogin();
renderizarNav("investimentos", usuario.email);

let todasTransacoes = [];
let todosInvestimentos = [];
let ordenacaoAtual = { chave: "data", direcao: "desc", tipo: "texto" };

ativarOrdenacao(document.querySelector("#tabela-investimentos thead"), (chave, direcao, tipo) => {
    ordenacaoAtual = { chave, direcao, tipo };
    renderizarTabela(todosInvestimentos);
});

function celulaTexto(texto) {
    const td = document.createElement("td");
    td.textContent = texto;
    return td;
}

function linhaCarteira(rotulo, valor, classeExtra = "") {
    const linha = document.createElement("div");
    linha.className = `linha-carteira ${classeExtra}`;

    const spanRotulo = document.createElement("span");
    spanRotulo.className = "rotulo-linha";
    spanRotulo.textContent = rotulo;

    const spanValor = document.createElement("span");
    spanValor.className = "valor-linha";
    spanValor.textContent = classeExtra === "texto" ? valor : formatarReais(valor);
    if (classeExtra === "saldo") spanValor.classList.add(valor >= 0 ? "valor-positivo" : "valor-negativo");

    linha.appendChild(spanRotulo);
    linha.appendChild(spanValor);
    return linha;
}

// Linha "[+] Rótulo ... valor" que expande, ao clicar, um mini-extrato em
// texto simples (Data, Detalhe, Valor) dos lançamentos passados — usado nos
// cards "Por dono" pra ver rapidinho o que compõe o Aportado/Resgatado sem
// precisar ir até a tabela grande.
function linhaExpansivel(rotulo, valor, lancamentos) {
    const wrapper = document.createElement("div");

    const linha = document.createElement("div");
    linha.className = "linha-carteira linha-expansivel";

    const spanRotulo = document.createElement("span");
    spanRotulo.className = "rotulo-linha";
    spanRotulo.textContent = `[+] ${rotulo}`;

    const spanValor = document.createElement("span");
    spanValor.className = "valor-linha";
    spanValor.textContent = formatarReais(valor);

    linha.appendChild(spanRotulo);
    linha.appendChild(spanValor);
    wrapper.appendChild(linha);

    const detalhe = document.createElement("div");
    detalhe.className = "mini-extrato";
    detalhe.style.display = "none";

    if (lancamentos.length === 0) {
        detalhe.innerHTML = "<p class='mini-extrato-linha vazio'>Nenhum lançamento.</p>";
    } else {
        [...lancamentos]
            .sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""))
            .forEach((l) => {
                const linhaDetalhe = document.createElement("p");
                linhaDetalhe.className = "mini-extrato-linha";
                linhaDetalhe.textContent = `${isoParaBR(l.data)} — ${l.saida || l.descricao || "—"} — ${formatarReais(l.valor)}`;
                detalhe.appendChild(linhaDetalhe);
            });
    }
    wrapper.appendChild(detalhe);

    let aberto = false;
    linha.addEventListener("click", () => {
        aberto = !aberto;
        detalhe.style.display = aberto ? "block" : "none";
        spanRotulo.textContent = `${aberto ? "[-]" : "[+]"} ${rotulo}`;
    });

    return wrapper;
}

function renderizarResumo(lista) {
    let aportado = 0;
    let resgatado = 0;

    lista.forEach((t) => {
        if (typeof t.valor !== "number") return;
        if (t.tipo === "SAIDA") aportado += t.valor;
        else resgatado += t.valor;
    });

    const saldo = aportado - resgatado;
    const cartaoSaldo = document.getElementById("cartao-saldo-investido");

    document.getElementById("total-aportado").textContent = formatarReais(aportado);
    document.getElementById("total-resgatado").textContent = formatarReais(resgatado);
    document.getElementById("total-saldo-investido").textContent = formatarReais(saldo);

    cartaoSaldo.classList.remove("metrica-saldo-pos", "metrica-saldo-neg");
    cartaoSaldo.classList.add(saldo >= 0 ? "metrica-saldo-pos" : "metrica-saldo-neg");
}

function renderizarPorInvestimento(lista) {
    const container = document.getElementById("grade-por-investimento");
    container.innerHTML = "";

    const porInvestimento = {};
    lista.forEach((t) => {
        if (typeof t.valor !== "number") return;
        const nome = (t.investimento || "").trim() || "Investimento não definido";
        if (!porInvestimento[nome]) porInvestimento[nome] = { aportado: 0, resgatado: 0, bancos: new Set(), porDono: {} };
        const grupo = porInvestimento[nome];

        if (t.banco) grupo.bancos.add(t.banco);

        const dono = (t.dono_carteira || "").trim() || SEM_DONO;
        if (!grupo.porDono[dono]) grupo.porDono[dono] = 0;

        if (t.tipo === "SAIDA") {
            grupo.aportado += t.valor;
            grupo.porDono[dono] += t.valor;
        } else {
            grupo.resgatado += t.valor;
            grupo.porDono[dono] -= t.valor;
        }
    });

    const nomes = Object.keys(porInvestimento).sort((a, b) => (porInvestimento[b].aportado - porInvestimento[b].resgatado) - (porInvestimento[a].aportado - porInvestimento[a].resgatado));

    if (nomes.length === 0) {
        container.innerHTML = "<p class='vazio'>Nenhum investimento ainda.</p>";
        return;
    }

    nomes.forEach((nome) => {
        const dados = porInvestimento[nome];
        const saldo = dados.aportado - dados.resgatado;

        const cartao = document.createElement("div");
        cartao.className = "cartao-carteira";

        const nomeEl = document.createElement("div");
        nomeEl.className = "nome-banco";
        nomeEl.textContent = nome;
        cartao.appendChild(nomeEl);

        const bancoLabel = dados.bancos.size > 0 ? [...dados.bancos].join(", ") : "—";
        cartao.appendChild(linhaCarteira("Banco", bancoLabel, "texto"));
        cartao.appendChild(linhaCarteira("Aportado", dados.aportado));
        cartao.appendChild(linhaCarteira("Resgatado", dados.resgatado));
        cartao.appendChild(linhaCarteira("Saldo investido", saldo, "saldo"));

        const donos = Object.keys(dados.porDono).sort((a, b) => dados.porDono[b] - dados.porDono[a]);
        if (donos.length > 1) {
            const separador = document.createElement("div");
            separador.className = "separador-cartao-carteira";
            separador.textContent = "Por dono";
            cartao.appendChild(separador);
            donos.forEach((dono) => cartao.appendChild(linhaCarteira(dono, dados.porDono[dono])));
        }

        container.appendChild(cartao);
    });
}

function renderizarPorDono(lista) {
    const container = document.getElementById("grade-por-dono");
    container.innerHTML = "";

    const porDono = {};
    lista.forEach((t) => {
        if (typeof t.valor !== "number") return;
        const dono = (t.dono_carteira || "").trim() || SEM_DONO;
        if (!porDono[dono]) porDono[dono] = { aportado: 0, resgatado: 0, lancamentos: [] };
        porDono[dono].lancamentos.push(t);
        if (t.tipo === "SAIDA") porDono[dono].aportado += t.valor;
        else porDono[dono].resgatado += t.valor;
    });

    const donos = Object.keys(porDono).sort((a, b) => (porDono[b].aportado - porDono[b].resgatado) - (porDono[a].aportado - porDono[a].resgatado));

    if (donos.length === 0) {
        container.innerHTML = "<p class='vazio'>Nenhum investimento ainda.</p>";
        return;
    }

    donos.forEach((dono) => {
        const dados = porDono[dono];
        const saldo = dados.aportado - dados.resgatado;
        const aportes = dados.lancamentos.filter((t) => t.tipo === "SAIDA");
        const resgates = dados.lancamentos.filter((t) => t.tipo === "ENTRADA");

        const cartao = document.createElement("div");
        cartao.className = "cartao-carteira";

        const nome = document.createElement("div");
        nome.className = "nome-banco";
        nome.textContent = dono;
        cartao.appendChild(nome);

        cartao.appendChild(linhaExpansivel("Aportado", dados.aportado, aportes));
        cartao.appendChild(linhaExpansivel("Resgatado", dados.resgatado, resgates));
        cartao.appendChild(linhaCarteira("Saldo investido", saldo, "saldo"));

        const acoes = document.createElement("div");
        acoes.className = "acoes-cartao-carteira";

        const botaoAportar = document.createElement("button");
        botaoAportar.className = "botao botao-secundario botao-pequeno";
        botaoAportar.textContent = "+ Aportar";
        botaoAportar.addEventListener("click", () => abrirNovoLancamento(prefillParaDono(dono, "SAIDA")));

        const botaoResgatar = document.createElement("button");
        botaoResgatar.className = "botao botao-secundario botao-pequeno";
        botaoResgatar.textContent = "+ Resgatar";
        botaoResgatar.addEventListener("click", () => abrirNovoLancamento(prefillParaDono(dono, "ENTRADA")));

        acoes.appendChild(botaoAportar);
        acoes.appendChild(botaoResgatar);
        cartao.appendChild(acoes);

        container.appendChild(cartao);
    });
}

// Pré-preenchimento do modal de novo lançamento a partir de um card "Por
// dono": sempre preenche o dono; só preenche Investimento/Banco quando esse
// dono tem exatamente 1 investimento (com mais de um, não dá pra adivinhar
// qual — o usuário escolhe na hora via autocomplete).
function prefillParaDono(dono, tipo) {
    const doDono = todosInvestimentos.filter((t) => ((t.dono_carteira || "").trim() || SEM_DONO) === dono);
    const investimentosDoDono = [...new Set(doDono.map((t) => t.investimento).filter(Boolean))];

    const prefill = { tipo, dono_carteira: dono === SEM_DONO ? "" : dono };

    if (investimentosDoDono.length === 1) {
        prefill.investimento = investimentosDoDono[0];
        const doInvestimento = doDono.filter((t) => t.investimento === investimentosDoDono[0]);
        const ultimo = [...doInvestimento].sort((a, b) => (b.criadoEmMs ?? 0) - (a.criadoEmMs ?? 0))[0];
        if (ultimo?.banco) prefill.banco = ultimo.banco;
    }

    return prefill;
}

function renderizarTabela(lista) {
    const corpo = document.querySelector("#tabela-investimentos tbody");
    corpo.innerHTML = "";

    if (lista.length === 0) {
        corpo.innerHTML = "<tr><td colspan='9' class='vazio'>Nenhum lançamento de investimento ainda.</td></tr>";
        return;
    }

    const listaOrdenada = [...lista].sort((a, b) => {
        const resultado = compararValores(a[ordenacaoAtual.chave], b[ordenacaoAtual.chave], ordenacaoAtual.tipo);
        return ordenacaoAtual.direcao === "asc" ? resultado : -resultado;
    });

    listaOrdenada.forEach((transacao) => {
        if (!transacao.data || typeof transacao.valor !== "number") return;

        const ehAporte = transacao.tipo === "SAIDA";
        const classeCor = ehAporte ? "saida" : "entrada";
        const sinal = ehAporte ? "-" : "+";

        const linha = document.createElement("tr");
        linha.appendChild(celulaTexto(isoParaBR(transacao.data)));
        linha.appendChild(celulaTexto(transacao.investimento || "—"));
        linha.appendChild(celulaTexto(transacao.descricao ?? ""));
        linha.appendChild(celulaTexto(transacao.saida ?? ""));
        linha.appendChild(celulaTexto(transacao.dono_carteira || "—"));
        linha.appendChild(celulaTexto(transacao.banco ?? ""));

        const tdTipo = document.createElement("td");
        const seloTipo = document.createElement("span");
        seloTipo.className = `selo-mov ${ehAporte ? "selo-externo" : "selo-interno"}`;
        seloTipo.textContent = ehAporte ? "📥 Aporte" : "📤 Resgate";
        tdTipo.appendChild(seloTipo);
        linha.appendChild(tdTipo);

        const tdValor = document.createElement("td");
        tdValor.className = classeCor;
        const b = document.createElement("b");
        b.textContent = `${sinal} ${formatarReais(transacao.valor)}`;
        tdValor.appendChild(b);
        linha.appendChild(tdValor);

        const tdAcoes = document.createElement("td");
        tdAcoes.className = "col-acoes";
        const wrapperAcoes = document.createElement("div");
        wrapperAcoes.className = "acoes-linha";

        const botaoEditar = document.createElement("button");
        botaoEditar.className = "botao-icone-primario";
        botaoEditar.title = "Editar lançamento";
        botaoEditar.textContent = "✏️";
        botaoEditar.addEventListener("click", () => editarInvestimento(transacao));

        const botaoExcluir = document.createElement("button");
        botaoExcluir.className = "botao-icone-perigo";
        botaoExcluir.title = "Excluir lançamento";
        botaoExcluir.textContent = "🗑";
        botaoExcluir.addEventListener("click", () => excluirInvestimento(transacao));

        wrapperAcoes.appendChild(botaoEditar);
        wrapperAcoes.appendChild(botaoExcluir);
        tdAcoes.appendChild(wrapperAcoes);
        linha.appendChild(tdAcoes);

        corpo.appendChild(linha);
    });
}

async function excluirInvestimento(transacao) {
    const confirmou = await confirmarAcao({
        titulo: "Excluir lançamento?",
        mensagem: `Tem certeza que quer apagar "${transacao.descricao ?? "este lançamento"}" no valor de ${formatarReais(transacao.valor)}? Essa ação não pode ser desfeita.`,
        textoConfirmar: "Excluir",
        textoCancelar: "Cancelar"
    });
    if (!confirmou) return;

    try {
        await excluirTransacaoPorId(usuario, transacao.id);
        mostrarToast("Lançamento excluído.", "sucesso");
        carregarDados();
    } catch (erro) {
        console.error("Erro ao excluir:", erro);
        mostrarToast("Erro ao excluir. Tente novamente.", "erro");
    }
}

function sugestoes() {
    const bancosUsados = todasTransacoes.map((t) => t.banco).filter(Boolean);
    const investimentosUsados = todosInvestimentos.map((t) => t.investimento).filter(Boolean);
    const donosUsados = todosInvestimentos.map((t) => t.dono_carteira).filter(Boolean);
    return {
        bancosSugeridos: mesclarSugestoes(BANCOS_SUGERIDOS, bancosUsados),
        investimentosSugeridos: mesclarSugestoes([], investimentosUsados),
        donosSugeridos: mesclarSugestoes([], donosUsados)
    };
}

async function editarInvestimento(transacao) {
    const dadosEditados = await abrirEditorTransacao(transacao, {
        ...sugestoes(),
        titulo: "Editar lançamento de investimento",
        contextoInvestimento: true
    });
    if (!dadosEditados) return;

    try {
        await atualizarTransacao(usuario, transacao.id, dadosEditados);
        mostrarToast("Lançamento atualizado!", "sucesso");
        carregarDados();
    } catch (erro) {
        console.error("Erro ao atualizar:", erro);
        mostrarToast("Erro ao salvar as alterações. Tente novamente.", "erro");
    }
}

async function abrirNovoLancamento(prefill = {}) {
    const dados = await abrirEditorTransacao(
        { tipo: "SAIDA", ...prefill },
        {
            ...sugestoes(),
            titulo: "Novo lançamento de investimento",
            textoSalvar: "Salvar lançamento",
            contextoInvestimento: true
        }
    );
    if (!dados) return;

    try {
        await criarTransacao(usuario, dados);
        mostrarToast("Lançamento salvo!", "sucesso");
        carregarDados();
    } catch (erro) {
        console.error("Erro ao salvar:", erro);
        mostrarToast("Erro ao salvar. Tente novamente.", "erro");
    }
}

async function carregarDados(forcarAtualizacao = false) {
    try {
        todasTransacoes = await obterTransacoes(usuario, { forcarAtualizacao });
        todosInvestimentos = todasTransacoes.filter(
            (t) => (t.classificacao_saida ?? "").trim().toUpperCase() === CLASSIFICACAO_INVESTIMENTO
        );

        renderizarResumo(todosInvestimentos);
        renderizarPorInvestimento(todosInvestimentos);
        renderizarPorDono(todosInvestimentos);
        renderizarTabela(todosInvestimentos);

        if (forcarAtualizacao) mostrarToast("Dados atualizados.", "sucesso");
    } catch (erro) {
        console.error("Erro ao buscar transações:", erro);
        document.querySelector("#tabela-investimentos tbody").innerHTML =
            "<tr><td colspan='9' class='vazio'>Erro ao carregar dados. Verifique o console (F12) para detalhes.</td></tr>";
    }
}

document.getElementById("btn-novo-investimento").addEventListener("click", () => abrirNovoLancamento());
document.getElementById("btn-atualizar").addEventListener("click", () => carregarDados(true));

carregarDados();
