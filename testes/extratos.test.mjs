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
import { numeroBR, lerCsv, decodificarTexto } from "../js/extratos/comum.js";
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

// ------------------------------------------------------------ 2) extratos reais (só nesta máquina)

const BACKUP = new URL("../backup-2026/backup-firestore-2026-11-14.json", import.meta.url).pathname;
const opcoesReais = { skip: !temModelos && "sem a pasta modelo-extratos/ (dados pessoais fora do git)" };

// [pasta, padrão do nome do arquivo, leitor esperado, nº de movimentos]
const ESPERADO = [
  ["bb", /102026\.csv$/, "bb-csv", 5],
  ["bradesco - conta corrente", /\.pdf$/, "bradesco-conta-pdf", 36],
  ["bradesco - credito", /^Bradesco_Fatura.*\)\.pdf$/, "bradesco-fatura-pdf", 25],
  ["bradesco - credito", /^Bradesco_Fatura.*novembro\.pdf$/, "bradesco-fatura-pdf", 26],
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
