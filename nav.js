// nav.js
// Monta o layout com barra lateral (sidebar) e move o conteúdo já existente
// da página para dentro dela — sem precisar reescrever o HTML de cada tela.
import { sair } from "./auth-guard.js";

const PAGINAS = [
  { id: "lancar", href: "index.html", icone: "➕", rotulo: "Lançar" },
  { id: "importar", href: "importar.html", icone: "📥", rotulo: "Importar" },
  { id: "extrato", href: "extrato.html", icone: "📋", rotulo: "Extrato" },
  { id: "dashboard", href: "dashboard.html", icone: "📊", rotulo: "Dashboard" }
];

export function renderizarNav(paginaAtiva, emailUsuario) {
  const conteudoOriginal = Array.from(document.body.children);

  const layout = document.createElement("div");
  layout.className = "layout";

  const aside = document.createElement("aside");
  aside.className = "sidebar";

  const marca = document.createElement("div");
  marca.className = "sidebar-marca";
  marca.textContent = "💰 Meu Financeiro";

  const nav = document.createElement("nav");
  nav.className = "sidebar-links";
  PAGINAS.forEach((p) => {
    const link = document.createElement("a");
    link.href = p.href;
    if (p.id === paginaAtiva) link.classList.add("ativo");
    const icone = document.createElement("span");
    icone.className = "icone";
    icone.textContent = p.icone;
    const rotulo = document.createElement("span");
    rotulo.textContent = p.rotulo;
    link.appendChild(icone);
    link.appendChild(rotulo);
    nav.appendChild(link);
  });

  const rodape = document.createElement("div");
  rodape.className = "sidebar-rodape";
  const spanEmail = document.createElement("div");
  spanEmail.className = "sidebar-email";
  spanEmail.textContent = emailUsuario ?? "";
  const botaoSair = document.createElement("button");
  botaoSair.id = "btn-sair";
  botaoSair.className = "botao-sair";
  botaoSair.textContent = "🚪 Sair";
  botaoSair.addEventListener("click", sair);
  rodape.appendChild(spanEmail);
  rodape.appendChild(botaoSair);

  aside.appendChild(marca);
  aside.appendChild(nav);
  aside.appendChild(rodape);

  const main = document.createElement("main");
  main.className = "conteudo-principal";
  conteudoOriginal.forEach((el) => main.appendChild(el));

  layout.appendChild(aside);
  layout.appendChild(main);
  document.body.appendChild(layout);

  return { aside, main };
}
