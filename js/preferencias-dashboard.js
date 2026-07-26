// preferencias-dashboard.js
// Preferências de COMO você quer visualizar seus dados no dashboard — não são
// dados financeiros, então ficam salvas só no seu navegador (localStorage),
// sem gastar leitura/escrita do Firestore.

function chave(uid, sufixo) {
  return `pref_dashboard_${sufixo}_${uid}`;
}

function ler(uid, sufixo, valorPadrao) {
  try {
    const bruto = localStorage.getItem(chave(uid, sufixo));
    return bruto ? JSON.parse(bruto) : valorPadrao;
  } catch {
    return valorPadrao;
  }
}

function salvar(uid, sufixo, valor) {
  try {
    localStorage.setItem(chave(uid, sufixo), JSON.stringify(valor));
  } catch { /* ignora */ }
}

// ---------- Categorias "à parte" (ex: Vale Alimentação) ----------
// Classificações que não devem se misturar com o saldo/entradas "de verdade".
export function obterCategoriasSeparadas(uid) {
  return ler(uid, "categorias_separadas", []);
}
export function salvarCategoriasSeparadas(uid, lista) {
  salvar(uid, "categorias_separadas", lista);
}

// ---------- Visões personalizadas (gráficos/relatórios criados pelo usuário) ----------
// Cada visão: { id, titulo, filtroCampo, filtroValor, agruparPor, tipo }
export function obterVisoesPersonalizadas(uid) {
  return ler(uid, "visoes", []);
}
export function salvarVisoesPersonalizadas(uid, lista) {
  salvar(uid, "visoes", lista);
}
