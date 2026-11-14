// Testes da importação de extratos. Rodar com:  npm test   (ou  node --test testes/)
//
// Duas partes:
// 1) Testes com dados inventados — rodam em qualquer máquina.
// 2) Testes com os extratos REAIS de modelo-extratos/ e o backup da base —
//    essas pastas ficam fora do git (dados pessoais), então os testes são
//    pulados quando elas não existem.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { numeroBR, lerCsv, decodificarTexto, somarMeses } from "../js/extratos/comum.js";
import { linhasDoOcr, tratarPixels } from "../js/extratos/ocr.js";
import { chaveTexto, criarModeloClassificacao, sugerirClassificacao } from "../js/extratos/classificador.js";
import { prepararImportacao, ehDoTitular, saldoDoSistema, montarGravacao, STATUS, ACAO } from "../js/extratos/conciliacao.js";
import { lerExtrato } from "../js/extratos/leitores/index.js";
import { temModelos, lerModelo } from "./carregar-extratos.mjs";

// ------------------------------------------------------------ 1) dados inventados

test("numeroBR entende os formatos dos bancos", () => {
  assert.equal(numeroBR("1.234,56"), 1234.56);
  assert.equal(numeroBR("-66,98"), -66.98);
  assert.equal(numeroBR("1.557,73-"), -1557.73);
  assert.equal(numeroBR("-R$ 34,34"), -34.34);
  assert.equal(numeroBR("+R$ 1.392,53"), 1392.53);
  assert.equal(numeroBR("1.842,88 -"), -1842.88);
  assert.equal(numeroBR("abc"), null);
});

test("lerCsv respeita aspas e vírgula decimal", () => {
  assert.deepEqual(lerCsv('"a","19,00"\n"b","-1,50"\n'), [["a", "19,00"], ["b", "-1,50"]]);
});

test("decodificarTexto aceita UTF-8 e Latin-1", () => {
  assert.equal(decodificarTexto(new TextEncoder().encode("Lançamento")), "Lançamento");
  assert.equal(decodificarTexto(new Uint8Array([0x4c, 0x61, 0x6e, 0xe7, 0x61])), "Lança");
});

test("chaveTexto tira códigos e palavras genéricas", () => {
  assert.equal(chaveTexto("DL*Spotify P478E"), "SPOTIFY");
  assert.equal(chaveTexto("ASSAI ATACADISTA LJ176"), "ASSAI ATACADISTA");
  assert.equal(chaveTexto("Uber UBER *TRIP HELP.U"), "UBER TRIP HELP U");
});

test("leitor Nubank CSV separa contraparte, CPF e banco", () => {
  const texto = "Data,Valor,Identificador,Descrição\n" +
    "04/11/2026,100.00,abc-1,Transferência recebida pelo Pix - FULANO DE TAL SILVA - •••.123.456-•• - BCO BRADESCO S.A. (0237) Agência: 1 Conta: 2-3\n" +
    "05/11/2026,-9.90,abc-2,Compra no débito - Uber UBER *TRIP HELP.U\n";
  const { extrato } = lerExtrato({ nome: "nu.csv", tipo: "csv", texto });
  assert.equal(extrato.movimentos.length, 2);
  const [pix, uber] = extrato.movimentos;
  assert.equal(pix.tipo, "ENTRADA");
  assert.equal(pix.contraparte, "FULANO DE TAL SILVA");
  assert.equal(pix.extra.bancoContraparte, "BRADESCO");
  assert.equal(pix.extra.cpfMeio, "123.456");
  assert.equal(uber.tipo, "SAIDA");
  assert.equal(uber.idExterno, "NUBANK|abc-2");
});

const titular = { nomes: ["FULANO DE TAL SILVA"], cpfs: [] };

test("ehDoTitular compara pelas 3 primeiras palavras do nome", () => {
  assert.ok(ehDoTitular({ contraparte: "Fulano de Tal Sil", extra: {} }, titular));
  assert.ok(!ehDoTitular({ contraparte: "Beltrano de Tal", extra: {} }, titular));
});

