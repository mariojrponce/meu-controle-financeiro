// extratos/ler-arquivo.js
// Do arquivo que você escolheu (File do navegador) até o extrato lido:
//   .csv            → texto
//   .pdf com texto  → pdf.js (posições de cada pedaço)
//   .pdf imagem     → pdf.js desenha a página → OCR
//   .png/.jpg/.webp → OCR
// Usado pela tela de importação e pela página de testes (testes/leitores.html).
import { decodificarTexto } from "./comum.js";
import { carregarPdfjs, extrairPaginasPdf } from "./texto-pdf.js";
import { paginasPdfComoImagem, imagemComoCanvas, reconhecerImagens } from "./ocr.js";
import { lerExtrato } from "./leitores/index.js";

export const EXTENSOES_ACEITAS = /\.(csv|pdf|png|jpe?g|webp)$/i;
const EXTENSOES_IMAGEM = /\.(png|jpe?g|webp)$/i;

// Primeira tentativa no modo "bloco de texto" (psm 6); se a conferência pelo
// total não fechar, tenta o modo "colunas" (psm 4) e fica com a que fechar.
async function tentarOcr(nome, imagens, aoProgredir) {
  let melhor = null;
  for (const psm of [6, 4]) {
    const paginas = await reconhecerImagens(imagens, { psm, aoProgredir });
    const lido = lerExtrato({ nome, tipo: "ocr", paginas });
    if (lido.extrato && lido.extrato.conferencias.every((c) => c.ok)) return lido;
    if (!melhor || (lido.extrato && !melhor.extrato)) melhor = lido;
    if (!paginas.length) break; // nada legível: não adianta tentar de novo
  }
  return melhor;
}

async function lerPorOcr(nome, imagens, aoProgredir) {
  try {
    return await tentarOcr(nome, imagens, aoProgredir);
  } catch (erro) {
    console.error("Erro no OCR de", nome, erro);
    return { erro: "Não consegui ler a imagem: o leitor de imagem (OCR) não carregou. Recarregue a página e tente de novo." };
  }
}

// aoProgredir(texto): mensagens para mostrar enquanto lê (o OCR leva alguns segundos).
export async function lerArquivoExtrato(arquivo, { aoProgredir = () => {} } = {}) {
  const nome = arquivo.name;
  const progressoOcr = (m) => {
    if (/loading|initializ/i.test(m.status ?? "")) aoProgredir(`${nome}: preparando a leitura de imagem (na primeira vez baixa ~5 MB)...`);
    else if (/^lendo/.test(m.status ?? "")) aoProgredir(`${nome}: ${m.status} da imagem...`);
  };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());

  if (EXTENSOES_IMAGEM.test(nome)) {
    aoProgredir(`${nome}: abrindo a imagem...`);
    return lerPorOcr(nome, await imagemComoCanvas(arquivo), progressoOcr);
  }
  if (/\.pdf$/i.test(nome)) {
    const pdfjs = await carregarPdfjs();
    // o pdf.js "consome" o buffer que recebe; a cópia fica para o OCR, se precisar
    const paginas = await extrairPaginasPdf(pdfjs, bytes.slice());
    if (paginas.some((p) => p.linhas.length)) return lerExtrato({ nome, tipo: "pdf", paginas });
    aoProgredir(`${nome}: o PDF é imagem — desenhando as páginas...`);
    return lerPorOcr(nome, await paginasPdfComoImagem(pdfjs, bytes), progressoOcr);
  }
  return lerExtrato({ nome, tipo: "csv", texto: decodificarTexto(bytes) });
}
