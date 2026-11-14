// Bradesco — conta corrente (PDF "Bradesco Celular", extrato dos últimos dias).
//
//   Data        Histórico              Docto.    Crédito (R$)  Débito (R$)  Saldo (R$)
//   19/10/2026  RESG/VENCTO CDB        2923664   1.000,00                    2.988,21
//               PIX QR CODE DINAMICO                                              ← histórico numa linha
//               1246061                                       50,00        1.095,33  ← valores na de baixo
//               DES: PIU 19/10                                                     ← favorecido
//
// No texto puro não dá para saber se o número é crédito ou débito; pela
// posição (x) da coluna dá. Além disso, cada linha traz o saldo, então a
// leitura é conferida linha a linha (saldo anterior ± valor = saldo).
import { novoMovimento, numeroBR, ehNumeroBR, brParaIso, conferencia, centavos, periodoDe, textoDaLinha, somar } from "../comum.js";

function acharCabecalho(pagina) {
  for (const linha of pagina.linhas) {
    const credito = linha.partes.find((p) => /^Cr[ée]dito/i.test(p.t));
    const debito = linha.partes.find((p) => /^D[ée]bito/i.test(p.t));
    const saldo = linha.partes.find((p) => /^Saldo/i.test(p.t));
    const docto = linha.partes.find((p) => /^Docto/i.test(p.t));
    if (credito && debito && saldo) {
      return { y: linha.y, credito: credito.xf, debito: debito.xf, saldo: saldo.xf, docto: docto?.x ?? 300, data: linha.partes[0].x };
    }
  }
  return null;
}

function anexarComplemento(movimento, texto) {
  if (!movimento.contraparte) movimento.contraparte = texto;
  else movimento.historico = `${movimento.historico} ${texto}`.trim();
}

// Em qual coluna está um número: a borda direita mais próxima.
function colunaDoNumero(parte, cabecalho) {
  const opcoes = [["credito", cabecalho.credito], ["debito", cabecalho.debito], ["saldo", cabecalho.saldo]];
  return opcoes.sort((a, b) => Math.abs(parte.xf - a[1]) - Math.abs(parte.xf - b[1]))[0][0];
}

