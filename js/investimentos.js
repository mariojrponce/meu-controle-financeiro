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
// "Onde está aplicado": o campo `banco` de um aporte é a conta de ONDE O
// DINHEIRO SAIU (ex: BRADESCO), pra o saldo do Extrato/Dashboard bater. Mas o
// dinheiro pode estar aplicado em outro lugar (ex: MERCADO BITCOIN, que só
// aparece no Detalhe). Por isso cada lançamento ganha um "banco aplicado",
// descoberto nesta ordem (ver calcularBancosAplicados):
//   1) campo `banco_investimento`, se o usuário preencheu no modal;
//   2) banco predominante do mesmo investimento (todos os lançamentos de
//      "RENDA FIXA" ficam no mesmo lugar, mesmo um resgate com Detalhe "UBER");
//   3) nome de banco encontrado no Detalhe/Descrição (ex: "BRADESCO
//      INVESTIMENTO" → BRADESCO, "MERCADO BITCOIN" → MERCADO BITCOIN);
//   4) o próprio `banco` (conta de origem).
// O filtro "Onde está aplicado" (chips abaixo dos big numbers) usa esse valor,
// então o Saldo investido filtrado é o que deve bater com o app do banco
// (principal aportado − resgatado, sem rendimento).
//
// obterTransacoes() não tem filtro de período nenhum (só por userId), então
// esta tela já busca o histórico inteiro por padrão — sem recorte de data.
import { exigirLogin } from "./auth-guard.js";
import { renderizarNav } from "./nav.js";
import { mostrarToast, confirmarAcao } from "./ui.js";
import { BANCOS_SUGERIDOS, mesclarSugestoes } from "./dados-comuns.js";
import { isoParaBR, brParaISO, normalizarDataDigitada, formatarReais, ligarCampoDataInteligente } from "./utils.js";
import { ativarOrdenacao, compararValores } from "./tabela-ordenavel.js";
import { criarSeletorMultiplo } from "./combobox.js";
import { obterCorBanco } from "./cores-bancos.js";
import { obterTransacoes, criarTransacao, excluirTransacaoPorId, atualizarTransacao } from "./dados-carteira.js";
import { abrirEditorTransacao } from "./editor-transacao.js";

const CLASSIFICACAO_INVESTIMENTO = "INVESTIMENTO";
const SEM_DONO = "Sem dono definido";
const SEM_INVESTIMENTO = "Investimento não definido";
const SEM_BANCO = "Banco não definido";
// Lugares onde se investe que não são "banco de conta corrente" e por isso
// não estão em BANCOS_SUGERIDOS — entram na detecção pelo Detalhe/Descrição.
const LOCAIS_INVESTIMENTO_EXTRAS = ["MERCADO BITCOIN"];
const CHAVE_PREFERENCIA_APLICADO = "investimentos_banco_aplicado";

const usuario = await exigirLogin();
renderizarNav("investimentos", usuario.email);

let todasTransacoes = [];
let todosInvestimentos = [];
let bancoAplicadoPorId = new Map();
let bancoAplicadoPorInvestimento = new Map();
let bancoAplicadoSelecionado = lerPreferenciaAplicado();
let ordenacaoAtual = { chave: "data", direcao: "desc", tipo: "texto" };

ativarOrdenacao(document.querySelector("#tabela-investimentos thead"), (chave, direcao, tipo) => {
    ordenacaoAtual = { chave, direcao, tipo };
    aplicarFiltrosTabela();
});

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function lerPreferenciaAplicado() {
    try { return localStorage.getItem(CHAVE_PREFERENCIA_APLICADO) ?? ""; } catch { return ""; }
}

function salvarPreferenciaAplicado(valor) {
    try { localStorage.setItem(CHAVE_PREFERENCIA_APLICADO, valor); } catch { /* não é grave */ }
}

function normalizarTexto(texto) {
    return (texto ?? "")
        .toString()
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
}

