import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { exigirLogin } from "./auth-guard.js";
import { renderizarNav } from "./nav.js";
import { isoParaBR, brParaISO, formatarMoeda, ligarCampoDataInteligente } from "./utils.js";
import { preencherDatalist } from "./dados-comuns.js";

const usuario = await exigirLogin();
renderizarNav("extrato", usuario.email);

ligarCampoDataInteligente(document.getElementById("filtro-data-inicio"));
ligarCampoDataInteligente(document.getElementById("filtro-data-fim"));

let todasTransacoes = [];

function celulaTexto(texto) {
    const td = document.createElement("td");
    td.textContent = texto;
    return td;
}

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

function renderizarTabela(lista) {
    const corpoTabela = document.querySelector("#tabela-transacoes tbody");
    corpoTabela.innerHTML = "";

    renderizarResumo(lista);

    if (lista.length === 0) {
        const linha = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 6;
        td.className = "vazio";
        td.textContent = "Nenhuma transação encontrada.";
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
        linha.appendChild(celulaTexto(transacao.tipo_mov ?? ""));
        linha.appendChild(celulaTexto(transacao.banco ?? ""));
        linha.appendChild(celulaTexto(transacao.classificacao_saida ?? ""));

        const tdValor = document.createElement("td");
        tdValor.className = classeCor;
        const b = document.createElement("b");
        b.textContent = `${sinal} R$ ${formatarMoeda(transacao.valor)}`;
        tdValor.appendChild(b);
        linha.appendChild(tdValor);

        corpoTabela.appendChild(linha);
    });
}

async function carregarTransacoesDoBanco() {
    const corpoTabela = document.querySelector("#tabela-transacoes tbody");
    corpoTabela.innerHTML = "<tr><td colspan='6' class='vazio'>Carregando dados...</td></tr>";

    try {
        // Importante: aqui filtramos SÓ por userId (sem orderBy do Firestore).
        // Combinar "where" + "orderBy" em campos diferentes exige um índice composto
        // no Firestore; se ele não existir, a consulta falha e nada aparece.
        // Por isso ordenamos os resultados aqui no navegador, o que também funciona
        // sem precisar criar índice nenhum.
        const consulta = query(collection(db, "transacoes"), where("userId", "==", usuario.uid));
        const snapshot = await getDocs(consulta);

        todasTransacoes = [];
        snapshot.forEach((doc) => todasTransacoes.push(doc.data()));

        todasTransacoes.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));

        const bancos = [...new Set(todasTransacoes.map(t => t.banco).filter(Boolean))].sort();
        preencherDatalist("lista-bancos-filtro", bancos);

        renderizarTabela(todasTransacoes);

    } catch (erro) {
        console.error("Erro ao buscar transações: ", erro);
        corpoTabela.innerHTML = "<tr><td colspan='6' class='vazio'>Erro ao carregar dados. Verifique o console (F12) para detalhes.</td></tr>";
    }
}

document.getElementById("btn-filtrar").addEventListener("click", () => {
    const dataInicioISO = brParaISO(document.getElementById("filtro-data-inicio").value);
    const dataFimISO = brParaISO(document.getElementById("filtro-data-fim").value);
    const bancoFiltro = document.getElementById("filtro-banco").value.toUpperCase();
    const movFiltro = document.getElementById("filtro-movimentacao").value;

    let listaFiltrada = todasTransacoes;

    if (dataInicioISO) listaFiltrada = listaFiltrada.filter(t => t.data >= dataInicioISO);
    if (dataFimISO) listaFiltrada = listaFiltrada.filter(t => t.data <= dataFimISO);
    if (bancoFiltro !== "") listaFiltrada = listaFiltrada.filter(t => (t.banco ?? "").includes(bancoFiltro));
    if (movFiltro !== "") listaFiltrada = listaFiltrada.filter(t => t.tipo_mov === movFiltro);

    renderizarTabela(listaFiltrada);
});

document.getElementById("btn-limpar").addEventListener("click", () => {
    document.getElementById("filtro-data-inicio").value = "";
    document.getElementById("filtro-data-fim").value = "";
    document.getElementById("filtro-banco").value = "";
    document.getElementById("filtro-movimentacao").value = "";
    renderizarTabela(todasTransacoes);
});

carregarTransacoesDoBanco();