function doc(id, campos) {
  return { id, tipo_mov: "EXTERNO", saida: "", descricao: "X", classificacao_saida: "X", ...campos };
}

test("classificador usa o histórico e o valor para escolher a classificação", () => {
  const base = [
    ...Array.from({ length: 5 }, (_, i) => doc(`g${i}`, { data: "2026-10-0" + (i + 1), banco: "PLUXE", tipo: "SAIDA", valor: 300, saida: "GIGANTE ATACADO", descricao: "COMPRAS CASA SEMANA", classificacao_saida: "COMPRAS CASA" })),
    ...Array.from({ length: 5 }, (_, i) => doc(`l${i}`, { data: "2026-10-1" + i, banco: "PLUXE", tipo: "SAIDA", valor: 15, saida: "GIGANTE ATACADO", descricao: "LANCHE TARDE", classificacao_saida: "LANCHE" }))
  ];
  const modelo = criarModeloClassificacao(base, { hoje: "2026-11-01" });
  const grande = sugerirClassificacao(modelo, { banco: "PLUXE", tipo: "SAIDA", valor: 280, contraparte: "Gigante Atacado", historico: "", extra: {} });
  const pequeno = sugerirClassificacao(modelo, { banco: "PLUXE", tipo: "SAIDA", valor: 12, contraparte: "Gigante Atacado", historico: "", extra: {} });
  assert.equal(grande.classificacao_saida, "COMPRAS CASA");
  assert.equal(pequeno.classificacao_saida, "LANCHE");
  assert.equal(grande.saida, "GIGANTE ATACADO");
});

test("texto do banco já importado antes vira sugestão aprendida", () => {
  const base = [doc("a", { data: "2026-10-01", banco: "NUBANK", tipo: "SAIDA", valor: 50, saida: "PIU RECARGAS", descricao: "RECARGA PASSE ONIBUS", classificacao_saida: "ONIBUS", texto_banco: "LMB TECNOLOGIA" })];
  const modelo = criarModeloClassificacao(base, { hoje: "2026-11-01" });
  const s = sugerirClassificacao(modelo, { banco: "NUBANK", tipo: "SAIDA", valor: 50, contraparte: "LMB TECNOLOGIA LTDA", historico: "", extra: {} });
  assert.equal(s.classificacao_saida, "ONIBUS");
  assert.equal(s.descricao, "RECARGA PASSE ONIBUS");
  assert.equal(s.confianca, "alta");
});

function extratoFicticio(banco, movimentos, extras = {}) {
  return { banco, arquivo: `${banco}.x`, periodo: { inicio: "2026-11-01", fim: "2026-11-30" }, movimentos, saldoFinal: null, conferencias: [], avisos: [], ...extras };
}
function mov(banco, data, valor, contraparte, historico = "", extra = {}) {
  return { banco, data, valor: Math.abs(valor), tipo: valor < 0 ? "SAIDA" : "ENTRADA", contraparte, historico, idExterno: `${banco}|${data}|${valor}|${contraparte}`, extra };
}

test("transferência entre suas contas é reconhecida dos dois lados", () => {
  const extratos = [
    extratoFicticio("BRADESCO", [mov("BRADESCO", "2026-11-04", -100, "Fulano de Tal Silva", "PIX ENVIADO")]),
    extratoFicticio("NUBANK", [mov("NUBANK", "2026-11-04", 100, "FULANO DE TAL SILVA", "Transferência recebida pelo Pix", { bancoContraparte: "BRADESCO" })])
  ];
  const r = prepararImportacao({ extratos, base: [], titularSalvo: titular, hoje: "2026-11-14" });
  const [saida, entrada] = r.linhas;
  assert.equal(saida.sugestao.tipo_mov, "INTERNO");
  assert.equal(saida.sugestao.descricao, "PIX PARA NUBANK");
  assert.equal(entrada.sugestao.descricao, "PIX DE BRADESCO");
  assert.equal(entrada.sugestao.classificacao_saida, "CONTROLE INTERNO");
});

