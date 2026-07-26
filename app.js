import { exigirLogin } from "./auth-guard.js";
import { renderizarNav } from "./nav.js";
import { mostrarToast, confirmarAcao } from "./ui.js";
import { BANCOS_SUGERIDOS, CLASSIFICACOES_SUGERIDAS, mesclarSugestoes } from "./dados-comuns.js";
import { brParaISO, isoParaBR, normalizarDataDigitada, ligarCampoDataInteligente, formatarReais } from "./utils.js";
import { criarComboboxTexto } from "./combobox.js";
import { ativarOrdenacao, compararValores } from "./tabela-ordenavel.js";
import { obterTransacoes, criarTransacao, excluirTransacaoPorId } from "./dados-carteira.js";

const QTD_ULTIMOS = 10;

const usuario = await exigirLogin();
renderizarNav("lancar", usuario.email);

const campoData = document.getElementById("data");
ligarCampoDataInteligente(campoData);

const comboboxBanco = criarComboboxTexto(document.getElementById("banco"), BANCOS_SUGERIDOS);
const comboboxClassificacao = criarComboboxTexto(document.getElementById("classificacao_saida"), CLASSIFICACOES_SUGERIDAS);

let ultimosAtuais = [];
let ordenacaoAtual = { chave: "criadoEm", direcao: "desc", tipo: "numero" };

function milissegundosCriacao(transacao) {
    return transacao.criadoEm?.toMillis ? transacao.criadoEm.toMillis() : 0;
}

function valorParaOrdenar(transacao, chave) {
    if (chave === "criadoEm") return milissegundosCriacao(transacao);
    return transacao[chave];
}

ativarOrdenacao(document.querySelector("#tabela-ultimos thead"), (chave, direcao, tipo) => {
    ordenacaoAtual = { chave, direcao, tipo };
    renderizarUltimos(ultimosAtuais);
});

// Uma única busca (com cache) serve tanto para as sugestões de Banco/Classificação
// quanto para os últimos lançamentos.
async function carregarDadosAuxiliares() {
    try {
        const transacoes = await obterTransacoes(usuario);

        const bancosUsados = transacoes.map(t => t.banco).filter(Boolean);
        const classificacoesUsadas = transacoes.map(t => t.classificacao_saida).filter(Boolean);
        comboboxBanco.atualizarOpcoes(mesclarSugestoes(BANCOS_SUGERIDOS, bancosUsados));
        comboboxClassificacao.atualizarOpcoes(mesclarSugestoes(CLASSIFICACOES_SUGERIDAS, classificacoesUsadas));

        ultimosAtuais = [...transacoes]
            .sort((a, b) => milissegundosCriacao(b) - milissegundosCriacao(a))
            .slice(0, QTD_ULTIMOS);
        ordenacaoAtual = { chave: "criadoEm", direcao: "desc", tipo: "numero" };
        renderizarUltimos(ultimosAtuais);

    } catch (erro) {
        console.error("Não foi possível carregar dados auxiliares:", erro);
        comboboxBanco.atualizarOpcoes(BANCOS_SUGERIDOS);
        comboboxClassificacao.atualizarOpcoes(CLASSIFICACOES_SUGERIDAS);
        document.querySelector("#tabela-ultimos tbody").innerHTML =
            "<tr><td colspan='5' class='vazio'>Erro ao carregar. Verifique o console (F12).</td></tr>";
    }
}

function celulaTexto(texto) {
    const td = document.createElement("td");
    td.textContent = texto;
    return td;
}

function renderizarUltimos(lista) {
    const listaOrdenada = [...lista].sort((a, b) => {
        const resultado = compararValores(
            valorParaOrdenar(a, ordenacaoAtual.chave),
            valorParaOrdenar(b, ordenacaoAtual.chave),
            ordenacaoAtual.tipo
        );
        return ordenacaoAtual.direcao === "asc" ? resultado : -resultado;
    });

    const corpo = document.querySelector("#tabela-ultimos tbody");
    corpo.innerHTML = "";

    if (listaOrdenada.length === 0) {
        corpo.innerHTML = "<tr><td colspan='5' class='vazio'>Nenhum lançamento ainda.</td></tr>";
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
        const botaoExcluir = document.createElement("button");
        botaoExcluir.className = "botao-icone-perigo";
        botaoExcluir.title = "Excluir lançamento";
        botaoExcluir.textContent = "🗑";
        botaoExcluir.addEventListener("click", () => excluirTransacao(transacao));
        tdAcoes.appendChild(botaoExcluir);
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

carregarDadosAuxiliares();

const formulario = document.getElementById("form-transacao");

formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    const dataNormalizada = normalizarDataDigitada(campoData.value);
    if (dataNormalizada) campoData.value = dataNormalizada;

    const botaoSalvar = formulario.querySelector("button");

    const valor = parseFloat(document.getElementById("valor").value);
    const dataISO = brParaISO(campoData.value);
    const descricao = document.getElementById("descricao").value.trim().toUpperCase();
    const saida = document.getElementById("saida").value.trim().toUpperCase();
    const banco = document.getElementById("banco").value.trim().toUpperCase();
    const tipo = document.getElementById("tipo").value;
    const tipo_mov = document.getElementById("tipo_mov").value;
    const classificacao_saida = document.getElementById("classificacao_saida").value.trim().toUpperCase();

    if (!valor || valor <= 0 || !descricao || !banco || !classificacao_saida) {
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
        await criarTransacao(usuario, { valor, data: dataISO, descricao, saida, banco, tipo, tipo_mov, classificacao_saida });

        mostrarToast("Salvo!", "sucesso");
        formulario.reset();
        carregarDadosAuxiliares();
    } catch (erro) {
        console.error("Erro ao salvar: ", erro);
        mostrarToast("Erro ao salvar. Tente novamente.", "erro");
    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar transação";
    }
});
