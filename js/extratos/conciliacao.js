// extratos/conciliacao.js
// Junta tudo: pega os movimentos lidos dos extratos, decide o que cada um é
// (compra, resgate, transferência entre suas contas, salário...), compara
// com o que já está lançado no sistema (para não duplicar e para achar
// diferenças) e calcula se o saldo do sistema bate com o do banco.
//
// Nada aqui grava no Firebase: o resultado vai para a tela de revisão, e só
// o que você confirmar lá é gravado.
import { normalizar, compactar, centavos, diasEntre } from "./comum.js";
import { criarModeloClassificacao, sugerirClassificacao, chaveTexto, DETALHE_CARTAO } from "./classificador.js";

export const STATUS = {
  NOVO: "NOVO",                 // não está no sistema → lançar
  JA_LANCADO: "JA_LANCADO",     // já está no sistema (mesmo banco, valor e data próxima)
  DIVERGENTE: "DIVERGENTE",     // parecido com um lançamento do sistema, mas com valor/data diferente
  IGNORADO: "IGNORADO"          // não vira lançamento (ex.: pagamento da fatura)
};

export const ACAO = {
  LANCAR: "LANCAR",
  CORRIGIR: "CORRIGIR",         // atualiza valor/data do lançamento existente com o que o banco diz
  NADA: "NADA"
};

const CLASSIFICACAO_INTERNO = "CONTROLE INTERNO";
const CLASSIFICACAO_INVESTIMENTO = "INVESTIMENTO";
const CLASSIFICACAO_SALARIO = "SALARIO";

// ---------------------------------------------------------------- titular

// titular = { nomes: ["FULANO DE TAL SILVA"], cpfs: ["123.456"] }
// Compara pelas 3 primeiras palavras do nome (os bancos cortam o nome de jeitos
// diferentes: "Fulano de Tal Sil", "FULANO T SILVA"...).
function prefixoNome(nome) {
  return compactar(normalizar(nome).split(" ").slice(0, 3).join(" "));
}

export function ehDoTitular(movimento, titular) {
  if (movimento.extra?.cpfMeio && titular.cpfs?.includes(movimento.extra.cpfMeio)) return true;
  const contraparte = compactar(movimento.contraparte);
  if (!contraparte) return false;
  return (titular.nomes ?? []).some((nome) => {
    const prefixo = prefixoNome(nome);
    return prefixo.length >= 8 && contraparte.startsWith(prefixo);
  });
}

// Junta o titular salvo com os nomes que aparecem nos cabeçalhos dos PDFs.
export function detectarTitular(extratos, titularSalvo = {}) {
  const nomes = new Set((titularSalvo.nomes ?? []).map(normalizar).filter(Boolean));
  const cpfs = new Set(titularSalvo.cpfs ?? []);
  extratos.forEach((e) => { if (e.titular) nomes.add(normalizar(e.titular)); });
  const titular = { nomes: [...nomes], cpfs: [...cpfs] };
  // CPF parcial aprendido do Nubank: se o nome bate, guarda o "123.456".
  extratos.flatMap((e) => e.movimentos).forEach((m) => {
    if (m.extra?.cpfMeio && ehDoTitular({ ...m, extra: {} }, titular)) cpfs.add(m.extra.cpfMeio);
  });
  return { nomes: titular.nomes, cpfs: [...cpfs] };
}

// ---------------------------------------------------------------- utilidades

function ehVirada(doc) {
  return /VIRADA/.test(normalizar(doc.classificacao_saida)) || /^VIR_MES/.test(normalizar(doc.saida));
}

function ehDocCartao(doc) {
  return normalizar(doc.saida) === DETALHE_CARTAO;
}

function sinal(tipo) {
  return tipo === "ENTRADA" ? 1 : -1;
}

function mesmoValor(a, b) {
  return centavos(a) === centavos(b);
}

// ---------------------------------------------------------------- regras

function regraInvestimento(movimento) {
  const historico = normalizar(movimento.historico);
  const ehResgate = /RESG|RESGATE/.test(historico) && /CDB|RDB|INVEST|POUP/.test(historico);
  const ehAplicacao = /APLICACAO|APLIC\b/.test(historico) && /CDB|RDB|INVEST|POUP/.test(historico);
  if (!ehResgate && !ehAplicacao) return null;
  const produto = /CDB/.test(historico) ? "CDB" : /RDB/.test(historico) ? "RDB" : "INVESTIMENTO";
  return {
    descricao: `${ehResgate ? "RESGATE" : "APLICAÇÃO"} ${produto}`,
    saida: `${movimento.banco} INVESTIMENTO`,
    classificacao_saida: CLASSIFICACAO_INVESTIMENTO,
    tipo_mov: "EXTERNO",
    investimento: `${produto} ${movimento.banco}`,
    banco_investimento: movimento.banco,
    confianca: "alta",
    motivo: `${ehResgate ? "Resgate" : "Aplicação"} de ${produto} (mesma regra da tela Investimentos). Se quiser, escreva na descrição para que foi o dinheiro.`
  };
}

