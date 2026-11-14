// Nubank — conta (arquivo .csv exportado pelo app).
// Cabeçalho: Data,Valor,Identificador,Descrição
// O "Identificador" é único por transação → reimportar o mesmo arquivo não duplica.
import { lerCsv, normalizar, novoMovimento, bancoPorCodigo, brParaIso, periodoDe } from "../comum.js";

// "Transferência recebida pelo Pix - FULANO - •••.123.456-•• - BCO BRADESCO S.A. (0237) Agência: 1234 Conta: 56789-0"
function separarDescricao(descricao) {
  const posicao = descricao.indexOf(" - ");
  const historico = posicao === -1 ? descricao : descricao.slice(0, posicao);
  let resto = posicao === -1 ? "" : descricao.slice(posicao + 3);

  const extra = {};
  const cpf = resto.match(/(\d{3}\.\d{3})-/);
  if (cpf) extra.cpfMeio = cpf[1];
  const codigoBanco = resto.match(/\((\d{3,4})\)/);
  if (codigoBanco) {
    extra.codigoBanco = Number(codigoBanco[1]);
    extra.bancoContraparte = bancoPorCodigo(codigoBanco[1]);
  }
  // Nome da contraparte = tudo antes do " - •••" (CPF) ou do " - 12.345.678/0001-90" (CNPJ)
  resto = resto
    .replace(/\s*\((Transfer[eê]ncia enviada|Transfer[eê]ncia recebida)\)\s*$/i, "")
    .split(/ - (?:•|\*|\d{2}\.\d{3}\.\d{3}\/)/)[0];
  const cnpj = descricao.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  if (cnpj) extra.cnpj = cnpj[1].replace(/\D/g, "");
  return { historico, contraparte: resto, extra };
}

export const leitorNubankCsv = {
  id: "nubank-csv",
  rotulo: "Nubank · conta (CSV)",
  banco: "NUBANK",

  aceita(arquivo) {
    if (arquivo.tipo !== "csv") return false;
    const cabecalho = normalizar(arquivo.texto.split(/\r?\n/)[0]);
    return cabecalho.startsWith("DATA,VALOR,IDENTIFICADOR,DESCRI");
  },

  ler(arquivo) {
    const [, ...linhas] = lerCsv(arquivo.texto);
    const movimentos = linhas.map(([data, valor, identificador, descricao]) => {
      const { historico, contraparte, extra } = separarDescricao(descricao ?? "");
      return novoMovimento({
        banco: "NUBANK",
        data: brParaIso(data),
        valor: Number(valor),
        historico,
        contraparte,
        idExterno: `NUBANK|${identificador}`,
        extra
      });
    }).filter((m) => m.data && m.valor > 0);

    return {
      banco: "NUBANK",
      periodo: periodoDe(movimentos),
      movimentos,
      saldoFinal: null,
      conferencias: [],
      avisos: ["O CSV do Nubank não traz saldo nem totais, então não dá para conferir a leitura por eles. Os rendimentos do mês só aparecem no PDF e continuam sendo lançados à mão."]
    };
  }
};
