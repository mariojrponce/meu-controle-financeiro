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

