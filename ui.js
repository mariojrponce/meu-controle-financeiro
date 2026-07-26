// ui.js
// Componentes visuais pequenos e reutilizáveis: aviso discreto (toast) e
// modal de confirmação (usado antes de excluir um lançamento).

let elementoToast = null;
let temporizadorToast = null;

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
    fundo.addEventListener("click", (evento) => {
      if (evento.target === fundo) finalizar(false);
    });
  });
}
