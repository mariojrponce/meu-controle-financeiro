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
import { exigirLogin } from "./auth-guard.js";
import { renderizarNav } from "./nav.js";
import { mostrarToast, confirmarAcao } from "./ui.js";
import { BANCOS_SUGERIDOS, mesclarSugestoes, normalizarNomeBanco } from "./dados-comuns.js";
import { brParaISO, isoParaBR, normalizarDataDigitada, ligarCampoDataInteligente, formatarReais } from "./utils.js";
import { criarComboboxTexto } from "./combobox.js";
import { ativarOrdenacao, compararValores } from "./tabela-ordenavel.js";
import { obterTransacoes, criarTransacao, excluirTransacaoPorId, atualizarTransacao } from "./dados-carteira.js";
import { abrirEditorTransacao } from "./editor-transacao.js";

const CLASSIFICACAO_INVESTIMENTO = "INVESTIMENTO";

const usuario = await exigirLogin();
renderizarNav("investimentos", usuario.email);

const campoData = document.getElementById("inv-data");
ligarCampoDataInteligente(campoData);

const campoInvestimento = document.getElementById("inv-investimento");
const campoDono = document.getElementById("inv-dono");
const campoBanco = document.getElementById("inv-banco");
const comboboxInvestimento = criarComboboxTexto(campoInvestimento, []);
const comboboxDono = criarComboboxTexto(campoDono, []);
const comboboxBanco = criarComboboxTexto(campoBanco, BANCOS_SUGERIDOS);

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

        const dono = (t.dono_carteira || "").trim() || "Sem dono definido";
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
            separador.style.cssText = "margin-top:8px; padding-top:8px; border-top:1px dashed var(--cor-borda); font-size:0.75rem; color:var(--cor-texto-suave); font-weight:700; text-transform:uppercase; letter-spacing:0.03em;";
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
        const dono = (t.dono_carteira || "").trim() || "Sem dono definido";
        if (!porDono[dono]) porDono[dono] = { aportado: 0, resgatado: 0 };
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

        const cartao = document.createElement("div");
        cartao.className = "cartao-carteira";

        const nome = document.createElement("div");
        nome.className = "nome-banco";
        nome.textContent = dono;
        cartao.appendChild(nome);

        cartao.appendChild(linhaCarteira("Aportado", dados.aportado));
        cartao.appendChild(linhaCarteira("Resgatado", dados.resgatado));
        cartao.appendChild(linhaCarteira("Saldo investido", saldo, "saldo"));

        container.appendChild(cartao);
    });
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

async function editarInvestimento(transacao) {
    const bancosUsados = todasTransacoes.map(t => t.banco).filter(Boolean);
    const investimentosUsados = todosInvestimentos.map(t => t.investimento).filter(Boolean);
    const dadosEditados = await abrirEditorTransacao(transacao, {
        bancosSugeridos: mesclarSugestoes(BANCOS_SUGERIDOS, bancosUsados),
        classificacoesSugeridas: [CLASSIFICACAO_INVESTIMENTO],
        investimentosSugeridos: mesclarSugestoes([], investimentosUsados),
        titulo: "Editar lançamento de investimento",
        mostrarDono: true,
        mostrarInvestimento: true
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

async function carregarDados() {
    try {
        todasTransacoes = await obterTransacoes(usuario);
        todosInvestimentos = todasTransacoes.filter(
            (t) => (t.classificacao_saida ?? "").trim().toUpperCase() === CLASSIFICACAO_INVESTIMENTO
        );

        const bancosUsados = todasTransacoes.map(t => t.banco).filter(Boolean);
        comboboxBanco.atualizarOpcoes(mesclarSugestoes(BANCOS_SUGERIDOS, bancosUsados));

        const donosUsados = [...new Set(todosInvestimentos.map(t => t.dono_carteira).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
        comboboxDono.atualizarOpcoes(donosUsados);

        const investimentosUsados = [...new Set(todosInvestimentos.map(t => t.investimento).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
        comboboxInvestimento.atualizarOpcoes(investimentosUsados);

        renderizarResumo(todosInvestimentos);
        renderizarPorInvestimento(todosInvestimentos);
        renderizarPorDono(todosInvestimentos);
        renderizarTabela(todosInvestimentos);
    } catch (erro) {
        console.error("Erro ao buscar transações:", erro);
        document.querySelector("#tabela-investimentos tbody").innerHTML =
            "<tr><td colspan='9' class='vazio'>Erro ao carregar dados. Verifique o console (F12) para detalhes.</td></tr>";
    }
}

carregarDados();

const formulario = document.getElementById("form-investimento");

formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    const dataNormalizada = normalizarDataDigitada(campoData.value);
    if (dataNormalizada) campoData.value = dataNormalizada;

    const botaoSalvar = formulario.querySelector("button");

    const valor = parseFloat(document.getElementById("inv-valor").value);
    const dataISO = brParaISO(campoData.value);
    const tipo = document.getElementById("inv-tipo").value;
    const investimento = campoInvestimento.value.trim().toUpperCase();
    const dono_carteira = campoDono.value.trim().toUpperCase();
    const banco = normalizarNomeBanco(campoBanco.value.trim().toUpperCase());
    const descricao = document.getElementById("inv-descricao").value.trim().toUpperCase();
    const saida = document.getElementById("inv-detalhe").value.trim().toUpperCase();

    if (!valor || valor <= 0 || !investimento || !dono_carteira || !banco || !descricao) {
        mostrarToast("Preencha todos os campos obrigatórios.", "erro");
        return;
    }
    if (!dataISO) {
        campoData.classList.add("campo-invalido");
        mostrarToast("Data inválida. Use dd/mm/aaaa.", "erro");
        return;
    }

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    try {
        await criarTransacao(usuario, {
            valor, data: dataISO, descricao, saida, banco, investimento, dono_carteira,
            tipo, tipo_mov: "EXTERNO", classificacao_saida: CLASSIFICACAO_INVESTIMENTO
        });

        mostrarToast("Lançamento salvo!", "sucesso");
        formulario.reset();
        carregarDados();
    } catch (erro) {
        console.error("Erro ao salvar: ", erro);
        mostrarToast("Erro ao salvar. Tente novamente.", "erro");
    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar lançamento";
    }
});