function escaparRegex(texto) {
    return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function debounce(fn, atrasoMs) {
    let temporizador;
    return (...args) => {
        clearTimeout(temporizador);
        temporizador = setTimeout(() => fn(...args), atrasoMs);
    };
}

function nomeInvestimento(t) {
    return (t.investimento || "").trim() || SEM_INVESTIMENTO;
}

function nomeDono(t) {
    return (t.dono_carteira || "").trim() || SEM_DONO;
}

function bancoAplicado(t) {
    return bancoAplicadoPorId.get(t.id) || (t.banco || "").trim() || SEM_BANCO;
}

function somarAportesResgates(lista) {
    let aportado = 0;
    let resgatado = 0;
    lista.forEach((t) => {
        if (typeof t.valor !== "number") return;
        if (t.tipo === "SAIDA") aportado += t.valor;
        else resgatado += t.valor;
    });
    return { aportado, resgatado, saldo: aportado - resgatado };
}

function celulaTexto(texto) {
    const td = document.createElement("td");
    td.textContent = texto;
    return td;
}

// ---------------------------------------------------------------------------
// "Onde está aplicado" — descobre o banco de cada lançamento
// ---------------------------------------------------------------------------

function candidatosDeBanco() {
    const usados = todasTransacoes.map((t) => t.banco);
    const aplicadosExplicitos = todosInvestimentos.map((t) => t.banco_investimento);
    const todos = [...BANCOS_SUGERIDOS, ...LOCAIS_INVESTIMENTO_EXTRAS, ...usados, ...aplicadosExplicitos]
        .map((b) => (b ?? "").toString().trim().toUpperCase())
        .filter(Boolean);
    // Mais longos primeiro: "NUBANK CAIXINHA" ganha de "NUBANK".
    return [...new Set(todos)].sort((a, b) => b.length - a.length);
}

// Procura um nome de banco inteiro (não pedaço de palavra: "BB" não casa com
// "HOBBY", "INTER" não casa com "INTERNO") no Detalhe e depois na Descrição.
function detectarBancoNoTexto(t, candidatos) {
    for (const texto of [t.saida, t.descricao]) {
        const alvo = normalizarTexto(texto);
        if (!alvo) continue;
        for (const candidato of candidatos) {
            const padrao = new RegExp(`(^|[^A-Z0-9])${escaparRegex(normalizarTexto(candidato))}([^A-Z0-9]|$)`);
            if (padrao.test(alvo)) return candidato;
        }
    }
    return "";
}

function calcularBancosAplicados() {
    const candidatos = candidatosDeBanco();
    const pistaPorId = new Map();
    const votosPorInvestimento = new Map();

    todosInvestimentos.forEach((t) => {
        const explicito = (t.banco_investimento || "").trim().toUpperCase();
        const pista = explicito || detectarBancoNoTexto(t, candidatos);
        pistaPorId.set(t.id, { explicito, pista });

        const investimento = (t.investimento || "").trim();
        if (!investimento || !pista) return;
        if (!votosPorInvestimento.has(investimento)) votosPorInvestimento.set(investimento, new Map());
        const votos = votosPorInvestimento.get(investimento);
        const atual = votos.get(pista) ?? { quantidade: 0, ultimaData: "" };
        atual.quantidade += 1;
        if ((t.data ?? "") > atual.ultimaData) atual.ultimaData = t.data ?? "";
        votos.set(pista, atual);
    });

    bancoAplicadoPorInvestimento = new Map();
    votosPorInvestimento.forEach((votos, investimento) => {
        const [vencedor] = [...votos.entries()].sort((a, b) =>
            (b[1].quantidade - a[1].quantidade) || b[1].ultimaData.localeCompare(a[1].ultimaData)
        );
        if (vencedor) bancoAplicadoPorInvestimento.set(investimento, vencedor[0]);
    });

    bancoAplicadoPorId = new Map();
    todosInvestimentos.forEach((t) => {
        const { explicito, pista } = pistaPorId.get(t.id);
        const doInvestimento = bancoAplicadoPorInvestimento.get((t.investimento || "").trim());
        const final = explicito || doInvestimento || pista || (t.banco || "").trim().toUpperCase() || SEM_BANCO;
        bancoAplicadoPorId.set(t.id, final);
    });
}

// ---------------------------------------------------------------------------
// Filtro "Onde está aplicado" (chips abaixo dos big numbers)
// ---------------------------------------------------------------------------

function listaEscopo() {
    if (!bancoAplicadoSelecionado) return todosInvestimentos;
    return todosInvestimentos.filter((t) => bancoAplicado(t) === bancoAplicadoSelecionado);
}

function criarChip(rotulo, valor, ativo, cor, aoClicar) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `chip-banco${ativo ? " ativo" : ""}`;
    chip.setAttribute("aria-pressed", ativo ? "true" : "false");

    if (cor) {
        const bolinha = document.createElement("span");
        bolinha.className = "chip-bolinha";
        bolinha.style.background = cor;
        chip.appendChild(bolinha);
    }

    const nome = document.createElement("span");
    nome.textContent = rotulo;
    chip.appendChild(nome);

    const spanValor = document.createElement("span");
    spanValor.className = "chip-valor";
    spanValor.textContent = formatarReais(valor);
    chip.appendChild(spanValor);

    chip.addEventListener("click", aoClicar);
    return chip;
}

