// transferencia.js
// Atalho para transferências internas entre bancos próprios (ex: PIX de um
// banco para outro): em vez de lançar duas transações manualmente, o
// usuário informa origem/destino/valor uma vez só e o par de lançamentos
// (SAÍDA na origem + ENTRADA no destino) é criado automaticamente — mesmo
// padrão usado em "Virar mês" para a virada de saldo.
import { exigirLogin } from "./auth-guard.js";
import { renderizarNav } from "./nav.js";
import { mostrarToast, confirmarAcao } from "./ui.js";
import { BANCOS_SUGERIDOS, mesclarSugestoes, normalizarNomeBanco } from "./dados-comuns.js";
import { brParaISO, isoParaBR, normalizarDataDigitada, ligarCampoDataInteligente, formatarReais } from "./utils.js";
import { criarComboboxTexto } from "./combobox.js";
import { ativarOrdenacao, compararValores } from "./tabela-ordenavel.js";
import { obterTransacoes, criarTransacao, excluirTransacaoPorId, atualizarTransacao } from "./dados-carteira.js";
import { abrirEditorTransacao } from "./editor-transacao.js";

const CLASSIFICACAO_TRANSFERENCIA = "CONTROLE INTERNO";
const QTD_ULTIMAS = 10;

const usuario = await exigirLogin();
renderizarNav("transferencia", usuario.email);

const campoData = document.getElementById("data");
ligarCampoDataInteligente(campoData);

const campoBancoOrigem = document.getElementById("banco-origem");
const campoBancoDestino = document.getElementById("banco-destino");
const comboboxOrigem = criarComboboxTexto(campoBancoOrigem, BANCOS_SUGERIDOS);
const comboboxDestino = criarComboboxTexto(campoBancoDestino, BANCOS_SUGERIDOS);

let todasInternas = [];
let ordenacaoAtual = { chave: "criadoEmMs", direcao: "desc", tipo: "numero" };

ativarOrdenacao(document.querySelector("#tabela-ultimas thead"), (chave, direcao, tipo) => {
    ordenacaoAtual = { chave, direcao, tipo };
    renderizarUltimas(todasInternas);
});

async function carregarDadosAuxiliares() {
    try {
        const transacoes = await obterTransacoes(usuario);

        const bancosUsados = transacoes.map(t => t.banco).filter(Boolean);
        const sugestoesBanco = mesclarSugestoes(BANCOS_SUGERIDOS, bancosUsados);
        comboboxOrigem.atualizarOpcoes(sugestoesBanco);
        comboboxDestino.atualizarOpcoes(sugestoesBanco);

        todasInternas = transacoes
            .filter(t => t.tipo_mov === "INTERNO")
            .sort((a, b) => (b.criadoEmMs ?? 0) - (a.criadoEmMs ?? 0))
            .slice(0, QTD_ULTIMAS);
        ordenacaoAtual = { chave: "criadoEmMs", direcao: "desc", tipo: "numero" };
        renderizarUltimas(todasInternas);

    } catch (erro) {
        console.error("Não foi possível carregar dados auxiliares:", erro);
        comboboxOrigem.atualizarOpcoes(BANCOS_SUGERIDOS);
        comboboxDestino.atualizarOpcoes(BANCOS_SUGERIDOS);
        document.querySelector("#tabela-ultimas tbody").innerHTML =
            "<tr><td colspan='5' class='vazio'>Erro ao carregar. Verifique o console (F12).</td></tr>";
    }
}

function celulaTexto(texto) {
    const td = document.createElement("td");
    td.textContent = texto;
    return td;
}

function renderizarUltimas(lista) {
    const listaOrdenada = [...lista].sort((a, b) => {
        const resultado = compararValores(a[ordenacaoAtual.chave], b[ordenacaoAtual.chave], ordenacaoAtual.tipo);
        return ordenacaoAtual.direcao === "asc" ? resultado : -resultado;
    });

    const corpo = document.querySelector("#tabela-ultimas tbody");
    corpo.innerHTML = "";

    if (listaOrdenada.length === 0) {
        corpo.innerHTML = "<tr><td colspan='5' class='vazio'>Nenhuma transferência interna ainda.</td></tr>";
        return;
    }

    listaOrdenada.forEach((transacao) => {
        const linha = document.createElement("tr");
        const classeCor = transacao.tipo === "SAIDA" ? "saida" : "entrada";
        const sinal = transacao.tipo === "SAIDA" ? "-" : "+";

        linha.appendChild(celulaTexto(isoParaBR(transacao.data)));
        linha.appendChild(celulaTexto(transacao.descricao ?? ""));
        linha.appendChild(celulaTexto(transacao.banco ?? ""));

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
        botaoEditar.addEventListener("click", () => editarTransacao(transacao));

        const botaoExcluir = document.createElement("button");
        botaoExcluir.className = "botao-icone-perigo";
        botaoExcluir.title = "Excluir lançamento";
        botaoExcluir.textContent = "🗑";
        botaoExcluir.addEventListener("click", () => excluirTransacao(transacao));

        wrapperAcoes.appendChild(botaoEditar);
        wrapperAcoes.appendChild(botaoExcluir);
        tdAcoes.appendChild(wrapperAcoes);
        linha.appendChild(tdAcoes);

        corpo.appendChild(linha);
    });
}

