// extratos/comum.js
// Funções pequenas usadas por todos os leitores de extrato. Este arquivo (e
// todos os de js/extratos/) NÃO importa nada do Firebase nem mexe na tela —
// só transforma texto em dados. Por isso dá para testar no Node
// (`node --test testes/`) com os extratos de verdade.

const MESES = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12
};

// Códigos de banco (COMPE) que aparecem nos textos de PIX/TED → nome usado no sistema.
const BANCOS_POR_CODIGO = { 1: "BB", 33: "SANTANDER", 104: "CAIXA", 237: "BRADESCO", 260: "NUBANK" };

export function bancoPorCodigo(codigo) {
  return BANCOS_POR_CODIGO[Number(codigo)] ?? null;
}

export function numeroDoMes(nome) {
  return MESES[semAcento(String(nome).toLowerCase()).replace(/\.$/, "")] ?? null;
}

export function semAcento(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Maiúsculas, sem acento e com espaços simples — forma usada para comparar textos.
export function normalizar(texto) {
  return semAcento(texto).toUpperCase().replace(/\s+/g, " ").trim();
}

// Só letras e números (sem espaço/pontuação): "Super Big." e "SUPERBIG" viram "SUPERBIG".
export function compactar(texto) {
  return normalizar(texto).replace(/[^A-Z0-9]/g, "");
}

// Valor em reais escrito no padrão brasileiro → número com sinal.
// Aceita "1.234,56", "-66,98", "1.557,73-" (sinal no fim, Santander),
// "-R$ 34,34" / "+R$ 1.392,53" (Pluxee) e "1.842,88 -" (fatura).
export function numeroBR(texto) {
  const bruto = String(texto ?? "").trim();
  const m = bruto.match(/^([+-])?\s*(?:R\$)?\s*([\d.]*\d,\d{2})\s*(-)?$/);
  if (!m) return null;
  const numero = Number(m[2].replace(/\./g, "").replace(",", "."));
  return m[1] === "-" || m[3] === "-" ? -numero : numero;
}

export function ehNumeroBR(texto) {
  return numeroBR(texto) !== null;
}

export function centavos(valor) {
  return Math.round(Number(valor) * 100);
}

function doisDigitos(n) {
  return String(n).padStart(2, "0");
}

export function isoDe(dia, mes, ano) {
  return `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
}

// "dd/mm/aaaa" → "aaaa-mm-dd" (ou null)
// "2026-11-17" + 1 mês → "2026-12-17" (dia preservado; vencimento do cartão).
export function somarMeses(iso, meses) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const total = ano * 12 + (mes - 1) + meses;
  return isoDe(dia, (total % 12) + 1, Math.floor(total / 12));
}

export function brParaIso(texto) {
  const m = String(texto ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? isoDe(m[1], m[2], m[3]) : null;
}

export function diasEntre(isoA, isoB) {
  return Math.round((Date.parse(`${isoB}T12:00:00Z`) - Date.parse(`${isoA}T12:00:00Z`)) / 86400000);
}

export function somarDias(iso, dias) {
  const d = new Date(Date.parse(`${iso}T12:00:00Z`) + dias * 86400000);
  return d.toISOString().slice(0, 10);
}

// Decodifica os bytes de um arquivo de texto: tenta UTF-8 (Nubank) e, se não
// for UTF-8 válido, usa Windows-1252/Latin-1 (BB).
export function decodificarTexto(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

// CSV simples com suporte a aspas ("19,00" não é quebrado na vírgula).
export function lerCsv(texto, separador = ",") {
  const linhas = [];
  let campo = "";
  let linha = [];
  let entreAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreAspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') entreAspas = false;
      else campo += c;
    } else if (c === '"') entreAspas = true;
    else if (c === separador) { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      if (linha.some((v) => v.trim() !== "")) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((v) => v.trim() !== "")) linhas.push(linha);
  return linhas;
}

// Cria o "movimento" padronizado que todo leitor devolve. Valor sempre
// positivo; o sentido vem de `tipo` (mesma regra dos lançamentos do sistema).
export function novoMovimento({
  banco, data, valor, historico = "", contraparte = "", documento = "",
  idExterno = "", dataOriginal = null, parcela = null, extra = {}
}) {
  const valorNumero = Math.abs(Number(valor));
  return {
    banco,
    data,
    valor: Math.round(valorNumero * 100) / 100,
    tipo: Number(valor) < 0 ? "SAIDA" : "ENTRADA",
    historico: String(historico).replace(/\s+/g, " ").trim(),
    contraparte: String(contraparte).replace(/\s+/g, " ").trim(),
    documento: String(documento ?? "").trim(),
    idExterno,
    dataOriginal,
    parcela,
    extra
  };
}

// Garante idExterno único quando o banco não dá um identificador próprio:
// duas compras iguais no mesmo dia ganham "#2", "#3"...
export function numerarIdsRepetidos(movimentos) {
  const vistos = new Map();
  movimentos.forEach((m) => {
    const n = (vistos.get(m.idExterno) ?? 0) + 1;
    vistos.set(m.idExterno, n);
    if (n > 1) m.idExterno = `${m.idExterno}#${n}`;
  });
  return movimentos;
}

// Monta um item de conferência ("o que o banco diz" × "o que eu li").
export function conferencia(rotulo, esperado, obtido) {
  return {
    rotulo,
    esperado: Math.round(esperado * 100) / 100,
    obtido: Math.round(obtido * 100) / 100,
    ok: Math.abs(centavos(esperado) - centavos(obtido)) === 0
  };
}

export function somar(movimentos, tipo) {
  return movimentos.filter((m) => m.tipo === tipo).reduce((s, m) => s + m.valor, 0);
}

export function periodoDe(movimentos) {
  const datas = movimentos.map((m) => m.data).filter(Boolean).sort();
  return datas.length ? { inicio: datas[0], fim: datas[datas.length - 1] } : null;
}

// Junta o texto de uma linha de PDF (partes já ordenadas por x).
export function textoDaLinha(linha) {
  return linha.partes.map((p) => p.t).join("  ");
}
