// configuracoes.js
// Lê e grava as configurações do usuário (um documento por usuário em
// "configuracoes/{uid}" no Firestore) e as põe em uso. Guarda uma cópia no
// navegador para não buscar no Firestore a cada página.
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { aplicarConfiguracoes, configuracoesPadrao, limparConfiguracoes } from "./configuracoes-modelo.js";

const NOME_COLECAO = "configuracoes";
const IDADE_MAXIMA_MS = 6 * 60 * 60 * 1000; // igual ao cache dos lançamentos

// Termina com o uid para ser apagada no logout (auth-guard.js).
const chaveCache = (uid) => `config_cache_${uid}`;

function lerCache(uid) {
  try {
    const objeto = JSON.parse(localStorage.getItem(chaveCache(uid)));
    if (!objeto || Date.now() - objeto.buscadoEm > IDADE_MAXIMA_MS) return null;
    return objeto;
  } catch {
    return null;
  }
}

function salvarCache(uid, config, personalizada) {
  try {
    localStorage.setItem(chaveCache(uid), JSON.stringify({ config, personalizada, buscadoEm: Date.now() }));
  } catch { /* só volta a buscar do Firestore */ }
}

// Busca as configurações do usuário e já as põe em uso na página.
// Devolve { config, personalizada } — personalizada=false quando o usuário
// nunca salvou nada (está no padrão do sistema).
export async function carregarConfiguracoes(usuario, { forcarAtualizacao = false } = {}) {
  if (!forcarAtualizacao) {
    const doCache = lerCache(usuario.uid);
    if (doCache) return { config: aplicarConfiguracoes(doCache.config), personalizada: Boolean(doCache.personalizada) };
  }
  const snapshot = await getDoc(doc(db, NOME_COLECAO, usuario.uid));
  const personalizada = snapshot.exists();
  const config = aplicarConfiguracoes(personalizada ? snapshot.data() : configuracoesPadrao());
  salvarCache(usuario.uid, config, personalizada);
  return { config, personalizada };
}

// Grava as configurações do usuário e já as põe em uso.
export async function salvarConfiguracoes(usuario, config) {
  const limpa = limparConfiguracoes(config);
  await setDoc(doc(db, NOME_COLECAO, usuario.uid), { ...limpa, atualizadoEm: serverTimestamp() });
  aplicarConfiguracoes(limpa);
  salvarCache(usuario.uid, limpa, true);
  return limpa;
}
