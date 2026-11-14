// Utilitário dos testes: lê os arquivos de modelo-extratos/ (dados reais,
// fora do git) do mesmo jeito que a tela faz no navegador.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { decodificarTexto } from "../js/extratos/comum.js";
import { extrairPaginasPdf } from "../js/extratos/texto-pdf.js";
import { lerExtrato } from "../js/extratos/leitores/index.js";

export const PASTA_MODELOS = new URL("../modelo-extratos/", import.meta.url).pathname;
export const temModelos = existsSync(PASTA_MODELOS);

let pdfjs = null;
async function obterPdfjs() {
  if (!pdfjs) {
    const avisoOriginal = console.warn; // o pdf.js reclama de canvas no Node — irrelevante para texto
    console.warn = () => {};
    console.log = ((log) => (...a) => (String(a[0]).startsWith("Warning") ? null : log(...a)))(console.log);
    pdfjs = await import("../js/vendor/pdfjs/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("../js/vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
    console.warn = avisoOriginal;
  }
  return pdfjs;
}

export async function carregarArquivo(caminho) {
  const bytes = new Uint8Array(readFileSync(caminho));
  const nome = caminho.split("/").pop();
  const ext = extname(nome).toLowerCase();
  if (ext === ".pdf") return { nome, tipo: "pdf", paginas: await extrairPaginasPdf(await obterPdfjs(), bytes) };
  return { nome, tipo: "csv", texto: decodificarTexto(bytes) };
}

export function listarModelos() {
  const lista = [];
  const visitar = (pasta) => readdirSync(pasta).forEach((n) => {
    const c = join(pasta, n);
    if (statSync(c).isDirectory()) visitar(c);
    else if (/\.(pdf|csv)$/i.test(n) && statSync(c).size < 15_000_000) lista.push(c);
  });
  if (temModelos) visitar(PASTA_MODELOS);
  return lista.sort();
}

// Acha o arquivo pela pasta + um pedaço do nome (os nomes reais têm número de
// conta etc. e não devem aparecer no código, que é público).
export function acharModelo(pasta, padrao) {
  const achado = listarModelos().find((c) => c.includes(`/modelo-extratos/${pasta}/`) && padrao.test(c.split("/").pop()));
  if (!achado) throw new Error(`modelo não encontrado: ${pasta} ${padrao}`);
  return achado;
}

export async function lerModelo(pasta, padrao) {
  return lerExtrato(await carregarArquivo(acharModelo(pasta, padrao)));
}
