// auth-guard.js
// Garante que só usuários logados vejam qualquer página do sistema.
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

export async function sair() {
  await signOut(auth);
  window.location.href = "login.html";
}
