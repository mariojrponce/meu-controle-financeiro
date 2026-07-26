// nav.js
// A barra lateral já vem pronta no HTML de cada página (evita o "piscar" ao
// trocar de tela). Aqui só marcamos o link ativo, mostramos o e-mail e
// ligamos o botão de sair.
import { sair } from "./auth-guard.js";

export function renderizarNav(paginaAtiva, emailUsuario) {
  document.querySelectorAll(".sidebar-links a").forEach((link) => {
    link.classList.toggle("ativo", link.dataset.pagina === paginaAtiva);
  });

  const spanEmail = document.querySelector(".sidebar-email");
  if (spanEmail) spanEmail.textContent = emailUsuario ?? "";

  const botaoSair = document.getElementById("btn-sair");
  if (botaoSair) botaoSair.addEventListener("click", sair);
}
