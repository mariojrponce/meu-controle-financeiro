// utils.js
// Toda data é guardada no banco como texto ISO "aaaa-mm-dd", mas o campo
// visível na tela trabalha em "dd/mm/aaaa".

export function isoParaBR(dataISO) {
  const partes = (dataISO ?? "").split("-");
  if (partes.length !== 3) return "";
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

export function brParaISO(dataBR) {
  const m = (dataBR ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  return `${ano}-${mes}-${dia}`;
}

// Reconhece uma data digitada de forma flexível:
// aceita dia/mês com 1 ou 2 dígitos, separador "/", "-", "." ou espaço,
// e ano com 2 ou 4 dígitos. Sempre devolve no formato completo "dd/mm/aaaa",
// ou null se o texto não for uma data válida.
export function normalizarDataDigitada(texto) {
  const limpo = (texto ?? "").trim();
  const m = limpo.match(/^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2}|\d{4})$/);
  if (!m) return null;

  let [, dia, mes, ano] = m;
  dia = dia.padStart(2, "0");
  mes = mes.padStart(2, "0");
  if (ano.length === 2) ano = `20${ano}`;

  const diaNum = Number(dia);
  const mesNum = Number(mes);
  if (mesNum < 1 || mesNum > 12) return null;
  if (diaNum < 1 || diaNum > 31) return null;

  return `${dia}/${mes}/${ano}`;
}

// Tenta encontrar uma data dentro de um texto colado (ex: copiado de um extrato
// bancário, que pode ter outras palavras junto), nos formatos mais comuns.
export function extrairDataDeTexto(textoColado) {
  const texto = (textoColado ?? "").trim();

  let m = texto.match(/(\d{4})-(\d{1,2})-(\d{1,2})/); // aaaa-mm-dd (ISO)
  if (m) return normalizarDataDigitada(`${m[3]}/${m[2]}/${m[1]}`);

  m = texto.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/); // dd/mm/aaaa
  if (m) return normalizarDataDigitada(`${m[1]}/${m[2]}/${m[3]}`);

  m = texto.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})(?!\d)/); // dd/mm/aa
  if (m) return normalizarDataDigitada(`${m[1]}/${m[2]}/${m[3]}`);

  return null;
}

export function formatarMoeda(valor) {
  return (valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------- Intervalos de data (usados nos filtros de Extrato e Dashboard) ----------

function doisDigitos(numero) {
  return String(numero).padStart(2, "0");
}

export function hojeISO() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${doisDigitos(hoje.getMonth() + 1)}-${doisDigitos(hoje.getDate())}`;
}

export function ultimoDiaDoMes(ano, mes) {
  return new Date(Number(ano), Number(mes), 0).getDate();
}

// Intervalo padrão ao abrir as telas: do dia 1 até hoje, no mês atual.
export function intervaloMesAtual() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  return {
    ano,
    mes,
    inicioISO: `${ano}-${doisDigitos(mes)}-01`,
    fimISO: hojeISO()
  };
}

// Calcula o intervalo para um ano/mês escolhidos nos filtros.
// mes === "" significa "todos os meses" daquele ano.
export function intervaloParaAnoMes(ano, mes) {
  const hoje = new Date();
  const anoNum = Number(ano);

  if (!mes) {
    const fimISO = anoNum === hoje.getFullYear() ? hojeISO() : `${anoNum}-12-31`;
    return { inicioISO: `${anoNum}-01-01`, fimISO };
  }

  const mesNum = Number(mes);
  const ehMesAtual = anoNum === hoje.getFullYear() && mesNum === hoje.getMonth() + 1;
  const fimISO = ehMesAtual ? hojeISO() : `${anoNum}-${doisDigitos(mesNum)}-${doisDigitos(ultimoDiaDoMes(anoNum, mesNum))}`;
  return { inicioISO: `${anoNum}-${doisDigitos(mesNum)}-01`, fimISO };
}

// ---------- Conversores usados na importação de arquivos (CSV/TXT/XLSX) ----------

// Converte o valor de uma célula (Date do Excel, número serial ou texto) para "aaaa-mm-dd".
export function celulaParaDataISO(valorCelula) {
  if (valorCelula instanceof Date && !isNaN(valorCelula)) {
    const ano = valorCelula.getFullYear();
    const mes = String(valorCelula.getMonth() + 1).padStart(2, "0");
    const dia = String(valorCelula.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }
  if (typeof valorCelula === "number" && !isNaN(valorCelula)) {
    // número serial de data do Excel (base 30/12/1899)
    const base = new Date(Date.UTC(1899, 11, 30));
    const data = new Date(base.getTime() + valorCelula * 86400000);
    const ano = data.getUTCFullYear();
    const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
    const dia = String(data.getUTCDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }
  if (typeof valorCelula === "string" && valorCelula.trim() !== "") {
    const normalizada = normalizarDataDigitada(valorCelula);
    return normalizada ? brParaISO(normalizada) : null;
  }
  return null;
}

// Converte o valor de uma célula para número, aceitando tanto "150.50" quanto "150,50" / "1.234,56".
export function celulaParaNumero(valorCelula) {
  if (typeof valorCelula === "number") return valorCelula;
  if (typeof valorCelula !== "string") return NaN;

  let texto = valorCelula.trim().replace(/R\$/gi, "").replace(/\s/g, "");
  if (texto === "") return NaN;

  if (texto.includes(",")) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  }
  return parseFloat(texto);
}

// Liga um <input type="text"> para se comportar como campo de data "inteligente":
// - o usuário pode digitar livremente (com ou sem separador, 1 ou 2 dígitos, ano com 2 ou 4 dígitos)
// - ao sair do campo (blur), o valor é reconhecido e normalizado para "dd/mm/aaaa"
// - também aceita colar uma data de qualquer formato comum
// - se não conseguir reconhecer uma data válida, apenas destaca o campo (sem popup)
export function ligarCampoDataInteligente(input) {
  input.setAttribute("placeholder", "dd/mm/aaaa");
  input.setAttribute("inputmode", "numeric");
  input.setAttribute("maxlength", "10");

  input.addEventListener("blur", () => {
    if (input.value.trim() === "") {
      input.classList.remove("campo-invalido");
      return;
    }
    const dataNormalizada = normalizarDataDigitada(input.value);
    if (dataNormalizada) {
      input.value = dataNormalizada;
      input.classList.remove("campo-invalido");
    } else {
      input.classList.add("campo-invalido");
    }
  });

  input.addEventListener("input", () => {
    input.classList.remove("campo-invalido");
  });

  input.addEventListener("paste", (evento) => {
    const textoColado = (evento.clipboardData || window.clipboardData).getData("text");
    const dataReconhecida = extrairDataDeTexto(textoColado);
    if (dataReconhecida) {
      evento.preventDefault();
      input.value = dataReconhecida;
      input.classList.remove("campo-invalido");
    }
    // Se não reconhecer, deixa colar o texto normalmente para o usuário ajustar.
  });
}