async function excluirTransacao(transacao) {
    const confirmou = await confirmarAcao({
        titulo: "Excluir lançamento?",
        mensagem: `Tem certeza que quer apagar "${transacao.descricao ?? "esta transação"}" no valor de ${formatarReais(transacao.valor)}? Essa ação não pode ser desfeita.`,
        textoConfirmar: "Excluir",
        textoCancelar: "Cancelar"
    });
    if (!confirmou) return;

    try {
        await excluirTransacaoPorId(usuario, transacao.id);
        mostrarToast("Lançamento excluído.", "sucesso");
        carregarDadosAuxiliares();
    } catch (erro) {
        console.error("Erro ao excluir:", erro);
        mostrarToast("Erro ao excluir. Tente novamente.", "erro");
    }
}

async function editarTransacao(transacao) {
    const bancosUsados = todasInternas.map(t => t.banco).filter(Boolean);
    const dadosEditados = await abrirEditorTransacao(transacao, {
        bancosSugeridos: mesclarSugestoes(BANCOS_SUGERIDOS, bancosUsados),
        classificacoesSugeridas: [CLASSIFICACAO_TRANSFERENCIA]
    });
    if (!dadosEditados) return;

    try {
        await atualizarTransacao(usuario, transacao.id, dadosEditados);
        mostrarToast("Lançamento atualizado!", "sucesso");
        carregarDadosAuxiliares();
    } catch (erro) {
        console.error("Erro ao atualizar:", erro);
        mostrarToast("Erro ao salvar as alterações. Tente novamente.", "erro");
    }
}

carregarDadosAuxiliares();

const formulario = document.getElementById("form-transferencia");

formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    const dataNormalizada = normalizarDataDigitada(campoData.value);
    if (dataNormalizada) campoData.value = dataNormalizada;

    const botaoTransferir = formulario.querySelector("button");

    const valor = parseFloat(document.getElementById("valor").value);
    const dataISO = brParaISO(campoData.value);
    const bancoOrigem = normalizarNomeBanco(campoBancoOrigem.value.trim().toUpperCase());
    const bancoDestino = normalizarNomeBanco(campoBancoDestino.value.trim().toUpperCase());
    const detalhe = document.getElementById("detalhe").value.trim().toUpperCase();

    if (!valor || valor <= 0 || !bancoOrigem || !bancoDestino) {
        mostrarToast("Preencha todos os campos obrigatórios.", "erro");
        return;
    }
    if (!dataISO) {
        campoData.classList.add("campo-invalido");
        mostrarToast("Data inválida. Use dd/mm/aaaa.", "erro");
        return;
    }
    if (bancoOrigem === bancoDestino) {
        mostrarToast("Banco de origem e destino não podem ser o mesmo.", "erro");
        return;
    }

    const confirmou = await confirmarAcao({
        titulo: "Confirmar transferência?",
        mensagem: `Transferir ${formatarReais(valor)} de "${bancoOrigem}" para "${bancoDestino}" em ${campoData.value}?`,
        textoConfirmar: "Transferir",
        textoCancelar: "Cancelar"
    });
    if (!confirmou) return;

    botaoTransferir.disabled = true;
    botaoTransferir.textContent = "Transferindo...";

    const dadosOrigem = {
        valor, data: dataISO, descricao: `PIX PARA ${bancoDestino}`, saida: detalhe,
        banco: bancoOrigem, tipo: "SAIDA", tipo_mov: "INTERNO", classificacao_saida: CLASSIFICACAO_TRANSFERENCIA
    };
    const dadosDestino = {
        valor, data: dataISO, descricao: `PIX DE ${bancoOrigem}`, saida: detalhe,
        banco: bancoDestino, tipo: "ENTRADA", tipo_mov: "INTERNO", classificacao_saida: CLASSIFICACAO_TRANSFERENCIA
    };

    try {
        await criarTransacao(usuario, dadosOrigem);
        await criarTransacao(usuario, dadosDestino);

        mostrarToast("Transferência registrada!", "sucesso");
        formulario.reset();
        carregarDadosAuxiliares();
    } catch (erro) {
        console.error("Erro ao transferir: ", erro);
        mostrarToast("Erro ao transferir. Tente novamente.", "erro");
    } finally {
        botaoTransferir.disabled = false;
        botaoTransferir.textContent = "Transferir";
    }
});
