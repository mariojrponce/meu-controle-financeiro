import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { exigirLogin } from "./auth-guard.js";
import { renderizarNav } from "./nav.js";
import { formatarMoeda } from "./utils.js";

const NOME_COLECAO = "carteira";

const usuario = await exigirLogin();
renderizarNav("dashboard", usuario.email);

const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function chaveAnoMes(data) {
    return (data ?? "").slice(0, 7); // "aaaa-mm-dd" -> "aaaa-mm"
}

async function carregarDashboard() {
    const hoje = new Date();
    const chaveMesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    document.getElementById("subtitulo-mes").textContent =
        `Visão geral das suas finanças — ${NOMES_MES[hoje.getMonth()]} de ${hoje.getFullYear()}`;

    try {
        const consulta = query(collection(db, NOME_COLECAO), where("userId", "==", usuario.uid));
        const snapshot = await getDocs(consulta);

        const transacoes = [];
        snapshot.forEach((doc) => transacoes.push(doc.data()));

        // ---- Por banco: saldo, entradas e saídas separadas (todo o período) ----
        const porBanco = {}; // { NUBANK: { saldo, entradas, saidas } }
        let saldoGeral = 0;

        transacoes.forEach((t) => {
            if (typeof t.valor !== "number" || !t.banco) return;

            if (!porBanco[t.banco]) porBanco[t.banco] = { saldo: 0, entradas: 0, saidas: 0 };

            if (t.tipo === "ENTRADA") {
                porBanco[t.banco].entradas += t.valor;
                porBanco[t.banco].saldo += t.valor;
                saldoGeral += t.valor;
            } else {
                porBanco[t.banco].saidas += t.valor;
                porBanco[t.banco].saldo -= t.valor;
                saldoGeral -= t.valor;
            }
        });

        // ---- Totais do mês atual ----
        let entradasMes = 0;
        let saidasMes = 0;
        const gastoPorClassificacaoMes = {};

        transacoes.forEach((t) => {
            if (typeof t.valor !== "number") return;
            if (chaveAnoMes(t.data) !== chaveMesAtual) return;

            if (t.tipo === "ENTRADA") {
                entradasMes += t.valor;
            } else {
                saidasMes += t.valor;
                const chave = t.classificacao_saida || "SEM CLASSIFICAÇÃO";
                gastoPorClassificacaoMes[chave] = (gastoPorClassificacaoMes[chave] ?? 0) + t.valor;
            }
        });

        const saldoMes = entradasMes - saidasMes;

        // ---- Cartões principais ----
        document.getElementById("saldo-geral").textContent = `R$ ${formatarMoeda(saldoGeral)}`;
        document.getElementById("entradas-mes").textContent = `R$ ${formatarMoeda(entradasMes)}`;
        document.getElementById("saidas-mes").textContent = `R$ ${formatarMoeda(saidasMes)}`;
        document.getElementById("saldo-mes").textContent = `R$ ${formatarMoeda(saldoMes)}`;

        const cartaoSaldoGeral = document.getElementById("cartao-saldo-geral");
        cartaoSaldoGeral.classList.toggle("metrica-saldo-neg", saldoGeral < 0);
        cartaoSaldoGeral.classList.toggle("metrica-saldo-pos", saldoGeral >= 0);

        const cartaoSaldoMes = document.getElementById("cartao-saldo-mes");
        cartaoSaldoMes.classList.toggle("metrica-saldo-neg", saldoMes < 0);
        cartaoSaldoMes.classList.toggle("metrica-neutra", saldoMes >= 0);

        renderizarCarteiras(porBanco);
        renderizarClassificacoes(gastoPorClassificacaoMes);

    } catch (erro) {
        console.error("Erro ao carregar dashboard:", erro);
        document.getElementById("grade-carteiras").innerHTML = "<p class='vazio'>Erro ao carregar dados. Verifique o console (F12).</p>";
        document.getElementById("lista-classificacoes").innerHTML = "";
    }
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
        container.innerHTML = "<p class='vazio'>Nenhuma transação cadastrada ainda.</p>";
        return;
    }

    bancos.forEach((banco) => {
        const dados = porBanco[banco];

        const cartao = document.createElement("div");
        cartao.className = "cartao-carteira";

        const nome = document.createElement("div");
        nome.className = "nome-banco";
        nome.textContent = banco;
        cartao.appendChild(nome);

        cartao.appendChild(linhaCarteira("Entradas", dados.entradas));
        cartao.appendChild(linhaCarteira("Saídas", dados.saidas));
        cartao.appendChild(linhaCarteira("Saldo", dados.saldo, "saldo"));

        container.appendChild(cartao);
    });
}

function renderizarClassificacoes(gastoPorClassificacao) {
    const container = document.getElementById("lista-classificacoes");
    container.innerHTML = "";

    const classificacoes = Object.entries(gastoPorClassificacao).sort((a, b) => b[1] - a[1]);

    if (classificacoes.length === 0) {
        container.innerHTML = "<p class='vazio'>Nenhuma saída registrada neste mês ainda.</p>";
        return;
    }

    const maiorValor = classificacoes[0][1];

    classificacoes.forEach(([nome, valor]) => {
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

carregarDashboard();