function renderizarChipsAplicado() {
    const container = document.getElementById("chips-banco-aplicado");
    container.innerHTML = "";

    const porBanco = new Map();
    todosInvestimentos.forEach((t) => {
        const banco = bancoAplicado(t);
        if (!porBanco.has(banco)) porBanco.set(banco, []);
        porBanco.get(banco).push(t);
    });

    if (bancoAplicadoSelecionado && !porBanco.has(bancoAplicadoSelecionado)) {
        bancoAplicadoSelecionado = "";
        salvarPreferenciaAplicado("");
    }

    const selecionar = (valor) => {
        bancoAplicadoSelecionado = valor;
        salvarPreferenciaAplicado(valor);
        renderizarTudo();
    };

    const total = somarAportesResgates(todosInvestimentos).saldo;
    container.appendChild(criarChip("Todos", total, bancoAplicadoSelecionado === "", null, () => selecionar("")));

    [...porBanco.entries()]
        .map(([banco, lista]) => ({ banco, saldo: somarAportesResgates(lista).saldo }))
        .sort((a, b) => b.saldo - a.saldo)
        .forEach(({ banco, saldo }) => {
            container.appendChild(criarChip(banco, saldo, bancoAplicadoSelecionado === banco, obterCorBanco(banco), () => selecionar(banco)));
        });

    const dica = document.getElementById("dica-filtro-aplicado");
    dica.textContent = bancoAplicadoSelecionado
        ? `Mostrando só o que está aplicado em ${bancoAplicadoSelecionado}. O Saldo investido abaixo é o principal (aportes − resgates) e deve bater com o app do banco, sem contar rendimento.`
        : "Escolha um banco para ver só o que está investido nele. O Saldo investido passa a ser o valor que deve bater com o app do banco (sem contar rendimento).";
}

// ---------------------------------------------------------------------------
// Big numbers e cards
// ---------------------------------------------------------------------------

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
    const { aportado, resgatado, saldo } = somarAportesResgates(lista);
    const cartaoSaldo = document.getElementById("cartao-saldo-investido");

    document.getElementById("total-aportado").textContent = formatarReais(aportado);
    document.getElementById("total-resgatado").textContent = formatarReais(resgatado);
    document.getElementById("total-saldo-investido").textContent = formatarReais(saldo);
    cartaoSaldo.querySelector(".rotulo").textContent = bancoAplicadoSelecionado
        ? `Saldo investido · ${bancoAplicadoSelecionado}`
        : "Saldo investido";

    cartaoSaldo.classList.remove("metrica-saldo-pos", "metrica-saldo-neg");
    cartaoSaldo.classList.add(saldo >= 0 ? "metrica-saldo-pos" : "metrica-saldo-neg");
}

