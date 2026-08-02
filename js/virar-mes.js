// virar-mes.js
// Remaneja o saldo apurado de um banco no mês de origem para o mês de
// destino, criando um par de lançamentos (SAÍDA no mês de origem + ENTRADA
// no mês de destino, ou o inverso se o saldo for negativo) que seguem
// exatamente o mesmo formato de um lançamento normal do Extrato — então dá
// pra editar/excluir depois do jeito de sempre.
import { exigirLogin } from "./auth-guard.js";
import { renderizarNav } from "./nav.js";
import { formatarReais, ultimoDiaDoMes, NOMES_MESES } from "./utils.js";
import { obterTransacoes, criarTransacao } from "./dados-carteira.js";
import { mostrarToast, confirmarAcao } from "./ui.js";

const DESCRICAO_VIRADA = "VALOR EM CARTEIRA";
const CLASSIFICACAO_VIRADA = "VIRADA DE MÊS";

const usuario = await exigirLogin();
renderizarNav("virar-mes", usuario.email);

const campoMesOrigem = document.getElementById("mes-origem");
const campoAnoOrigem = document.getElementById("ano-origem");
const campoMesDestino = document.getElementById("mes-destino");
const campoAnoDestino = document.getElementById("ano-destino");
const corpoTabela = document.querySelector("#tabela-saldos tbody");

let todasTransacoes = [];

function popularSelectsMes() {
    [campoMesOrigem, campoMesDestino].forEach((select) => {
        select.innerHTML = "";
        NOMES_MESES.forEach((nome, indice) => {
            const opcao = document.createElement("option");
            opcao.value = String(indice + 1).padStart(2, "0");
            opcao.textContent = nome;
            select.appendChild(opcao);
        });
    });
}

function popularSelectsAno() {
    const anoAtual = new Date().getFullYear();
    const anosDosDados = todasTransacoes.map((t) => Number((t.data ?? "").slice(0, 4))).filter(Boolean);
    const anos = new Set([anoAtual - 1, anoAtual, anoAtual + 1, ...anosDosDados]);
    const listaOrdenada = Array.from(anos).sort((a, b) => a - b);

    [campoAnoOrigem, campoAnoDestino].forEach((select) => {
        select.innerHTML = "";
        listaOrdenada.forEach((ano) => {
            const opcao = document.createElement("option");
            opcao.value = String(ano);
            opcao.textContent = String(ano);
            select.appendChild(opcao);
        });
    });
}

function definirPeriodoPadrao() {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;

    let mesOrigem = mesAtual - 1;
    let anoOrigem = anoAtual;
    if (mesOrigem < 1) {
        mesOrigem = 12;
        anoOrigem -= 1;
    }

    campoMesOrigem.value = String(mesOrigem).padStart(2, "0");
    campoAnoOrigem.value = String(anoOrigem);
    campoMesDestino.value = String(mesAtual).padStart(2, "0");
    campoAnoDestino.value = String(anoAtual);
}

function calcularSaldosPorBanco(anoMesISO) {
    const porBanco = {};
    todasTransacoes.forEach((t) => {
        if (typeof t.valor !== "number" || !t.banco) return;
        if ((t.data ?? "").slice(0, 7) !== anoMesISO) return;
        porBanco[t.banco] = (porBanco[t.banco] ?? 0) + (t.tipo === "ENTRADA" ? t.valor : -t.valor);
    });
    return porBanco;
}

function nomeMesLabel(mesNumero, ano) {
    const nome = NOMES_MESES[Number(mesNumero) - 1] ?? "";
    return `${nome}/${ano}`;
}