// Procura a outra ponta de uma transferência entre as suas contas: nos
// outros extratos subidos agora OU no que já está lançado no sistema.
function acharOutraPonta(movimento, movimentosLote, base) {
  const tipoOposto = movimento.tipo === "ENTRADA" ? "SAIDA" : "ENTRADA";
  // a entrada chega no mesmo dia ou até 3 dias depois da saída (fim de semana / data do PIX)
  const janela = (data) => {
    const d = diasEntre(movimento.data, data);
    return movimento.tipo === "SAIDA" ? d >= -1 && d <= 3 : d >= -3 && d <= 1;
  };
  const doLote = movimentosLote.find((m) => m !== movimento && m.banco !== movimento.banco
    && m.tipo === tipoOposto && mesmoValor(m.valor, movimento.valor) && janela(m.data));
  if (doLote) return { banco: doLote.banco, origem: "extrato" };

  const daBase = base.find((d) => d.banco !== movimento.banco && d.tipo === tipoOposto
    && d.tipo_mov === "INTERNO" && !ehVirada(d) && mesmoValor(d.valor, movimento.valor) && janela(d.data));
  if (daBase) return { banco: daBase.banco, origem: "sistema" };
  return null;
}

// Salário pela conta-salário do Santander: "CREDITO DE SALARIO" e, no mesmo
// dia, "PIX ENVIADO" do mesmo valor para você mesmo → no banco de destino
// chega um "PIX RECEBIDO" vindo de você.
// Também aceita o COMPROVANTE do PIX (o extrato mensal do Santander só sai no
// mês seguinte): como a conta do Santander só recebe salário, um PIX saindo
// dela para você é salário.
function acharSalarioSantander(movimento, movimentosReferencia) {
  const pix = movimentosReferencia.find((m) => m.banco === "SANTANDER" && m.tipo === "SAIDA"
    && Math.abs(m.valor - movimento.valor) <= 0.02 && diasEntre(m.data, movimento.data) >= 0 && diasEntre(m.data, movimento.data) <= 4);
  if (!pix) return null;
  const credito = movimentosReferencia.find((m) => m.banco === "SANTANDER" && m.tipo === "ENTRADA"
    && /SALARIO/.test(normalizar(m.historico)) && m.data === pix.data && Math.abs(m.valor - pix.valor) <= 0.02);
  return { pix, credito };
}

function regraTransferenciaPropria(movimento, contexto) {
  if (!ehDoTitular(movimento, contexto.titular)) return null;
  const { movimentosLote, movimentosReferencia, base } = contexto;

  if (movimento.tipo === "ENTRADA") {
    const salario = acharSalarioSantander(movimento, movimentosReferencia);
    if (salario || movimento.extra?.bancoContraparte === "SANTANDER") {
      return {
        descricao: "SALARIO",
        saida: "PIX SANTANDER (CONTA-SALÁRIO)",
        classificacao_saida: CLASSIFICACAO_SALARIO,
        tipo_mov: "EXTERNO",
        confianca: salario ? "alta" : "media",
        motivo: salario?.credito
          ? `Salário: crédito de salário no Santander em ${br(salario.credito.data)} repassado por PIX.`
          : salario
            ? `Salário: PIX da sua conta-salário do Santander em ${br(salario.pix.data)}.`
            : "PIX vindo do Santander (sua conta-salário)."
      };
    }
    const origem = movimento.extra?.bancoContraparte || acharOutraPonta(movimento, movimentosLote, base)?.banco;
    if (origem) {
      return {
        descricao: `PIX DE ${origem}`, saida: "", classificacao_saida: CLASSIFICACAO_INTERNO, tipo_mov: "INTERNO",
        confianca: "alta", motivo: `Transferência entre suas contas (veio do ${origem}).`
      };
    }
    const salarioNoSistema = base.find((d) => d.banco === movimento.banco && d.tipo === "ENTRADA"
      && /SALARIO/.test(normalizar(d.classificacao_saida)) && Math.abs(diasEntre(d.data, movimento.data)) <= 5);
    if (salarioNoSistema) {
      return {
        descricao: "SALARIO", saida: "PIX SANTANDER (CONTA-SALÁRIO)", classificacao_saida: CLASSIFICACAO_SALARIO, tipo_mov: "EXTERNO",
        confianca: "media", motivo: "PIX vindo de você perto da data de um salário no sistema. Suba o extrato do Santander para confirmar."
      };
    }
    return {
      descricao: "PIX DE OUTRA CONTA", saida: "", classificacao_saida: CLASSIFICACAO_INTERNO, tipo_mov: "INTERNO",
      confianca: "baixa", motivo: "PIX vindo de você, mas não achei de qual conta. Se for salário, troque a classificação."
    };
  }

  const destino = movimento.extra?.bancoContraparte || acharOutraPonta(movimento, movimentosLote, base)?.banco;
  return {
    descricao: destino ? `PIX PARA ${destino}` : "PIX PARA OUTRA CONTA",
    saida: "",
    classificacao_saida: CLASSIFICACAO_INTERNO,
    tipo_mov: "INTERNO",
    confianca: destino ? "alta" : "baixa",
    motivo: destino ? `Transferência entre suas contas (foi para o ${destino}).` : "PIX para você mesmo, mas não achei a conta de destino. Corrija a descrição se souber."
  };
}

