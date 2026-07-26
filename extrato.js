import { exigirLogin } from "./auth-guard.js";
import { renderizarNav } from "./nav.js";
import {
    isoParaBR, brParaISO, normalizarDataDigitada, formatarReais,
    ligarCampoDataInteligente, intervaloMesAtual, intervaloParaAnoMes
} from "./utils.js";
import { criarSeletorMultiplo } from "./combobox.js";
import { ativarOrdenacao, compararValores } from "./tabela-ordenavel.js";
import { mostrarToast, confirmarAcao } from "./ui.js";
import { obterTransacoes, excluirTransacaoPorId } from "./dados-carteira.js";
import { obterFiltroSalvo, salvarFiltro } from "./preferencias-filtros.js";

const NOME_PAGINA = "extrato";

const usuario = await exigirLogin();
renderizarNav("extrato", usuario.email);

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
let ordenacaoAtual = { chave: "data", direcao: "desc", tipo: "texto" };
let carregando = true; // evita salvar o filtro default antes de restaurar o que estava salvo

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

    campoAno.innerHTML = "";
    listaOrdenada.forEach((ano) => {
        const opcao = document.createElement("option");
        opcao.value = String(ano);
        opcao.textContent = String(ano);
        campoAno.appendChild(opcao);
    });
    if (listaOrdenada.includes(Number(anoSelecionado))) campoAno.value = String(anoSelecionado);
}

function aplicarAnoMesNosCampos() {
    const { inicioISO, fimISO } = intervaloParaAnoMes(campoAno.value, campoMes.value);
    campoInicio.value = isoParaBR(inicioISO);
    campoFim.value = isoParaBR(fimISO);
}

campoAno.addEventListener("change", () => { aplicarAnoMesNosCampos(); aplicarFiltros(); });
campoMes.addEventListener("change", () => { aplicarAnoMesNosCampos(); aplicarFiltros(); });
campoMov.addEventListener("change", aplicarFiltros);

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

    document.getElementById("total-entradas").textContent = formatarReais(entradas);
    document.getElementById("total-saidas").textContent = formatarReais(saidas);
    document.getElementById("total-saldo").textContent = formatarReais(saldo);

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

        corpoTabela.appendChild(linha);
    });
}

function salvarEstadoFiltro() {
    if (carregando) return; // não sobrescreve o salvo enquanto ainda estamos restaurando
    salvarFiltro(usuario.uid, NOME_PAGINA, {
        ano: campoAno.value,
        mes: campoMes.value,
        inicioBR: campoInicio.value,
        fimBR: campoFim.value,
        bancos: seletorBanco.obterSelecionados(),
        mov: campoMov.value,
        ordenacao: ordenacaoAtual
    });
}

function aplicarFiltros() {
    const dataInicioISO = brParaISO(normalizarDataDigitada(campoInicio.value) ?? "");
    const dataFimISO = brParaISO(normalizarDataDigitada(campoFim.value) ?? "");
    const bancosFiltro = seletorBanco.obterSelecionados();
    const movFiltro = campoMov.value;

    let listaFiltrada = todasTransacoes;

    if (dataInicioISO) listaFiltrada = listaFiltrada.filter(t => t.data >= dataInicioISO);
    if (dataFimISO) listaFiltrada = listaFiltrada.filter(t => t.data <= dataFimISO);
    if (bancosFiltro.length > 0) listaFiltrada = listaFiltrada.filter(t => bancosFiltro.includes(t.banco));
    if (movFiltro !== "") listaFiltrada = listaFiltrada.filter(t => t.tipo_mov === movFiltro);

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
    campoMes.value = String(mes).padStart(2, "0");
    aplicarAnoMesNosCampos();
    seletorBanco.definirSelecionados([]);
    campoMov.value = "";
    ordenacaoAtual = { chave: "data", direcao: "desc", tipo: "texto" };
    controladorOrdenacao.definirEstado("data", "desc");
    aplicarFiltros();
});

document.getElementById("btn-atualizar").addEventListener("click", () => carregarTransacoesDoBanco(true));

async function carregarTransacoesDoBanco(forcarAtualizacao = false) {
    const corpoTabela = document.querySelector("#tabela-transacoes tbody");
    corpoTabela.innerHTML = "<tr><td colspan='8' class='vazio'>Carregando dados...</td></tr>";

    try {
        todasTransacoes = await obterTransacoes(usuario, { forcarAtualizacao });

        const bancosDisponiveis = [...new Set(todasTransacoes.map(t => t.banco).filter(Boolean))].sort();
        seletorBanco.definirOpcoes(bancosDisponiveis);

        if (!forcarAtualizacao) {
            const salvo = obterFiltroSalvo(usuario.uid, NOME_PAGINA);

            if (salvo) {
                // Restaura o filtro e a ordenação que estavam configurados da última vez
                popularSeletorAno(Number(salvo.ano) || new Date().getFullYear());
                campoMes.value = salvo.mes ?? "";
                campoInicio.value = salvo.inicioBR ?? "";
                campoFim.value = salvo.fimBR ?? "";
                seletorBanco.definirSelecionados((salvo.bancos ?? []).filter(b => bancosDisponiveis.includes(b)));
                campoMov.value = salvo.mov ?? "";
                if (salvo.ordenacao) {
                    ordenacaoAtual = salvo.ordenacao;
                    controladorOrdenacao.definirEstado(salvo.ordenacao.chave, salvo.ordenacao.direcao);
                }
            } else {
                // Primeira vez: padrão é mês atual, do dia 1 até hoje
                const { ano, mes, inicioISO, fimISO } = intervaloMesAtual();
                popularSeletorAno(ano);
                campoMes.value = String(mes).padStart(2, "0");
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
        corpoTabela.innerHTML = "<tr><td colspan='8' class='vazio'>Erro ao carregar dados. Verifique o console (F12) para detalhes.</td></tr>";
    }
}

carregarTransacoesDoBanco();
