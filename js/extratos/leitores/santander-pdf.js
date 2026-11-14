// Santander — "Extrato Consolidado Inteligente" (PDF mensal).
// A conta do Santander é só uma conta-salário de passagem: o salário cai e
// no mesmo dia vai por PIX para o Bradesco (saldo sempre 0,00). Por isso ela
// NÃO vira banco no sistema: o extrato serve para reconhecer, no extrato do
// Bradesco, que aquele "PIX RECEBIDO REM: SEU NOME..." é SALÁRIO e não uma
// transferência entre contas.
//
//   Data   Descrição            Nº Documento   Movimento (R$)   Saldo (R$)
//          SALDO EM 30/09                                        0,00
//   15/10  CREDITO DE SALARIO   011015         1.557,72
//          CNPJ 025086034000171
//          PIX ENVIADO          -              1.557,72-        0,00
//          Fulano de Tal Sil
//          SALDO EM 31/10                                        0,00
import { novoMovimento, numeroBR, ehNumeroBR, isoDe, numeroDoMes, conferencia, somar, periodoDe, textoDaLinha } from "../comum.js";

export const leitorSantanderPdf = {
  id: "santander-pdf",
  rotulo: "Santander · conta-salário (PDF)",
  banco: "SANTANDER",

  aceita(arquivo) {
    return arquivo.tipo === "pdf" && /EXTRATO CONSOLIDADO INTELIGENTE/i.test(arquivo.textoPlano);
  },

  ler(arquivo) {
    const linhasTodas = arquivo.paginas.flatMap((p) => p.linhas);
    const textos = linhasTodas.map(textoDaLinha);

    const resumo = textos.map((t) => t.match(/Resumo - ([a-zçA-ZÇ]+)\/(\d{4})/i)).find(Boolean);
    const anoRef = resumo ? Number(resumo[2]) : null;
    const mesRef = resumo ? numeroDoMes(resumo[1]) : null;
    const titular = textos.findIndex((t) => /^Nome$/i.test(t.trim()));

    const totalCreditos = numeroBR(textos.find((t) => /Total de Cr[ée]ditos/i.test(t))?.split(/\s{2,}/).pop());
    const totalDebitos = numeroBR(textos.find((t) => /Total de D[ée]bitos/i.test(t))?.split(/\s{2,}/).pop());

    const inicio = textos.findIndex((t) => /^Movimenta[çc][ãa]o$/i.test(t.trim()));
    const cabecalho = linhasTodas[inicio + 1];
    const xMovimento = cabecalho?.partes.find((p) => /^Movimento/i.test(p.t))?.xf ?? 460;
    const xSaldo = cabecalho?.partes.find((p) => /^Saldo/i.test(p.t))?.xf ?? 550;

    const movimentos = [];
    let dataAtual = null;
    let ultimo = null;
    let saldosVistos = 0;
    let saldoFinal = null;

    for (let i = inicio + 2; inicio !== -1 && i < linhasTodas.length; i++) {
      const linha = linhasTodas[i];
      const texto = textos[i];
      const saldoEm = texto.match(/SALDO EM (\d{2})\/(\d{2})/);
      if (saldoEm) {
        saldosVistos++;
        if (saldosVistos > 1) {
          const numero = linha.partes.find((p) => ehNumeroBR(p.t));
          saldoFinal = { data: isoDe(saldoEm[1], saldoEm[2], anoRef), valor: numero ? numeroBR(numero.t) : 0 };
          break;
        }
        continue;
      }

      const parteData = linha.partes.find((p) => p.x < 60 && /^\d{2}\/\d{2}$/.test(p.t));
      if (parteData) {
        const [dia, mes] = parteData.t.split("/").map(Number);
        dataAtual = isoDe(dia, mes, mes > mesRef ? anoRef - 1 : anoRef);
      }
      const numeros = linha.partes.filter((p) => p.x > 380 && ehNumeroBR(p.t));
      const parteMovimento = numeros.sort((a, b) => Math.abs(a.xf - xMovimento) - Math.abs(b.xf - xMovimento))[0];
      const ehMovimento = parteMovimento && Math.abs(parteMovimento.xf - xMovimento) < Math.abs(parteMovimento.xf - xSaldo);
      const descricao = linha.partes.filter((p) => p.x >= 60 && p.x < 300).map((p) => p.t).join(" ");
      const documento = linha.partes.find((p) => p.x >= 290 && p.x < 380 && /^\d+$/.test(p.t))?.t ?? "";

      if (ehMovimento && dataAtual) {
        const valor = numeroBR(parteMovimento.t);
        ultimo = novoMovimento({
          banco: "SANTANDER",
          data: dataAtual,
          valor,
          historico: descricao,
          documento,
          idExterno: `SANTANDER|${dataAtual}|${documento}|${valor}`
        });
        movimentos.push(ultimo);
      } else if (descricao && ultimo && !ultimo.contraparte) {
        // linha de complemento: "CNPJ 025086034000171" ou o nome do favorecido
        const cnpj = descricao.match(/CNPJ\s*(\d{14,15})/i);
        if (cnpj) ultimo.extra.cnpj = cnpj[1].slice(-14);
        ultimo.contraparte = descricao;
      }
    }

    const conferencias = [];
    if (totalCreditos !== null) conferencias.push(conferencia("Total de créditos", totalCreditos, somar(movimentos, "ENTRADA")));
    if (totalDebitos !== null) conferencias.push(conferencia("Total de débitos", totalDebitos, somar(movimentos, "SAIDA")));

    return {
      banco: "SANTANDER",
      somenteReferencia: true,
      titular: titular !== -1 ? textos[titular + 1]?.trim() ?? null : null,
      periodo: periodoDe(movimentos),
      movimentos,
      saldoFinal,
      conferencias,
      avisos: ["Santander é conta-salário de passagem: não vira lançamento. Serve para reconhecer o salário que chega por PIX no Bradesco."]
    };
  }
};
