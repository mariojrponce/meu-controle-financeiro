// graficos.js
// Fábrica fina de gráficos (Chart.js, carregado via CDN em dashboard.html) —
// cores e formatação seguem o design system do projeto (style.css). O par
// azul/laranja usado nos gráficos de 2 séries foi escolhido (em vez do
// verde/vermelho usado no resto do app) porque validou contraste/CVD; o par
// verde/vermelho falha a checagem de daltonismo (ΔE 5.0, abaixo do piso).
import { formatarReais } from "./utils.js";

const instancias = new Map();

function destruir(idCanvas) {
    const existente = instancias.get(idCanvas);
    if (existente) {
        existente.destroy();
        instancias.delete(idCanvas);
    }
}

function ajustarAltura(idCanvas, quantidadeItens, alturaPorItem = 34, minimo = 160, maximo = 420) {
    const canvas = document.getElementById(idCanvas);
    if (!canvas) return;
    canvas.parentElement.style.height = `${Math.min(maximo, Math.max(minimo, quantidadeItens * alturaPorItem))}px`;
}

const TOOLTIP_BASE = {
    backgroundColor: "#0f172a",
    titleColor: "#ffffff",
    bodyColor: "#ffffff",
    padding: 10,
    cornerRadius: 8,
    displayColors: false
};

// Mostra o gráfico (e esconde a mensagem de "sem dados"), ou o contrário.
export function alternarEstadoVazio(idCanvas, idVazio, temDados) {
    const canvas = document.getElementById(idCanvas);
    const vazio = document.getElementById(idVazio);
    if (canvas) canvas.parentElement.style.display = temDados ? "" : "none";
    if (vazio) vazio.style.display = temDados ? "none" : "";
}

// Barras horizontais, uma só série — comparação de magnitude (ex: gasto por classificação).
export function renderizarGraficoBarras(idCanvas, dados, { cor = "#059669" } = {}) {
    destruir(idCanvas);
    const canvas = document.getElementById(idCanvas);
    if (!canvas) return;

    const itens = Object.entries(dados).sort((a, b) => b[1] - a[1]);
    ajustarAltura(idCanvas, itens.length);

    const grafico = new Chart(canvas, {
        type: "bar",
        data: {
            labels: itens.map(([nome]) => nome),
            datasets: [{
                data: itens.map(([, valor]) => valor),
                backgroundColor: cor,
                borderRadius: 4,
                borderSkipped: false,
                barPercentage: 0.65
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: "y",
            scales: {
                x: { beginAtZero: true, grid: { color: "#e2e8f0" }, ticks: { color: "#64748b", font: { size: 11 } } },
                y: { grid: { display: false }, ticks: { color: "#0f172a", font: { size: 12 } } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { ...TOOLTIP_BASE, callbacks: { label: (ctx) => formatarReais(ctx.parsed.x) } }
            }
        }
    });
    instancias.set(idCanvas, grafico);
}

// Barras horizontais agrupadas, duas séries (ex: entradas x saídas previstas por categoria).
export function renderizarGraficoBarrasAgrupadas(idCanvas, categorias, series) {
    destruir(idCanvas);
    const canvas = document.getElementById(idCanvas);
    if (!canvas) return;

    ajustarAltura(idCanvas, categorias.length, 46, 180, 420);

    const grafico = new Chart(canvas, {
        type: "bar",
        data: {
            labels: categorias,
            datasets: series.map((s) => ({
                label: s.nome,
                data: s.valores,
                backgroundColor: s.cor,
                borderRadius: 4,
                borderSkipped: false,
                barPercentage: 0.7,
                categoryPercentage: 0.7
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: "y",
            scales: {
                x: { beginAtZero: true, grid: { color: "#e2e8f0" }, ticks: { color: "#64748b", font: { size: 11 } } },
                y: { grid: { display: false }, ticks: { color: "#0f172a", font: { size: 12 } } }
            },
            plugins: {
                legend: {
                    display: true,
                    position: "top",
                    align: "start",
                    labels: { color: "#0f172a", boxWidth: 12, boxHeight: 12, font: { size: 12 }, usePointStyle: true, pointStyle: "circle" }
                },
                tooltip: { ...TOOLTIP_BASE, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatarReais(ctx.parsed.x)}` } }
            }
        }
    });
    instancias.set(idCanvas, grafico);
}

// Linha, uma só série — tendência ao longo do tempo (ex: gasto total por mês).
export function renderizarGraficoLinha(idCanvas, rotulos, valores, { cor = "#dc2626" } = {}) {
    destruir(idCanvas);
    const canvas = document.getElementById(idCanvas);
    if (!canvas) return;

    const grafico = new Chart(canvas, {
        type: "line",
        data: {
            labels: rotulos,
            datasets: [{
                data: valores,
                borderColor: cor,
                backgroundColor: `${cor}22`,
                borderWidth: 2,
                pointRadius: 4,
                pointBackgroundColor: cor,
                pointBorderColor: "#ffffff",
                pointBorderWidth: 1,
                fill: true,
                tension: 0.25
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 11 } } },
                y: { beginAtZero: true, grid: { color: "#e2e8f0" }, ticks: { color: "#64748b", font: { size: 11 } } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { ...TOOLTIP_BASE, callbacks: { label: (ctx) => formatarReais(ctx.parsed.y) } }
            }
        }
    });
    instancias.set(idCanvas, grafico);
}
