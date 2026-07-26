import { collection, getDocs, query, where, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { exigirLogin } from "./auth-guard.js";
import { renderizarNav } from "./nav.js";
import {
    isoParaBR, brParaISO, normalizarDataDigitada, formatarMoeda,
    ligarCampoDataInteligente, intervaloMesAtual, intervaloParaAnoMes
} from "./utils.js";
import { preencherDatalist } from "./dados-comuns.js";
import { mostrarToast, confirmarAcao } from "./ui.js";

const NOME_COLECAO = "carteira";

const usuario = await exigirLogin();
renderizarNav("extrato", usuario.email);

const campoAno = document.getElementById("filtro-ano");
const campoMes = document.getElementById("filtro-mes");
const campoInicio = document.getElementById("filtro-data-inicio");
const campoFim = document.getElementById("filtro-data-fim");
const campoBanco = document.getElementById("filtro-banco");
const campoMov = document.getElementById("filtro-movimentacao");

ligarCampoDataInteligente(campoInicio);
ligarCampoDataInteligente(campoFim);

let todasTransacoes = [];

function celulaTexto(texto) {
    const td = document.createElement("td");
    td.textContent = texto;
    return td;
}

// ---------- Seletor de Ano ----------
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

// Ano/Mês escolhidos preenchem automaticamente os campos de data
function aplicarAnoMesNosCampos() {
    const { inicioISO, fimISO } = intervaloParaAnoMes(campoAno.value, campoMes.value);
    campoInicio.value = isoParaBR(inicioISO);
    campoFim.value = isoParaBR(fimISO);
}

campoAno.addEventListener("change", () => { aplicarAnoMesNosCampos(); aplicarFiltros(); });
campoMes.addEventListener("change", () => { aplicarAnoMesNosCampos(); aplicarFiltros(); });
campoBanco.addEventListener("change", aplicarFiltros);
campoMov.addEventListener("change", aplicarFiltros);

// ---------- Resumo e tabela ----------
function renderizarResumo(lista) {
    let entradas = 0;
    let saidas = 0;

    lista.forEach((t) => {
        if (typeof t.valor !== "number") return;
        if (t.tipo === "ENTRADA") entradas += t.valor;
        else saidas += t.valor;
    });

    const saldo = entradas - saidas;
    const cartaoSaldo = document.getElementById("cartao-saldo");

    document.getElementById("total-entradas").textContent = `R$ ${formatarMoeda(entradas)}`;
    document.getElementById("total-saidas").textContent = `R$ ${formatarMoeda(saidas)}`;
    document.getElementById("total-saldo").textContent = `R$ ${formatarMoeda(saldo)}`;

    cartaoSaldo.classList.remove("metrica-saldo-pos", "metrica-saldo-neg");
    cartaoSaldo.classList.add(saldo >= 0 ? "metrica-saldo-pos" : "metrica-saldo-neg");
}

async function excluirTransacao(transacao) {
    const confirmou = await confirmarAcao({
        titulo: "Excluir lançamento?",
        mensagem: `Tem certeza que quer apagar "${transacao.descricao ?? "esta transação"}" no valor de R$ ${formatarMoeda(transacao.valor)}? Essa ação não pode ser desfeita.`,
        textoConfirmar: "Excluir",
        textoCancelar: "Cancelar"
    });
    if (!confirmou) return;

    try {
        await deleteDoc(doc(db, NOME_COLECAO, transacao.id));
        todasTransacoes = todasTransacoes.filter((t) => t.id !== transacao.id);
        aplicarFiltros();
        mostrarToast("Lançamento excluído.", "sucesso");
    } catch (erro) {
        console.error("Erro ao excluir:", erro);
        mostrarToast("Erro ao excluir. Tente novamente.", "erro");
    }
}

function renderizarTabela(lista) {
    const corpoTabela = document.querySelector("#tabela-transacoes tbody");
    corpoTabela.innerHTML = "";

    renderizarResumo(lista);

    if (lista.length === 0) {
        const linha = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 8;
        td.className = "vazio";
        td.textContent = "Nenhuma transação encontrada neste período.";
        linha.appendChild(td);
        corpoTabela.appendChild(linha);
        return;
    }

    lista.forEach((transacao) => {
        if (!transacao.data || typeof transacao.valor !== "number") return;

        const classeCor = transacao.tipo === "SAIDA" ? "saida" : "entrada";
        const sinal = transacao.tipo === "SAIDA" ? "-" : "+";

        const linha = document.createElement("tr");
        linha.appendChild(celulaTexto(isoParaBR(transacao.data)));
        linha.appendChild(celulaTexto(transacao.descricao ?? ""));
        linha.appendChild(celulaTexto(transacao.saida ?? ""));
        linha.appendChild(celulaTexto(transacao.tipo_mov ?? ""));
        linha.appendChild(celulaTexto(transacao.banco ?? ""));
        linha.appendChild(celulaTexto(transacao.classificacao_saida ?? ""));

        const tdValor = document.createElement("td");
        tdValor.className = classeCor;
        const b = document.createElement("b");
        b.textContent = `${sinal} R$ ${formatarMoeda(transacao.valor)}`;
        tdValor.appendChild(b);
        linha.appendChild(tdValor);

        const tdAcoes = document.createElement("td");
        tdAcoes.className = "col-acoes";
        const botaoExcluir = document.createElement("button");
        botaoExcluir.className = "botao-icone-perigo";
        botaoExcluir.title = "Excluir lançamento";
        botaoExcluir.textContent = "🗑";
        botaoExcluir.addEventListener("click", () => excluirTransacao(transacao));
        tdAcoes.appendChild(botaoExcluir);
        linha.appendChild(tdAcoes);

        corpoTabela.appendChild(linha);
    });
}

function aplicarFiltros() {
    const dataInicioISO = brParaISO(normalizarDataDigitada(campoInicio.value) ?? "");
    const dataFimISO = brParaISO(normalizarDataDigitada(campoFim.value) ?? "");
    const bancoFiltro = campoBanco.value.toUpperCase();
    const movFiltro = campoMov.value;

    let listaFiltrada = todasTransacoes;

    if (dataInicioISO) listaFiltrada = listaFiltrada.filter(t => t.data >= dataInicioISO);
    if (dataFimISO) listaFiltrada = listaFiltrada.filter(t => t.data <= dataFimISO);
    if (bancoFiltro !== "") listaFiltrada = listaFiltrada.filter(t => (t.banco ?? "").includes(bancoFiltro));
    if (movFiltro !== "") listaFiltrada = listaFiltrada.filter(t => t.tipo_mov === movFiltro);

    renderizarTabela(listaFiltrada);
}

document.getElementById("btn-filtrar").addEventListener("click", aplicarFiltros);

document.getElementById("btn-limpar").addEventListener("click", () => {
    const { ano, mes } = intervaloMesAtual();
    campoAno.value = String(ano);
    campoMes.value = String(mes).padStart(2, "0");
    aplicarAnoMesNosCampos();
    campoBanco.value = "";
    campoMov.value = "";
    aplicarFiltros();
});

async function carregarTransacoesDoBanco() {
    const corpoTabela = document.querySelector("#tabela-transacoes tbody");
    corpoTabela.innerHTML = "<tr><td colspan='8' class='vazio'>Carregando dados...</td></tr>";

    try {
        // Filtramos só por userId (sem orderBy do Firestore) e ordenamos aqui no
        // navegador — assim não é preciso criar nenhum índice composto no banco.
        const consulta = query(collection(db, NOME_COLECAO), where("userId", "==", usuario.uid));
        const snapshot = await getDocs(consulta);

        todasTransacoes = [];
        snapshot.forEach((doc) => todasTransacoes.push({ id: doc.id, ...doc.data() }));

        todasTransacoes.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));

        const bancos = [...new Set(todasTransacoes.map(t => t.banco).filter(Boolean))].sort();
        preencherDatalist("lista-bancos-filtro", bancos);

        // Padrão ao abrir: mês atual, do dia 1 até hoje
        const { ano, mes, inicioISO, fimISO } = intervaloMesAtual();
        popularSeletorAno(ano);
        campoMes.value = String(mes).padStart(2, "0");
        campoInicio.value = isoParaBR(inicioISO);
        campoFim.value = isoParaBR(fimISO);

        aplicarFiltros();

    } catch (erro) {
        console.error("Erro ao buscar transações: ", erro);
        corpoTabela.innerHTML = "<tr><td colspan='8' class='vazio'>Erro ao carregar dados. Verifique o console (F12) para detalhes.</td></tr>";
    }
}

carregarTransacoesDoBanco();
