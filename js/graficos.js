// graficos.js
// Fábrica de gráficos (Chart.js via CDN em dashboard.html) —
// Adaptado para os guias de UX/UI, leitura de telas (temas dinâmicos) e multi-dispositivos.

import { formatarReais } from "./utils.js";

Chart.register(ChartDataLabels);

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

function maiorValorComFolga(valores) {
    const maior = Math.max(0, ...valores);
    return maior > 0 ? maior * 1.2 : undefined;
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
export function renderizarGraficoBarras(idCanvas, dados, { cor = "#059669" } = {}) {
    destruir(idCanvas);
    const canvas = document.getElementById(idCanvas);
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
                backgroundColor: cor,
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
}

// Barras horizontais agrupadas — comparação de 2 séries (entradas x saídas)
export function renderizarGraficoBarrasAgrupadas(idCanvas, categorias, series) {
    destruir(idCanvas);
    const canvas = document.getElementById(idCanvas);
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
    const canvas = document.getElementById(idCanvas);
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
