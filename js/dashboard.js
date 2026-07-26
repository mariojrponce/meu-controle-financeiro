import { exigirLogin } from "./auth-guard.js";
import { renderizarNav } from "./nav.js";
import {
    formatarReais, isoParaBR, brParaISO, normalizarDataDigitada, hojeISO,
    ligarCampoFiltroData, intervaloMesAtual, intervaloParaAnoEMeses,
    NOMES_MESES, nomeMesParaNumero, numeroParaNomeMes
} from "./utils.js";
import { criarSeletorMultiplo } from "./combobox.js";
import { obterCorBanco } from "./cores-bancos.js";
import { obterTransacoes } from "./dados-carteira.js";
import { mostrarToast } from "./ui.js";
import { obterFiltroSalvo, salvarFiltro } from "./preferencias-filtros.js";
import {
    obterCategoriasSeparadas, salvarCategoriasSeparadas,
    obterVisoesPersonalizadas, salvarVisoesPersonalizadas
} from "./preferencias-dashboard.js";

const NOME_PAGINA = "dashboard";
const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const ROTULOS_CAMPO = { classificacao_saida: "Classificação", banco: "Banco", saida: "Detalhe", descricao: "Descrição" };

const usuario = await exigirLogin();
renderizarNav("dashboard", usuario.email);

const campoAno = document.getElementById("filtro-ano");
const campoInicio = document.getElementById("filtro-data-inicio");
const campoFim = document.getElementById("filtro-data-fim");
const campoMov = document.getElementById("filtro-movimentacao");
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

let todasTransacoes = [];
let seletorCategoriasSeparadas = null;
let carregando = true;

campoAno.addEventListener("change", () => { aplicarAnoMesNosCampos(); aplicarFiltros(); });
campoMov.addEventListener("change", aplicarFiltros);
document.getElementById("btn-filtrar").addEventListener("click", aplicarFiltros);
document.getElementById("btn-atualizar").addEventListener("click", () => carregarDashboard(true));

function debounce(fn, atrasoMs) {
    let temporizador;
    return (...args) => {
        clearTimeout(temporizador);
        temporizador = setTimeout(() => fn(...args), atrasoMs);
    };
}
campoDetalhe.addEventListener("input", debounce(aplicarFiltros, 250));
campoDescricao.addEventListener("input", debounce(aplicarFiltros, 250));

document.getElementById("btn-limpar").addEventListener("click", () => {
    const { ano, mes } = intervaloMesAtual();
    campoAno.value = String(ano);
    seletorMes.definirSelecionados([numeroParaNomeMes(String(mes).padStart(2, "0"))]);
    aplicarAnoMesNosCampos();
    seletorBanco.definirSelecionados([]);
    campoMov.value = "";
    campoDetalhe.value = "";
    campoDescricao.value = "";
    aplicarFiltros();
});

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
    const mesesNumeros = seletorMes.obterSelecionados().map(nomeMesParaNumero).filter(Boolean);
    const { inicioISO, fimISO } = intervaloParaAnoEMeses(campoAno.value, mesesNumeros);
    campoInicio.value = isoParaBR(inicioISO);
    campoFim.value = isoParaBR(fimISO);
}

function rotuloDoPeriodo(inicioISO, fimISO) {
    if (!inicioISO || !fimISO) return "";
    const [anoI, mesI] = inicioISO.split("-");
    const [anoF, mesF] = fimISO.split("-");
    if (anoI === anoF && mesI === mesF) {
        const nomeMes = NOMES_MES[Number(mesI) - 1];
        return `${nomeMes.charAt(0).toUpperCase()}${nomeMes.slice(1)}/${anoI.slice(2)}`;
    }
    return `${isoParaBR(inicioISO)} a ${isoParaBR(fimISO)}`;
}