// Parcela de compra antiga no cartão: "P6/P10 - AMAZON - 15/05" — copia o que
// você usou na parcela anterior (P5/P10).
function regraParcela(movimento, base) {
  if (!movimento.parcela || !movimento.dataOriginal) return null;
  const [atual, total] = movimento.parcela.split("/").map(Number);
  const ddmm = `${movimento.dataOriginal.slice(8, 10)}/${movimento.dataOriginal.slice(5, 7)}`;
  const anterior = base
    .filter((d) => ehDocCartao(d) && new RegExp(`^P\\d+/P${total}\\b.*${ddmm.replace("/", "\\/")}$`).test(d.descricao ?? "")
      && Math.abs(d.valor - movimento.valor) <= 1)
    .sort((a, b) => b.data.localeCompare(a.data))[0];
  if (!anterior) return null;
  return {
    descricao: anterior.descricao.replace(/^P\d+\/P\d+/, `P${atual}/P${total}`),
    saida: DETALHE_CARTAO,
    classificacao_saida: anterior.classificacao_saida,
    tipo_mov: "EXTERNO",
    confianca: "alta",
    motivo: `Parcela ${atual}/${total}: igual à parcela anterior ("${anterior.descricao}").`
  };
}

function regraIgnorar(movimento) {
  const historico = normalizar(movimento.historico);
  if (/GASTOS CARTAO|PAGTO.*CARTAO|PAGAMENTO.*FATURA|FATURA.*CARTAO/.test(historico)) {
    return "Pagamento da fatura do cartão: as compras entram pela fatura (senão o gasto conta duas vezes).";
  }
  return null;
}

// ---------------------------------------------------------------- base × extrato

// Quais lançamentos do sistema podem ser "o mesmo" que este movimento.
function candidatosNaBase(movimento, base) {
  const ehCartao = Boolean(movimento.extra?.cartaoCredito);
  return base.filter((d) => d.banco === movimento.banco && d.tipo === movimento.tipo && !ehVirada(d)
    && (ehCartao ? ehDocCartao(d) : !ehDocCartao(d)));
}

// Desempate quando há vários lançamentos com o mesmo valor: nome parecido e,
// no cartão, a data da compra no fim da descrição ("... - 11/11").
function parecidoTexto(movimento, doc) {
  let pontos = 0;
  const alvo = compactar(chaveTexto(movimento.contraparte || movimento.historico));
  const texto = compactar(doc.texto_banco || `${doc.saida} ${doc.descricao}`);
  if (alvo && texto && texto.includes(alvo.slice(0, 5))) pontos += 1;
  if (movimento.dataOriginal && ehDocCartao(doc)) {
    const ddmm = `${movimento.dataOriginal.slice(8, 10)}/${movimento.dataOriginal.slice(5, 7)}`;
    if ((doc.descricao ?? "").trim().endsWith(ddmm)) pontos += 2;
  }
  return pontos;
}

