// Testes da seção "Evolução por categoria" do Dashboard.  npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularEvolucaoPorCategoria, mesLimiteDaComparacao, sentidoDaVariacao, variacao } from "../js/evolucao-categorias.js";

const t = (data, valor, classificacao, tipo = "SAIDA", extra = {}) => ({ data, valor, classificacao_saida: classificacao, tipo, tipo_mov: "EXTERNO", ...extra });

test("compara só os mesmos meses do ano anterior (ano corrente vai até o mês atual)", () => {
  const lista = [
    t("2026-01-10", 100, "MERCADO"), t("2026-11-05", 50, "MERCADO"), t("2026-12-20", 999, "MERCADO"), // dez/26 = previsto, fora da comparação
    t("2025-01-03", 80, "MERCADO"), t("2025-12-10", 500, "MERCADO"),                                   // dez/25 fora da comparação
    t("2026-03-01", 30, "UBER"), t("2025-03-01", 60, "UBER"),
    t("2024-05-01", 1000, "MERCADO")                                                                     // ano retrasado: ignora
  ];
  const r = calcularEvolucaoPorCategoria(lista, { ano: 2026, tipo: "SAIDA", hojeISO: "2026-11-14" });
  assert.equal(r.mesLimite, 11);
  const mercado = r.categorias.find((c) => c.nome === "MERCADO");
  assert.equal(mercado.meses[0], 100);
  assert.equal(mercado.meses[11], 999);
  assert.equal(mercado.totalAno, 1149);
  assert.equal(mercado.periodoAtual, 150);
  assert.equal(mercado.periodoAnterior, 80);
  assert.equal(mercado.diferenca, 70);
  assert.equal(Math.round(mercado.percentual * 100), 88);
  const uber = r.categorias.find((c) => c.nome === "UBER");
  assert.equal(uber.diferenca, -30);
  assert.equal(r.total.periodoAtual, 180);
  assert.equal(r.total.periodoAnterior, 140);
  assert.deepEqual(r.categorias.map((c) => c.nome), ["MERCADO", "UBER"], "ordem: maior gasto no período primeiro");
});

test("ignora internos, categorias à parte e o outro tipo; categoria sem classificação vira SEM CLASSIFICAÇÃO", () => {
  const lista = [
    t("2026-02-01", 10, "PIX", "SAIDA", { tipo_mov: "INTERNO" }),
    t("2026-02-01", 20, "VALE ALIMENTACAO"),
    t("2026-02-01", 30, "SALARIO", "ENTRADA"),
    t("2026-02-01", 40, ""),
    t("2025-02-01", 5, "SÓ NO ANO PASSADO")
  ];
  const r = calcularEvolucaoPorCategoria(lista, { ano: "2026", tipo: "SAIDA", categoriasSeparadas: new Set(["VALE ALIMENTACAO"]), hojeISO: "2026-11-14" });
  assert.deepEqual(r.categorias.map((c) => c.nome).sort(), ["SEM CLASSIFICAÇÃO", "SÓ NO ANO PASSADO"]);
  const soPassado = r.categorias.find((c) => c.nome === "SÓ NO ANO PASSADO");
  assert.equal(soPassado.periodoAtual, 0);
  assert.equal(soPassado.diferenca, -5);
});

test("ano que já passou compara o ano inteiro; sentido da variação depende do tipo", () => {
  assert.equal(mesLimiteDaComparacao("2025", "2026-11-14"), 12);
  assert.equal(mesLimiteDaComparacao("2026", "2026-03-02"), 3);
  assert.equal(sentidoDaVariacao("SAIDA", 50), "piorou");
  assert.equal(sentidoDaVariacao("SAIDA", -50), "melhorou");
  assert.equal(sentidoDaVariacao("ENTRADA", 50), "melhorou");
  assert.equal(sentidoDaVariacao("ENTRADA", 0), "igual");
  assert.deepEqual(variacao(10, 0), { diferenca: 10, percentual: null });
});

// ---------- Equiparação por finalidade (finalidade.js) ----------
import { finalidadeDe } from "../js/finalidade.js";
import { variacaoMensal } from "../js/evolucao-categorias.js";

