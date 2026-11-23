import { exigirLogin } from "./auth-guard.js";
import { renderizarNav } from "./nav.js";
import { mostrarToast, confirmarAcao, preencherBotao, mostrarLinhaMensagem } from "./ui.js";
import { BANCOS_SUGERIDOS, CLASSIFICACOES_SUGERIDAS, mesclarSugestoes, normalizarNomeBanco } from "./dados-comuns.js";
import { brParaISO, isoParaBR, normalizarDataDigitada, ligarCampoDataInteligente, formatarReais } from "./utils.js";
import { criarComboboxTexto } from "./combobox.js";
import { ativarOrdenacao, compararValores } from "./tabela-ordenavel.js";
import { obterTransacoes, criarTransacao, criarOcorrenciaRecorrente, excluirTransacaoPorId, atualizarTransacao } from "./dados-carteira.js";
import { abrirEditorTransacao } from "./editor-transacao.js";
import { filtrarPorVale, preencherSelectVale } from "./vale.js";
import { carregarConfiguracoes, salvarConfiguracoes } from "./configuracoes.js";

const QTD_ULTIMOS = 10;

const usuario = await exigirLogin();
renderizarNav("lancar", usuario.email);

let configuracaoAtual;
async function salvarModelosRecorrentes(recorrencias) {
    const { config } = await carregarConfiguracoes(usuario, { forcarAtualizacao: true });
    configuracaoAtual = await salvarConfiguracoes(usuario, { ...config, recorrencias });
    renderizarRecorrencias();
}

function renderizarRecorrencias() {
    const container = document.getElementById("lista-recorrencias");
    if (!container || !configuracaoAtual) return;
    container.replaceChildren();
    const lista = configuracaoAtual.recorrencias ?? [];
    if (!lista.length) { container.textContent = "Nenhuma recorrência cadastrada."; return; }
    lista.forEach((r) => {
        const linha = document.createElement("div");
        linha.className = "faixa-info";
        linha.style.justifyContent = "space-between";
        const texto = document.createElement("span");
        texto.textContent = `${r.descricao} · dia ${r.dia} · ${formatarReais(r.valor)} · ${r.ativo ? "Ativa" : "Pausada"}`;
        const acoes = document.createElement("span");
        const alternar = document.createElement("button");
        alternar.type = "button"; alternar.className = "botao botao-secundario"; alternar.textContent = r.ativo ? "Pausar" : "Ativar";
        alternar.addEventListener("click", () => salvarModelosRecorrentes(lista.map(x => x.id === r.id ? { ...x, ativo: !x.ativo } : x)));
        const excluir = document.createElement("button");
        excluir.type = "button"; excluir.className = "botao botao-secundario"; excluir.textContent = "Remover";
        excluir.addEventListener("click", () => salvarModelosRecorrentes(lista.filter(x => x.id !== r.id)));
        acoes.append(alternar, excluir); linha.append(texto, acoes); container.appendChild(linha);
    });
}

async function inicializarRecorrencias() {
    try {
        const resultado = await carregarConfiguracoes(usuario);
        configuracaoAtual = resultado.config;
        renderizarRecorrencias();
        const hoje = new Date();
        for (const r of configuracaoAtual.recorrencias.filter(x => x.ativo)) {
            let ano = hoje.getFullYear();
            let mesNumero = hoje.getMonth();
            let dia = Math.min(r.dia, new Date(ano, mesNumero + 1, 0).getDate());
            if (dia < hoje.getDate()) { mesNumero += 1; if (mesNumero > 11) { mesNumero = 0; ano += 1; } dia = Math.min(r.dia, new Date(ano, mesNumero + 1, 0).getDate()); }
            const mes = String(mesNumero + 1).padStart(2, "0");
            const data = `${ano}-${mes}-${String(dia).padStart(2, "0")}`;
            await criarOcorrenciaRecorrente(usuario, r, `${ano}${mes}`, {
                valor: r.valor, data, descricao: r.descricao, saida: r.saida, banco: r.banco,
                tipo: r.tipo, tipo_mov: r.tipo_mov, classificacao_saida: r.classificacao_saida
            });
        }
        await carregarDadosAuxiliares(true);
    } catch (erro) { console.error("Erro ao carregar recorrências:", erro); carregarDadosAuxiliares(); }
}

const campoData = document.getElementById("data");
ligarCampoDataInteligente(campoData);

const comboboxBanco = criarComboboxTexto(document.getElementById("banco"), BANCOS_SUGERIDOS);
const comboboxClassificacao = criarComboboxTexto(document.getElementById("classificacao_saida"), CLASSIFICACOES_SUGERIDAS);

let todasRecentes = [];
let ultimosAtuais = [];

const campoVale = document.getElementById("filtro-vale");
preencherSelectVale(campoVale);
campoVale.addEventListener("change", atualizarUltimos);

function atualizarUltimos() {
    ultimosAtuais = filtrarPorVale(todasRecentes, campoVale.value).slice(0, QTD_ULTIMOS);
    ordenacaoAtual = { chave: "criadoEmMs", direcao: "desc", tipo: "numero" };
    renderizarUltimos(ultimosAtuais);
}
let ordenacaoAtual = { chave: "criadoEmMs", direcao: "desc", tipo: "numero" };

