// graficos.js
// Fábrica de gráficos (Chart.js via CDN em dashboard.html) —
// Adaptado para os guias de UX/UI, leitura de telas (temas dinâmicos) e multi-dispositivos.

import { formatarReais } from "./utils.js";

Chart.register(ChartDataLabels);

// Sem animação de "crescimento" das barras/linhas: o dashboard redesenha
// os gráficos várias vezes seguidas (filtros, tema, carga do cache e depois
// do Firebase), e com a animação ligada o navegador às vezes ficava com
// pedaços de quadros intermediários no canvas — barras "picotadas" e
// rótulos cortados no meio. Desenhando direto o quadro final, isso some.
Chart.defaults.animation = false;
Chart.defaults.resizeDelay = 100;

const instancias = new Map();
let callbackTemaAlterado = null;

export function aoMudarTema(fn) {
    callbackTemaAlterado = fn;
}

// Observer para re-renderizar os gráficos automaticamente quando o tema muda (Claro, Escuro, Sépia)
const observerTema = new MutationObserver(() => {
    if (typeof callbackTemaAlterado === "function") {
        callbackTemaAlterado();
    }
});
observerTema.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

// Pede o contexto 2D "por software" antes do Chart.js tocar no canvas (o
// tipo de contexto fica fixo na primeira chamada). No Chrome com aceleração
// de GPU, canvas largos às vezes saíam em branco ou com pedaços de quadros
// antigos (barras picotadas, linha de evolução sumindo) — por software o
// desenho sai sempre certo, e para gráficos desse tamanho não pesa.
function obterCanvas(idCanvas) {
    const canvas = document.getElementById(idCanvas);
    if (canvas) canvas.getContext("2d", { willReadFrequently: true });
    return canvas;
}

function destruir(idCanvas) {
    const existente = instancias.get(idCanvas);
    if (existente) {
        existente.destroy();
        instancias.delete(idCanvas);
    }
}

