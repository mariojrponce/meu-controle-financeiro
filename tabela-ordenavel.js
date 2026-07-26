// tabela-ordenavel.js
// Deixa o cabeçalho de uma tabela clicável: clique numa coluna para ordenar
// por ela; clique de novo para inverter a direção.

export function ativarOrdenacao(thead, aoOrdenar) {
  const celulas = Array.from(thead.querySelectorAll("th[data-chave]"));
  let chaveAtual = null;
  let direcaoAtual = "asc";

  celulas.forEach((th) => {
    th.classList.add("th-ordenavel");
    const textoOriginal = th.textContent;
    th.textContent = "";

    const spanTexto = document.createElement("span");
    spanTexto.textContent = textoOriginal;

    const spanSeta = document.createElement("span");
    spanSeta.className = "seta-ordenacao";

    th.appendChild(spanTexto);
    th.appendChild(spanSeta);

    th.addEventListener("click", () => {
      const chave = th.dataset.chave;
      direcaoAtual = chaveAtual === chave ? (direcaoAtual === "asc" ? "desc" : "asc") : "asc";
      chaveAtual = chave;

      celulas.forEach((c) => { c.querySelector(".seta-ordenacao").textContent = ""; });
      spanSeta.textContent = direcaoAtual === "asc" ? "▲" : "▼";

      aoOrdenar(chaveAtual, direcaoAtual, th.dataset.tipo || "texto");
    });
  });
}

// Compara dois valores de acordo com o tipo da coluna ("numero" ou "texto").
// Datas em formato ISO ("aaaa-mm-dd") ordenam certinho como texto mesmo.
export function compararValores(a, b, tipo) {
  if (tipo === "numero") {
    return (Number(a) || 0) - (Number(b) || 0);
  }
  const x = (a ?? "").toString().toLowerCase();
  const y = (b ?? "").toString().toLowerCase();
  if (x < y) return -1;
  if (x > y) return 1;
  return 0;
}