export const leitorBradescoContaPdf = {
  id: "bradesco-conta-pdf",
  rotulo: "Bradesco · conta corrente (PDF)",
  banco: "BRADESCO",

  aceita(arquivo) {
    const t = arquivo.textoPlano;
    return arquivo.tipo === "pdf" && /Bradesco/i.test(t) && /Extrato de:/i.test(t) && /Hist[óo]rico/i.test(t) && /D[ée]bito \(R\$\)/i.test(t);
  },

  ler(arquivo) {
    const movimentos = [];
    const avisos = [];
    let titular = null;
    let conta = null;
    let dataAtual = null;
    let historicoPendente = [];
    let ultimo = null;
    let totais = null;
    let saldoInicial = null;
    let saldoAnteriorLinha = null;

    for (const pagina of arquivo.paginas) {
      const cabecalho = acharCabecalho(pagina);
      if (!cabecalho) continue;

      for (const linha of pagina.linhas) {
        const texto = textoDaLinha(linha);
        if (!titular) titular = texto.match(/Nome:\s*(.+)$/)?.[1]?.trim() ?? null;
        if (!conta) conta = texto.match(/Ag[êe]ncia:\s*(\d+)\s*\|\s*Conta:\s*([\d-]+)/)?.slice(1).join("/") ?? null;
        if (linha.y >= cabecalho.y - 1) continue; // cabeçalho da página

        const partes = linha.partes;
        const parteData = partes.find((p) => p.x < cabecalho.docto - 40 && /^\d{2}\/\d{2}\/\d{4}$/.test(p.t));
        if (parteData) dataAtual = brParaIso(parteData.t);

        const numeros = partes.filter((p) => p.x > cabecalho.docto + 40 && ehNumeroBR(p.t));
        const parteDoc = partes.find((p) => /^\d{4,}$/.test(p.t) && Math.abs(p.x - cabecalho.docto) < 30);
        const textoLivre = partes
          .filter((p) => p !== parteData && p !== parteDoc && !numeros.includes(p))
          .map((p) => p.t).join(" ").trim();

        if (/^Total$/i.test(textoLivre)) {
          totais = {};
          numeros.forEach((p) => { totais[colunaDoNumero(p, cabecalho)] = numeroBR(p.t); });
          continue;
        }

        if (numeros.length) {
          // O histórico de uma linha de valores sem texto é a linha logo acima.
          // Linhas soltas antes dela são complemento do lançamento anterior
          // (ex.: "PAGUE FACIL BRADESCO 30,00" seguido de "RECARGA CLARO PRE PAGO").
          const historico = textoLivre || historicoPendente[historicoPendente.length - 1] || "";
          const complementos = textoLivre ? historicoPendente : historicoPendente.slice(0, -1);
          if (complementos.length && ultimo) anexarComplemento(ultimo, complementos.join(" "));
          historicoPendente = [];
          const valores = {};
          numeros.forEach((p) => { valores[colunaDoNumero(p, cabecalho)] = numeroBR(p.t); });

          if (/SALDO ANTERIOR/i.test(historico)) {
            saldoInicial = valores.saldo ?? null;
            saldoAnteriorLinha = saldoInicial;
            continue;
          }
          const valor = valores.credito ?? (valores.debito !== undefined ? -Math.abs(valores.debito) : null);
          if (valor === null || !dataAtual) {
            avisos.push(`Linha não entendida: "${texto}"`);
            continue;
          }

          const movimento = novoMovimento({
            banco: "BRADESCO",
            data: dataAtual,
            valor,
            historico,
            documento: parteDoc?.t ?? "",
            idExterno: `BRADESCO|${dataAtual}|${parteDoc?.t ?? ""}|${valor}`,
            extra: { saldoApos: valores.saldo ?? null }
          });

          // Conferência linha a linha pelo saldo
          if (valores.saldo !== undefined) {
            if (saldoAnteriorLinha === null) {
              saldoInicial = valores.saldo - valor;
            } else if (centavos(saldoAnteriorLinha + valor) !== centavos(valores.saldo)) {
              avisos.push(`Saldo não fecha em ${dataAtual} (${historico} ${movimento.valor}): esperado ${(saldoAnteriorLinha + valor).toFixed(2)}, extrato ${valores.saldo.toFixed(2)}.`);
            }
            saldoAnteriorLinha = valores.saldo;
          } else if (saldoAnteriorLinha !== null) {
            saldoAnteriorLinha += valor;
          }

          movimentos.push(movimento);
          ultimo = movimento;
          continue;
        }

        // "DES: JOAO DA SILVA C 20/10" (enviado) / "REM: SEU NOME ... 30/10" (recebido)
        const favorecido = textoLivre.match(/^(DES|REM):\s*(.*?)(?:\s+(\d{2}\/\d{2}))?$/i);
        if (favorecido && ultimo) {
          ultimo.contraparte = favorecido[2].trim();
          ultimo.extra.papelContraparte = favorecido[1].toUpperCase() === "DES" ? "destinatario" : "remetente";
          if (favorecido[3]) ultimo.extra.dataInformada = favorecido[3];
          continue;
        }

        if (textoLivre && !/^Folha/i.test(textoLivre)) historicoPendente.push(textoLivre);
      }
    }
    if (historicoPendente.length && ultimo) anexarComplemento(ultimo, historicoPendente.join(" "));

    const conferencias = [];
    if (totais) {
      if (totais.credito !== undefined) conferencias.push(conferencia("Total de créditos", totais.credito, somar(movimentos, "ENTRADA")));
      if (totais.debito !== undefined) conferencias.push(conferencia("Total de débitos", totais.debito, somar(movimentos, "SAIDA")));
    }
    const ultimoComSaldo = [...movimentos].reverse().find((m) => m.extra.saldoApos !== null);
    if (totais?.saldo !== undefined && saldoInicial !== null) {
      const liquido = somar(movimentos, "ENTRADA") - somar(movimentos, "SAIDA");
      conferencias.push(conferencia("Saldo inicial + movimentos = saldo final", totais.saldo, saldoInicial + liquido));
    }
    if (movimentos.length) {
      const falhas = avisos.filter((a) => a.startsWith("Saldo não fecha")).length;
      conferencias.push({ rotulo: "Saldo linha a linha", ok: falhas === 0, texto: falhas ? `${falhas} linha(s) não fecham` : "todas as linhas fecham" });
    }

    return {
      banco: "BRADESCO",
      titular,
      conta,
      periodo: periodoDe(movimentos),
      movimentos,
      saldoFinal: ultimoComSaldo ? { data: ultimoComSaldo.data, valor: totais?.saldo ?? ultimoComSaldo.extra.saldoApos } : null,
      conferencias,
      avisos
    };
  }
};