ativarOrdenacao(document.querySelector("#tabela-ultimos thead"), (chave, direcao, tipo) => {
    ordenacaoAtual = { chave, direcao, tipo };
    renderizarUltimos(ultimosAtuais);
});

// Uma única busca (com cache) serve tanto para as sugestões de Banco/Classificação
// quanto para os últimos lançamentos.
async function carregarDadosAuxiliares(forcarAtualizacao = false) {
    try {
        const transacoes = await obterTransacoes(usuario, { forcarAtualizacao });

        const bancosUsados = transacoes.map(t => t.banco).filter(Boolean);
        const classificacoesUsadas = transacoes.map(t => t.classificacao_saida).filter(Boolean);
        comboboxBanco.atualizarOpcoes(mesclarSugestoes(BANCOS_SUGERIDOS, bancosUsados));
        comboboxClassificacao.atualizarOpcoes(mesclarSugestoes(CLASSIFICACOES_SUGERIDAS, classificacoesUsadas));

        todasRecentes = [...transacoes].sort((a, b) => (b.criadoEmMs ?? 0) - (a.criadoEmMs ?? 0));
        atualizarUltimos();

    } catch (erro) {
        console.error("Não foi possível carregar dados auxiliares:", erro);
        comboboxBanco.atualizarOpcoes(BANCOS_SUGERIDOS);
        comboboxClassificacao.atualizarOpcoes(CLASSIFICACOES_SUGERIDAS);
        mostrarLinhaMensagem(document.querySelector("#tabela-ultimos tbody"), 5, "Erro ao carregar. Verifique o console (F12).");
    }
}

function celulaTexto(texto) {
    const td = document.createElement("td");
    td.textContent = texto;
    return td;
}

function renderizarUltimos(lista) {
    const listaOrdenada = [...lista].sort((a, b) => {
        const resultado = compararValores(a[ordenacaoAtual.chave], b[ordenacaoAtual.chave], ordenacaoAtual.tipo);
        return ordenacaoAtual.direcao === "asc" ? resultado : -resultado;
    });

    const corpo = document.querySelector("#tabela-ultimos tbody");
    corpo.replaceChildren();

    if (listaOrdenada.length === 0) {
        mostrarLinhaMensagem(corpo, 5, "Nenhum lançamento ainda.");
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
        preencherBotao(botaoEditar, "editar");
        botaoEditar.addEventListener("click", () => editarTransacao(transacao));

        const botaoExcluir = document.createElement("button");
        botaoExcluir.className = "botao-icone-perigo";
        botaoExcluir.title = "Excluir lançamento";
        preencherBotao(botaoExcluir, "excluir");
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

function listasDeSugestao(transacoes) {
    const bancosUsados = transacoes.map(t => t.banco).filter(Boolean);
    const classificacoesUsadas = transacoes.map(t => t.classificacao_saida).filter(Boolean);
    return {
        bancosSugeridos: mesclarSugestoes(BANCOS_SUGERIDOS, bancosUsados),
        classificacoesSugeridas: mesclarSugestoes(CLASSIFICACOES_SUGERIDAS, classificacoesUsadas)
    };
}

async function editarTransacao(transacao) {
    const dadosEditados = await abrirEditorTransacao(transacao, listasDeSugestao(ultimosAtuais));
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

inicializarRecorrencias();

document.getElementById("form-recorrencia")?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    try {
        const { config } = await carregarConfiguracoes(usuario, { forcarAtualizacao: true });
        const normalizar = (id) => document.getElementById(id).value.trim().toUpperCase();
        const modelo = {
            id: crypto.randomUUID(), ativo: true,
            valor: Number(document.getElementById("rec-valor").value),
            dia: Number(document.getElementById("rec-dia").value),
            descricao: normalizar("rec-descricao"), saida: normalizar("rec-detalhe"),
            banco: normalizar("rec-banco"), tipo: document.getElementById("rec-tipo").value,
            tipo_mov: "EXTERNO", classificacao_saida: normalizar("rec-classificacao")
        };
        configuracaoAtual = await salvarConfiguracoes(usuario, { ...config, recorrencias: [...(config.recorrencias ?? []), modelo] });
        renderizarRecorrencias();
        evento.currentTarget.reset();
        mostrarToast("Recorrência adicionada.", "sucesso");
        inicializarRecorrencias();
    } catch (erro) { console.error("Erro ao salvar recorrência:", erro); mostrarToast("Não foi possível salvar a recorrência.", "erro"); }
});

const formulario = document.getElementById("form-transacao");

formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    const dataNormalizada = normalizarDataDigitada(campoData.value);
    if (dataNormalizada) campoData.value = dataNormalizada;

    const botaoSalvar = formulario.querySelector("button[type=submit]");

    const valor = parseFloat(document.getElementById("valor").value);
    const dataISO = brParaISO(campoData.value);
    const descricao = document.getElementById("descricao").value.trim().toUpperCase();
    const saida = document.getElementById("saida").value.trim().toUpperCase();
    const banco = normalizarNomeBanco(document.getElementById("banco").value.trim().toUpperCase());
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
