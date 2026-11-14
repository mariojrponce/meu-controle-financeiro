// nav.js
// A barra lateral / navegação mobile vem no HTML de cada página.
// Gerencia link ativo, e-mail do usuário, logout e o Seletor de Tema (Leitura/Ergonomia).

import { sair } from "./auth-guard.js";

// Dia = claro, noite = escuro, sem depender do modo claro/escuro do sistema
// operacional (esse já é usado por outros apps e nem sempre reflete se é dia
// ou noite de verdade). Faixa fixa 06h–18h como aproximação de "sol lá fora".
function temaAutomaticoPorHorario() {
  const hora = new Date().getHours();
  return (hora >= 6 && hora < 18) ? "light" : "dark";
}

export function inicializarTema() {
  const temaSalvo = localStorage.getItem("tema_meu_financeiro");
  aplicarTema(temaSalvo || temaAutomaticoPorHorario());
  document.querySelectorAll(".btn-alternar-tema").forEach((btn) => {
    btn.onclick = (evento) => {
      evento.preventDefault();
      alternarProximoTema();
    };
  });
}

// Só aplica visualmente — não grava no localStorage. Se gravasse aqui, o
// tema "automático" viraria permanente já no primeiro carregamento do dia,
// e nunca mais acompanharia o horário nas próximas visitas.
export function aplicarTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  atualizarIconeBotaoTema(tema);
}

function alternarProximoTema() {
  document.documentElement.classList.add("tema-em-transicao");
  const temaAtual = document.documentElement.getAttribute("data-theme") || "light";
  const proximoTema = temaAtual === "light" ? "dark" : temaAtual === "dark" ? "sepia" : "light";
  aplicarTema(proximoTema);
  // Só uma escolha manual (o clique no botão) fixa o tema — daí sim vale
  // guardar, para respeitar a escolha do usuário nas próximas visitas.
  localStorage.setItem("tema_meu_financeiro", proximoTema);
  setTimeout(() => {
    document.documentElement.classList.remove("tema-em-transicao");
  }, 350);
}

const TEMAS = {
  light: { icone: "sol", rotulo: "Claro", proximo: "Trocar para o tema Escuro (noite)" },
  dark: { icone: "lua", rotulo: "Escuro", proximo: "Trocar para o tema Sépia (leitura confortável)" },
  sepia: { icone: "sepia", rotulo: "Sépia", proximo: "Trocar para o tema Claro" }
};

function atualizarIconeBotaoTema(tema) {
  const info = TEMAS[tema] ?? TEMAS.light;
  document.querySelectorAll(".btn-alternar-tema").forEach((btn) => {
    const rotulo = btn.querySelector(".tema-rotulo");
    const classeRotulo = rotulo?.className ?? "tema-rotulo";
    btn.innerHTML = `<svg class="icone" aria-hidden="true"><use href="assets/icones.svg#i-${info.icone}"></use></svg><span class="${classeRotulo}">${info.rotulo}</span>`;
    btn.title = info.proximo;
    btn.setAttribute("aria-label", `Tema ${info.rotulo}. ${info.proximo}`);
  });
}

// No celular, a barra de filtros começa recolhida (o conteúdo vem primeiro).
function recolherFiltrosNoCelular() {
  if (!window.matchMedia("(max-width: 767px)").matches) return;
  document.querySelectorAll("details.painel-filtros[open]").forEach((d) => d.removeAttribute("open"));
}

export function renderizarNav(paginaAtiva, emailUsuario) {
  inicializarTema();
  recolherFiltrosNoCelular();

  document.querySelectorAll(".sidebar-links a, .mobile-nav a").forEach((link) => {
    const ativo = link.dataset.pagina === paginaAtiva;
    link.classList.toggle("ativo", ativo);
    if (ativo) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  const spanEmail = document.querySelector(".sidebar-email");
  if (spanEmail) {
    spanEmail.textContent = emailUsuario ?? "";
    spanEmail.title = emailUsuario ?? "";
  }

  const botoesSair = document.querySelectorAll(".btn-sair, .botao-sair, #btn-sair");
  botoesSair.forEach((btn) => {
    btn.onclick = (evento) => {
      evento.preventDefault();
      sair();
    };
  });

}

