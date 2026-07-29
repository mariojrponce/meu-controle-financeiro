// auth-guard.js
// Garante que só usuários logados vejam qualquer página do sistema.
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase-config.js";

// Retorna uma Promise que resolve com o usuário logado, ou redireciona imediatamente para o login.
export function exigirLogin() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (usuario) => {
      if (usuario) {
        document.body.classList.add("autenticado");
        resolve(usuario);
      } else {
        document.body.classList.remove("autenticado");
        window.location.replace("login.html");
      }
    });
  });
}

export async function sair() {
  try {
    const uid = auth.currentUser?.uid;
    if (uid) limparDadosLocaisDoUsuario(uid);
    await signOut(auth);
  } catch (erro) {
    console.error("Erro ao realizar logout:", erro);
  } finally {
    document.body.classList.remove("autenticado");
    window.location.replace("login.html");
  }
}

// Remove do localStorage tudo que foi salvo para este usuário (cache de
// transações + preferências de filtro/dashboard) — sem isso, os dados
// financeiros continuavam legíveis no navegador mesmo depois do logout.
function limparDadosLocaisDoUsuario(uid) {
  if (!uid) return;
  const sufixo = `_${uid}`;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const chave = localStorage.key(i);
    if (chave && chave.endsWith(sufixo)) localStorage.removeItem(chave);
  }
}

