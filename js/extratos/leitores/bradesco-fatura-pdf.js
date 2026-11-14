// Bradesco — fatura FECHADA do cartão de crédito (PDF com texto).
// (A "fatura aberta" do app é imagem: tem leitor próprio, por OCR.)
//
// Como o sistema já faz hoje: cada compra vira um lançamento no banco
// BRADESCO, com a DATA DE VENCIMENTO da fatura, detalhe "BRADESCO CREDITO" e
// a data real da compra na descrição. A linha "GASTOS CARTAO DE CREDITO" do
// extrato da conta é ignorada (senão o gasto conta duas vezes).
//
// Página 2:  Data   Histórico de Lançamentos   Cidade   US$   R$  │ painel lateral (x > 355)
//            06/10  FAST LANCHES BUFFET E      PALMAS        8,00 │ Compras R$ 20.000,00 ...
//            15/05  AMAZON BR  06/10           SAO PAULO   345,79   ← parcela 6 de 10
import { compactar, novoMovimento, numeroBR, ehNumeroBR, brParaIso, isoDe, somarMeses, conferencia, somar, textoDaLinha, numerarIdsRepetidos } from "../comum.js";

const LIMITE_X_LANCAMENTOS = 355; // à direita disso é o painel de limites/taxas

// Parcelas que ainda vão cair: "AMAZON 06/10" nesta fatura → 07/10 a 10/10 nas
// próximas, com o mesmo valor. O banco informa a soma delas ("Total para as
// próximas faturas"), que serve de conferência. Entram como lançamentos
// futuros (previstos): se você já lançou à mão, aparecem como "já lançado".
function projetarParcelas(movimentos, vencimento) {
  const futuras = [];
  movimentos.forEach((m) => {
    if (!m.parcela || m.tipo !== "SAIDA") return;
    const [atual, total] = m.parcela.split("/").map(Number);
    for (let n = atual + 1; n <= total; n++) {
      const parcela = `${String(n).padStart(2, "0")}/${String(total).padStart(2, "0")}`;
      const data = somarMeses(vencimento, n - atual);
      futuras.push(novoMovimento({
        banco: "BRADESCO",
        data,
        valor: -m.valor,
        historico: m.historico,
        contraparte: m.contraparte,
        idExterno: `BRADESCO-CARTAO-PARCELA|${m.dataOriginal}|${compactar(m.contraparte)}|${parcela}`,
        dataOriginal: m.dataOriginal,
        parcela,
        extra: { ...m.extra, parcelaFutura: true }
      }));
    }
  });
  return futuras;
}

function acharTotalProximasFaturas(paginas) {
  for (const pagina of paginas) {
    for (const linha of pagina.linhas) {
      const i = linha.partes.findIndex((p) => /Total para as pr[óo]ximas faturas/i.test(p.t));
      if (i === -1) continue;
      const numero = linha.partes.slice(i + 1).find((p) => ehNumeroBR(p.t));
      if (numero) return numeroBR(numero.t);
    }
  }
  return null;
}

function acharVencimento(paginas) {
  for (const pagina of paginas) {
    for (let i = 0; i < pagina.linhas.length; i++) {
      if (!/Vencimento/.test(textoDaLinha(pagina.linhas[i]))) continue;
      const proxima = pagina.linhas[i + 1];
      const data = proxima?.partes.find((p) => /^\d{2}\/\d{2}\/\d{4}$/.test(p.t));
      const total = proxima?.partes.find((p) => /^R\$\s*[\d.]*\d,\d{2}$/.test(p.t));
      if (data) return { vencimento: brParaIso(data.t), total: total ? numeroBR(total.t) : null };
    }
  }
  return { vencimento: null, total: null };
}

