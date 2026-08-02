// exportar-excel.js
// Gera um .xlsx no mesmo modelo da planilha real do usuário (aba
// "ENTRADAS  SAIDAS": mesmas colunas, mesma ordem, mesmos nomes de
// cabeçalho) — para que, se um dia for preciso analisar os dados fora do
// sistema, o arquivo já sirva nas fórmulas/tabelas dinâmicas da planilha
// original. Depende do SheetJS (variável global XLSX) já carregado via
// <script> na página que chamar esta função.
import { NOMES_MESES } from "./utils.js";

const CABECALHOS = [
  "VALOR", "SAIDA", "DESCRICAO", "BANCO", "DATA", "SITUACAO", "TIPO",
  "MES", "ANO", "TIPO_MOV", "DIA", "CLASSIFICACAO SAIDA", "DIA_SEMANA"
];

// Larguras copiadas da planilha original (em "número de caracteres", mesma
// unidade que o Excel usa) para o arquivo abrir com as colunas já legíveis.
const LARGURAS_COLUNAS = [20.57, 37.43, 44.86, 17.29, 16.43, 26, 13.86, 10, 8, 15.86, 12.57, 26.71, 16];

// Constrói a data em horário LOCAL a partir do "aaaa-mm-dd" salvo — usar
// `new Date(dataISO)` diretamente interpretaria como UTC e viraria o dia
// errado em fusos atrás de UTC (ex: Brasil).
function dataLocalDoISO(dataISO) {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

// Número serial de data do Excel (dias desde 30/12/1899), calculado à mão em
// vez de deixar o SheetJS converter o objeto Date sozinho — a conversão dele
// soma/divide em milissegundos e sobra um resto de ponto flutuante, o que
// fazia a data abrir como "31/07 23:59:12" em vez de "01/08 00:00:00".
function serialExcelData(dataLocal) {
  const epocaExcelUTC = Date.UTC(1899, 11, 30);
  const dataUTC = Date.UTC(dataLocal.getFullYear(), dataLocal.getMonth(), dataLocal.getDate());
  return Math.round((dataUTC - epocaExcelUTC) / 86400000);
}

// A planilha original tem uma coluna SITUACAO com um controle manual mais
// fino (às vezes um lançamento antigo fica marcado como "PREVISTO" mesmo já
// tendo passado a data). O sistema não guarda esse controle à parte, então
// aqui a situação é sempre deduzida pela data: futuro = PREVISTO, senão
// PAGO (saída) ou RECEBIDO (entrada) — igual à lógica que o próprio
// app já usa no Extrato/Dashboard para marcar o selo "Previsto".
function calcularSituacao(transacao, hojeISO) {
  if (transacao.data > hojeISO) return "PREVISTO";
  return transacao.tipo === "ENTRADA" ? "RECEBIDO" : "PAGO";
}

function hojeISOLocal() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
}

export function exportarTransacoesXLSX(transacoes, nomeArquivo) {
  const hojeISO = hojeISOLocal();

  const linhas = transacoes
    .filter((t) => t.data && typeof t.valor === "number")
    .map((t) => {
      const dataLocal = dataLocalDoISO(t.data);
      return {
        VALOR: t.valor,
        // Nomes de coluna da planilha original: "SAIDA" guarda a descrição
        // principal e "DESCRICAO" guarda o detalhe — invertido em relação
        // aos nomes de campo do sistema, mas é a convenção que já existia.
        SAIDA: t.descricao ?? "",
        DESCRICAO: t.saida ?? "",
        BANCO: t.banco ?? "",
        DATA: serialExcelData(dataLocal),
        SITUACAO: calcularSituacao(t, hojeISO),
        TIPO: t.tipo ?? "",
        MES: (NOMES_MESES[dataLocal.getMonth()] ?? "").toUpperCase(),
        ANO: dataLocal.getFullYear(),
        TIPO_MOV: t.tipo_mov ?? "",
        DIA: dataLocal.getDate(),
        "CLASSIFICACAO SAIDA": t.classificacao_saida ?? "",
        DIA_SEMANA: dataLocal.toLocaleDateString("pt-BR", { weekday: "long" })
      };
    });

  const planilha = XLSX.utils.json_to_sheet(linhas, { header: CABECALHOS });
  planilha["!cols"] = LARGURAS_COLUNAS.map((wch) => ({ wch }));

  if (linhas.length > 0) {
    const intervalo = XLSX.utils.decode_range(planilha["!ref"]);
    for (let linha = intervalo.s.r + 1; linha <= intervalo.e.r; linha++) {
      const celulaValor = planilha[XLSX.utils.encode_cell({ r: linha, c: 0 })];
      if (celulaValor) celulaValor.z = "R$ #,##0.00";
      const celulaData = planilha[XLSX.utils.encode_cell({ r: linha, c: 4 })];
      if (celulaData) celulaData.z = "dd/mm/yyyy";
    }
  }

  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, "ENTRADAS  SAIDAS");
  XLSX.writeFile(livro, nomeArquivo);
}
