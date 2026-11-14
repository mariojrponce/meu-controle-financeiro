// Bradesco — "fatura aberta" do cartão (app → Extrato → Em Aberto).
// O app só gera IMAGEM (um print da tela dentro de um PDF), então o texto vem
// do OCR (extratos/ocr.js), com x/y em milésimos da largura e y crescendo
// para baixo.
//
//   Situação do Extrato: Em Aberto
//   FULANO - VISA INFINITE                         XXXX.XXXX.XXXX.1234
//   Data   Histórico          Moeda de origem  US$       Cotação US$  R$
//   17/11  SALDO ANTERIOR                      USD 0,00  R$ 0,00      R$ 2.899,82   ← fatura fechada (vencimento)
//   11/11  LanchoneteBoa                       USD 0,00  R$ 0,00      R$ 36,80
//   Total para: FULANO                                                R$ 3.040,12
//
// A conferência é a soma: saldo anterior + compras − créditos = total. Um
// dígito lido errado pelo OCR faz a conta não fechar e a tela avisa.
//
// As compras entram como as da fatura fechada: banco BRADESCO, data = vencimento
// da PRÓXIMA fatura (o mês seguinte ao do saldo anterior), data real na descrição.
import { compactar, novoMovimento, isoDe, somarMeses, conferencia, somar, numerarIdsRepetidos, textoDaLinha } from "../comum.js";

const DIA_VENCIMENTO_PADRAO = 17;

// "2 899,82" / "2.899,82" / "R$36,80" / "-R$ 10,00" → número (OCR às vezes
// troca o ponto de milhar por espaço ou junta o "R$" no valor).
function valorDoFim(texto) {
  const m = texto.match(/(-?)\s*(?:R\s?\$|RS)?\s*(-?)\s*(\d[\d. ]*,\d{2})\s*(-?)\s*$/);
  if (!m) return null;
  const numero = Number(m[3].replace(/[ .]/g, "").replace(",", "."));
  return m[1] || m[2] || m[4] ? -numero : numero;
}

// Lixo que o OCR lê das bordas da tabela: "|", "—", "-".
function limparHistorico(partes) {
  return partes.map((p) => p.t.replace(/[|]/g, "")).filter((t) => t && !/^[—–\-_.:;]+$/.test(t)).join(" ").replace(/\s+/g, " ").trim();
}