test("PIX do Santander para você mesmo é salário", () => {
  const extratos = [
    extratoFicticio("BRADESCO", [mov("BRADESCO", "2026-11-16", 2000.5, "FULANO DE TAL SILVA", "PIX RECEBIDO")]),
    extratoFicticio("SANTANDER", [
      mov("SANTANDER", "2026-11-14", 2000.5, "CNPJ 1", "CREDITO DE SALARIO"),
      mov("SANTANDER", "2026-11-14", -2000.5, "Fulano de Tal Sil", "PIX ENVIADO")
    ], { somenteReferencia: true })
  ];
  const r = prepararImportacao({ extratos, base: [], titularSalvo: titular, hoje: "2026-11-16" });
  assert.equal(r.linhas.length, 1, "Santander não vira lançamento");
  assert.equal(r.linhas[0].sugestao.classificacao_saida, "SALARIO");
  assert.equal(r.linhas[0].sugestao.tipo_mov, "EXTERNO");
});

test("pagamento da fatura é ignorado e o que já está no sistema não duplica", () => {
  const base = [doc("ja", { data: "2026-11-03", banco: "NUBANK", tipo: "SAIDA", valor: 9.9, saida: "UBER", classificacao_saida: "UBER" })];
  const extratos = [
    extratoFicticio("BRADESCO", [mov("BRADESCO", "2026-11-17", -500, "", "GASTOS CARTAO DE CREDITO")]),
    extratoFicticio("NUBANK", [mov("NUBANK", "2026-11-04", -9.9, "Uber UBER *TRIP HELP.U", "Compra no débito")])
  ];
  const r = prepararImportacao({ extratos, base, hoje: "2026-11-14" });
  assert.equal(r.linhas[0].status, STATUS.IGNORADO);
  assert.equal(r.linhas[1].status, STATUS.JA_LANCADO);
  assert.equal(r.linhas[1].correspondente.id, "ja");
  assert.deepEqual(montarGravacao(r.linhas, "IMP").criar, []);
});

test("previsto com valor diferente vira correção", () => {
  const base = [doc("prev", { data: "2026-11-15", banco: "BRADESCO", tipo: "ENTRADA", valor: 1900, classificacao_saida: "SALARIO" })];
  const extratos = [extratoFicticio("BRADESCO", [mov("BRADESCO", "2026-11-16", 2000.5, "FULANO DE TAL SILVA", "PIX RECEBIDO")])];
  const r = prepararImportacao({ extratos, base, titularSalvo: titular, hoje: "2026-11-14" });
  assert.equal(r.linhas[0].status, STATUS.DIVERGENTE);
  assert.equal(r.linhas[0].acao, ACAO.CORRIGIR);
  const { corrigir } = montarGravacao(r.linhas, "IMP");
  assert.deepEqual(corrigir[0].dados.valor, 2000.5);
  assert.deepEqual(corrigir[0].anterior.valor, 1900);
});

test("saldo do sistema = virada do dia 01 + mês, sem a virada de saída nem previstos", () => {
  const base = [
    doc("v1", { data: "2026-11-01", banco: "BB", tipo: "ENTRADA", valor: 100, classificacao_saida: "VIRADA DE MÊS", tipo_mov: "INTERNO" }),
    doc("a", { data: "2026-11-05", banco: "BB", tipo: "SAIDA", valor: 30 }),
    doc("p", { data: "2026-11-20", banco: "BB", tipo: "SAIDA", valor: 10 }),
    doc("v2", { data: "2026-11-30", banco: "BB", tipo: "SAIDA", valor: 60, classificacao_saida: "VIRADA DE MÊS", tipo_mov: "INTERNO" }),
    doc("out", { data: "2026-10-31", banco: "BB", tipo: "ENTRADA", valor: 999 })
  ];
  assert.deepEqual(saldoDoSistema(base, "BB", "2026-11-30", { hoje: "2026-11-14" }), { saldo: 70, semAbertura: false });
  assert.equal(saldoDoSistema(base, "BB", "2026-11-30").saldo, 60);
});

