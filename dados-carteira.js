// dados-carteira.js
// Toda leitura/escrita da coleção "carteira" passa por aqui. A ideia central:
// buscar do Firestore só quando realmente necessário, e reaproveitar os dados
// já buscados (guardados no navegador) entre as páginas — já que hoje cada
// página buscava a coleção inteira de novo, consumindo a cota diária de
// leitura gratuita rapidinho.
import {
  collection, getDocs, query, where,
  addDoc, deleteDoc, doc, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

const NOME_COLECAO = "carteira";
const IDADE_MAXIMA_MS = 6 * 60 * 60 * 1000; // 6 horas — depois disso busca de novo sozinho

function chaveCache(uid) {
  return `carteira_cache_${uid}`;
}

function lerCache(uid) {
  try {
    const bruto = localStorage.getItem(chaveCache(uid));
    if (!bruto) return null;
    const objeto = JSON.parse(bruto);
    if (!objeto || !Array.isArray(objeto.transacoes)) return null;
    if (Date.now() - objeto.buscadoEm > IDADE_MAXIMA_MS) return null;
    return objeto.transacoes;
  } catch {
    return null;
  }
}

function salvarCache(uid, transacoes) {
  try {
    localStorage.setItem(chaveCache(uid), JSON.stringify({ transacoes, buscadoEm: Date.now() }));
  } catch (erro) {
    console.warn("Não foi possível salvar o cache local (não é grave, só volta a buscar do Firebase sempre):", erro);
  }
}

// Busca as transações do usuário. Usa o cache local se ele existir e ainda for
// recente; só fala com o Firestore de fato na primeira vez, ou quando
// forcarAtualizacao=true (botão "Atualizar dados"), ou quando o cache expira.
export async function obterTransacoes(usuario, { forcarAtualizacao = false } = {}) {
  if (!forcarAtualizacao) {
    const doCache = lerCache(usuario.uid);
    if (doCache) return doCache;
  }

  const consulta = query(collection(db, NOME_COLECAO), where("userId", "==", usuario.uid));
  const snapshot = await getDocs(consulta);
  const transacoes = [];
  snapshot.forEach((d) => transacoes.push({ id: d.id, ...d.data() }));
  salvarCache(usuario.uid, transacoes);
  return transacoes;
}

// Cria uma transação e já atualiza o cache local (sem precisar buscar tudo de novo).
export async function criarTransacao(usuario, dados) {
  const referencia = await addDoc(collection(db, NOME_COLECAO), {
    userId: usuario.uid,
    ...dados,
    criadoEm: serverTimestamp()
  });

  const cacheAtual = lerCache(usuario.uid) ?? [];
  cacheAtual.push({
    id: referencia.id,
    userId: usuario.uid,
    ...dados,
    criadoEm: { toMillis: () => Date.now() } // aproximação local até a próxima busca real
  });
  salvarCache(usuario.uid, cacheAtual);

  return referencia.id;
}

// Exclui uma transação e atualiza o cache local.
export async function excluirTransacaoPorId(usuario, id) {
  await deleteDoc(doc(db, NOME_COLECAO, id));
  const cacheAtual = lerCache(usuario.uid);
  if (cacheAtual) salvarCache(usuario.uid, cacheAtual.filter((t) => t.id !== id));
}

// Importa várias transações em lotes (usado na tela de Importar) e atualiza o cache local.
export async function importarTransacoes(usuario, listaDeDados, aoProgredir) {
  const TAMANHO_LOTE = 400;
  let feitos = 0;
  const novosDocs = [];

  for (let i = 0; i < listaDeDados.length; i += TAMANHO_LOTE) {
    const fatia = listaDeDados.slice(i, i + TAMANHO_LOTE);
    const lote = writeBatch(db);
    const referencias = fatia.map(() => doc(collection(db, NOME_COLECAO)));

    fatia.forEach((dadosLinha, indice) => {
      lote.set(referencias[indice], { userId: usuario.uid, ...dadosLinha, criadoEm: serverTimestamp() });
    });

    await lote.commit();
    fatia.forEach((dadosLinha, indice) => {
      novosDocs.push({ id: referencias[indice].id, userId: usuario.uid, ...dadosLinha });
    });

    feitos += fatia.length;
    aoProgredir?.(feitos, listaDeDados.length);
  }

  const cacheAtual = lerCache(usuario.uid) ?? [];
  salvarCache(usuario.uid, [...cacheAtual, ...novosDocs]);
}

export function invalidarCache(usuario) {
  try { localStorage.removeItem(chaveCache(usuario.uid)); } catch { /* ignora */ }
}
