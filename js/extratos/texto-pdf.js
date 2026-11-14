// extratos/texto-pdf.js
// Lê o texto de um PDF guardando a POSIÇÃO de cada pedaço (x, y). É a posição
// que permite separar colunas — por exemplo, no Bradesco o mesmo número pode
// estar na coluna "Crédito" ou "Débito", e só o x diz qual é.
//
// A biblioteca (pdf.js, da Mozilla) fica dentro do projeto em js/vendor/pdfjs —
// roda 100% no navegador, sem servidor e sem CDN.

// Agrupa os pedaços de texto em linhas (mesmo y, com tolerância de 2 pontos).
// Cada linha: { y, partes: [{ x, xf, t }] } — xf = x final (x + largura),
// útil para números alinhados à direita.
function agruparEmLinhas(itens) {
  const pedacos = itens
    .filter((it) => it.str && it.str.trim())
    .map((it) => ({
      x: Math.round(it.transform[4] * 10) / 10,
      xf: Math.round((it.transform[4] + (it.width ?? 0)) * 10) / 10,
      y: Math.round(it.transform[5] * 10) / 10,
      t: it.str.trim()
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const linhas = [];
  for (const p of pedacos) {
    const atual = linhas[linhas.length - 1];
    if (atual && Math.abs(atual.y - p.y) <= 2) atual.partes.push(p);
    else linhas.push({ y: p.y, partes: [p] });
  }
  linhas.forEach((l) => l.partes.sort((a, b) => a.x - b.x));
  return linhas;
}

// pdfjsLib é passado de fora: no navegador vem de carregarPdfjs(); nos testes
// do Node vem do import direto do mesmo arquivo.
export async function extrairPaginasPdf(pdfjsLib, bytes) {
  const documento = await pdfjsLib.getDocument({
    data: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
    isEvalSupported: false,
    verbosity: 0
  }).promise;

  const paginas = [];
  for (let numero = 1; numero <= documento.numPages; numero++) {
    const pagina = await documento.getPage(numero);
    const conteudo = await pagina.getTextContent();
    paginas.push({ numero, linhas: agruparEmLinhas(conteudo.items) });
  }
  await documento.destroy();
  return paginas;
}

let pdfjsCarregado = null;

// Só para o navegador: carrega o pdf.js do próprio site na primeira vez que
// for preciso (os outros usuários da tela que só sobem CSV nem baixam ele).
export function carregarPdfjs() {
  if (!pdfjsCarregado) {
    pdfjsCarregado = import("../vendor/pdfjs/pdf.min.mjs").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
      return lib;
    });
  }
  return pdfjsCarregado;
}