// ------------------------------------------------------------ fatura aberta (OCR) e parcelas futuras

test("somarMeses vira o ano", () => {
  assert.equal(somarMeses("2026-11-17", 1), "2026-12-17");
  assert.equal(somarMeses("2026-12-17", 3), "2027-03-17");
});

test("tratarPixels: tons de cinza, contraste e detecção de página em branco", () => {
  const branco = new Uint8ClampedArray([255, 255, 255, 255, 250, 250, 250, 255]);
  assert.equal(tratarPixels(branco), 0);
  const azul = new Uint8ClampedArray([60, 110, 230, 255]); // texto azul dos valores
  assert.equal(tratarPixels(azul), 1);
  assert.equal(azul[0], azul[1]);
  const transparente = new Uint8ClampedArray([0, 0, 0, 0]); // fundo transparente vira branco
  assert.equal(tratarPixels(transparente), 0);
});

test("linhasDoOcr põe x/y em milésimos da largura e ordena", () => {
  const palavra = (text, x0, x1) => ({ text, bbox: { x0, x1 }, confidence: 90 });
  const linhas = linhasDoOcr([
    { bbox: { y0: 400 }, words: [palavra("36,80", 1742, 1800), palavra("11/11", 132, 190)] },
    { bbox: { y0: 200 }, words: [palavra(" ", 10, 12)] }
  ], 2000);
  assert.equal(linhas.length, 1);
  assert.deepEqual(linhas[0].partes.map((p) => [p.x, p.t]), [[66, "11/11"], [871, "36,80"]]);
  assert.equal(linhas[0].y, 200);
});

// Texto como o OCR devolve a fatura aberta do app (x em milésimos; nomes fictícios).
function linhaOcr(y, partes) {
  return { y, partes: partes.map(([x, t]) => ({ x, xf: x + 20, t })) };
}
function faturaAbertaOcr(linhasItens, total = "R$  3.040,12") {
  return {
    nome: "aberta.pdf",
    tipo: "ocr",
    paginas: [{ numero: 1, linhas: [
      linhaOcr(100, [[44, "bradesco"], [158, "Data:"], [211, "14/11/2026"], [329, "13:35"]]),
      linhaOcr(200, [[42, "Situação"], [122, "do"], [150, "Extrato:"], [224, "Em"], [255, "Aberto"]]),
      linhaOcr(280, [[76, "FULANO"], [140, "DE"], [160, "TAL"], [200, "-"], [210, "VISA"], [790, "XXXX.XXXX.XXXX.1234"]]),
      linhaOcr(320, [[47, "|"], [64, "Data"], [141, "Histórico"], [524, "Moeda"], [601, "US$"], [755, "Cotação"], [799, "US$"], [899, "R$"]]),
      linhaOcr(400, [[70, "17/11"], [124, "SALDO"], [166, "ANTERIOR"], [632, "USD"], [658, "0,00"], [784, "R$"], [802, "0,00"], [887, "R$"], [905, "2"], [916, "899,82"]]),
      ...linhasItens,
      linhaOcr(640, [[47, "Total"], [79, "para:"], [110, "FULANO"], [152, "DE"], [883, total.split(/\s+/)[0]], [900, total.split(/\s+/)[1]]])
    ] }]
  };
}
const ITENS_ABERTA = [
  linhaOcr(460, [[70, "11/11."], [113, "—"], [124, "LanchoneteBoa|"], [632, "USD"], [658, "0,00"], [784, "R$"], [802, "0,00"], [904, "R$"], [921, "36,80"]]),
  linhaOcr(520, [[70, "10/11"], [124, "JOAO"], [178, "DA"], [200, "SILV"], [632, "USD"], [658, "0,00"], [784, "R$0,00"], [904, "R$39,90"]]),
  linhaOcr(580, [[70, "06/11"], [124, "LOJA"], [160, "XPTO"], [200, "02/03"], [632, "USD"], [658, "0,00"], [784, "R$"], [802, "0,00"], [904, "R$"], [921, "63,60"]])
];

