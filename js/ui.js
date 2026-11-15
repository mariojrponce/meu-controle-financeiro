// ui.js
// Componentes visuais pequenos e reutilizáveis: aviso discreto (toast) e
// modal de confirmação (usado antes de excluir um lançamento).

let elementoToast = null;
let temporizadorToast = null;

// Fecha o modal ao clicar fora dele (no fundo escurecido) — mas só quando o
// CLIQUE COMEÇA E TERMINA no fundo. Sem isso, selecionar um texto dentro do
// modal (mousedown num campo) e soltar o botão fora por acidente (mouseup no
// fundo) contava como "clicar fora" e fechava o modal, perdendo o que tinha
// sido digitado.
export function ligarFechamentoPorFundo(fundo, aoFechar) {
  let comecouNoFundo = false;
  fundo.addEventListener("mousedown", (evento) => {
    comecouNoFundo = evento.target === fundo;
  });
  fundo.addEventListener("click", (evento) => {
    if (comecouNoFundo && evento.target === fundo) aoFechar();
    comecouNoFundo = false;
  });
}

// Mostra um aviso discreto no canto da tela, que some sozinho.
// Não interrompe o que o usuário está fazendo (ao contrário de um alert()).
export function mostrarToast(mensagem, tipo = "sucesso") {
  if (!elementoToast) {
    elementoToast = document.createElement("div");
    elementoToast.id = "toast-global";
    document.body.appendChild(elementoToast);
  }

  elementoToast.className = `toast toast-${tipo}`;
  elementoToast.textContent = mensagem;

  requestAnimationFrame(() => elementoToast.classList.add("mostrar"));

  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => {
    elementoToast.classList.remove("mostrar");
  }, 2200);
}

// Abre um modal de confirmação e retorna uma Promise<boolean>
// (true se o usuário confirmou, false se cancelou ou fechou o modal).
export function confirmarAcao({ titulo, mensagem, textoConfirmar = "Excluir", textoCancelar = "Cancelar" }) {
  return new Promise((resolve) => {
    const fundo = document.createElement("div");
    fundo.className = "modal-fundo";

    const caixa = document.createElement("div");
    caixa.className = "modal-caixa";

    const h3 = document.createElement("h3");
    h3.textContent = titulo;

    const p = document.createElement("p");
    p.textContent = mensagem;

    const acoes = document.createElement("div");
    acoes.className = "modal-acoes";

    const botaoCancelar = document.createElement("button");
    botaoCancelar.className = "botao botao-secundario";
    botaoCancelar.textContent = textoCancelar;

    const botaoConfirmar = document.createElement("button");
    botaoConfirmar.className = "botao botao-perigo";
    botaoConfirmar.textContent = textoConfirmar;

    acoes.appendChild(botaoCancelar);
    acoes.appendChild(botaoConfirmar);
    caixa.appendChild(h3);
    caixa.appendChild(p);
    caixa.appendChild(acoes);
    fundo.appendChild(caixa);
    document.body.appendChild(fundo);

    requestAnimationFrame(() => fundo.classList.add("aberto"));

    function finalizar(resultado) {
      fundo.classList.remove("aberto");
      setTimeout(() => fundo.remove(), 150);
      resolve(resultado);
    }

    botaoCancelar.addEventListener("click", () => finalizar(false));
    botaoConfirmar.addEventListener("click", () => finalizar(true));
    ligarFechamentoPorFundo(fundo, () => finalizar(false));
  });
}

// Ícone linear do conjunto do sistema (assets/icones.svg) — o mesmo traço em
// todas as telas, no lugar de emojis (que mudam de cara em cada aparelho).
export function icone(nome, classe = "icone") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", classe);
  svg.setAttribute("aria-hidden", "true");
  const uso = document.createElementNS("http://www.w3.org/2000/svg", "use");
  uso.setAttribute("href", `assets/icones.svg#i-${nome}`);
  svg.appendChild(uso);
  return svg;
}

// Põe ícone (+ texto opcional) num botão, com rótulo acessível.
export function preencherBotao(botao, nomeIcone, texto = "") {
  botao.replaceChildren(icone(nomeIcone));
  if (texto) botao.appendChild(document.createTextNode(texto));
  else if (botao.title) botao.setAttribute("aria-label", botao.title);
  return botao;
}

// ---------- Montagem de trechos de tela sem innerHTML ----------
// Todo texto entra por textContent: nada que venha de dados é interpretado como HTML.

// Troca o conteúdo de `container` por uma mensagem (ex.: "Nenhum lançamento ainda.").
export function mostrarMensagem(container, texto, classe = "vazio", tag = "p") {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  elemento.textContent = texto;
  container.replaceChildren(elemento);
}

// Troca o conteúdo de um <tbody> por uma linha única com a mensagem, ocupando `colunas` colunas.
export function mostrarLinhaMensagem(corpoTabela, colunas, texto) {
  const linha = document.createElement("tr");
  const celula = document.createElement("td");
  celula.colSpan = colunas;
  celula.className = "vazio";
  celula.textContent = texto;
  linha.appendChild(celula);
  corpoTabela.replaceChildren(linha);
}

// Monta a linha de títulos de um <thead>. Cada coluna: texto simples ou
// { texto, chave, tipo, direita } (chave/tipo = ordenação; direita = alinhado à direita).
export function montarCabecalho(thead, colunas) {
  const linha = document.createElement("tr");
  colunas.forEach((coluna) => {
    const info = typeof coluna === "string" ? { texto: coluna } : coluna;
    const th = document.createElement("th");
    th.textContent = info.texto;
    if (info.chave) th.dataset.chave = info.chave;
    if (info.tipo) th.dataset.tipo = info.tipo;
    if (info.direita) th.style.textAlign = "right";
    linha.appendChild(th);
  });
  thead.replaceChildren(linha);
}

// Cria um elemento com atributos e filhos (textos ou outros elementos).
// Atributos especiais: classe, texto; os demais vão por setAttribute (true = atributo sem valor).
export function criarElemento(tag, atributos = {}, ...filhos) {
  const elemento = document.createElement(tag);
  Object.entries(atributos).forEach(([nome, valor]) => {
    if (valor === false || valor === null || valor === undefined) return;
    if (nome === "classe") elemento.className = valor;
    else if (nome === "texto") elemento.textContent = valor;
    else elemento.setAttribute(nome, valor === true ? "" : String(valor));
  });
  filhos.flat().forEach((filho) => {
    if (filho === false || filho === null || filho === undefined) return;
    elemento.append(filho);
  });
  return elemento;
}
