// nav.js
// Monta a barra de navegação no topo de cada página e liga o botão "Sair".
import { sair } from "./auth-guard.js";

export function renderizarNav(paginaAtiva, emailUsuario) {
  const nav = document.createElement("nav");
  nav.className = "nav-topo";

  const paginas = [
    { id: "lancar", href: "index.html", rotulo: "➕ Lançar" },
    { id: "extrato", href: "extrato.html", rotulo: "📋 Extrato" },
    { id: "dashboard", href: "dashboard.html", rotulo: "📊 Dashboard" }
  ];

  const linksHtml = paginas
    .map(p => `<a href="${p.href}" class="${p.id === paginaAtiva ? "ativo" : ""}">${p.rotulo}</a>`)
    .join("");

  nav.innerHTML = `
    <div class="nav-marca">💰 Meu Financeiro</div>
    <div class="nav-links">${linksHtml}</div>
    <div class="nav-usuario">
      <span class="nav-email"></span>
      <button id="btn-sair" class="botao botao-secundario botao-pequeno">Sair</button>
    </div>
  `;

  document.body.prepend(nav);

  const spanEmail = nav.querySelector(".nav-email");
  if (emailUsuario) spanEmail.textContent = emailUsuario;

  nav.querySelector("#btn-sair").addEventListener("click", sair);

  return nav;
}