function casarComBase(linhas, base, hoje) {
  const usados = new Set();
  const porIdExterno = new Map(base.filter((d) => d.id_externo).map((d) => [d.id_externo, d]));

  // 1) identificador do banco já importado antes
  linhas.forEach((l) => {
    if (l.status === STATUS.IGNORADO) return;
    const doc = porIdExterno.get(l.movimento.idExterno);
    if (doc) {
      usados.add(doc.id);
      l.status = STATUS.JA_LANCADO;
      l.correspondente = doc;
      l.motivoStatus = "Este movimento já foi importado antes.";
    }
  });

  // 2) mesmo banco, tipo e valor; data até 3 dias de diferença (casamento global, mais perto primeiro)
  const pares = [];
  linhas.forEach((l, i) => {
    if (l.status !== STATUS.NOVO) return;
    candidatosNaBase(l.movimento, base).forEach((d) => {
      if (usados.has(d.id) || !mesmoValor(d.valor, l.movimento.valor)) return;
      const distancia = Math.abs(diasEntre(d.data, l.movimento.data));
      if (distancia <= 3) pares.push({ i, d, distancia, texto: parecidoTexto(l.movimento, d) });
    });
  });
  pares.sort((a, b) => a.distancia - b.distancia || b.texto - a.texto);
  pares.forEach(({ i, d, distancia }) => {
    const l = linhas[i];
    if (l.status !== STATUS.NOVO || usados.has(d.id)) return;
    usados.add(d.id);
    l.correspondente = d;
    const ehPrevistoComOutraData = d.data > hoje && d.data !== l.movimento.data;
    if (ehPrevistoComOutraData) {
      l.status = STATUS.DIVERGENTE;
      l.acao = ACAO.CORRIGIR;
      l.motivoStatus = `Previsto no sistema para ${br(d.data)}; o banco mostra ${br(l.movimento.data)}.`;
    } else {
      l.status = STATUS.JA_LANCADO;
      l.motivoStatus = distancia ? `Já lançado em ${br(d.data)} (${distancia} dia${distancia > 1 ? "s" : ""} de diferença).` : "Já lançado.";
    }
  });

  // 3) parecido mas com valor diferente (até 10% ou R$ 1) — erro de digitação ou previsto com valor estimado
  linhas.forEach((l) => {
    if (l.status !== STATUS.NOVO) return;
    const candidatos = candidatosNaBase(l.movimento, base).filter((d) => !usados.has(d.id)
      && Math.abs(diasEntre(d.data, l.movimento.data)) <= 3
      && Math.abs(d.valor - l.movimento.valor) <= Math.max(1, l.movimento.valor * 0.1)
      && l.sugestao.classificacao_saida && normalizar(d.classificacao_saida) === normalizar(l.sugestao.classificacao_saida));
    const d = candidatos.sort((a, b) => Math.abs(a.valor - l.movimento.valor) - Math.abs(b.valor - l.movimento.valor))[0];
    if (!d) return;
    usados.add(d.id);
    l.status = STATUS.DIVERGENTE;
    l.acao = ACAO.CORRIGIR;
    l.correspondente = d;
    l.motivoStatus = `No sistema está R$ ${d.valor.toFixed(2).replace(".", ",")} em ${br(d.data)}; o banco mostra R$ ${l.movimento.valor.toFixed(2).replace(".", ",")} em ${br(l.movimento.data)}.`;
  });

  return usados;
}

function br(iso) {
  return iso ? iso.split("-").reverse().join("/") : "";
}

// Lançamentos do sistema, no período e banco do extrato, que o banco NÃO mostra.
// Normalmente é aqui que aparece o lançamento feito no banco errado ou duplicado.
function acharFaltantes(extratos, base, usados, hoje) {
  const faltantes = [];
  extratos.forEach((e) => {
    if (e.somenteReferencia || !e.periodo || !e.movimentos.length) return;
    base.forEach((d) => {
      if (usados.has(d.id) || d.banco !== e.banco || ehVirada(d)) return;
      if (e.cartaoCredito) {
        // A fatura aberta ainda não mostra as parcelas do mês (só aparecem no fechamento).
        if (e.faturaAberta && /^P\d+\/P\d+/i.test((d.descricao ?? "").trim())) return;
        if (ehDocCartao(d) && d.data === e.vencimento) faltantes.push({ extrato: e.arquivo, doc: d });
        return;
      }
      if (ehDocCartao(d) || d.data > hoje) return;
      if (d.data >= e.periodo.inicio && d.data <= e.periodo.fim) faltantes.push({ extrato: e.arquivo, doc: d });
    });
  });
  return faltantes;
}

// ---------------------------------------------------------------- saldos