export const leitorBradescoFaturaPdf = {
  id: "bradesco-fatura-pdf",
  rotulo: "Bradesco · fatura do cartão (PDF)",
  banco: "BRADESCO",

  aceita(arquivo) {
    const t = arquivo.textoPlano;
    return arquivo.tipo === "pdf" && /Fatura Mensal/i.test(t) && /Hist[óo]rico de Lan[çc]amentos/i.test(t);
  },

  ler(arquivo) {
    const { vencimento, total } = acharVencimento(arquivo.paginas);
    const avisos = [];
    if (!vencimento) {
      return { banco: "BRADESCO", periodo: null, movimentos: [], saldoFinal: null, conferencias: [], avisos: ["Não achei a data de vencimento da fatura."] };
    }
    const [anoVenc, mesVenc] = vencimento.split("-").map(Number);

    const movimentos = [];
    let pagamentoAnterior = 0;
    let totalFatura = null;
    let cartaoAtual = null;

    for (const pagina of arquivo.paginas) {
      for (const linha of pagina.linhas) {
        const partes = linha.partes.filter((p) => p.x < LIMITE_X_LANCAMENTOS);
        if (!partes.length) continue;
        const texto = partes.map((p) => p.t).join(" ");

        const cartao = texto.match(/Cart[ãa]o\s+\d{4}\s+X{4}\s+X{4}\s+(\d{4})/);
        if (cartao) cartaoAtual = cartao[1];

        if (/^Total da fatura em real/i.test(texto)) {
          const numero = partes.find((p) => ehNumeroBR(p.t));
          if (numero) totalFatura = numeroBR(numero.t);
          continue;
        }

        const parteData = partes[0];
        if (parteData.x > 60 || !/^\d{2}\/\d{2}$/.test(parteData.t)) continue;

        const parteValor = [...partes].reverse().find((p) => p.x > 290 && /^[\d.]*\d,\d{2}(\s*-)?$/.test(p.t));
        if (!parteValor) continue;
        const ehCredito = /-\s*$/.test(parteValor.t);
        const valor = Math.abs(numeroBR(parteValor.t.replace(/\s*-\s*$/, "")));

        // Histórico: x entre a data e a cidade. Parcela ("06/10") pode vir separada ou grudada no fim.
        const pedacosHistorico = partes.filter((p) => p !== parteData && p !== parteValor && p.x < 200);
        let parcela = null;
        const pedacoParcela = pedacosHistorico.find((p) => p.x > 90 && /^\d{2}\/\d{2}$/.test(p.t));
        let historico = pedacosHistorico.filter((p) => p !== pedacoParcela).map((p) => p.t).join(" ");
        if (pedacoParcela) parcela = pedacoParcela.t;
        else {
          const grudada = historico.match(/^(.*?\D)(\d{2})\/(\d{2})$/);
          if (grudada && Number(grudada[2]) <= Number(grudada[3])) {
            historico = grudada[1].replace(/[\s*]+$/, "");
            parcela = `${grudada[2]}/${grudada[3]}`;
          }
        }
        const cidade = partes.filter((p) => p.x >= 200 && p.x < 290).map((p) => p.t).join(" ");

        if (ehCredito && /PAGTO|PAGAMENTO/i.test(historico)) {
          pagamentoAnterior += valor; // pagamento da fatura anterior: não é lançamento
          continue;
        }

        const [dia, mes] = parteData.t.split("/").map(Number);
        const anoCompra = mes > mesVenc ? anoVenc - 1 : anoVenc;
        const dataCompra = isoDe(dia, mes, anoCompra);

        movimentos.push(novoMovimento({
          banco: "BRADESCO",
          data: vencimento,
          valor: ehCredito ? valor : -valor,
          historico: "CARTAO DE CREDITO",
          contraparte: historico,
          idExterno: `BRADESCO-CARTAO|${vencimento}|${dataCompra}|${valor}|${compactar(historico)}`,
          dataOriginal: dataCompra,
          parcela,
          extra: { cartao: cartaoAtual, cidade, cartaoCredito: true }
        }));
      }
    }

    const conferencias = [];
    const totalReferencia = totalFatura ?? total;
    if (totalReferencia !== null) {
      conferencias.push(conferencia("Compras − créditos = total da fatura", totalReferencia, somar(movimentos, "SAIDA") - somar(movimentos, "ENTRADA")));
    } else {
      avisos.push("Não achei o total da fatura para conferir.");
    }

    const parcelasFuturas = projetarParcelas(movimentos, vencimento);
    const totalProximas = acharTotalProximasFaturas(arquivo.paginas);
    if (totalProximas !== null && (totalProximas > 0 || parcelasFuturas.length)) {
      conferencias.push(conferencia("Parcelas futuras = total para as próximas faturas", totalProximas, somar(parcelasFuturas, "SAIDA")));
    }

    return {
      banco: "BRADESCO",
      cartaoCredito: true,
      vencimento,
      periodo: { inicio: vencimento, fim: vencimento },
      movimentos: numerarIdsRepetidos(movimentos),
      parcelasFuturas: numerarIdsRepetidos(parcelasFuturas),
      saldoFinal: null,
      conferencias,
      avisos,
      pagamentoAnterior
    };
  }
};