function linhaCarteira(rotulo, valor, classeExtra = "") {
    const linha = document.createElement("div");
    linha.className = `linha-carteira ${classeExtra}`;

    const spanRotulo = document.createElement("span");
    spanRotulo.className = "rotulo-linha";
    spanRotulo.textContent = rotulo;

    const spanValor = document.createElement("span");
    spanValor.className = "valor-linha";
    spanValor.textContent = formatarReais(valor);
    if (classeExtra === "saldo") spanValor.classList.add(valor >= 0 ? "valor-positivo" : "valor-negativo");

    linha.appendChild(spanRotulo);
    linha.appendChild(spanValor);
    return linha;
}

function renderizarCarteiras(porBanco) {
    const container = document.getElementById("grade-carteiras");
    container.innerHTML = "";

    const bancos = Object.keys(porBanco).sort((a, b) => porBanco[b].saldo - porBanco[a].saldo);
    if (bancos.length === 0) {
        container.innerHTML = "<p class='vazio'>Nenhuma transação neste período.</p>";
        return;
    }

    bancos.forEach((banco) => {
        const dados = porBanco[banco];
        const cor = obterCorBanco(banco);

        const cartao = document.createElement("div");
        cartao.className = "cartao-carteira";
        cartao.style.borderTopColor = cor;

        const nome = document.createElement("div");
        nome.className = "nome-banco";
        const ponto = document.createElement("span");
        ponto.className = "ponto-banco";
        ponto.style.background = cor;
        nome.appendChild(ponto);
        nome.appendChild(document.createTextNode(banco));
        cartao.appendChild(nome);

        cartao.appendChild(linhaCarteira("Entradas", dados.entradas));
        cartao.appendChild(linhaCarteira("Saídas", dados.saidas));
        cartao.appendChild(linhaCarteira("Saldo", dados.saldo, "saldo"));

        container.appendChild(cartao);
    });
}

function removerCategoriaSeparada(categoria) {
    const restantes = obterCategoriasSeparadas(usuario.uid).filter((c) => c !== categoria);
    salvarCategoriasSeparadas(usuario.uid, restantes);
    if (seletorCategoriasSeparadas) seletorCategoriasSeparadas.definirSelecionados(restantes);
    aplicarFiltros();
}

function renderizarCartoesCategoriaSeparada(dadosPorCategoria) {
    const container = document.getElementById("grade-categorias-separadas");
    container.innerHTML = "";

    const categorias = Object.keys(dadosPorCategoria);
    if (categorias.length === 0) {
        container.innerHTML = "<p class='vazio'>Nenhuma categoria configurada como \"à parte\" ainda.</p>";
        return;
    }

    categorias.forEach((categoria) => {
        const dados = dadosPorCategoria[categoria];
        const cartao = document.createElement("div");
        cartao.className = "cartao-carteira";
        cartao.style.borderTopColor = "#d97706";

        const cabecalho = document.createElement("div");
        cabecalho.style.display = "flex";
        cabecalho.style.justifyContent = "space-between";
        cabecalho.style.alignItems = "center";

        const nome = document.createElement("div");
        nome.className = "nome-banco";
        nome.style.marginBottom = "0";
        nome.textContent = `🍱 ${categoria}`;

        const botaoRemover = document.createElement("button");
        botaoRemover.className = "botao-icone-perigo";
        botaoRemover.title = "Remover dos separados";
        botaoRemover.textContent = "🗑";
        botaoRemover.addEventListener("click", () => removerCategoriaSeparada(categoria));

        cabecalho.appendChild(nome);
        cabecalho.appendChild(botaoRemover);
        cartao.appendChild(cabecalho);

        cartao.appendChild(linhaCarteira("Entradas", dados.entradas));
        cartao.appendChild(linhaCarteira("Saídas", dados.saidas));
        cartao.appendChild(linhaCarteira("Saldo", dados.saldo, "saldo"));

        container.appendChild(cartao);
    });
}