export const leitorBradescoFaturaAbertaOcr = {
  id: "bradesco-fatura-aberta-ocr",
  rotulo: "Bradesco · fatura aberta do cartão (imagem, OCR)",
  banco: "BRADESCO",

  aceita(arquivo) {
    const t = arquivo.textoPlano;
    return arquivo.tipo === "ocr" && /Situa\S*\s+do\s+Extrato\S*\s+Em\s+Aberto/i.test(t) && /(SALDO\s+ANTERIOR|Total\s+para)/i.test(t);
  },

  ler(arquivo) {
    const avisos = [];
    const linhas = arquivo.paginas.flatMap((p) => p.linhas);
    const textos = linhas.map(textoDaLinha);

    const emissao = textos.map((t) => t.match(/Data:?\s*(\d{2})\/(\d{2})\/(\d{4})/)).find(Boolean);
    if (!emissao) avisos.push("Não achei a data de emissão (\"Data: dd/mm/aaaa\"); usei o ano atual.");
    const anoEmissao = emissao ? Number(emissao[3]) : new Date().getFullYear();
    const mesEmissao = emissao ? Number(emissao[2]) : new Date().getMonth() + 1;
    // dd/mm sem ano: se o mês é "depois" do mês da emissão (com folga de 1 para
    // o vencimento), é do ano anterior.
    const anoDe = (mes, folga = 0) => (mes > mesEmissao + folga ? anoEmissao - 1 : anoEmissao);

    // Coluna "R$" (a última do cabeçalho): o valor da linha tem de estar nela.
    // Sem isso, se o OCR perder o valor, o "R$ 0,00" da cotação viraria o valor.
    const cabecalho = linhas.find((l) => /Hist/i.test(textoDaLinha(l)) && /Cota/i.test(textoDaLinha(l)));
    const colunaReais = cabecalho ? [...cabecalho.partes].reverse().find((p) => /^R\$?$|^RS$/i.test(p.t)) : null;
    const xMinimoValor = colunaReais ? colunaReais.x - 40 : 850;
    const valorDaLinha = (linha, texto) => {
      const ultima = linha.partes[linha.partes.length - 1];
      return ultima && ultima.x >= xMinimoValor ? valorDoFim(texto) : null;
    };

    let cartao = null;
    let vencimentoAnterior = null;
    let saldoAnterior = 0;
    let total = null;
    const itens = [];
    const naoEntendidas = [];

    linhas.forEach((linha, i) => {
      const texto = textos[i];
      const final = texto.match(/(?:X{2,}|K{2,}|[XK.]{6,})[.\s]*(\d{4})\s*$/i);
      if (final && !cartao) cartao = final[1];

      if (/^Total\s+para/i.test(texto)) {
        const v = valorDaLinha(linha, texto);
        if (v === null) naoEntendidas.push(texto);
        else total = (total ?? 0) + v;
        return;
      }

      const parteData = linha.partes[0];
      // (o OCR às vezes gruda pontuação na data: "11/11." / "11/11—")
      const data = parteData && parteData.x <= 150 ? parteData.t.match(/^(\d{2})\/(\d{2})[^\d\w]*$/) : null;
      if (!data) return;
      const [dia, mes] = [Number(data[1]), Number(data[2])];
      if (dia < 1 || dia > 31 || mes < 1 || mes > 12) {
        naoEntendidas.push(texto);
        return;
      }

      // Histórico = do lado direito da data até a coluna "USD" (ou até a metade da página).
      const iUsd = linha.partes.findIndex((p) => /^US[D$S]/i.test(p.t));
      const fimHistorico = iUsd > 0 ? iUsd : linha.partes.findIndex((p, k) => k > 0 && p.x > 500);
      const partesHistorico = linha.partes.slice(1, fimHistorico > 0 ? fimHistorico : undefined);
      let historico = limparHistorico(partesHistorico);
      const valor = valorDaLinha(linha, texto);
      if (valor === null) {
        naoEntendidas.push(texto);
        return;
      }

      if (/SALDO\s+ANTERIOR/i.test(historico)) {
        vencimentoAnterior = isoDe(dia, mes, anoDe(mes, 1));
        saldoAnterior += valor;
        return;
      }

      let parcela = null;
      const grudada = historico.match(/^(.*?\S)\s*(\d{2})\/(\d{2})$/);
      if (grudada && Number(grudada[2]) <= Number(grudada[3]) && Number(grudada[3]) > 1) {
        historico = grudada[1];
        parcela = `${grudada[2]}/${grudada[3]}`;
      }
      itens.push({ dataCompra: isoDe(dia, mes, anoDe(mes)), historico, valor, parcela, pagamento: /PAGTO|PAGAMENTO/i.test(historico) });
    });

    naoEntendidas.forEach((t) => avisos.push(`Linha que o OCR não leu direito: "${t}"`));

    let vencimento;
    if (vencimentoAnterior) {
      vencimento = somarMeses(vencimentoAnterior, 1);
    } else {
      vencimento = somarMeses(isoDe(DIA_VENCIMENTO_PADRAO, mesEmissao, anoEmissao), 1);
      avisos.push(`Não achei a linha "SALDO ANTERIOR" para saber o vencimento; usei ${vencimento.split("-").reverse().join("/")}. Confira a data.`);
    }

    // Valor positivo na fatura = compra (saída); negativo = estorno/crédito.
    const movimentos = itens
      .filter((it) => !it.pagamento)
      .map((it) => novoMovimento({
        banco: "BRADESCO",
        data: vencimento,
        valor: -it.valor,
        historico: "CARTAO DE CREDITO",
        contraparte: it.historico,
        idExterno: `BRADESCO-CARTAO-ABERTA|${vencimento}|${it.dataCompra}|${Math.abs(it.valor)}|${compactar(it.historico)}`,
        dataOriginal: it.dataCompra,
        parcela: it.parcela,
        extra: { cartao, cartaoCredito: true, faturaAberta: true, ocr: true }
      }));
    const pagamentos = itens.filter((it) => it.pagamento).reduce((s, it) => s + it.valor, 0);

    const conferencias = [];
    if (total !== null) {
      const liquido = somar(movimentos, "SAIDA") - somar(movimentos, "ENTRADA");
      conferencias.push(conferencia("Saldo anterior + compras − créditos = total (confere o OCR)", total, saldoAnterior + liquido + pagamentos));
    } else {
      avisos.push("Não achei o \"Total para\" no fim da fatura: não deu para conferir a leitura. Confira os valores um a um.");
      conferencias.push({ rotulo: "Total da fatura", ok: false, texto: "não encontrado" });
    }
    if (naoEntendidas.length) conferencias.push({ rotulo: "Linhas lidas", ok: false, texto: `${naoEntendidas.length} linha(s) ilegível(is)` });
    avisos.push("Fatura ABERTA: lida por OCR (imagem). As compras entram no vencimento da próxima fatura e, quando ela fechar, a fatura fechada reconhece o que já foi lançado.");

    return {
      banco: "BRADESCO",
      cartaoCredito: true,
      faturaAberta: true,
      vencimento,
      periodo: { inicio: vencimento, fim: vencimento },
      movimentos: numerarIdsRepetidos(movimentos),
      saldoFinal: null,
      conferencias,
      avisos,
      saldoAnterior
    };
  }
};