// Saldo do sistema num banco no fim do dia `ateData`, do jeito que o sistema
// já calcula: cada mês começa com a VIRADA (entrada no dia 01 com o saldo
// anterior) e vai somando os lançamentos do mês. A virada de saída (último dia)
// é o "fechamento" e não entra — senão o saldo do último dia daria zero.
// Sem a virada de entrada no mês, não dá para saber o saldo (semAbertura).
function dentroDoMes(data, ateData) {
  return data >= `${ateData.slice(0, 7)}-01` && data <= ateData;
}

// Previstos (data depois de hoje) só contam se o extrato confirmou que
// aconteceram (estão em `confirmados`).
export function saldoDoSistema(base, banco, ateData, { hoje = "9999-12-31", confirmados = new Set() } = {}) {
  let saldo = 0;
  let temAbertura = false;
  base.forEach((d) => {
    if (d.banco !== banco || !dentroDoMes(d.data, ateData)) return;
    if (d.data > hoje && !confirmados.has(d.id)) return;
    if (ehVirada(d) && d.tipo === "SAIDA") return;
    if (ehVirada(d) && d.tipo === "ENTRADA") temAbertura = true;
    saldo += sinal(d.tipo) * d.valor;
  });
  return { saldo, semAbertura: !temAbertura };
}

// Recalculado sempre que você muda uma ação na tela de revisão.
export function conferirSaldos(resultado, base) {
  const confirmados = new Set(resultado.linhas.map((l) => l.correspondente?.id).filter(Boolean));
  const hoje = resultado.hoje;
  return resultado.extratos
    .filter((e) => e.saldoFinal && !e.somenteReferencia && !e.cartaoCredito)
    .map((e) => {
      const { data, valor } = e.saldoFinal;
      const { saldo: antes, semAbertura } = saldoDoSistema(base, e.banco, data, { hoje, confirmados });
      let depois = antes;
      resultado.linhas.forEach((l) => {
        const m = l.movimento;
        if (m.banco !== e.banco) return;
        if (l.acao === ACAO.LANCAR && dentroDoMes(m.data, data)) depois += sinal(m.tipo) * m.valor;
        if (l.acao === ACAO.CORRIGIR && l.correspondente) {
          const d = l.correspondente;
          if (dentroDoMes(d.data, data)) depois -= sinal(d.tipo) * d.valor;
          if (dentroDoMes(m.data, data)) depois += sinal(m.tipo) * m.valor;
        }
      });
      return {
        banco: e.banco,
        arquivo: e.arquivo,
        data,
        saldoBanco: valor,
        saldoAntes: Math.round(antes * 100) / 100,
        saldoDepois: Math.round(depois * 100) / 100,
        semAbertura,
        ok: !semAbertura && centavos(depois) === centavos(valor)
      };
    });
}

// ---------------------------------------------------------------- principal

