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
