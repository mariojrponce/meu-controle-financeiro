// utils.js
// Funções compartilhadas de data e moeda.
// Internamente, toda data é guardada como texto ISO "yyyy-mm-dd" (mesmo formato
// já usado no banco), mas o campo visível na tela trabalha em "dd/mm/aaaa".

export function isoParaBR(dataISO) {
  const partes = dataISO.split("-");
  if (partes.length !== 3) return "";
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

export function brParaISO(dataBR) {
  const m = dataBR.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  return `${ano}-${mes}-${dia}`;
}

// Tenta reconhecer uma data dentro de um texto colado (ex: copiado de um extrato bancário),
// aceitando os formatos mais comuns: dd/mm/aaaa, dd-mm-aaaa, dd.mm.aaaa, aaaa-mm-dd, dd/mm/aa.
export function extrairDataBR(textoColado) {
  const texto = textoColado.trim();

  let m = texto.match(/(\d{4})-(\d{2})-(\d{2})/); // aaaa-mm-dd (ISO)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;

  m = texto.match(/(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/); // dd/mm/aaaa, dd-mm-aaaa, dd.mm.aaaa
  if (m) return `${m[1]}/${m[2]}/${m[3]}`;

  m = texto.match(/(\d{2})[\/\-.](\d{2})[\/\-.](\d{2})(?!\d)/); // dd/mm/aa
  if (m) return `${m[1]}/${m[2]}/20${m[3]}`;

  return null;
}

export function formatarMoeda(valor) {
  return (valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Liga um <input type="text"> para se comportar como campo de data:
// - digita e o sistema insere as barras automaticamente
// - cola um texto (de qualquer formato comum) e o sistema reconhece a data
export function ligarCampoDataInteligente(input) {
  input.setAttribute("placeholder", "dd/mm/aaaa");
  input.setAttribute("inputmode", "numeric");
  input.setAttribute("maxlength", "10");

  input.addEventListener("input", () => {
    let digitos = input.value.replace(/\D/g, "").slice(0, 8);
    let formatado = digitos;
    if (digitos.length > 4) {
      formatado = `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
    } else if (digitos.length > 2) {
      formatado = `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
    }
    input.value = formatado;
  });

  input.addEventListener("paste", (evento) => {
    const textoColado = (evento.clipboardData || window.clipboardData).getData("text");
    const dataReconhecida = extrairDataBR(textoColado);
    if (dataReconhecida) {
      evento.preventDefault();
      input.value = dataReconhecida;
    }
    // Se não reconhecer um padrão de data, deixa o navegador colar o texto normalmente
    // e o usuário pode ajustar manualmente.
  });
}
