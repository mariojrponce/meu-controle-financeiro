// auth-guard.js
// Garante que só usuários logados vejam qualquer página do sistema.
// Se não estiver logado, manda para login.html.
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase-config.js";

// Retorna uma Promise que resolve com o usuário logado, ou redireciona para o login.
export function exigirLogin() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (usuario) => {
      if (usuario) {
        resolve(usuario);
      } else {
        window.location.href = "login.html";
      }
    });
  });
}

// Liga o botão de logout, se existir na página.
export function ligarBotaoSair() {
  const botaoSair = document.getElementById("btn-sair");
  if (botaoSair) {
    botaoSair.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "login.html";
    });
  }
}
