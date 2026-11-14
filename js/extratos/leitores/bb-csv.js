// Banco do Brasil — conta corrente (arquivo .csv, vem em Latin-1).
// "Data","Lançamento","Detalhes","N° documento","Valor","Tipo Lançamento"
// Linhas "Saldo Anterior" / "Saldo do dia" / "S A L D O" não são movimentos,
// mas servem para conferir a leitura (saldo anterior + movimentos = saldo final).
import { lerCsv, normalizar, novoMovimento, brParaIso, numeroBR, conferencia, periodoDe, numerarIdsRepetidos } from "../comum.js";

export const leitorBbCsv = {
  id: "bb-csv",
  rotulo: "Banco do Brasil · conta corrente (CSV)",
  banco: "BB",

  aceita(arquivo) {
    if (arquivo.tipo !== "csv") return false;
    const cabecalho = normalizar(arquivo.texto.split(/\r?\n/)[0]);
    return cabecalho.includes("LANCAMENTO") && cabecalho.includes("TIPO LANCAMENTO");
  },

  ler(arquivo) {
    const [, ...linhas] = lerCsv(arquivo.texto);
    const movimentos = [];
    let saldoInicial = null;
    let saldoFinal = null;

    linhas.forEach(([data, lancamento, detalhes, documento, valor]) => {
      const dataIso = brParaIso(data);
      const numero = numeroBR(valor);
      const tipoLinha = normalizar(lancamento).replace(/\s/g, "");
      if (!dataIso || numero === null) return;

      if (tipoLinha === "SALDOANTERIOR") { saldoInicial = numero; return; }
      if (tipoLinha === "SALDO") { saldoFinal = { data: dataIso, valor: numero }; return; }
      if (tipoLinha === "SALDODODIA") return;

      movimentos.push(novoMovimento({
        banco: "BB",
        data: dataIso,
        valor: numero,
        historico: lancamento,
        // "20/10 12:01 IFOOD.COM AGENCIA DE REST" → "IFOOD.COM AGENCIA DE REST"
        contraparte: String(detalhes ?? "").replace(/^\d{2}\/\d{2}\s+\d{2}:\d{2}\s+/, ""),
        documento,
        idExterno: `BB|${dataIso}|${documento}|${numero}`
      }));
    });

    const conferencias = [];
    if (saldoInicial !== null && saldoFinal) {
      const movimentoLiquido = movimentos.reduce((s, m) => s + (m.tipo === "ENTRADA" ? m.valor : -m.valor), 0);
      conferencias.push(conferencia("Saldo anterior + movimentos = saldo final", saldoFinal.valor, saldoInicial + movimentoLiquido));
    }

    return {
      banco: "BB",
      periodo: periodoDe(movimentos),
      movimentos: numerarIdsRepetidos(movimentos),
      saldoFinal,
      conferencias,
      avisos: []
    };
  }
};