// Cores dos gráficos vêm dos tokens do tema (style.css) — nada fixo aqui.
// Assim o gráfico acompanha Claro/Escuro/Sépia sozinho.
export function corDoTema(token) {
    return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

export function obterPaletaGraficos() {
    return {
        azulPrincipal: corDoTema("--cor-primaria"),
        azulApoio: corDoTema("--brand-azul-claro"),
        entrada: corDoTema("--cor-entrada"),
        saida: corDoTema("--cor-saida"),
        previsto: corDoTema("--cor-previsto"),
        alerta: corDoTema("--cor-alerta-acento"),
        texto: corDoTema("--texto-corpo"),
        grade: corDoTema("--borda-sutil")
    };
}

function obterEstiloTema() {
    return {
        corTexto: corDoTema("--texto-corpo"),
        corTextoSuave: corDoTema("--texto-secundario"),
        corGrid: corDoTema("--borda-sutil"),
        corTooltipBg: corDoTema("--texto-principal"),
        corTooltipTexto: corDoTema("--bg-superficie"),
        corFundo: corDoTema("--bg-superficie")
    };
}

function ajustarAltura(idCanvas, quantidadeItens, alturaPorItem = 38, minimo = 180, maximo = 450) {
    const canvas = document.getElementById(idCanvas);
    if (!canvas) return;
    canvas.parentElement.style.height = `${Math.min(maximo, Math.max(minimo, quantidadeItens * alturaPorItem))}px`;
}

// Qual categoria (linha do eixo Y) está na altura do clique/mouse.
function rotuloDaLinha(grafico, evento) {
    const { top, bottom } = grafico.chartArea;
    if (evento.y < top || evento.y > bottom) return null;
    const indice = Math.round(grafico.scales.y.getValueForPixel(evento.y));
    return grafico.data.labels[indice] ?? null;
}

function maiorValorComFolga(valores) {
    const maior = Math.max(0, ...valores);
    return maior > 0 ? maior * 1.2 : undefined;
}

// Escreve o total (soma de todos os itens) no selo ao lado do título do gráfico.
export function mostrarTotalGrafico(idTotal, texto) {
    const selo = document.getElementById(idTotal);
    if (!selo) return;
    selo.textContent = texto ?? "";
    selo.style.display = texto ? "" : "none";
}

export function somarValores(valores) {
    return valores.reduce((soma, valor) => soma + (Number(valor) || 0), 0);
}

export function alternarEstadoVazio(idCanvas, idVazio, temDados, mensagemVazia) {
    const canvas = document.getElementById(idCanvas);
    const vazio = document.getElementById(idVazio);
    if (canvas) canvas.parentElement.style.display = temDados ? "" : "none";
    if (vazio) {
        vazio.style.display = temDados ? "none" : "";
        if (!temDados && mensagemVazia) vazio.textContent = mensagemVazia;
    }
}

// Barras horizontais simples — comparação de magnitude por categoria
// aoClicar(rotulo): chamado ao clicar em qualquer ponto da linha de uma
// categoria (barra, espaço vazio ou o nome no eixo). Com `selecionado`, as
// outras barras ficam apagadas para destacar a escolhida.
export function renderizarGraficoBarras(idCanvas, dados, { cor = corDoTema("--cor-primaria"), selecionado = null, aoClicar = null } = {}) {
    destruir(idCanvas);
    const canvas = obterCanvas(idCanvas);
    if (!canvas) return;

    const itens = Object.entries(dados).sort((a, b) => b[1] - a[1]);
    ajustarAltura(idCanvas, itens.length);

    const { corTexto, corTextoSuave, corGrid, corTooltipBg, corTooltipTexto } = obterEstiloTema();

    const grafico = new Chart(canvas, {
        type: "bar",
        data: {
            labels: itens.map(([nome]) => nome),
            datasets: [{
                data: itens.map(([, valor]) => valor),
                backgroundColor: itens.map(([nome]) => (selecionado && nome !== selecionado ? `${cor}40` : cor)),
                borderRadius: 6,
                borderSkipped: false,
                barPercentage: 0.65
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: "y",

            layout: { padding: { right: 16, top: 4, bottom: 4 } },
            scales: {
                x: {
                    beginAtZero: true,
                    suggestedMax: maiorValorComFolga(itens.map(([, valor]) => valor)),
                    grid: { color: corGrid },
                    ticks: { color: corTextoSuave, font: { family: "Inter, sans-serif", size: 11 } }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: corTexto, font: { family: "Inter, sans-serif", size: 12, weight: "600" } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: corTooltipBg,
                    titleColor: corTooltipTexto,
                    bodyColor: corTooltipTexto,
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: { label: (ctx) => formatarReais(ctx.parsed.x) }
                },
                datalabels: {
                    color: corTexto,
                    anchor: "end",
                    align: "end",
                    clamp: true,
                    font: { family: "Inter, sans-serif", size: 11, weight: "700" },
                    formatter: (valor) => formatarReais(valor)
                }
            }
        }
    });
    instancias.set(idCanvas, grafico);
    ligarCliqueNasLinhas(canvas, grafico, aoClicar);
}

// O onClick do Chart.js só dispara dentro da área das barras; com eventos
// nativos o clique vale também no nome da categoria (eixo Y). Atribuição
// direta (não addEventListener) para não acumular ouvintes a cada redesenho.
function ligarCliqueNasLinhas(canvas, grafico, aoClicar) {
    if (!aoClicar) {
        canvas.onclick = null;
        canvas.onmousemove = null;
        canvas.style.cursor = "";
        return;
    }
    const rotuloNoEvento = (evento) => rotuloDaLinha(grafico, Chart.helpers.getRelativePosition(evento, grafico));
    canvas.onclick = (evento) => {
        const rotulo = rotuloNoEvento(evento);
        if (rotulo !== null) aoClicar(rotulo);
    };
    canvas.onmousemove = (evento) => {
        canvas.style.cursor = rotuloNoEvento(evento) !== null ? "pointer" : "";
    };
}

// Barras horizontais agrupadas — comparação de 2 séries (entradas x saídas)
export function renderizarGraficoBarrasAgrupadas(idCanvas, categorias, series) {
    destruir(idCanvas);
    const canvas = obterCanvas(idCanvas);
    if (!canvas) return;

    ajustarAltura(idCanvas, categorias.length, 48, 200, 450);
    const todosValores = series.flatMap((s) => s.valores);

    const { corTexto, corTextoSuave, corGrid, corTooltipBg, corTooltipTexto } = obterEstiloTema();

    const grafico = new Chart(canvas, {
        type: "bar",
        data: {
            labels: categorias,
            datasets: series.map((s) => ({
                label: s.nome,
                data: s.valores,
                backgroundColor: s.cor,
                borderRadius: 6,
                borderSkipped: false,
                barPercentage: 0.7,
                categoryPercentage: 0.7
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: "y",
            layout: { padding: { right: 16, top: 4, bottom: 4 } },
            scales: {
                x: {
                    beginAtZero: true,
                    suggestedMax: maiorValorComFolga(todosValores),
                    grid: { color: corGrid },
                    ticks: { color: corTextoSuave, font: { family: "Inter, sans-serif", size: 11 } }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: corTexto, font: { family: "Inter, sans-serif", size: 12, weight: "600" } }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: "top",
                    align: "start",
                    labels: {
                        color: corTexto,
                        boxWidth: 12,
                        boxHeight: 12,
                        font: { family: "Inter, sans-serif", size: 12, weight: "600" },
                        usePointStyle: true,
                        pointStyle: "circle"
                    }
                },
                tooltip: {
                    backgroundColor: corTooltipBg,
                    titleColor: corTooltipTexto,
                    bodyColor: corTooltipTexto,
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatarReais(ctx.parsed.x)}` }
                },
                datalabels: {
                    color: corTexto,
                    anchor: "end",
                    align: "end",
                    clamp: true,
                    font: { family: "Inter, sans-serif", size: 11, weight: "700" },
                    formatter: (valor) => formatarReais(valor)
                }
            }
        }
    });
    instancias.set(idCanvas, grafico);
}

// Gráfico de linha — tendência de evolução temporal
export function renderizarGraficoLinha(idCanvas, rotulos, valores, { cor = corDoTema("--cor-saida") } = {}) {
    destruir(idCanvas);
    const canvas = obterCanvas(idCanvas);
    if (!canvas) return;

    const { corTexto, corTextoSuave, corGrid, corTooltipBg, corTooltipTexto } = obterEstiloTema();

    const grafico = new Chart(canvas, {
        type: "line",
        data: {
            labels: rotulos,
            datasets: [{
                data: valores,
                borderColor: cor,
                backgroundColor: `${cor}20`,
                borderWidth: 2.5,
                pointRadius: 4.5,
                pointHoverRadius: 7,
                pointBackgroundColor: cor,
                pointBorderColor: obterEstiloTema().corFundo,
                pointBorderWidth: 1.5,
                fill: true,
                tension: 0.35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 24, left: 8, right: 36, bottom: 8 } },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: corTextoSuave, font: { family: "Inter, sans-serif", size: 11, weight: "600" } }
                },
                y: {
                    beginAtZero: true,
                    suggestedMax: maiorValorComFolga(valores),
                    grid: { color: corGrid },
                    ticks: { color: corTextoSuave, font: { family: "Inter, sans-serif", size: 11 } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: corTooltipBg,
                    titleColor: corTooltipTexto,
                    bodyColor: corTooltipTexto,
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: { label: (ctx) => formatarReais(ctx.parsed.y) }
                },
                datalabels: {
                    color: corTexto,
                    font: { family: "Inter, sans-serif", size: 11, weight: "700" },
                    formatter: (valor) => formatarReais(valor),
                    // Meses sem movimento (comum no ano todo, jan–dez) ficam sem
                    // rótulo para não poluir o gráfico com vários "R$ 0,00".
                    display: (ctx) => ctx.dataset.data[ctx.dataIndex] !== 0,
                    anchor: "center",
                    align: (ctx) => {
                        if (ctx.dataIndex === 0) return "right";
                        if (ctx.dataIndex === ctx.dataset.data.length - 1) return "left";
                        return "top";
                    }
                }
            }
        }
    });
    instancias.set(idCanvas, grafico);
}

// Duas linhas mês a mês: este ano (cor semântica, cheia) × ano anterior
// (cinza tracejado). O tooltip mostra os dois valores e a diferença.
export function renderizarGraficoComparativo(idCanvas, rotulos, { atual, anterior, nomeAtual, nomeAnterior, cor, limite = 12 }) {
    destruir(idCanvas);
    const canvas = obterCanvas(idCanvas);
    if (!canvas) return;

    const { corTexto, corTextoSuave, corGrid, corTooltipBg, corTooltipTexto, corFundo } = obterEstiloTema();
    // Meses depois do limite (ainda não chegaram) = previsto: ponto vazado.
    const raioPonto = (ctx) => (ctx.dataIndex >= limite ? 3 : 4);

    const grafico = new Chart(canvas, {
        type: "line",
        data: {
            labels: rotulos,
            datasets: [
                {
                    label: nomeAtual,
                    data: atual,
                    borderColor: cor,
                    backgroundColor: `${cor}18`,
                    borderWidth: 2.5,
                    pointRadius: raioPonto,
                    pointHoverRadius: 6,
                    pointBackgroundColor: (ctx) => (ctx.dataIndex >= limite ? corFundo : cor),
                    pointBorderColor: cor,
                    pointBorderWidth: 1.5,
                    segment: { borderDash: (ctx) => (ctx.p1DataIndex >= limite ? [3, 3] : undefined) },
                    fill: true,
                    tension: 0.3
                },
                {
                    label: nomeAnterior,
                    data: anterior,
                    borderColor: corTextoSuave,
                    backgroundColor: "transparent",
                    borderWidth: 2,
                    borderDash: [6, 4],
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: corTextoSuave,
                    pointBorderColor: corTextoSuave,
                    fill: false,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            layout: { padding: { top: 8, left: 4, right: 12, bottom: 4 } },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: corTextoSuave, font: { family: "Inter, sans-serif", size: 11, weight: "600" } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: corGrid },
                    ticks: { color: corTextoSuave, font: { family: "Inter, sans-serif", size: 11 } }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: "top",
                    align: "end",
                    labels: { color: corTexto, usePointStyle: true, pointStyle: "line", boxWidth: 24, font: { family: "Inter, sans-serif", size: 12, weight: "600" } }
                },
                tooltip: {
                    backgroundColor: corTooltipBg,
                    titleColor: corTooltipTexto,
                    bodyColor: corTooltipTexto,
                    footerColor: corTooltipTexto,
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        title: (itens) => `${itens[0].label}${itens[0].dataIndex >= limite ? " (previsto)" : ""}`,
                        label: (ctx) => ` ${ctx.dataset.label}: ${formatarReais(ctx.parsed.y)}`,
                        footer: (itens) => {
                            if (itens.length < 2) return "";
                            const diferenca = itens[0].parsed.y - itens[1].parsed.y;
                            const sinal = diferenca > 0 ? "+" : diferenca < 0 ? "-" : "";
                            return `Diferença: ${sinal} ${formatarReais(Math.abs(diferenca))}`;
                        }
                    }
                },
                datalabels: { display: false }
            }
        }
    });
    instancias.set(idCanvas, grafico);
}
