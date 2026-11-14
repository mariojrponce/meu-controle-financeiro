// extratos/ocr.js
// Lê texto de IMAGEM (OCR) para os extratos que o banco só entrega como
// figura — hoje, a "fatura aberta" do app do Bradesco, que é um print da tela
// embrulhado num PDF (ou o próprio print, em PNG/JPG).
//
// Tudo no navegador: o pdf.js desenha a página num <canvas>, a imagem é
// tratada (tons de cinza, ampliada, contraste) e o Tesseract (WebAssembly,
// em js/vendor/tesseract) devolve as palavras com a posição de cada uma.
// O resultado tem o mesmo formato do texto-pdf.js ({ linhas: [{ y, partes:
// [{ x, xf, t }] }] }), com x e y em MILÉSIMOS da largura da página — assim o
// leitor não depende da resolução do print.
//
// As funções puras (tratarPixels, linhasDoOcr) ficam aqui também para os testes.

const LARGURA_ALVO = 1900;   // px: abaixo disso o OCR erra dígitos; acima só fica lento
const AMPLIACAO_MAXIMA = 3;

// Tons de cinza + contraste em RGBA (Uint8ClampedArray do canvas), no lugar.
// Escurece o texto azul/cinza claro dos valores, que é o que o OCR mais erra.
// Devolve a fração de pixels escuros (página em branco ≈ 0).
export function tratarPixels(rgba) {
  let escuros = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const alfa = rgba[i + 3] / 255;
    const cinza = (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) * alfa + 255 * (1 - alfa);
    const v = Math.max(0, Math.min(255, (cinza - 60) * 255 / 150));
    rgba[i] = rgba[i + 1] = rgba[i + 2] = v;
    rgba[i + 3] = 255;
    if (v < 128) escuros++;
  }
  return escuros / (rgba.length / 4);
}

// Linhas do Tesseract → { y, partes: [{ x, xf, t, conf }] } em milésimos da largura.
export function linhasDoOcr(linhasTesseract, largura) {
  const escala = 1000 / largura;
  const arredondar = (n) => Math.round(n * escala * 10) / 10;
  return linhasTesseract
    .map((linha) => ({
      y: arredondar(linha.bbox.y0),
      partes: linha.words
        .filter((w) => w.text && w.text.trim())
        .map((w) => ({ x: arredondar(w.bbox.x0), xf: arredondar(w.bbox.x1), t: w.text.trim(), conf: Math.round(w.confidence) }))
        .sort((a, b) => a.x - b.x)
    }))
    .filter((l) => l.partes.length)
    .sort((a, b) => a.y - b.y);
}

// ---------------------------------------------------------------- navegador

function escalaPara(largura) {
  return Math.min(AMPLIACAO_MAXIMA, Math.max(1, LARGURA_ALVO / largura));
}

function canvasTratado(desenhar, largura, altura) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(largura);
  canvas.height = Math.round(altura);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  return Promise.resolve(desenhar(ctx, canvas)).then(() => {
    const imagem = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const tinta = tratarPixels(imagem.data);
    ctx.putImageData(imagem, 0, 0);
    return { canvas, emBranco: tinta < 0.001 };
  });
}

// Cada página do PDF vira um canvas já tratado.
export async function paginasPdfComoImagem(pdfjsLib, bytes) {
  const documento = await pdfjsLib.getDocument({ data: bytes, isEvalSupported: false, verbosity: 0 }).promise;
  const imagens = [];
  for (let numero = 1; numero <= documento.numPages; numero++) {
    const pagina = await documento.getPage(numero);
    const base = pagina.getViewport({ scale: 1 });
    const viewport = pagina.getViewport({ scale: escalaPara(base.width) });
    const tratada = await canvasTratado(
      (ctx) => pagina.render({ canvasContext: ctx, viewport, background: "#ffffff" }).promise,
      viewport.width, viewport.height
    );
    imagens.push({ numero, ...tratada });
    pagina.cleanup();
  }
  await documento.destroy();
  return imagens;
}

// Um arquivo PNG/JPG vira um canvas tratado (createImageBitmap não precisa de
// URL blob:, então não esbarra na CSP).
export async function imagemComoCanvas(arquivo) {
  const bitmap = await createImageBitmap(arquivo);
  const escala = escalaPara(bitmap.width);
  const tratada = await canvasTratado(
    (ctx, canvas) => ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height),
    bitmap.width * escala, bitmap.height * escala
  );
  bitmap.close?.();
  return [{ numero: 1, ...tratada }];
}

let trabalhador = null;

// Carrega o Tesseract do próprio site na primeira vez (≈ 5 MB; depois o
// navegador guarda em cache). workerBlobURL: false → o worker é um arquivo
// do próprio site, então a CSP da página não bloqueia o WebAssembly.
function obterTrabalhador(aoProgredir) {
  if (!trabalhador) {
    const pasta = new URL("../vendor/tesseract/", import.meta.url);
    trabalhador = import("../vendor/tesseract/tesseract.esm.min.js").then(async (modulo) => {
      const Tesseract = modulo.default ?? modulo;
      return Tesseract.createWorker("por", 1, {
        workerPath: new URL("worker.min.js", pasta).href,
        corePath: new URL("core", pasta).href,
        langPath: new URL("lang", pasta).href,
        workerBlobURL: false,
        gzip: true,
        logger: (m) => aoProgredir?.(m)
      });
    }).catch((erro) => {
      trabalhador = null;
      throw erro;
    });
  }
  return trabalhador;
}

// psm 6 = "um bloco de texto uniforme": o melhor para tabelas como a da
// fatura aberta. O psm 4 ("colunas") é a segunda tentativa.
export async function reconhecerImagens(imagens, { psm = 6, aoProgredir } = {}) {
  const worker = await obterTrabalhador(aoProgredir);
  await worker.setParameters({ tessedit_pageseg_mode: String(psm), preserve_interword_spaces: "1" });
  const paginas = [];
  for (const imagem of imagens) {
    if (imagem.emBranco) continue;
    aoProgredir?.({ status: `lendo a página ${imagem.numero}` });
    const { data } = await worker.recognize(imagem.canvas);
    paginas.push({ numero: imagem.numero, confianca: Math.round(data.confidence), linhas: linhasDoOcr(data.lines, imagem.canvas.width) });
  }
  return paginas;
}