const g = (classificacao, descricao, saida, tipo = "SAIDA") => ({ classificacao_saida: classificacao, descricao, saida, tipo });

test("finalidade: TRANSPORTE antigo se divide em UBER (corridas, inclui 99) e ONIBUS (passe)", () => {
  assert.equal(finalidadeDe(g("TRANSPORTE", "IR PARA SERVIÇO", "99 TAXI")), "UBER");
  assert.equal(finalidadeDe(g("TRANSPORTE", "VOLTAR PRA CASA", "UBER")), "UBER");
  assert.equal(finalidadeDe(g("TRANSPORTE", "RECARGA CARTEIRINHA ONIBUS", "ZPLMB TECNOLOGIA")), "ONIBUS");
  assert.equal(finalidadeDe(g("TRANSPORTE", "COLOCAR DE PASSE", "SAQUE DINHEIRO")), "ONIBUS");
  assert.equal(finalidadeDe(g("TRANSPORTE", "RECARGA CARTEIRA CIDADÃO", "TRANSPORTE PUBLICO")), "ONIBUS");
  assert.equal(finalidadeDe(g("ONIBUS", "RECARGA PASSE ONIBUS", "PIU")), "ONIBUS");
  assert.equal(finalidadeDe(g("UBER", "IR PARA SERVIÇO", "UBER")), "UBER");
});

test("finalidade: contas do mês, compras de casa, lanche de casa e investimentos", () => {
  assert.equal(finalidadeDe(g("IMPOSTOS", "DESP MENSAL", "DAS/MEI JANEIRO/2025")), "DESP MENSAL");
  assert.equal(finalidadeDe(g("IMPOSTOS", "IRRF TESOURO DIRETO", "IMPOSTOS")), "IMPOSTOS");
  assert.equal(finalidadeDe(g("DESPESAS", "DESP MENSAL", "SPOTIFY")), "DESP MENSAL");
  assert.equal(finalidadeDe(g("DESPESAS", "CREDITO CELULAR", "RECARGA FACIL")), "DESP MENSAL");
  assert.equal(finalidadeDe(g("DESPESAS", "PAGAMENTO AMAZON PRIME", "AMAZON PRIME")), "DESPESAS");
  assert.equal(finalidadeDe(g("DESPESAS", "CORTE CABELO", "STHILOS CABELEIREIROS")), "DIVERSOS");
  assert.equal(finalidadeDe(g("COMPRAS CASA", "COMPRAS CASA SEMANA", "GIGANTE CASH")), "COMPRAS CASA 108N");
  assert.equal(finalidadeDe(g("COMPRAS CASA", "LANCHE CASA NOITE", "GIGANTE CASH")), "CASA LANCHE");
  assert.equal(finalidadeDe(g("LANCHE", "COMPRAS LANCHE CASA", "QUARTETTO SUPER.")), "CASA LANCHE");
  assert.equal(finalidadeDe(g("LANCHE", "LANCHE TARDE", "SUPER BIG")), "LANCHE");
  assert.equal(finalidadeDe(g("INVESTIMENTOS", "M039", "EMPRESTIMO MRV")), "INVESTIMENTOS");
  assert.equal(finalidadeDe(g("INVESTIMENTOS", "VALOR SEGUROS/ENCARGOS", "COBRANÇAS CAIXA")), "INVESTIMENTOS");
  assert.equal(finalidadeDe(g("INVESTIMENTOS", "TESOURO SELIC 29", "NUBANK INVESTIMENTOS")), "INVESTIMENTO");
  assert.equal(finalidadeDe(g("NUBANK CAIXINHA", "GUARDAR PARA GÁS", "NUBANK CAIXINHA")), "INVESTIMENTO");
  assert.equal(finalidadeDe(g("RENDA FIXA", "CDB DI", "BRADESCO INVESTIMENTO")), "INVESTIMENTO");
  // Recebimento não usa as regras de gasto
  assert.equal(finalidadeDe(g("INVESTIMENTO", "RESGATE PARA DESPESAS", "BRADESCO INVESTIMENTO", "ENTRADA")), "RESGATES DE INVEST.");
  assert.equal(finalidadeDe(g("SALARIO", "X", "Y", "ENTRADA")), "SALARIO");
});

