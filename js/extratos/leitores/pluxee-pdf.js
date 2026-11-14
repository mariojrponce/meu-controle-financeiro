// Pluxee (vale alimentação) — PDF do app.
//   12 novembro 2026                       ← cabeçalho do dia
//   Superbig Superm.        -R$ 34,34      ← estabelecimento + valor
//   Compra no Alimentação • 13:44          ← tipo + hora
// O PDF não traz totais, só o "Saldo total" na data em que foi gerado.
import { compactar, novoMovimento, numeroBR, numeroDoMes, isoDe, brParaIso, periodoDe, textoDaLinha, numerarIdsRepetidos } from "../comum.js";

const RE_DIA = /^(\d{1,2})\s+([A-Za-zçÇ]+)\s+(\d{4})$/;
const RE_VALOR = /^(.+?)\s+([+-]R\$\s*[\d.]*\d,\d{2})$/;
const RE_DETALHE = /^(.*?)\s*•\s*(\d{2}:\d{2})$/;

export const leitorPluxeePdf = {
  id: "pluxee-pdf",
  rotulo: "Pluxee · vale (PDF)",
  banco: "PLUXE",

  aceita(arquivo) {
    return arquivo.tipo === "pdf" && /\bPluxee\b/i.test(arquivo.textoPlano) && /Saldo total/i.test(arquivo.textoPlano);
  },

  ler(arquivo) {
    const textos = arquivo.paginas.flatMap((p) => p.linhas.map(textoDaLinha));
    const movimentos = [];
    let dataAtual = null;
    let saldoTotal = null;
    let dataSaldo = null;

    textos.forEach((texto, i) => {
      if (/^PDF gerado em/i.test(texto)) return;

      const atualizado = texto.match(/Extrato atualizado em (\d{2}\/\d{2}\/\d{4})/i);
      if (atualizado) dataSaldo = brParaIso(atualizado[1]);
      if (/^Saldo total$/i.test(texto.trim())) {
        // o valor do saldo vem numa das próximas linhas ("R$ 385,37")
        const linhaValor = textos.slice(i + 1, i + 4).find((t) => /^R\$\s*[\d.]*\d,\d{2}$/.test(t.trim()));
        if (linhaValor) saldoTotal = numeroBR(linhaValor);
        return;
      }

      const dia = texto.trim().match(RE_DIA);
      if (dia && numeroDoMes(dia[2])) {
        dataAtual = isoDe(dia[1], numeroDoMes(dia[2]), dia[3]);
        return;
      }

      const valor = texto.trim().match(RE_VALOR);
      if (valor && dataAtual) {
        const detalhe = (textos[i + 1] ?? "").trim().match(RE_DETALHE);
        const estabelecimento = valor[1].trim();
        const numero = numeroBR(valor[2].replace(/\s/g, ""));
        movimentos.push(novoMovimento({
          banco: "PLUXE",
          data: dataAtual,
          valor: numero,
          historico: detalhe ? detalhe[1] : "",
          contraparte: estabelecimento,
          idExterno: `PLUXE|${dataAtual}|${detalhe ? detalhe[2] : ""}|${numero}|${compactar(estabelecimento)}`,
          extra: { hora: detalhe ? detalhe[2] : null }
        }));
      }
    });

    return {
      banco: "PLUXE",
      periodo: periodoDe(movimentos),
      movimentos: numerarIdsRepetidos(movimentos),
      saldoFinal: saldoTotal !== null && dataSaldo ? { data: dataSaldo, valor: saldoTotal } : null,
      conferencias: [],
      avisos: ["O PDF da Pluxee não traz totais; a conferência é feita pelo \"Saldo total\" comparado com o saldo do sistema."]
    };
  }
};
