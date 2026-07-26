import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { exigirLogin } from "./auth-guard.js";
import { renderizarNav } from "./nav.js";
import {
    formatarMoeda, isoParaBR, brParaISO, normalizarDataDigitada,
    ligarCampoDataInteligente, intervaloMesAtual, intervaloParaAnoMes
} from "./utils.js";
import { criarSeletorMultiplo } from "./combobox.js";
import { obterCorBanco } from "./cores-bancos.js";

const NOME_COLECAO = "carteira";
const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const usuario = await exigirLogin();
renderizarNav("dashboard", usuario.email);

const campoAno = document.getElementById("filtro-ano");
const campoMes = document.getElementById("filtro-mes");
const campoInicio = document.getElementById("filtro-data-inicio");
const campoFim = document.getElementById("filtro-data-fim");
const campoMov = document.getElementById("filtro-movimentacao");

ligarCampoDataInteligente(campoInicio);
ligarCampoDataInteligente(campoFim);

const seletorBanco = criarSeletorMultiplo({
    container: document.getElementById("filtro-banco"),
    opcoes: [],
    rotuloTodos: "Todos os bancos",
    aoMudar: aplicarFiltros
});

let todasTransacoes = [];

function popularSeletorAno(anoSelecionado) {
    const anoAtual = new Date().getFullYear();
    const anosDosDados = todasTransacoes.map(t => Number((t.data ?? "").slice(0, 4))).filter(Boolean);
    const anos = new Set([anoAtual, ...anosDosDados]);
    const listaOrdenada = Array.from(anos).sort((a, b) => b - a);

    campoAno.innerHTML = "";
    listaOrdenada.forEach((ano) => {
        const opcao = document.createElement("option");
        opcao.value = String(ano);
        opcao.textContent = String(ano);
        campoAno.appendChild(opcao);
    });
    campoAno.value = String(anoSelecionado);
}

function aplicarAnoMesNosCampos() {
    const { inicioISO, fimISO } = intervaloParaAnoMes(campoAno.value, campoMes.value);
    campoInicio.value = isoParaBR(inicioISO);
    campoFim.value = isoParaBR(fimISO);
}

campoAno.addEventListener("change", () => { aplicarAnoMesNosCampos(); aplicarFiltros(); });
campoMes.addEventListener("change", () => { aplicarAnoMesNosCampos(); aplicarFiltros(); });
campoMov.addEventListener("change", aplicarFiltros);
document.getElementById("btn-filtrar").addEventListener("click", aplicarFiltros);

document.getElementById("btn-limpar").addEventListener("click", () => {
    const { ano, mes } = intervaloMesAtual();
    campoAno.value = String(ano);
    campoMes.value = String(mes).padStart(2, "0");
    aplicarAnoMesNosCampos();
    seletorBanco.definirSelecionados([]);
    campoMov.value = "";
    aplicarFiltros();
});

function rotuloDoPeriodo(inicioISO, fimISO) {
    if (!inicioISO || !fimISO) return "";
    const [anoI, mesI] = inicioISO.split("-");
    const [anoF, mesF] = fimISO.split("-");
    if (anoI === anoF && mesI === mesF) {
        const nomeMes = NOMES_MES[Number(mesI) - 1];
        const nomeCapitalizado = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
        return `${nomeCapitalizado}/${anoI.slice(2)}`;
    }
    return `${isoParaBR(inicioISO)} a ${isoParaBR(fimISO)}`;
}

function linhaCarteira(rotulo, valor, classeExtra = "") {
    const linha = document.createElement("div");
    linha.className = `linha-carteira ${classeExtra}`;

    const spanRotulo = document.createElement("span");
    spanRotulo.className = "rotulo-linha";
    spanRotulo.textContent = rotulo;

    const spanValor = document.createElement("span");
    spanValor.className = "valor-linha";
    spanValor.textContent = `R$ ${formatarMoeda(valor)}`;
    if (classeExtra === "saldo") {
        spanValor.classList.add(valor >= 0 ? "valor-positivo" : "valor-negativo");
    }

    linha.appendChild(spanRotulo);
    linha.appendChild(spanValor);
    return linha;
}

function renderizarCarteiras(porBanco) {
    const container = document.getElementById("grade-carteiras");
    container.innerHTML = "";

    const bancos = Object.keys(porBanco).sort((a, b) => porBanco[b].saldo - porBanco[a].saldo);

    if (bancos.length === 0) {
        container.innerHTML = "<p class='vazio'>Nenhuma transação neste período.</p>";
        return;
    }

    bancos.forEach((banco) => {
        const dados = porBanco[banco];
        const cor = obterCorBanco(banco);

        const cartao = document.createElement("div");
        cartao.className = "cartao-carteira";
        cartao.style.borderTopColor = cor;

        const nome = document.createElement("div");
        nome.className = "nome-banco";

        const ponto = document.createElement("span");
        ponto.className = "ponto-banco";
        ponto.style.background = cor;

        nome.appendChild(ponto);
        nome.appendChild(document.createTextNode(banco));
        cartao.appendChild(nome);

        cartao.appendChild(linhaCarteira("Entradas", dados.entradas));
        cartao.appendChild(linhaCarteira("Saídas", dados.saidas));
        cartao.appendChild(linhaCarteira("Saldo", dados.saldo, "saldo"));

        container.appendChild(cartao);
    });
}

