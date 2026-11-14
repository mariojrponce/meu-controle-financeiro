// extratos/leitores/index.js
// Descobre sozinho de qual banco é o arquivo e chama o leitor certo.
import { leitorNubankCsv } from "./nubank-csv.js";
import { leitorBbCsv } from "./bb-csv.js";
import { leitorPluxeePdf } from "./pluxee-pdf.js";
import { leitorBradescoContaPdf } from "./bradesco-conta-pdf.js";
import { leitorBradescoFaturaPdf } from "./bradesco-fatura-pdf.js";
import { leitorSantanderPdf } from "./santander-pdf.js";
import { leitorSantanderComprovantePdf } from "./santander-comprovante-pdf.js";
import { textoDaLinha } from "../comum.js";

export const LEITORES = [
  leitorNubankCsv,
  leitorBbCsv,
  leitorBradescoFaturaPdf,
  leitorBradescoContaPdf,
  leitorSantanderPdf,
  leitorSantanderComprovantePdf,
  leitorPluxeePdf
];

// Bancos/formatos que a tela explica que NÃO são lidos (para dar uma
// mensagem útil em vez de "formato desconhecido").
function explicarNaoSuportado(arquivo) {
  const t = arquivo.textoPlano ?? "";
  if (arquivo.tipo === "pdf" && !t.trim()) {
    return "Este PDF é uma imagem (não tem texto dentro). É o caso do extrato da Caixa e da fatura aberta do Bradesco. A Caixa continua sendo lançada à mão; para o cartão, use a fatura fechada.";
  }
  if (/Demonstrativo de Evolu[çc][ãa]o - Habita[çc][ãa]o/i.test(t)) return "Demonstrativo do financiamento da Caixa: é só informativo, não gera lançamentos.";
  if (/Extrato de Movimenta[çc][ãa]o/i.test(t) && /CDB/i.test(t)) return "Extrato de investimentos (CDB): as aplicações e resgates já vêm no extrato da conta do Bradesco, então este arquivo não gera lançamentos.";
  if (/Comprovante do Pix/i.test(t)) return "Comprovante de PIX deste banco não é lido (só o do Santander, para reconhecer o salário). Use o extrato do mês.";
  if (/nubank/i.test(t) && /Movimenta[çc][õo]es/i.test(t)) return "Extrato do Nubank em PDF: use o arquivo .csv do mesmo período (o app exporta os dois). O CSV tem um código único por transação, que evita duplicar.";
  if (/Extrato de Conta Corrente/i.test(t) && /Cliente:/i.test(t)) return "Extrato do Banco do Brasil em PDF: use o arquivo .csv do mesmo período.";
  return "Não reconheci este arquivo. Formatos aceitos: Nubank (CSV), Banco do Brasil (CSV), Bradesco conta e fatura fechada (PDF), Santander (PDF) e Pluxee (PDF).";
}

// arquivo = { nome, tipo: "csv" | "pdf", texto?, paginas? }
// Devolve { leitor, extrato } ou { erro }.
export function lerExtrato(arquivo) {
  const preparado = { ...arquivo };
  if (preparado.tipo === "pdf") {
    preparado.textoPlano = preparado.paginas.flatMap((p) => p.linhas.map(textoDaLinha)).join("\n");
  }
  const leitor = LEITORES.find((l) => l.aceita(preparado));
  if (!leitor) return { erro: explicarNaoSuportado(preparado) };

  const extrato = leitor.ler(preparado);
  return { leitor: { id: leitor.id, rotulo: leitor.rotulo }, extrato: { ...extrato, arquivo: arquivo.nome, leitor: leitor.id, rotulo: leitor.rotulo } };
}