function renderizarPorInvestimento(lista) {
    const container = document.getElementById("grade-por-investimento");
    container.innerHTML = "";

    const porInvestimento = {};
    lista.forEach((t) => {
        if (typeof t.valor !== "number") return;
        const nome = nomeInvestimento(t);
        if (!porInvestimento[nome]) porInvestimento[nome] = { aportado: 0, resgatado: 0, aplicados: new Set(), origens: new Set(), porDono: {} };
        const grupo = porInvestimento[nome];

        grupo.aplicados.add(bancoAplicado(t));
        if (t.banco) grupo.origens.add(t.banco);

        const dono = nomeDono(t);
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

        const aplicadoLabel = [...dados.aplicados].join(", ") || "—";
        const origemLabel = [...dados.origens].join(", ") || "—";
        cartao.appendChild(linhaCarteira("Aplicado em", aplicadoLabel, "texto"));
        if (origemLabel !== aplicadoLabel) cartao.appendChild(linhaCarteira("Conta de origem", origemLabel, "texto"));
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
        const dono = nomeDono(t);
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
// qual — o usuário escolhe na hora via autocomplete). Respeita o filtro
// "Onde está aplicado": com um banco escolhido, só olha os investimentos dele.
function prefillParaDono(dono, tipo) {
    const doDono = listaEscopo().filter((t) => nomeDono(t) === dono);
    const investimentosDoDono = [...new Set(doDono.map((t) => t.investimento).filter(Boolean))];

    const prefill = { tipo, dono_carteira: dono === SEM_DONO ? "" : dono };
    if (bancoAplicadoSelecionado && bancoAplicadoSelecionado !== SEM_BANCO) prefill.banco_investimento = bancoAplicadoSelecionado;

    if (investimentosDoDono.length === 1) {
        prefill.investimento = investimentosDoDono[0];
        const doInvestimento = doDono.filter((t) => t.investimento === investimentosDoDono[0]);
        const ultimo = [...doInvestimento].sort((a, b) => (b.criadoEmMs ?? 0) - (a.criadoEmMs ?? 0))[0];
        if (ultimo?.banco) prefill.banco = ultimo.banco;
        if (ultimo) prefill.banco_investimento = bancoAplicado(ultimo);
    }

    return prefill;
}

// ---------------------------------------------------------------------------
// Filtros da tabela de movimentações
// ---------------------------------------------------------------------------

const campoInicio = document.getElementById("filtro-inv-inicio");
const campoFim = document.getElementById("filtro-inv-fim");
const campoDescricao = document.getElementById("filtro-inv-descricao");
const campoDetalhe = document.getElementById("filtro-inv-detalhe");
const campoTipo = document.getElementById("filtro-inv-tipo");

const seletorInvestimento = criarSeletorMultiplo({
    container: document.getElementById("filtro-inv-investimento"),
    opcoes: [],
    rotuloTodos: "Todos os investimentos",
    aoMudar: () => aplicarFiltrosTabela()
});

const seletorDono = criarSeletorMultiplo({
    container: document.getElementById("filtro-inv-dono"),
    opcoes: [],
    rotuloTodos: "Todos os donos",
    aoMudar: () => aplicarFiltrosTabela()
});

const seletorBanco = criarSeletorMultiplo({
    container: document.getElementById("filtro-inv-banco"),
    opcoes: [],
    rotuloTodos: "Todos os bancos",
    aoMudar: () => aplicarFiltrosTabela()
});

ligarCampoDataInteligente(campoInicio);
ligarCampoDataInteligente(campoFim);
// Registrados depois do ligarCampoDataInteligente: o blur dele normaliza
// ("14/9" → "14/09/2026") antes deste filtrar.
[campoInicio, campoFim].forEach((campo) => {
    campo.addEventListener("blur", () => aplicarFiltrosTabela());
    campo.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter") campo.blur();
    });
    campo.addEventListener("input", debounce(() => {
        if (campo.value.trim() === "" || normalizarDataDigitada(campo.value)?.length === 10 && campo.value.length === 10) aplicarFiltrosTabela();
    }, 300));
});
campoDescricao.addEventListener("input", debounce(() => aplicarFiltrosTabela(), 250));
campoDetalhe.addEventListener("input", debounce(() => aplicarFiltrosTabela(), 250));
campoTipo.addEventListener("change", () => aplicarFiltrosTabela());

document.getElementById("btn-limpar-filtros-inv").addEventListener("click", () => {
    campoInicio.value = "";
    campoFim.value = "";
    campoDescricao.value = "";
    campoDetalhe.value = "";
    campoTipo.value = "";
    [campoInicio, campoFim].forEach((c) => c.classList.remove("campo-invalido"));
    seletorInvestimento.definirSelecionados([]);
    seletorDono.definirSelecionados([]);
    seletorBanco.definirSelecionados([]);
    aplicarFiltrosTabela();
});

function dataDoCampoISO(campo) {
    const texto = campo.value.trim();
    if (!texto) return null;
    const normalizada = normalizarDataDigitada(texto);
    return normalizada ? brParaISO(normalizada) : null;
}

function ordenarPtBR(valores) {
    return [...new Set(valores)].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// As opções de cada seletor vêm só do que está no escopo do filtro "Onde
// está aplicado" (se escolheu MERCADO BITCOIN, não aparece CDB BRADESCO).
// O Banco lista tanto a conta de origem quanto onde está aplicado — assim
// dá pra filtrar "MERCADO BITCOIN" mesmo o lançamento tendo Banco BRADESCO.
function atualizarOpcoesFiltros(lista) {
    seletorInvestimento.definirOpcoes(ordenarPtBR(lista.map(nomeInvestimento)));
    seletorDono.definirOpcoes(ordenarPtBR(lista.map(nomeDono)));
    seletorBanco.definirOpcoes(ordenarPtBR(lista.flatMap((t) => [(t.banco || "").trim(), bancoAplicado(t)]).filter(Boolean)));
}

function filtrarTabela(lista) {
    const inicio = dataDoCampoISO(campoInicio);
    const fim = dataDoCampoISO(campoFim);
    const investimentos = seletorInvestimento.obterSelecionados();
    const donos = seletorDono.obterSelecionados();
    const bancos = seletorBanco.obterSelecionados();
    const termoDescricao = normalizarTexto(campoDescricao.value);
    const termoDetalhe = normalizarTexto(campoDetalhe.value);
    const tipo = campoTipo.value;

    return lista.filter((t) => {
        const data = t.data ?? "";
        if (inicio && data < inicio) return false;
        if (fim && data > fim) return false;
        if (investimentos.length > 0 && !investimentos.includes(nomeInvestimento(t))) return false;
        if (donos.length > 0 && !donos.includes(nomeDono(t))) return false;
        if (bancos.length > 0 && !bancos.includes((t.banco || "").trim()) && !bancos.includes(bancoAplicado(t))) return false;
        if (termoDescricao && !normalizarTexto(t.descricao).includes(termoDescricao)) return false;
        if (termoDetalhe && !normalizarTexto(t.saida).includes(termoDetalhe)) return false;
        if (tipo && t.tipo !== tipo) return false;
        return true;
    });
}

function aplicarFiltrosTabela() {
    const escopo = listaEscopo();
    const filtrada = filtrarTabela(escopo);

    const { aportado, resgatado, saldo } = somarAportesResgates(filtrada);
    const quantidade = filtrada.length;
    document.getElementById("resumo-filtro-inv").textContent =
        `${quantidade} ${quantidade === 1 ? "movimentação" : "movimentações"} · Aportes ${formatarReais(aportado)} · Resgates ${formatarReais(resgatado)} · Líquido ${formatarReais(saldo)}`;

    renderizarTabela(filtrada, escopo.length > 0);
}

function renderizarTabela(lista, haDadosSemFiltro = true) {
    const corpo = document.querySelector("#tabela-investimentos tbody");
    corpo.innerHTML = "";

    if (lista.length === 0) {
        const mensagem = haDadosSemFiltro ? "Nenhuma movimentação com esses filtros." : "Nenhum lançamento de investimento ainda.";
        corpo.innerHTML = `<tr><td colspan='9' class='vazio'>${mensagem}</td></tr>`;
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

        const tdBanco = celulaTexto(transacao.banco ?? "");
        const aplicado = bancoAplicado(transacao);
        if (aplicado && aplicado !== (transacao.banco ?? "").trim()) {
            const sub = document.createElement("span");
            sub.className = "subtexto-aplicado";
            sub.textContent = `aplicado em ${aplicado}`;
            tdBanco.appendChild(sub);
        }
        linha.appendChild(tdBanco);

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

// ---------------------------------------------------------------------------
// Ações (novo / editar / excluir)
// ---------------------------------------------------------------------------

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
    const aplicadosUsados = [...bancoAplicadoPorId.values()].filter((b) => b && b !== SEM_BANCO);
    return {
        bancosSugeridos: mesclarSugestoes(BANCOS_SUGERIDOS, bancosUsados),
        investimentosSugeridos: mesclarSugestoes([], investimentosUsados),
        donosSugeridos: mesclarSugestoes([], donosUsados),
        aplicadosSugeridos: mesclarSugestoes([...BANCOS_SUGERIDOS, ...LOCAIS_INVESTIMENTO_EXTRAS], aplicadosUsados)
    };
}

async function editarInvestimento(transacao) {
    // Mostra no modal onde o sistema acha que está aplicado; se o usuário
    // salvar, esse valor passa a ficar gravado (e pode ser corrigido ali).
    const aplicado = bancoAplicado(transacao);
    const dadosEditados = await abrirEditorTransacao(
        { ...transacao, banco_investimento: transacao.banco_investimento || (aplicado !== SEM_BANCO ? aplicado : "") },
        {
            ...sugestoes(),
            titulo: "Editar lançamento de investimento",
            contextoInvestimento: true
        }
    );
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
    const inicial = { tipo: "SAIDA", ...prefill };
    if (!inicial.banco_investimento && bancoAplicadoSelecionado && bancoAplicadoSelecionado !== SEM_BANCO) {
        inicial.banco_investimento = bancoAplicadoSelecionado;
    }

    const dados = await abrirEditorTransacao(inicial, {
        ...sugestoes(),
        titulo: "Novo lançamento de investimento",
        textoSalvar: "Salvar lançamento",
        contextoInvestimento: true
    });
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

// ---------------------------------------------------------------------------
// Carga e renderização
// ---------------------------------------------------------------------------

function renderizarTudo() {
    renderizarChipsAplicado();
    const escopo = listaEscopo();
    renderizarResumo(escopo);
    renderizarPorInvestimento(escopo);
    renderizarPorDono(escopo);
    atualizarOpcoesFiltros(escopo);
    aplicarFiltrosTabela();
}

async function carregarDados(forcarAtualizacao = false) {
    try {
        todasTransacoes = await obterTransacoes(usuario, { forcarAtualizacao });
        todosInvestimentos = todasTransacoes.filter(
            (t) => (t.classificacao_saida ?? "").trim().toUpperCase() === CLASSIFICACAO_INVESTIMENTO
        );

        calcularBancosAplicados();
        renderizarTudo();

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