function renderizarListaBarras(idContainer, dados, textoVazio) {
    const container = document.getElementById(idContainer);
    container.innerHTML = "";

    const itens = Object.entries(dados).sort((a, b) => b[1] - a[1]);

    if (itens.length === 0) {
        container.innerHTML = `<p class="vazio">${textoVazio}</p>`;
        return;
    }

    const maiorValor = itens[0][1];

    itens.forEach(([nome, valor]) => {
        const percentual = maiorValor > 0 ? Math.round((valor / maiorValor) * 100) : 0;

        const item = document.createElement("div");
        item.className = "item-barra";

        const cabecalho = document.createElement("div");
        cabecalho.className = "cabecalho-barra";

        const spanNome = document.createElement("span");
        spanNome.textContent = nome;

        const spanValor = document.createElement("span");
        spanValor.textContent = `R$ ${formatarMoeda(valor)}`;

        cabecalho.appendChild(spanNome);
        cabecalho.appendChild(spanValor);

        const trilha = document.createElement("div");
        trilha.className = "trilha-barra";
        const preenchimento = document.createElement("div");
        preenchimento.className = "preenchimento-barra";
        preenchimento.style.width = `${percentual}%`;
        trilha.appendChild(preenchimento);

        item.appendChild(cabecalho);
        item.appendChild(trilha);
        container.appendChild(item);
    });
}

function aplicarFiltros() {
    const dataInicioISO = brParaISO(normalizarDataDigitada(campoInicio.value) ?? "");
    const dataFimISO = brParaISO(normalizarDataDigitada(campoFim.value) ?? "");
    const bancosFiltro = seletorBanco.obterSelecionados();
    const movFiltro = campoMov.value;

    let lista = todasTransacoes;
    if (dataInicioISO) lista = lista.filter(t => t.data >= dataInicioISO);
    if (dataFimISO) lista = lista.filter(t => t.data <= dataFimISO);
    if (bancosFiltro.length > 0) lista = lista.filter(t => bancosFiltro.includes(t.banco));
    if (movFiltro !== "") lista = lista.filter(t => t.tipo_mov === movFiltro);

    let saldoGeral = 0;
    let entradasPeriodo = 0;
    let saidasPeriodo = 0;
    const porBanco = {};
    const gastoPorClassificacao = {};
    const entradaPorClassificacao = {};

    lista.forEach((t) => {
        if (typeof t.valor !== "number" || !t.banco) return;

        if (!porBanco[t.banco]) porBanco[t.banco] = { saldo: 0, entradas: 0, saidas: 0 };

        if (t.tipo === "ENTRADA") {
            porBanco[t.banco].entradas += t.valor;
            porBanco[t.banco].saldo += t.valor;
            saldoGeral += t.valor;
            entradasPeriodo += t.valor;
            const chaveEntrada = t.classificacao_saida || "SEM CLASSIFICAÇÃO";
            entradaPorClassificacao[chaveEntrada] = (entradaPorClassificacao[chaveEntrada] ?? 0) + t.valor;
        } else {
            porBanco[t.banco].saidas += t.valor;
            porBanco[t.banco].saldo -= t.valor;
            saldoGeral -= t.valor;
            saidasPeriodo += t.valor;
            const chave = t.classificacao_saida || "SEM CLASSIFICAÇÃO";
            gastoPorClassificacao[chave] = (gastoPorClassificacao[chave] ?? 0) + t.valor;
        }
    });

    document.getElementById("saldo-geral").textContent = `R$ ${formatarMoeda(saldoGeral)}`;
    document.getElementById("entradas-periodo").textContent = `R$ ${formatarMoeda(entradasPeriodo)}`;
    document.getElementById("saidas-periodo").textContent = `R$ ${formatarMoeda(saidasPeriodo)}`;

    const cartaoSaldoGeral = document.getElementById("cartao-saldo-geral");
    cartaoSaldoGeral.classList.toggle("metrica-saldo-neg", saldoGeral < 0);
    cartaoSaldoGeral.classList.toggle("metrica-saldo-pos", saldoGeral >= 0);

    const rotulo = rotuloDoPeriodo(dataInicioISO, dataFimISO);
    document.getElementById("subtitulo-periodo").textContent = rotulo ? `Mostrando: ${rotulo}` : "Selecione um período nos filtros abaixo.";
    document.getElementById("rotulo-periodo-entradas").textContent = rotulo ? `— ${rotulo}` : "";

    renderizarCarteiras(porBanco);
    renderizarListaBarras("lista-entradas-categoria", entradaPorClassificacao, "Nenhuma entrada registrada neste período.");
    renderizarListaBarras("lista-classificacoes", gastoPorClassificacao, "Nenhuma saída registrada neste período.");
}

async function carregarDashboard() {
    try {
        const consulta = query(collection(db, NOME_COLECAO), where("userId", "==", usuario.uid));
        const snapshot = await getDocs(consulta);

        todasTransacoes = [];
        snapshot.forEach((doc) => todasTransacoes.push(doc.data()));

        const bancos = [...new Set(todasTransacoes.map(t => t.banco).filter(Boolean))].sort();
        seletorBanco.definirOpcoes(bancos);

        const { ano, mes, inicioISO, fimISO } = intervaloMesAtual();
        popularSeletorAno(ano);
        campoMes.value = String(mes).padStart(2, "0");
        campoInicio.value = isoParaBR(inicioISO);
        campoFim.value = isoParaBR(fimISO);

        aplicarFiltros();

    } catch (erro) {
        console.error("Erro ao carregar dashboard:", erro);
        document.getElementById("grade-carteiras").innerHTML = "<p class='vazio'>Erro ao carregar dados. Verifique o console (F12).</p>";
        document.getElementById("lista-classificacoes").innerHTML = "";
        document.getElementById("lista-entradas-categoria").innerHTML = "";
    }
}

carregarDashboard();
