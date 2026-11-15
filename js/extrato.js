import { exigirLogin } from "./auth-guard.js";
import { renderizarNav } from "./nav.js";
import {
    isoParaBR, brParaISO, normalizarDataDigitada, formatarReais, hojeISO,
    ligarCampoFiltroData, intervaloMesAtual, intervaloParaAnoEMeses,
    NOMES_MESES, nomeMesParaNumero, numeroParaNomeMes
} from "./utils.js";
import { criarSeletorMultiplo } from "./combobox.js";
import { ativarOrdenacao, compararValores } from "./tabela-ordenavel.js";
import { mostrarToast, confirmarAcao, preencherBotao, mostrarLinhaMensagem } from "./ui.js";
import { obterTransacoes, criarTransacao, excluirTransacaoPorId, atualizarTransacao } from "./dados-carteira.js";
import { obterFiltroSalvo, salvarFiltro } from "./preferencias-filtros.js";
import { BANCOS_SUGERIDOS, CLASSIFICACOES_SUGERIDAS, mesclarSugestoes } from "./dados-comuns.js";
import { abrirEditorTransacao } from "./editor-transacao.js";
import { exportarTransacoesXLSX } from "./exportar-excel.js";
import { filtrarPorVale, preencherSelectVale } from "./vale.js";
import { finalidadeDe } from "./finalidade.js";

const NOME_PAGINA = "extrato";

const usuario = await exigirLogin();
renderizarNav("extrato", usuario.email);

const campoAno = document.getElementById("filtro-ano");
const campoInicio = document.getElementById("filtro-data-inicio");
const campoFim = document.getElementById("filtro-data-fim");
const campoMov = document.getElementById("filtro-movimentacao");
const campoTipo = document.getElementById("filtro-tipo");
const campoSituacao = document.getElementById("filtro-situacao");
const campoVale = document.getElementById("filtro-vale");
preencherSelectVale(campoVale);
const campoDetalhe = document.getElementById("filtro-detalhe");
const campoDescricao = document.getElementById("filtro-descricao");

function contextoMesAtual() {
    const selecionados = seletorMes.obterSelecionados();
    const mesNumero = selecionados.length > 0 ? nomeMesParaNumero(selecionados[0]) : String(new Date().getMonth() + 1).padStart(2, "0");
    return { ano: campoAno.value, mes: mesNumero };
}

ligarCampoFiltroData(campoInicio, contextoMesAtual);
ligarCampoFiltroData(campoFim, contextoMesAtual);

const seletorMes = criarSeletorMultiplo({
    container: document.getElementById("filtro-mes"),
    opcoes: NOMES_MESES,
    rotuloTodos: "Todos os meses",
    aoMudar: () => { aplicarAnoMesNosCampos(); aplicarFiltros(); }
});

const seletorBanco = criarSeletorMultiplo({
    container: document.getElementById("filtro-banco"),
    opcoes: [],
    rotuloTodos: "Todos os bancos",
    aoMudar: aplicarFiltros
});

const seletorClassificacao = criarSeletorMultiplo({
    container: document.getElementById("filtro-classificacao"),
    opcoes: [],
    rotuloTodos: "Todas as classificações",
    aoMudar: aplicarFiltros
});

