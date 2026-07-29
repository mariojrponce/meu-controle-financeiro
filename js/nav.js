// nav.js
// A barra lateral / navegação mobile vem no HTML de cada página.
// Gerencia link ativo, e-mail do usuário, logout e o Seletor de Tema (Leitura/Ergonomia).

import { sair } from "./auth-guard.js";

export function inicializarTema() {
  const temaSalvo = localStorage.getItem("tema_meu_financeiro");
  let tema = temaSalvo;

  if (!tema) {
    tema = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  aplicarTema(tema);
}

export function aplicarTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  localStorage.setItem("tema_meu_financeiro", tema);
  atualizarIconeBotaoTema(tema);
}

function alternarProximoTema() {
  document.documentElement.classList.add("tema-em-transicao");
  const temaAtual = document.documentElement.getAttribute("data-theme") || "light";
  const proximoTema = temaAtual === "light" ? "dark" : temaAtual === "dark" ? "sepia" : "light";
  aplicarTema(proximoTema);
  setTimeout(() => {
    document.documentElement.classList.remove("tema-em-transicao");
  }, 350);
}

function atualizarIconeBotaoTema(tema) {
  const btns = document.querySelectorAll(".btn-alternar-tema");
  btns.forEach((btn) => {
    if (tema === "dark") {
      btn.innerHTML = `🌙 <span class="tema-rotulo">Escuro</span>`;
      btn.title = "Alternar para tema Sépia (Conforto visual)";
    } else if (tema === "sepia") {
      btn.innerHTML = `📜 <span class="tema-rotulo">Sépia</span>`;
      btn.title = "Alternar para tema Claro";
    } else {
      btn.innerHTML = `☀️ <span class="tema-rotulo">Claro</span>`;
      btn.title = "Alternar para tema Escuro (Modo noturno)";
    }
  });
}

export function renderizarNav(paginaAtiva, emailUsuario) {
  inicializarTema();

  document.querySelectorAll(".sidebar-links a, .mobile-nav a").forEach((link) => {
    link.classList.toggle("ativo", link.dataset.pagina === paginaAtiva);
  });

  const spanEmail = document.querySelector(".sidebar-email");
  if (spanEmail) spanEmail.textContent = emailUsuario ?? "";

  const botoesSair = document.querySelectorAll(".btn-sair, .botao-sair, #btn-sair");
  botoesSair.forEach((btn) => {
    btn.onclick = (evento) => {
      evento.preventDefault();
      sair();
    };
  });

  const botoesTema = document.querySelectorAll(".btn-alternar-tema");
  botoesTema.forEach((btn) => {
    btn.onclick = (evento) => {
      evento.preventDefault();
      alternarProximoTema();
    };
  });
}