test("fatura aberta (OCR): compras no vencimento seguinte e conferência pelo total", () => {
  const r = lerExtrato(faturaAbertaOcr(ITENS_ABERTA));
  assert.ok(!r.erro, r.erro);
  assert.equal(r.leitor.id, "bradesco-fatura-aberta-ocr");
  const e = r.extrato;
  assert.equal(e.vencimento, "2026-12-17", "saldo anterior vence 17/11 → as compras vão para 17/12");
  assert.equal(e.saldoAnterior, 2899.82, "\"2 899,82\" (OCR perdeu o ponto) é lido certo");
  assert.deepEqual(e.movimentos.map((m) => [m.data, m.dataOriginal, m.tipo, m.valor, m.contraparte, m.parcela]), [
    ["2026-12-17", "2026-11-11", "SAIDA", 36.8, "LanchoneteBoa", null],
    ["2026-12-17", "2026-11-10", "SAIDA", 39.9, "JOAO DA SILV", null],
    ["2026-12-17", "2026-11-06", "SAIDA", 63.6, "LOJA XPTO", "02/03"]
  ]);
  assert.equal(e.movimentos[0].extra.cartao, "1234");
  assert.ok(e.conferencias.every((c) => c.ok));
});

test("o mesmo arquivo subido duas vezes (PDF e print) não duplica", () => {
  const e1 = lerExtrato(faturaAbertaOcr(ITENS_ABERTA)).extrato;
  const e2 = { ...lerExtrato({ ...faturaAbertaOcr(ITENS_ABERTA), nome: "print.png" }).extrato, arquivo: "print.png" };
  const r = prepararImportacao({ extratos: [e1, e2], base: [], hoje: "2026-11-14" });
  assert.equal(r.linhas.filter((l) => l.acao === ACAO.LANCAR).length, 3);
  assert.equal(r.linhas.filter((l) => l.status === STATUS.IGNORADO).length, 3);
});

test("fatura aberta (OCR): valor perdido ou dígito errado não passa despercebido", () => {
  const semValor = [ITENS_ABERTA[0], linhaOcr(520, [[70, "10/11"], [124, "JOAO"], [632, "USD"], [658, "0,00"], [784, "R$"], [802, "0,00"]]), ITENS_ABERTA[2]];
  const r1 = lerExtrato(faturaAbertaOcr(semValor)).extrato;
  assert.equal(r1.movimentos.length, 2, "o \"R$ 0,00\" da cotação não vira valor");
  assert.ok(r1.conferencias.some((c) => !c.ok));
  assert.ok(r1.avisos.some((a) => /não leu direito/.test(a)));

  const r2 = lerExtrato(faturaAbertaOcr(ITENS_ABERTA, "R$  3.040,72")).extrato; // 1 → 7
  assert.ok(!r2.conferencias[0].ok, "total diferente da soma acusa erro de leitura");
});

test("parcelas futuras: uma só por parcela e reconhece as já lançadas à mão", () => {
  const cartao = { cartaoCredito: true };
  const parcela = (data, p, valor = -300) => ({ ...mov("BRADESCO", data, valor, "LOJA XPTO", "CARTAO DE CREDITO", { cartaoCredito: true, parcelaFutura: true }), dataOriginal: "2026-09-20", parcela: p, idExterno: `P|${p}` });
  const real = { ...mov("BRADESCO", "2026-11-17", -300, "LOJA XPTO", "CARTAO DE CREDITO", { cartaoCredito: true }), dataOriginal: "2026-09-20", parcela: "03/04" };
  const extratos = [
    extratoFicticio("BRADESCO", [], { ...cartao, vencimento: "2026-10-17", parcelasFuturas: [parcela("2026-11-17", "03/04"), parcela("2026-12-17", "04/04")] }),
    extratoFicticio("BRADESCO", [real], { ...cartao, vencimento: "2026-11-17", parcelasFuturas: [parcela("2026-12-17", "04/04")] })
  ];
  const base = [doc("p4", { data: "2026-12-17", banco: "BRADESCO", tipo: "SAIDA", valor: 300.05, saida: "BRADESCO CREDITO", descricao: "P4/P4 - LOJA - 20/09", classificacao_saida: "CASA" })];
  const r = prepararImportacao({ extratos, base, hoje: "2026-11-14" });
  assert.deepEqual(r.linhas.map((l) => [l.movimento.data, l.movimento.parcela]), [["2026-11-17", "03/04"], ["2026-12-17", "04/04"]]);
  const p4 = r.linhas[1];
  assert.equal(p4.correspondente?.id, "p4", "a parcela lançada à mão é reconhecida");
  assert.equal(p4.sugestao.descricao, "P4/P4 - LOJA - 20/09");
});

