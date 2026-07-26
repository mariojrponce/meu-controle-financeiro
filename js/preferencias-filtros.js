// preferencias-filtros.js
// Lembra o último filtro (e ordenação, quando houver) usado em cada tela,
// para continuar do jeito que você deixou mesmo depois de atualizar a página.
// Guardado só no seu navegador — não é dado financeiro, então não usa o Firestore.

function chave(uid, pagina) {
  return `filtro_${pagina}_${uid}`;
}

export function obterFiltroSalvo(uid, pagina) {
  try {
    const bruto = localStorage.getItem(chave(uid, pagina));
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

export function salvarFiltro(uid, pagina, estado) {
  try {
    localStorage.setItem(chave(uid, pagina), JSON.stringify(estado));
  } catch { /* ignora */ }
}