test("evolução com finalidade: UBER de 2026 compara com as corridas que estavam em TRANSPORTE", () => {
  const lista = [
    { ...t("2026-03-01", 30, "UBER"), descricao: "IR PARA SERVIÇO", saida: "UBER" },
    { ...t("2025-03-01", 20, "TRANSPORTE"), descricao: "IR PARA SERVIÇO", saida: "99 TAXI" },
    { ...t("2025-03-05", 50, "TRANSPORTE"), descricao: "RECARGA PASSE ONIBUS", saida: "ZPLMB TECNOLOGIA" }
  ];
  const r = calcularEvolucaoPorCategoria(lista, { ano: 2026, tipo: "SAIDA", hojeISO: "2026-11-14", classificar: finalidadeDe });
  assert.deepEqual(r.categorias.map((c) => c.nome), ["UBER", "ONIBUS"]);
  const uber = r.categorias[0];
  assert.equal(uber.periodoAnterior, 20);
  assert.deepEqual(uber.origens, { TRANSPORTE: { atual: 0, anterior: 20 } });
  const mensal = variacaoMensal(uber.meses, uber.anterior);
  assert.equal(mensal[2].diferenca, 10);
  assert.equal(mensal[2].percentual, 0.5);
  assert.equal(mensal[0].percentual, null);
});

// ---------- Configurações do usuário (configuracoes-modelo.js) ----------
import { configuracoesPadrao, limparConfiguracoes, aplicarConfiguracoes } from "../js/configuracoes-modelo.js";
import { ehBancoVale } from "../js/vale.js";
import { BANCOS_SUGERIDOS } from "../js/dados-comuns.js";

test("configurações: o padrão passa pela limpeza sem mudar", () => {
  const padrao = configuracoesPadrao();
  assert.deepEqual(limparConfiguracoes(padrao), padrao);
  assert.deepEqual(limparConfiguracoes(undefined), padrao);
});

test("configurações: limpa nomes, tira repetidos e descarta regra incompleta ou inválida", () => {
  const limpa = limparConfiguracoes({
    bancos: [" nubank ", "NUBANK", ""],
    classificacoes: [],
    bancosVale: ["meu vale"],
    regras: [
      { tipo: "SAIDA", de: ["padaria", " "], se: "pão|café", para: "alimentação" },
      { tipo: "SAIDA", de: [], para: "X" },
      { tipo: "SAIDA", de: ["A"], se: "(", para: "X" }
    ]
  });
  assert.deepEqual(limpa.bancos, ["NUBANK"]);
  assert.deepEqual(limpa.classificacoes, []);
  assert.deepEqual(limpa.regras, [{ tipo: "SAIDA", de: ["PADARIA"], se: "PAO|CAFE", para: "ALIMENTAÇÃO" }]);
});

test("configurações: aplicar troca sugestões, bancos de vale e regras; o padrão volta depois", () => {
  aplicarConfiguracoes({ bancos: ["MEU BANCO"], classificacoes: ["X"], bancosVale: ["MEU VALE"], regras: [{ tipo: "SAIDA", de: ["PADARIA"], se: "\\bPÃO\\b", para: "COMIDA" }] });
  assert.deepEqual(BANCOS_SUGERIDOS, ["MEU BANCO"]);
  assert.equal(ehBancoVale("MEU VALE REFEIÇÃO"), true);
  assert.equal(ehBancoVale("ALELO"), false);
  assert.equal(finalidadeDe(g("PADARIA", "COMPREI PÃO", "")), "COMIDA");
  assert.equal(finalidadeDe(g("PADARIA", "COMPREI LEITE", "")), "PADARIA");
  assert.equal(finalidadeDe(g("TRANSPORTE", "IR PARA SERVIÇO", "UBER")), "TRANSPORTE");

  aplicarConfiguracoes(configuracoesPadrao());
  assert.equal(ehBancoVale("ALELO"), true);
  assert.equal(finalidadeDe(g("TRANSPORTE", "IR PARA SERVIÇO", "UBER")), "UBER");
});