// ------------------------------------------------------------ 2) extratos reais (só nesta máquina)

const BACKUP = new URL("../backup-2026/backup-firestore-2026-11-14.json", import.meta.url).pathname;
const opcoesReais = { skip: !temModelos && "sem a pasta modelo-extratos/ (dados pessoais fora do git)" };

// [pasta, padrão do nome do arquivo, leitor esperado, nº de movimentos]
const ESPERADO = [
  ["bb", /102026\.csv$/, "bb-csv", 5],
  ["bradesco - conta corrente", /\.pdf$/, "bradesco-conta-pdf", 36],
  ["bradesco - credito", /^Bradesco_Fatura.*\)\.pdf$/, "bradesco-fatura-pdf", 25],
  ["bradesco - credito", /^Bradesco_Fatura.*novembro\.pdf$/, "bradesco-fatura-pdf", 26],
  // (a fatura ABERTA é imagem: precisa do OCR do navegador, testada à parte)
  ["nubank", /01OUT2026.*\.csv$/, "nubank-csv", 26],
  ["nubank", /01NOV2026.*\.csv$/, "nubank-csv", 14],
  ["pluxe", /\.pdf$/, "pluxee-pdf", 20],
  ["santander", /9565\.pdf$/, "santander-pdf", 4],
  ["santander", /3108\.pdf$/, "santander-comprovante-pdf", 1]
];

for (const [pasta, padrao, leitor, quantidade] of ESPERADO) {
  test(`extrato real: ${pasta} ${padrao}`, opcoesReais, async () => {
    const r = await lerModelo(pasta, padrao);
    assert.ok(!r.erro, r.erro);
    assert.equal(r.leitor.id, leitor);
    assert.equal(r.extrato.movimentos.length, quantidade);
    r.extrato.conferencias.forEach((c) => assert.ok(c.ok, `conferência falhou: ${c.rotulo}`));
  });
}

test("extratos imagem (Caixa) são recusados com explicação", opcoesReais, async () => {
  const r = await lerModelo("caixa - conta corrente", /\.pdf$/);
  assert.match(r.erro, /imagem/);
});

test("com a base real: nada duplica e os saldos batem com os bancos", { skip: (!temModelos || !existsSync(BACKUP)) && "sem extratos/backup" }, async () => {
  const base = Object.entries(JSON.parse(readFileSync(BACKUP, "utf8")).carteira).map(([id, d]) => ({ id, ...d }));
  const extratos = [];
  for (const [pasta, padrao] of ESPERADO) extratos.push((await lerModelo(pasta, padrao)).extrato);
  const r = prepararImportacao({ extratos, base, hoje: "2026-11-14" });

  const ja = r.linhas.filter((l) => l.status === STATUS.JA_LANCADO).length;
  assert.ok(ja >= 130, `esperava ~133 já lançados, veio ${ja}`);
  assert.ok(r.saldos.length >= 3);
  r.saldos.forEach((s) => assert.ok(s.ok, `saldo ${s.banco}: banco ${s.saldoBanco} × sistema ${s.saldoDepois}`));
  const salario = r.linhas.find((l) => l.movimento.banco === "BRADESCO" && l.movimento.data === "2026-11-16");
  assert.equal(salario.sugestao.classificacao_saida, "SALARIO");
});
