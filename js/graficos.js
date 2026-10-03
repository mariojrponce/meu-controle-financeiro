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

function obterEstiloTema() {
    const ehDark = document.documentElement.getAttribute("data-theme") === "dark";
    const ehSepia = document.documentElement.getAttribute("data-theme") === "sepia";

    return {
        corTexto: ehDark ? "#f1f5f9" : ehSepia ? "#2c221e" : "#0f172a",
        corTextoSuave: ehDark ? "#94a3b8" : ehSepia ? "#7c6853" : "#64748b",
        corGrid: ehDark ? "rgba(255, 255, 255, 0.08)" : ehSepia ? "rgba(44, 34, 30, 0.12)" : "rgba(15, 23, 42, 0.08)",
        corTooltipBg: ehDark ? "#1d283d" : ehSepia ? "#f5e6c7" : "#0f172a",
        corTooltipTexto: ehDark ? "#f1f5f9" : ehSepia ? "#2c221e" : "#ffffff"
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
export function renderizarGraficoBarras(idCanvas, dados, { cor = "#059669", selecionado = null, aoClicar = null } = {}) {
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
export function renderizarGraficoLinha(idCanvas, rotulos, valores, { cor = "#ef4444" } = {}) {
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
                pointBorderColor: "#ffffff",
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
