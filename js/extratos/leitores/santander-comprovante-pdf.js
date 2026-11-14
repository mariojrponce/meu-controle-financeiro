// Santander — comprovante de PIX (PDF gerado pelo app).
// Serve só de REFERÊNCIA, como o extrato do Santander: o extrato mensal só
// sai no mês seguinte, então o comprovante do PIX do salário (Santander →
// Bradesco) é o jeito de confirmar, no meio do mês, que aquele
// "PIX RECEBIDO REM: SEU NOME..." do Bradesco é salário.
import { novoMovimento, numeroBR, brParaIso, bancoPorCodigo, textoDaLinha } from "../comum.js";

function valorDepoisDe(textos, rotulo, aPartirDe = 0) {
  const i = textos.findIndex((t, indice) => indice >= aPartirDe && t.trim() === rotulo);
  return i === -1 ? { valor: null, indice: -1 } : { valor: textos[i + 1]?.trim() ?? null, indice: i + 1 };
}

export const leitorSantanderComprovantePdf = {
  id: "santander-comprovante-pdf",
  rotulo: "Santander · comprovante de PIX (PDF)",
  banco: "SANTANDER",

  aceita(arquivo) {
    const t = arquivo.textoPlano;
    return arquivo.tipo === "pdf" && /Comprovante do Pix/i.test(t) && /SANTANDER/i.test(t) && /Dados do pagador/i.test(t);
  },

  ler(arquivo) {
    const textos = arquivo.paginas.flatMap((p) => p.linhas.map(textoDaLinha));
    const valor = numeroBR(valorDepoisDe(textos, "Valor pago").valor);
    const dataHora = valorDepoisDe(textos, "Data e hora da transação").valor ?? "";
    const data = brParaIso(dataHora.slice(0, 10));
    const recebedor = valorDepoisDe(textos, "Dados do recebedor");
    const nomeRecebedor = valorDepoisDe(textos, "Para", recebedor.indice).valor;
    const instituicaoRecebedor = valorDepoisDe(textos, "Instituição", recebedor.indice).valor ?? "";
    const pagador = valorDepoisDe(textos, "Dados do pagador");
    const instituicaoPagador = valorDepoisDe(textos, "Instituição", pagador.indice).valor ?? "";
    const idTransacao = valorDepoisDe(textos, "ID/Transação").valor;

    const avisos = ["Comprovante de PIX do Santander: não vira lançamento. Serve para reconhecer o salário que chega no outro banco."];
    if (!/SANTANDER/i.test(instituicaoPagador)) avisos.push("Este comprovante não é de um PIX saindo do Santander.");
    if (!valor || !data) {
      return { banco: "SANTANDER", somenteReferencia: true, periodo: null, movimentos: [], saldoFinal: null, conferencias: [], avisos: ["Não consegui ler o valor/data do comprovante."] };
    }

    const codigoDestino = instituicaoRecebedor.match(/^(\d{3})/)?.[1];
    const movimento = novoMovimento({
      banco: "SANTANDER",
      data,
      valor: -Math.abs(valor),
      historico: "PIX ENVIADO",
      contraparte: nomeRecebedor ?? "",
      idExterno: `SANTANDER-PIX|${idTransacao ?? `${data}|${valor}`}`,
      extra: { bancoContraparte: codigoDestino ? bancoPorCodigo(codigoDestino) : null, comprovante: true }
    });

    return {
      banco: "SANTANDER",
      somenteReferencia: true,
      periodo: { inicio: data, fim: data },
      movimentos: /SANTANDER/i.test(instituicaoPagador) ? [movimento] : [],
      saldoFinal: null,
      conferencias: [],
      avisos
    };
  }
};