async function remanejarSaldo(banco, saldo) {
    const mesOrigem = campoMesOrigem.value;
    const anoOrigem = campoAnoOrigem.value;
    const mesDestino = campoMesDestino.value;
    const anoDestino = campoAnoDestino.value;

    const confirmou = await confirmarAcao({
        titulo: "Remanejar saldo?",
        mensagem: `Remanejar ${formatarReais(Math.abs(saldo))} de "${banco}" de ${nomeMesLabel(mesOrigem, anoOrigem)} para ${nomeMesLabel(mesDestino, anoDestino)}?`,
        textoConfirmar: "Remanejar valor",
        textoCancelar: "Cancelar"
    });
    if (!confirmou) return;

    const diaFinalOrigem = String(ultimoDiaDoMes(anoOrigem, mesOrigem)).padStart(2, "0");
    const dataOrigemISO = `${anoOrigem}-${mesOrigem}-${diaFinalOrigem}`;
    const dataDestinoISO = `${anoDestino}-${mesDestino}-01`;

    const valorAbs = Math.abs(saldo);
    const tipoOrigem = saldo >= 0 ? "SAIDA" : "ENTRADA";
    const tipoDestino = saldo >= 0 ? "ENTRADA" : "SAIDA";

    const nomeMesOrigem = (NOMES_MESES[Number(mesOrigem) - 1] ?? "").toUpperCase();
    const nomeMesDestino = (NOMES_MESES[Number(mesDestino) - 1] ?? "").toUpperCase();
    const detalhe = `VIR_MES_${nomeMesOrigem}-${String(anoOrigem).slice(2)}_${nomeMesDestino}-${String(anoDestino).slice(2)}`;

    const dadosOrigem = { valor: valorAbs, data: dataOrigemISO, descricao: DESCRICAO_VIRADA, saida: detalhe, banco, tipo: tipoOrigem, tipo_mov: "INTERNO", classificacao_saida: CLASSIFICACAO_VIRADA };
    const dadosDestino = { valor: valorAbs, data: dataDestinoISO, descricao: DESCRICAO_VIRADA, saida: detalhe, banco, tipo: tipoDestino, tipo_mov: "INTERNO", classificacao_saida: CLASSIFICACAO_VIRADA };

    try {
        const idOrigem = await criarTransacao(usuario, dadosOrigem);
        const idDestino = await criarTransacao(usuario, dadosDestino);
        todasTransacoes = [
            ...todasTransacoes,
            { id: idOrigem, userId: usuario.uid, ...dadosOrigem, criadoEmMs: Date.now() },
            { id: idDestino, userId: usuario.uid, ...dadosDestino, criadoEmMs: Date.now() + 1 }
        ];
        mostrarToast("Saldo remanejado!", "sucesso");
        renderizarTabela();
    } catch (erro) {
        console.error("Erro ao remanejar saldo:", erro);
        mostrarToast("Erro ao remanejar. Tente novamente.", "erro");
    }
}

function renderizarTabela() {
    const anoMesOrigem = `${campoAnoOrigem.value}-${campoMesOrigem.value}`;
    const porBanco = calcularSaldosPorBanco(anoMesOrigem);
    const bancosComSaldo = Object.entries(porBanco).filter(([, saldo]) => Math.abs(saldo) >= 0.005);

    corpoTabela.innerHTML = "";

    if (bancosComSaldo.length === 0) {
        corpoTabela.innerHTML = `<tr><td colspan="3" class="vazio">Nenhum banco com saldo em ${nomeMesLabel(campoMesOrigem.value, campoAnoOrigem.value)}.</td></tr>`;
        return;
    }

    bancosComSaldo
        .sort((a, b) => b[1] - a[1])
        .forEach(([banco, saldo]) => {
            const linha = document.createElement("tr");

            const tdBanco = document.createElement("td");
            tdBanco.textContent = banco;
            linha.appendChild(tdBanco);

            const tdSaldo = document.createElement("td");
            tdSaldo.className = saldo >= 0 ? "entrada" : "saida";
            const b = document.createElement("b");
            b.textContent = formatarReais(saldo);
            tdSaldo.appendChild(b);
            linha.appendChild(tdSaldo);

            const tdAcao = document.createElement("td");
            tdAcao.className = "col-acoes";
            const botao = document.createElement("button");
            botao.className = "botao botao-primario botao-pequeno";
            botao.style.margin = "0";
            botao.style.width = "auto";
            botao.textContent = "Remanejar valor";
            botao.addEventListener("click", () => remanejarSaldo(banco, saldo));
            tdAcao.appendChild(botao);
            linha.appendChild(tdAcao);

            corpoTabela.appendChild(linha);
        });
}

[campoMesOrigem, campoAnoOrigem, campoMesDestino, campoAnoDestino].forEach((select) => {
    select.addEventListener("change", renderizarTabela);
});

async function carregar() {
    corpoTabela.innerHTML = "<tr><td colspan='3' class='vazio'>Carregando dados...</td></tr>";
    try {
        todasTransacoes = await obterTransacoes(usuario);
        popularSelectsMes();
        popularSelectsAno();
        definirPeriodoPadrao();
        renderizarTabela();
    } catch (erro) {
        console.error("Erro ao buscar transações:", erro);
        corpoTabela.innerHTML = "<tr><td colspan='3' class='vazio'>Erro ao carregar dados. Verifique o console (F12) para detalhes.</td></tr>";
    }
}

carregar();