// extratos: saída dos leitores. base: lançamentos do sistema (obterTransacoes).
// titularSalvo: { nomes, cpfs } guardado no navegador. hoje: "aaaa-mm-dd".
export function prepararImportacao({ extratos, base, titularSalvo = {}, hoje }) {
  const titular = detectarTitular(extratos, titularSalvo);
  const modelo = criarModeloClassificacao(base, { hoje });
  const importaveis = extratos.filter((e) => !e.somenteReferencia);
  const movimentosLote = importaveis.flatMap((e) => e.movimentos);
  const movimentosReferencia = extratos.filter((e) => e.somenteReferencia).flatMap((e) => e.movimentos);
  const contexto = { titular, movimentosLote, movimentosReferencia, base };

  const linhas = [];
  const idsNoLote = new Set();
  const novaLinha = (movimento, extrato) => {
    // o mesmo movimento em dois arquivos (ex.: a fatura aberta em PDF e em print)
    if (movimento.idExterno && idsNoLote.has(movimento.idExterno)) {
      linhas.push({ movimento, arquivo: extrato.arquivo, status: STATUS.IGNORADO, acao: ACAO.NADA, sugestao: null, motivoStatus: "Repetido: este movimento já veio em outro arquivo desta importação.", correspondente: null });
      return;
    }
    if (movimento.idExterno) idsNoLote.add(movimento.idExterno);
    const motivoIgnorar = regraIgnorar(movimento);
    if (motivoIgnorar) {
      linhas.push({ movimento, arquivo: extrato.arquivo, status: STATUS.IGNORADO, acao: ACAO.NADA, sugestao: null, motivoStatus: motivoIgnorar, correspondente: null });
      return;
    }
    const textoBanco = chaveTexto(movimento.contraparte || movimento.historico);
    const porRegra = regraInvestimento(movimento)
      ?? regraTransferenciaPropria(movimento, contexto)
      ?? regraParcela(movimento, base);
    const sugestao = porRegra
      ? { tipo_mov: "EXTERNO", ...porRegra, textoBanco }
      : { tipo_mov: "EXTERNO", ...sugerirClassificacao(modelo, movimento) };
    linhas.push({ movimento, arquivo: extrato.arquivo, status: STATUS.NOVO, acao: ACAO.LANCAR, sugestao, motivoStatus: "", correspondente: null });
  };
  importaveis.forEach((extrato) => extrato.movimentos.forEach((m) => novaLinha(m, extrato)));

  // Parcelas futuras projetadas pela fatura fechada. Se a mesma parcela já
  // veio de verdade em outro arquivo (ou de outra fatura projetando a mesma),
  // fica só uma.
  const chaveParcela = (m) => `${m.dataOriginal}|${compactar(m.contraparte)}|${m.parcela}`;
  const parcelasVistas = new Set(movimentosLote.filter((m) => m.parcela).map(chaveParcela));
  importaveis.forEach((extrato) => (extrato.parcelasFuturas ?? []).forEach((m) => {
    if (parcelasVistas.has(chaveParcela(m))) return;
    parcelasVistas.add(chaveParcela(m));
    novaLinha(m, extrato);
  }));

  linhas.forEach((l) => {
    if (l.movimento.extra?.parcelaFutura && l.status === STATUS.NOVO) {
      l.motivoStatus = `Parcela ${l.movimento.parcela} prevista para a fatura de ${br(l.movimento.data)}.`;
    }
  });
  const usados = casarComBase(linhas, base, hoje);
  linhas.forEach((l) => {
    if (l.status === STATUS.JA_LANCADO || l.status === STATUS.IGNORADO) l.acao = ACAO.NADA;
  });

  const resultado = {
    hoje,
    titular,
    extratos,
    linhas,
    faltantes: acharFaltantes(importaveis, base, usados, hoje),
    classificacoesConhecidas: [...modelo.classificacoes.keys()].sort((a, b) => a.localeCompare(b, "pt-BR"))
  };
  resultado.saldos = conferirSaldos(resultado, base);
  return resultado;
}

// Monta o que será gravado no Firebase a partir das linhas revisadas.
// Devolve { criar: [dados], corrigir: [{ id, dados, anterior }] }.
export function montarGravacao(linhas, importacaoId) {
  const criar = [];
  const corrigir = [];
  linhas.forEach((l) => {
    const m = l.movimento;
    if (l.acao === ACAO.LANCAR) {
      const s = l.sugestao;
      const dados = {
        data: m.data,
        valor: m.valor,
        tipo: m.tipo,
        tipo_mov: s.tipo_mov,
        descricao: String(s.descricao).toUpperCase().trim().slice(0, 120),
        saida: String(s.saida ?? "").toUpperCase().trim().slice(0, 120),
        banco: m.banco,
        classificacao_saida: String(s.classificacao_saida).toUpperCase().trim().slice(0, 60),
        importacao_id: importacaoId,
        id_externo: m.idExterno,
        texto_banco: s.textoBanco ?? chaveTexto(m.contraparte || m.historico)
      };
      if (s.investimento) dados.investimento = s.investimento;
      if (s.banco_investimento) dados.banco_investimento = s.banco_investimento;
      criar.push(dados);
    } else if (l.acao === ACAO.CORRIGIR && l.correspondente) {
      const d = l.correspondente;
      corrigir.push({
        id: d.id,
        dados: { valor: m.valor, data: m.data, id_externo: m.idExterno },
        anterior: { valor: d.valor, data: d.data, id_externo: d.id_externo ?? null }
      });
    }
  });
  return { criar, corrigir };
}

// Uma linha só pode ser gravada se tiver o mínimo que as regras do Firestore exigem.
export function problemasDaLinha(linha) {
  if (linha.acao !== ACAO.LANCAR) return [];
  const s = linha.sugestao;
  const problemas = [];
  if (!String(s.descricao ?? "").trim()) problemas.push("descrição vazia");
  if (!String(s.classificacao_saida ?? "").trim()) problemas.push("escolha a classificação");
  if (!["INTERNO", "EXTERNO"].includes(s.tipo_mov)) problemas.push("movimentação inválida");
  return problemas;
}
