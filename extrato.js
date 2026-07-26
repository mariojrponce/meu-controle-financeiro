import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { exigirLogin, ligarBotaoSair } from "./auth-guard.js";

// Bloqueia a página até confirmar login
const usuario = await exigirLogin();
ligarBotaoSair();

let todasTransacoes = [];

function formatarMoeda(valor) {
    return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Evita XSS: nunca inserir texto do usuário direto no innerHTML.
// Criamos os elementos e usamos textContent, que trata qualquer conteúdo como texto puro.
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

    cartaoSaldo.classList.remove("saldo-positivo", "saldo-negativo");
    cartaoSaldo.classList.add(saldo >= 0 ? "saldo-positivo" : "saldo-negativo");
}

function renderizarTabela(listaDeTransacoes) {
    const corpoTabela = document.querySelector("#tabela-transacoes tbody");
    corpoTabela.innerHTML = "";

    renderizarResumo(listaDeTransacoes);

    if (listaDeTransacoes.length === 0) {
        const linha = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 6;
        td.style.textAlign = "center";
        td.textContent = "Nenhuma transação encontrada.";
        linha.appendChild(td);
        corpoTabela.appendChild(linha);
        return;
    }

    listaDeTransacoes.forEach((transacao) => {
        if (!transacao.data || typeof transacao.valor !== "number") {
            return;
        }

        const partesData = transacao.data.split('-');
        const dataBR = `${partesData[2]}/${partesData[1]}/${partesData[0]}`;

        const classeCor = transacao.tipo === "SAIDA" ? "saida" : "entrada";
        const sinal = transacao.tipo === "SAIDA" ? "-" : "+";

        const linha = document.createElement("tr");
        linha.appendChild(celulaTexto(dataBR));
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
    corpoTabela.innerHTML = "<tr><td colspan='6' style='text-align:center;'>Carregando dados...</td></tr>";

    try {
        // 🔑 Só busca as transações do usuário logado (reforçado também pelas Firestore Rules)
        const consulta = query(
            collection(db, "transacoes"),
            where("userId", "==", usuario.uid),
            orderBy("data", "desc")
        );
        const snapshot = await getDocs(consulta);

        todasTransacoes = [];
        snapshot.forEach((doc) => {
            todasTransacoes.push(doc.data());
        });

        renderizarTabela(todasTransacoes);

    } catch (erro) {
        console.error("Erro ao buscar transações: ", erro);
        corpoTabela.innerHTML = "<tr><td colspan='6' style='text-align:center;'>Erro ao carregar dados. Verifique o console.</td></tr>";
    }
}

document.getElementById("btn-filtrar").addEventListener("click", () => {
    const dataInicio = document.getElementById("filtro-data-inicio").value;
    const dataFim = document.getElementById("filtro-data-fim").value;
    const bancoFiltro = document.getElementById("filtro-banco").value.toUpperCase();
    const movFiltro = document.getElementById("filtro-movimentacao").value;

    let listaFiltrada = todasTransacoes;

    if (dataInicio !== "") {
        listaFiltrada = listaFiltrada.filter(t => t.data >= dataInicio);
    }
    if (dataFim !== "") {
        listaFiltrada = listaFiltrada.filter(t => t.data <= dataFim);
    }
    if (bancoFiltro !== "") {
        listaFiltrada = listaFiltrada.filter(t => (t.banco ?? "").includes(bancoFiltro));
    }
    if (movFiltro !== "") {
        listaFiltrada = listaFiltrada.filter(t => t.tipo_mov === movFiltro);
    }

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