function atualizarOpcoesClassificacao() {
    const classificacoes = [...new Set(todasTransacoes.map(t => t.classificacao_saida).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    seletorClassificacao.definirOpcoes(classificacoes);
    seletorClassificacao.definirSelecionados(seletorClassificacao.obterSelecionados().filter(c => classificacoes.includes(c)));
    return classificacoes;
}

// Filtro que só existe quando se chega pelo Dashboard (clique num valor da
// "Evolução por categoria"): a categoria de lá é a classificação depois das
// regras de equiparação, e só filtrando por ela a lista bate com o valor
// clicado. Não é salvo; some em "Tirar este filtro" ou "Mês atual".
let categoriaDoDashboard = "";
const faixaCategoriaDashboard = document.getElementById("faixa-categoria-dashboard");

function definirCategoriaDoDashboard(categoria) {
    categoriaDoDashboard = categoria || "";
    faixaCategoriaDashboard.hidden = !categoriaDoDashboard;
    document.getElementById("texto-categoria-dashboard").textContent = categoriaDoDashboard
        ? `Vindo do Dashboard: só os lançamentos que entram na categoria "${categoriaDoDashboard}" (classificação depois das regras de equiparação).`
        : "";
}

document.getElementById("btn-limpar-categoria-dashboard").addEventListener("click", () => {
    definirCategoriaDoDashboard("");
    aplicarFiltros();
});

let todasTransacoes = [];
let listaFiltradaAtual = [];
let ordenacaoAtual = { chave: "data", direcao: "desc", tipo: "texto" };
let carregando = true;

const controladorOrdenacao = ativarOrdenacao(document.querySelector("#tabela-transacoes thead"), (chave, direcao, tipo) => {
    ordenacaoAtual = { chave, direcao, tipo };
    aplicarFiltros();
});

function celulaTexto(texto) {
    const td = document.createElement("td");
    td.textContent = texto;
    return td;
}

function popularSeletorAno(anoSelecionado) {
    const anoAtual = new Date().getFullYear();
    const anosDosDados = todasTransacoes.map(t => Number((t.data ?? "").slice(0, 4))).filter(Boolean);
    const anos = new Set([anoAtual, ...anosDosDados]);
    const listaOrdenada = Array.from(anos).sort((a, b) => b - a);

    campoAno.replaceChildren();
    listaOrdenada.forEach((ano) => {
        const opcao = document.createElement("option");
        opcao.value = String(ano);
        opcao.textContent = String(ano);
        campoAno.appendChild(opcao);
    });
    if (listaOrdenada.includes(Number(anoSelecionado))) campoAno.value = String(anoSelecionado);
}

function aplicarAnoMesNosCampos() {
    const mesesNumeros = seletorMes.obterSelecionados().map(nomeMesParaNumero).filter(Boolean);
    const { inicioISO, fimISO } = intervaloParaAnoEMeses(campoAno.value, mesesNumeros);
    campoInicio.value = isoParaBR(inicioISO);
    campoFim.value = isoParaBR(fimISO);
}

campoAno.addEventListener("change", () => { aplicarAnoMesNosCampos(); aplicarFiltros(); });
campoMov.addEventListener("change", aplicarFiltros);
campoTipo.addEventListener("change", aplicarFiltros);
campoSituacao.addEventListener("change", aplicarFiltros);
campoVale.addEventListener("change", aplicarFiltros);

function debounce(fn, atrasoMs) {
    let temporizador;
    return (...args) => {
        clearTimeout(temporizador);
        temporizador = setTimeout(() => fn(...args), atrasoMs);
    };
}
campoDetalhe.addEventListener("input", debounce(aplicarFiltros, 250));
campoDescricao.addEventListener("input", debounce(aplicarFiltros, 250));

function renderizarResumo(lista) {
    const hoje = hojeISO();
    let entradas = 0;
    let saidas = 0;
    let saldoFuturoLiquido = 0;

    lista.forEach((t) => {
        if (typeof t.valor !== "number") return;
        const sinal = t.tipo === "ENTRADA" ? t.valor : -t.valor;

        if ((t.data ?? "") > hoje) {
            saldoFuturoLiquido += sinal;
        } else if (t.tipo === "ENTRADA") {
            entradas += t.valor;
        } else {
            saidas += t.valor;
        }
    });

    const saldo = entradas - saidas;
    const saldoPrevisto = saldo + saldoFuturoLiquido;
    const cartaoSaldo = document.getElementById("cartao-saldo");

    document.getElementById("total-entradas").textContent = formatarReais(entradas);
    document.getElementById("total-saidas").textContent = formatarReais(saidas);
    document.getElementById("total-saldo").textContent = formatarReais(saldo);
    document.getElementById("total-saldo-previsto").textContent = formatarReais(saldoPrevisto);

    cartaoSaldo.classList.remove("metrica-saldo-pos", "metrica-saldo-neg");
    cartaoSaldo.classList.add(saldo >= 0 ? "metrica-saldo-pos" : "metrica-saldo-neg");
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
        todasTransacoes = todasTransacoes.filter((t) => t.id !== transacao.id);
        atualizarOpcoesClassificacao();
        aplicarFiltros();
        mostrarToast("Lançamento excluído.", "sucesso");
    } catch (erro) {
        console.error("Erro ao excluir:", erro);
        mostrarToast("Erro ao excluir. Tente novamente.", "erro");
    }
}

function listasDeSugestao() {
    const bancosUsados = todasTransacoes.map(t => t.banco).filter(Boolean);
    const classificacoesUsadas = todasTransacoes.map(t => t.classificacao_saida).filter(Boolean);
    return {
        bancosSugeridos: mesclarSugestoes(BANCOS_SUGERIDOS, bancosUsados),
        classificacoesSugeridas: mesclarSugestoes(CLASSIFICACOES_SUGERIDAS, classificacoesUsadas)
    };
}

async function editarTransacao(transacao) {
    const dadosEditados = await abrirEditorTransacao(transacao, listasDeSugestao());
    if (!dadosEditados) return;

    try {
        await atualizarTransacao(usuario, transacao.id, dadosEditados);
        todasTransacoes = todasTransacoes.map((t) => (t.id === transacao.id ? { ...t, ...dadosEditados } : t));
        atualizarOpcoesClassificacao();
        aplicarFiltros();
        mostrarToast("Lançamento atualizado!", "sucesso");
    } catch (erro) {
        console.error("Erro ao atualizar:", erro);
        mostrarToast("Erro ao salvar as alterações. Tente novamente.", "erro");
    }
}

// Monta um "rascunho" de transação com o que já dá pra deduzir dos filtros
// ativos, para pré-preencher o modal de novo lançamento: data = dia 01 do
// mês/intervalo filtrado; banco = só se houver exatamente 1 banco filtrado;
// descrição/detalhe/movimentação = copiados dos respectivos filtros de texto.
function preenchimentoNovoLancamento() {
    const dataInicioISO = brParaISO(normalizarDataDigitada(campoInicio.value) ?? "");
    const data = dataInicioISO ? `${dataInicioISO.slice(0, 7)}-01` : hojeISO();

    const bancosFiltro = seletorBanco.obterSelecionados();
    const banco = bancosFiltro.length === 1 ? bancosFiltro[0] : "";

    return {
        data,
        banco,
        descricao: campoDescricao.value.trim(),
        saida: campoDetalhe.value.trim(),
        tipo_mov: campoMov.value || undefined
    };
}

async function novoLancamento() {
    const dadosNovos = await abrirEditorTransacao(preenchimentoNovoLancamento(), {
        ...listasDeSugestao(),
        titulo: "Novo lançamento",
        textoSalvar: "Salvar transação"
    });
    if (!dadosNovos) return;

    try {
        const id = await criarTransacao(usuario, dadosNovos);
        todasTransacoes = [...todasTransacoes, { id, userId: usuario.uid, ...dadosNovos, criadoEmMs: Date.now() }];
        atualizarOpcoesClassificacao();
        aplicarFiltros();
        mostrarToast("Lançamento criado!", "sucesso");
    } catch (erro) {
        console.error("Erro ao criar lançamento:", erro);
        mostrarToast("Erro ao salvar. Tente novamente.", "erro");
    }
}

document.getElementById("btn-novo-lancamento").addEventListener("click", novoLancamento);

document.getElementById("btn-exportar-excel").addEventListener("click", () => {
    if (listaFiltradaAtual.length === 0) {
        mostrarToast("Nenhum lançamento para exportar neste filtro.", "erro");
        return;
    }
    const agora = new Date();
    const carimbo = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
    exportarTransacoesXLSX(listaFiltradaAtual, `Despesas Mensais - ${carimbo}.xlsx`);
    mostrarToast("Arquivo exportado!", "sucesso");
});

function renderizarTabela(lista) {
    listaFiltradaAtual = lista;

    const corpoTabela = document.querySelector("#tabela-transacoes tbody");
    corpoTabela.replaceChildren();

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

    const hoje = hojeISO();

    lista.forEach((transacao) => {
        if (!transacao.data || typeof transacao.valor !== "number") return;

        const ehFuturo = transacao.data > hoje;
        const classeCor = transacao.tipo === "SAIDA" ? "saida" : "entrada";
        const sinal = transacao.tipo === "SAIDA" ? "-" : "+";

        const linha = document.createElement("tr");
        if (ehFuturo) linha.classList.add("linha-prevista");

        const tdData = celulaTexto(isoParaBR(transacao.data));
        if (ehFuturo) {
            const selo = document.createElement("span");
            selo.className = "selo-previsto";
            selo.textContent = "Previsto";
            tdData.appendChild(selo);
        }
        linha.appendChild(tdData);

        linha.appendChild(celulaTexto(transacao.descricao ?? ""));
        linha.appendChild(celulaTexto(transacao.saida ?? ""));

        const tdMov = document.createElement("td");
        const seloMov = document.createElement("span");
        seloMov.className = `selo-mov ${transacao.tipo_mov === "INTERNO" ? "selo-interno" : "selo-externo"}`;
        seloMov.textContent = transacao.tipo_mov === "INTERNO" ? "🔁 Interno" : "🌐 Externo";
        tdMov.appendChild(seloMov);
        linha.appendChild(tdMov);

        linha.appendChild(celulaTexto(transacao.banco ?? ""));
        linha.appendChild(celulaTexto(transacao.classificacao_saida ?? ""));

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

        corpoTabela.appendChild(linha);
    });
}

function salvarEstadoFiltro() {
    if (carregando) return;
    salvarFiltro(usuario.uid, NOME_PAGINA, {
        ano: campoAno.value,
        meses: seletorMes.obterSelecionados(),
        inicioBR: campoInicio.value,
        fimBR: campoFim.value,
        bancos: seletorBanco.obterSelecionados(),
        classificacoes: seletorClassificacao.obterSelecionados(),
        mov: campoMov.value,
        tipo: campoTipo.value,
        situacao: campoSituacao.value,
        vale: campoVale.value,
        detalhe: campoDetalhe.value,
        descricao: campoDescricao.value,
        ordenacao: ordenacaoAtual
    });
}

function aplicarFiltros() {
    const dataInicioISO = brParaISO(normalizarDataDigitada(campoInicio.value) ?? "");
    const dataFimISO = brParaISO(normalizarDataDigitada(campoFim.value) ?? "");
    const bancosFiltro = seletorBanco.obterSelecionados();
    const classificacoesFiltro = seletorClassificacao.obterSelecionados();
    const mesesFiltro = seletorMes.obterSelecionados().map(nomeMesParaNumero).filter(Boolean);
    const movFiltro = campoMov.value;
    const tipoFiltro = campoTipo.value;
    const situacaoFiltro = campoSituacao.value;
    const detalheFiltro = campoDetalhe.value.trim().toUpperCase();
    const descricaoFiltro = campoDescricao.value.trim().toUpperCase();

    let listaFiltrada = todasTransacoes;

    if (dataInicioISO) listaFiltrada = listaFiltrada.filter(t => t.data >= dataInicioISO);
    if (dataFimISO) listaFiltrada = listaFiltrada.filter(t => t.data <= dataFimISO);
    if (mesesFiltro.length > 0) listaFiltrada = listaFiltrada.filter(t => mesesFiltro.includes((t.data ?? "").slice(5, 7)));
    if (bancosFiltro.length > 0) listaFiltrada = listaFiltrada.filter(t => bancosFiltro.includes(t.banco));
    if (classificacoesFiltro.length > 0) listaFiltrada = listaFiltrada.filter(t => classificacoesFiltro.includes(t.classificacao_saida));
    if (categoriaDoDashboard) listaFiltrada = listaFiltrada.filter(t => finalidadeDe(t) === categoriaDoDashboard);
    if (movFiltro !== "") listaFiltrada = listaFiltrada.filter(t => t.tipo_mov === movFiltro);
    if (tipoFiltro !== "") listaFiltrada = listaFiltrada.filter(t => t.tipo === tipoFiltro);
    listaFiltrada = filtrarPorVale(listaFiltrada, campoVale.value);
    if (situacaoFiltro !== "") {
        const hoje = hojeISO();
        listaFiltrada = listaFiltrada.filter(t => (situacaoFiltro === "PREVISTA") === ((t.data ?? "") > hoje));
    }
    if (detalheFiltro !== "") listaFiltrada = listaFiltrada.filter(t => (t.saida ?? "").includes(detalheFiltro));
    if (descricaoFiltro !== "") listaFiltrada = listaFiltrada.filter(t => (t.descricao ?? "").includes(descricaoFiltro));

    listaFiltrada = [...listaFiltrada].sort((a, b) => {
        const resultado = compararValores(a[ordenacaoAtual.chave], b[ordenacaoAtual.chave], ordenacaoAtual.tipo);
        return ordenacaoAtual.direcao === "asc" ? resultado : -resultado;
    });

    renderizarTabela(listaFiltrada);
    salvarEstadoFiltro();
}

document.getElementById("btn-filtrar").addEventListener("click", aplicarFiltros);

document.getElementById("btn-limpar").addEventListener("click", () => {
    const { ano, mes } = intervaloMesAtual();
    campoAno.value = String(ano);
    seletorMes.definirSelecionados([numeroParaNomeMes(String(mes).padStart(2, "0"))]);
    aplicarAnoMesNosCampos();
    seletorBanco.definirSelecionados([]);
    seletorClassificacao.definirSelecionados([]);
    definirCategoriaDoDashboard("");
    campoMov.value = "";
    campoTipo.value = "";
    campoSituacao.value = "";
    campoVale.value = "";
    campoDetalhe.value = "";
    campoDescricao.value = "";
    ordenacaoAtual = { chave: "data", direcao: "desc", tipo: "texto" };
    controladorOrdenacao.definirEstado("data", "desc");
    aplicarFiltros();
});

// Atalho do Dashboard (clique num valor da "Evolução por categoria"): os filtros
// vêm no endereço e são retirados dele depois de lidos, para um F5 não reaplicar.
function lerAtalhoDoDashboard() {
    const p = new URLSearchParams(window.location.search);
    if (p.get("origem") !== "dashboard") return null;
    let bancos = [];
    try { bancos = JSON.parse(p.get("bancos") ?? "[]"); } catch { /* ignora */ }
    const atalho = {
        ano: p.get("ano") ?? "",
        meses: (p.get("meses") ?? "").split(",").filter(Boolean),
        categoria: p.get("cat") ?? "",
        tipo: ["ENTRADA", "SAIDA"].includes(p.get("tipo")) ? p.get("tipo") : "",
        mov: ["EXTERNO", "INTERNO"].includes(p.get("mov")) ? p.get("mov") : "",
        bancos: Array.isArray(bancos) ? bancos : [],
        vale: p.get("vale") ?? "",
        descricao: (p.get("descricao") ?? "").toUpperCase(),
        detalhe: (p.get("detalhe") ?? "").toUpperCase()
    };
    window.history.replaceState(null, "", window.location.pathname);
    return atalho;
}

document.getElementById("btn-atualizar").addEventListener("click", () => carregarTransacoesDoBanco(true));

async function carregarTransacoesDoBanco(forcarAtualizacao = false) {
    const corpoTabela = document.querySelector("#tabela-transacoes tbody");
    mostrarLinhaMensagem(corpoTabela, 8, "Carregando dados...");

    try {
        todasTransacoes = await obterTransacoes(usuario, { forcarAtualizacao });

        const bancosDisponiveis = [...new Set(todasTransacoes.map(t => t.banco).filter(Boolean))].sort();
        seletorBanco.definirOpcoes(bancosDisponiveis);
        const classificacoesDisponiveis = atualizarOpcoesClassificacao();

        const atalho = forcarAtualizacao ? null : lerAtalhoDoDashboard();

        if (atalho) {
            // Veio de um valor clicado no Dashboard: vale o filtro do atalho, não o salvo.
            popularSeletorAno(Number(atalho.ano) || new Date().getFullYear());
            seletorMes.definirSelecionados(atalho.meses.map(numeroParaNomeMes).filter(Boolean));
            aplicarAnoMesNosCampos();
            seletorBanco.definirSelecionados(atalho.bancos.filter(b => bancosDisponiveis.includes(b)));
            seletorClassificacao.definirSelecionados([]);
            definirCategoriaDoDashboard(atalho.categoria);
            campoMov.value = atalho.mov;
            campoTipo.value = atalho.tipo;
            campoSituacao.value = "";
            campoVale.value = atalho.vale;
            campoDetalhe.value = atalho.detalhe;
            campoDescricao.value = atalho.descricao;
        } else if (!forcarAtualizacao) {
            const salvo = obterFiltroSalvo(usuario.uid, NOME_PAGINA);

            if (salvo) {
                popularSeletorAno(Number(salvo.ano) || new Date().getFullYear());
                seletorMes.definirSelecionados(salvo.meses ?? []);
                campoInicio.value = salvo.inicioBR ?? "";
                campoFim.value = salvo.fimBR ?? "";
                seletorBanco.definirSelecionados((salvo.bancos ?? []).filter(b => bancosDisponiveis.includes(b)));
                seletorClassificacao.definirSelecionados((salvo.classificacoes ?? []).filter(c => classificacoesDisponiveis.includes(c)));
                campoMov.value = salvo.mov ?? "";
                campoTipo.value = salvo.tipo ?? "";
                campoSituacao.value = salvo.situacao ?? "";
                campoVale.value = salvo.vale ?? "";
                campoDetalhe.value = salvo.detalhe ?? "";
                campoDescricao.value = salvo.descricao ?? "";
                if (salvo.ordenacao && salvo.ordenacao.chave !== "categoria") {
                    ordenacaoAtual = salvo.ordenacao;
                    controladorOrdenacao.definirEstado(salvo.ordenacao.chave, salvo.ordenacao.direcao);
                }
            } else {
                const { ano, mes, inicioISO, fimISO } = intervaloMesAtual();
                popularSeletorAno(ano);
                seletorMes.definirSelecionados([numeroParaNomeMes(String(mes).padStart(2, "0"))]);
                campoInicio.value = isoParaBR(inicioISO);
                campoFim.value = isoParaBR(fimISO);
            }
        } else {
            popularSeletorAno(Number(campoAno.value) || new Date().getFullYear());
            mostrarToast("Dados atualizados.", "sucesso");
        }

        carregando = false;
        aplicarFiltros();

    } catch (erro) {
        console.error("Erro ao buscar transações: ", erro);
        mostrarLinhaMensagem(corpoTabela, 8, "Erro ao carregar dados. Verifique o console (F12) para detalhes.");
    }
}

carregarTransacoesDoBanco();