function renderizarListaBarras(idContainer, dados, textoVazio) {
    const container = document.getElementById(idContainer);
    container.innerHTML = "";

    const itens = Object.entries(dados).sort((a, b) => b[1] - a[1]);
    if (itens.length === 0) {
        container.innerHTML = `<p class="vazio">${textoVazio}</p>`;
        return;
    }

    const maiorValor = itens[0][1];
    itens.forEach(([nome, valor]) => {
        const percentual = maiorValor > 0 ? Math.round((valor / maiorValor) * 100) : 0;

        const item = document.createElement("div");
        item.className = "item-barra";

        const cabecalho = document.createElement("div");
        cabecalho.className = "cabecalho-barra";
        const spanNome = document.createElement("span");
        spanNome.textContent = nome;
        const spanValor = document.createElement("span");
        spanValor.textContent = formatarReais(valor);
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

// ---------- Configuração de categorias "à parte" ----------
document.getElementById("btn-config-separadas").addEventListener("click", () => {
    const painel = document.getElementById("config-categorias-separadas");
    painel.style.display = painel.style.display === "none" ? "block" : "none";
});

function inicializarSeletorCategoriasSeparadas(classificacoesDisponiveis) {
    const painel = document.getElementById("config-categorias-separadas");
    if (!seletorCategoriasSeparadas) {
        seletorCategoriasSeparadas = criarSeletorMultiplo({
            container: painel,
            opcoes: classificacoesDisponiveis,
            selecionados: obterCategoriasSeparadas(usuario.uid),
            rotuloTodos: "Nenhuma categoria à parte",
            aoMudar: (selecionados) => {
                salvarCategoriasSeparadas(usuario.uid, selecionados);
                aplicarFiltros();
            }
        });
    } else {
        seletorCategoriasSeparadas.definirOpcoes(classificacoesDisponiveis);
    }
}

// ---------- Visões personalizadas ----------
document.getElementById("btn-nova-visao").addEventListener("click", () => {
    const form = document.getElementById("form-nova-visao");
    form.style.display = form.style.display === "none" ? "block" : "none";
});
document.getElementById("btn-cancelar-visao").addEventListener("click", () => {
    document.getElementById("form-nova-visao").style.display = "none";
});

document.getElementById("btn-salvar-visao").addEventListener("click", () => {
    const titulo = document.getElementById("visao-titulo").value.trim();
    if (!titulo) {
        mostrarToast("Dê um título para a visão.", "erro");
        return;
    }

    const visao = {
        id: `visao_${Date.now()}`,
        titulo,
        filtroCampo: document.getElementById("visao-filtro-campo").value,
        filtroValor: document.getElementById("visao-filtro-valor").value.trim().toUpperCase(),
        agruparPor: document.getElementById("visao-agrupar-por").value,
        tipo: document.getElementById("visao-tipo").value
    };

    const visoes = obterVisoesPersonalizadas(usuario.uid);
    visoes.push(visao);
    salvarVisoesPersonalizadas(usuario.uid, visoes);

    document.getElementById("visao-titulo").value = "";
    document.getElementById("visao-filtro-valor").value = "";
    document.getElementById("form-nova-visao").style.display = "none";

    mostrarToast("Visão criada!", "sucesso");
    aplicarFiltros();
});

function calcularVisaoPersonalizada(lista, visao) {
    let filtrada = lista;
    if (visao.filtroCampo && visao.filtroValor) {
        // Busca parcial (contém o texto), não precisa ser idêntico —
        // assim "UBER" encontra "UBER EATS", "TRANS" encontra "TRANSPORTE", etc.
        filtrada = filtrada.filter(t => (t[visao.filtroCampo] ?? "").includes(visao.filtroValor));
    }
    if (visao.tipo !== "AMBOS") {
        filtrada = filtrada.filter(t => t.tipo === visao.tipo);
    }

    const grupos = {};
    filtrada.forEach((t) => {
        if (typeof t.valor !== "number") return;
        const chave = t[visao.agruparPor] || "SEM VALOR";
        grupos[chave] = (grupos[chave] ?? 0) + t.valor;
    });
    return grupos;
}

function renderizarVisoesPersonalizadas(lista) {
    const container = document.getElementById("visoes-personalizadas");
    container.innerHTML = "";

    const visoes = obterVisoesPersonalizadas(usuario.uid);
    if (visoes.length === 0) return;

    visoes.forEach((visao) => {
        const bloco = document.createElement("div");
        bloco.className = "secao";
        bloco.style.marginTop = "0";

        const titulo = document.createElement("div");
        titulo.className = "secao-titulo";

        const h4 = document.createElement("h3");
        h4.style.fontSize = "15px";
        const descricaoFiltro = visao.filtroCampo
            ? ` (${ROTULOS_CAMPO[visao.filtroCampo]}: ${visao.filtroValor || "—"})`
            : "";
        h4.textContent = `${visao.titulo}${descricaoFiltro}`;

        const botaoRemover = document.createElement("button");
        botaoRemover.className = "botao botao-secundario botao-pequeno";
        botaoRemover.textContent = "🗑 Remover";
        botaoRemover.addEventListener("click", () => {
            const restantes = obterVisoesPersonalizadas(usuario.uid).filter(v => v.id !== visao.id);
            salvarVisoesPersonalizadas(usuario.uid, restantes);
            aplicarFiltros();
        });

        titulo.appendChild(h4);
        titulo.appendChild(botaoRemover);
        bloco.appendChild(titulo);

        const areaBarras = document.createElement("div");
        areaBarras.className = "lista-barras";
        bloco.appendChild(areaBarras);

        container.appendChild(bloco);

        const dados = calcularVisaoPersonalizada(lista, visao);
        const idTemporario = `visao-barras-${visao.id}`;
        areaBarras.id = idTemporario;
        renderizarListaBarras(idTemporario, dados, "Nenhum dado encontrado para essa visão neste período.");
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
        mov: campoMov.value,
        detalhe: campoDetalhe.value,
        descricao: campoDescricao.value
    });
}

function renderizarPrevistos(listaFutura) {
    const corpo = document.querySelector("#tabela-previstos tbody");
    corpo.innerHTML = "";

    if (listaFutura.length === 0) {
        corpo.innerHTML = "<tr><td colspan='5' class='vazio'>Nenhum lançamento futuro neste período.</td></tr>";
        return;
    }

    const ordenados = [...listaFutura].sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));

    ordenados.forEach((t) => {
        if (typeof t.valor !== "number") return;

        const classeCor = t.tipo === "SAIDA" ? "saida" : "entrada";
        const sinal = t.tipo === "SAIDA" ? "-" : "+";

        const linha = document.createElement("tr");
        linha.classList.add("linha-prevista");

        const tdData = document.createElement("td");
        tdData.textContent = isoParaBR(t.data);
        const selo = document.createElement("span");
        selo.className = "selo-previsto";
        selo.textContent = "Previsto";
        tdData.appendChild(selo);
        linha.appendChild(tdData);

        const celulaTexto = (texto) => {
            const td = document.createElement("td");
            td.textContent = texto;
            return td;
        };
        linha.appendChild(celulaTexto(t.descricao ?? ""));
        linha.appendChild(celulaTexto(t.banco ?? ""));
        linha.appendChild(celulaTexto(t.classificacao_saida ?? ""));

        const tdValor = document.createElement("td");
        tdValor.className = classeCor;
        const b = document.createElement("b");
        b.textContent = `${sinal} ${formatarReais(t.valor)}`;
        tdValor.appendChild(b);
        linha.appendChild(tdValor);

        corpo.appendChild(linha);
    });
}

// ---------- Filtro principal ----------
function aplicarFiltros() {
    const dataInicioISO = brParaISO(normalizarDataDigitada(campoInicio.value) ?? "");
    const dataFimISO = brParaISO(normalizarDataDigitada(campoFim.value) ?? "");
    const bancosFiltro = seletorBanco.obterSelecionados();
    const mesesFiltro = seletorMes.obterSelecionados().map(nomeMesParaNumero).filter(Boolean);
    const movFiltro = campoMov.value;
    const detalheFiltro = campoDetalhe.value.trim().toUpperCase();
    const descricaoFiltro = campoDescricao.value.trim().toUpperCase();

    let lista = todasTransacoes;
    if (dataInicioISO) lista = lista.filter(t => t.data >= dataInicioISO);
    if (dataFimISO) lista = lista.filter(t => t.data <= dataFimISO);
    if (mesesFiltro.length > 0) lista = lista.filter(t => mesesFiltro.includes((t.data ?? "").slice(5, 7)));
    if (bancosFiltro.length > 0) lista = lista.filter(t => bancosFiltro.includes(t.banco));
    if (movFiltro !== "") lista = lista.filter(t => t.tipo_mov === movFiltro);
    if (detalheFiltro !== "") lista = lista.filter(t => (t.saida ?? "").includes(detalheFiltro));
    if (descricaoFiltro !== "") lista = lista.filter(t => (t.descricao ?? "").includes(descricaoFiltro));

    const hoje = hojeISO();
    const listaRealizada = lista.filter(t => (t.data ?? "") <= hoje);
    const listaFutura = lista.filter(t => (t.data ?? "") > hoje);

    const categoriasSeparadas = new Set(obterCategoriasSeparadas(usuario.uid));

    let saldoGeral = 0;
    let entradasPeriodo = 0;
    let saidasPeriodo = 0;
    let transferenciasInternas = 0;
    const porBanco = {};
    const gastoPorClassificacao = {};
    const entradaPorClassificacao = {};
    const porCategoriaSeparada = {};

    listaRealizada.forEach((t) => {
        if (typeof t.valor !== "number" || !t.banco) return;

        if (!porBanco[t.banco]) porBanco[t.banco] = { saldo: 0, entradas: 0, saidas: 0 };
        if (t.tipo === "ENTRADA") {
            porBanco[t.banco].entradas += t.valor;
            porBanco[t.banco].saldo += t.valor;
        } else {
            porBanco[t.banco].saidas += t.valor;
            porBanco[t.banco].saldo -= t.valor;
        }

        const ehCategoriaSeparada = categoriasSeparadas.has(t.classificacao_saida);

        if (ehCategoriaSeparada) {
            const chave = t.classificacao_saida;
            if (!porCategoriaSeparada[chave]) porCategoriaSeparada[chave] = { saldo: 0, entradas: 0, saidas: 0 };
            if (t.tipo === "ENTRADA") {
                porCategoriaSeparada[chave].entradas += t.valor;
                porCategoriaSeparada[chave].saldo += t.valor;
            } else {
                porCategoriaSeparada[chave].saidas += t.valor;
                porCategoriaSeparada[chave].saldo -= t.valor;
            }
            return;
        }

        if (t.tipo_mov === "INTERNO") {
            transferenciasInternas += t.valor;
            return;
        }

        if (t.tipo === "ENTRADA") {
            saldoGeral += t.valor;
            entradasPeriodo += t.valor;
            const chaveEntrada = t.classificacao_saida || "SEM CLASSIFICAÇÃO";
            entradaPorClassificacao[chaveEntrada] = (entradaPorClassificacao[chaveEntrada] ?? 0) + t.valor;
        } else {
            saldoGeral -= t.valor;
            saidasPeriodo += t.valor;
            const chave = t.classificacao_saida || "SEM CLASSIFICAÇÃO";
            gastoPorClassificacao[chave] = (gastoPorClassificacao[chave] ?? 0) + t.valor;
        }
    });

    document.getElementById("saldo-geral").textContent = formatarReais(saldoGeral);
    document.getElementById("entradas-periodo").textContent = formatarReais(entradasPeriodo);
    document.getElementById("saidas-periodo").textContent = formatarReais(saidasPeriodo);
    document.getElementById("transferencias-internas").textContent = formatarReais(transferenciasInternas);

    // Saldo previsto = saldo real + o líquido dos lançamentos futuros (mesmas
    // exclusões de transferência interna / categoria à parte que o saldo real usa)
    let saldoFuturoLiquido = 0;
    listaFutura.forEach((t) => {
        if (typeof t.valor !== "number") return;
        if (categoriasSeparadas.has(t.classificacao_saida)) return;
        if (t.tipo_mov === "INTERNO") return;
        saldoFuturoLiquido += t.tipo === "ENTRADA" ? t.valor : -t.valor;
    });
    document.getElementById("saldo-previsto").textContent = formatarReais(saldoGeral + saldoFuturoLiquido);

    const cartaoSaldoGeral = document.getElementById("cartao-saldo-geral");
    cartaoSaldoGeral.classList.toggle("metrica-saldo-neg", saldoGeral < 0);
    cartaoSaldoGeral.classList.toggle("metrica-saldo-pos", saldoGeral >= 0);

    const rotulo = rotuloDoPeriodo(dataInicioISO, dataFimISO);
    document.getElementById("subtitulo-periodo").textContent = rotulo ? `Mostrando: ${rotulo}` : "Selecione um período nos filtros abaixo.";
    document.getElementById("rotulo-periodo-entradas").textContent = rotulo ? `— ${rotulo}` : "";

    const classificacoesDisponiveis = [...new Set(todasTransacoes.map(t => t.classificacao_saida).filter(Boolean))].sort();
    inicializarSeletorCategoriasSeparadas(classificacoesDisponiveis);

    renderizarCarteiras(porBanco);
    renderizarCartoesCategoriaSeparada(porCategoriaSeparada);
    renderizarListaBarras("lista-entradas-categoria", entradaPorClassificacao, "Nenhuma entrada registrada neste período.");
    renderizarListaBarras("lista-classificacoes", gastoPorClassificacao, "Nenhuma saída registrada neste período.");
    renderizarPrevistos(listaFutura);
    renderizarVisoesPersonalizadas(listaRealizada);

    salvarEstadoFiltro();
}

async function carregarDashboard(forcarAtualizacao = false) {
    try {
        todasTransacoes = await obterTransacoes(usuario, { forcarAtualizacao });

        const bancosDisponiveis = [...new Set(todasTransacoes.map(t => t.banco).filter(Boolean))].sort();
        seletorBanco.definirOpcoes(bancosDisponiveis);

        if (!forcarAtualizacao) {
            const salvo = obterFiltroSalvo(usuario.uid, NOME_PAGINA);

            if (salvo) {
                popularSeletorAno(Number(salvo.ano) || new Date().getFullYear());
                seletorMes.definirSelecionados(salvo.meses ?? []);
                campoInicio.value = salvo.inicioBR ?? "";
                campoFim.value = salvo.fimBR ?? "";
                seletorBanco.definirSelecionados((salvo.bancos ?? []).filter(b => bancosDisponiveis.includes(b)));
                campoMov.value = salvo.mov ?? "";
                campoDetalhe.value = salvo.detalhe ?? "";
                campoDescricao.value = salvo.descricao ?? "";
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
        console.error("Erro ao carregar dashboard:", erro);
        document.getElementById("grade-carteiras").innerHTML = "<p class='vazio'>Erro ao carregar dados. Verifique o console (F12).</p>";
        document.getElementById("lista-classificacoes").innerHTML = "";
        document.getElementById("lista-entradas-categoria").innerHTML = "";
        document.querySelector("#tabela-previstos tbody").innerHTML = "<tr><td colspan='5' class='vazio'>Erro ao carregar dados.</td></tr>";
    }
}

carregarDashboard();
