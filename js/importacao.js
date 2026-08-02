// importacao.js
// Reconhece as colunas do arquivo importado (mesmo que o cabeçalho tenha
// acentos, maiúsculas/minúsculas diferentes, etc.) e valida cada linha
// antes de qualquer coisa ser gravada no Firebase.
import { celulaParaDataISO, celulaParaNumero } from "./utils.js";
import { normalizarNomeBanco } from "./dados-comuns.js";

const CAMPOS_ESPERADOS = {
  data: ["data"],
  valor: ["valor"],
  descricao: ["descricao", "descrição"],
  saida: ["saida", "saída", "detalhe"],
  banco: ["banco"],
  tipo: ["tipo"],
  tipo_mov: ["tipo_mov", "tipomov", "movimentacao", "movimentação"],
  classificacao_saida: ["classificacao_saida", "classificação_saida", "classificacao", "classificação", "categoria"]
};

export const CAMPOS_OBRIGATORIOS = ["data", "valor", "descricao", "banco", "tipo", "tipo_mov", "classificacao_saida"];

function normalizarChave(chave) {
  return chave
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function normalizarTexto(texto) {
  return texto
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Olha o cabeçalho da primeira linha do arquivo e descobre qual coluna
// original corresponde a cada campo esperado (data, valor, banco...).
export function mapearCabecalhos(linhaBruta) {
  const chavesNormalizadas = {};
  Object.keys(linhaBruta).forEach((chaveOriginal) => {
    chavesNormalizadas[normalizarChave(chaveOriginal)] = chaveOriginal;
  });

  const mapa = {};
  Object.entries(CAMPOS_ESPERADOS).forEach(([campo, alternativas]) => {
    const encontrada = alternativas.find((alt) => chavesNormalizadas[alt] !== undefined);
    if (encontrada) mapa[campo] = chavesNormalizadas[encontrada];
  });

  return mapa;
}

// Valida e normaliza uma linha, devolvendo { valido, erros, dados }.
export function processarLinha(linhaBruta, mapaColunas) {
  const erros = [];
  const bruta = (campo) => {
    const chave = mapaColunas[campo];
    return chave !== undefined ? linhaBruta[chave] : undefined;
  };

  const dataISO = celulaParaDataISO(bruta("data"));
  if (!dataISO) erros.push("data inválida");

  const valorNumero = celulaParaNumero(bruta("valor"));
  if (!valorNumero || Number.isNaN(valorNumero) || valorNumero <= 0) erros.push("valor inválido");

  const descricao = String(bruta("descricao") ?? "").trim().toUpperCase();
  if (!descricao) erros.push("descrição vazia");

  const banco = normalizarNomeBanco(String(bruta("banco") ?? "").trim().toUpperCase());
  if (!banco) erros.push("banco vazio");

  const classificacao_saida = String(bruta("classificacao_saida") ?? "").trim().toUpperCase();
  if (!classificacao_saida) erros.push("classificação vazia");

  const saida = String(bruta("saida") ?? "").trim().toUpperCase();

  const tipo = normalizarTexto(bruta("tipo") ?? "");
  if (tipo !== "ENTRADA" && tipo !== "SAIDA") erros.push('tipo deve ser "ENTRADA" ou "SAIDA"');

  const tipo_mov = normalizarTexto(bruta("tipo_mov") ?? "");
  if (tipo_mov !== "INTERNO" && tipo_mov !== "EXTERNO") erros.push('movimentação deve ser "INTERNO" ou "EXTERNO"');

  return {
    valido: erros.length === 0,
    erros,
    dados: { data: dataISO, valor: valorNumero, descricao, saida, banco, tipo, tipo_mov, classificacao_saida }
  };
}
