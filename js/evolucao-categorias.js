// evolucao-categorias.js
// Conta da seção "Evolução por categoria" do Dashboard — sem DOM, testável no Node.
//
// Para um ano e um tipo (SAIDA = gastos, ENTRADA = recebimentos):
//   - cada categoria mês a mês (jan–dez) no ano escolhido e no ano anterior;
//   - comparação justa com o ano anterior: só os MESMOS meses (jan até o mês
//     limite — o mês atual, se o ano escolhido é o ano corrente; senão dez).
//
// Mesmas regras dos outros gráficos do Dashboard: não conta transferências
// internas nem as categorias "à parte"; realizado + previsto.

export const SEM_CLASSIFICACAO = "SEM CLASSIFICAÇÃO";

function mesDe(data) {
  const mes = Number(String(data ?? "").slice(5, 7));
  return mes >= 1 && mes <= 12 ? mes : null;
}

function somar(valores, ate = 12) {
  return valores.slice(0, ate).reduce((s, v) => s + v, 0);
}

function arredondar(n) {
  return Math.round(n * 100) / 100;
}

// Variação do período: valor em R$ e percentual (null quando o ano anterior é zero).
export function variacao(atual, anterior) {
  const diferenca = arredondar(atual - anterior);
  const percentual = anterior > 0 ? diferenca / anterior : null;
  return { diferenca, percentual };
}

// Para gastos, subir é ruim; para recebimentos, subir é bom.
export function sentidoDaVariacao(tipo, diferenca) {
  if (Math.abs(diferenca) < 0.005) return "igual";
  const subiu = diferenca > 0;
  return (tipo === "SAIDA") === subiu ? "piorou" : "melhorou";
}

// Até que mês comparar: ano corrente → mês atual; ano passado → dezembro;
// ano futuro → dezembro (só previstos).
export function mesLimiteDaComparacao(ano, hojeISO) {
  const anoHoje = Number(hojeISO.slice(0, 4));
  return Number(ano) === anoHoje ? Number(hojeISO.slice(5, 7)) : 12;
}

// Mês a mês: diferença e percentual de cada mês contra o mesmo mês do ano anterior.
export function variacaoMensal(meses, anterior) {
  return meses.map((valor, i) => variacao(valor, anterior[i]));
}

// lista: lançamentos já filtrados (banco, vale, texto...) de QUALQUER data.
// classificar(t): em que categoria o lançamento entra (padrão: a classificação
// gravada). O Dashboard passa finalidadeDe (finalidade.js) para equiparar os
// nomes que mudaram de um ano para o outro; `origens` guarda de onde veio o
// que foi trazido de outra classificação: { nomeOriginal: { atual, anterior } }.
export function calcularEvolucaoPorCategoria(lista, { ano, tipo, categoriasSeparadas = new Set(), hojeISO, classificar = (t) => t.classificacao_saida }) {
  const anoAtual = String(ano);
  const anoAnterior = String(Number(ano) - 1);
  const mesLimite = mesLimiteDaComparacao(anoAtual, hojeISO);
  const porCategoria = new Map();

  lista.forEach((t) => {
    if (typeof t.valor !== "number" || t.tipo !== tipo) return;
    if (t.tipo_mov === "INTERNO") return;
    if (categoriasSeparadas.has(t.classificacao_saida)) return;
    const anoLancamento = String(t.data ?? "").slice(0, 4);
    if (anoLancamento !== anoAtual && anoLancamento !== anoAnterior) return;
    const mes = mesDe(t.data);
    if (!mes) return;
    const original = t.classificacao_saida || SEM_CLASSIFICACAO;
    const nome = classificar(t) || SEM_CLASSIFICACAO;
    if (!porCategoria.has(nome)) porCategoria.set(nome, { nome, meses: Array(12).fill(0), anterior: Array(12).fill(0), origens: {} });
    const linha = porCategoria.get(nome);
    const ehAnoAtual = anoLancamento === anoAtual;
    (ehAnoAtual ? linha.meses : linha.anterior)[mes - 1] += t.valor;
    if (original !== nome) {
      linha.origens[original] ??= { atual: 0, anterior: 0 };
      linha.origens[original][ehAnoAtual ? "atual" : "anterior"] += t.valor;
    }
  });

  const categorias = [...porCategoria.values()].map((c) => {
    c.meses = c.meses.map(arredondar);
    c.anterior = c.anterior.map(arredondar);
    const totalAno = arredondar(somar(c.meses));
    const periodoAtual = arredondar(somar(c.meses, mesLimite));
    const periodoAnterior = arredondar(somar(c.anterior, mesLimite));
    return { ...c, totalAno, periodoAtual, periodoAnterior, ...variacao(periodoAtual, periodoAnterior) };
  }).sort((a, b) => b.periodoAtual - a.periodoAtual || b.totalAno - a.totalAno || b.periodoAnterior - a.periodoAnterior || a.nome.localeCompare(b.nome, "pt-BR"));

  const totalMeses = Array.from({ length: 12 }, (_, i) => arredondar(categorias.reduce((s, c) => s + c.meses[i], 0)));
  const totalAnteriorMeses = Array.from({ length: 12 }, (_, i) => arredondar(categorias.reduce((s, c) => s + c.anterior[i], 0)));
  const periodoAtual = arredondar(somar(totalMeses, mesLimite));
  const periodoAnterior = arredondar(somar(totalAnteriorMeses, mesLimite));

  return {
    ano: anoAtual,
    anoAnterior,
    tipo,
    mesLimite,
    categorias,
    total: { meses: totalMeses, anterior: totalAnteriorMeses, totalAno: arredondar(somar(totalMeses)), periodoAtual, periodoAnterior, ...variacao(periodoAtual, periodoAnterior) }
  };
}
