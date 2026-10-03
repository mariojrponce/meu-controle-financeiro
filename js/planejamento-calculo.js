// planejamento-calculo.js
// Conta do "Planejamento por salário", sem nada de tela (dá pra testar no Node).
//
// Ideia: o salário do fim do mês paga as contas até a véspera do salário do
// dia 15, e o do dia 15 paga as contas até a véspera do próximo. Cada
// intervalo "dia do salário → véspera do próximo salário" é um CICLO. O que
// sobra de um ciclo passa para o seguinte; o menor saldo que aparece nessa
// sequência, menos um colchão de segurança, é o que dá para investir sem
// fazer falta depois.
import { ehBancoVale } from "./vale.js";

const PADRAO_SALARIO = /SAL[AÁ]RIO/;
const PADRAO_INVESTIMENTO = /INVESTIMENTO/;
const DIAS_MEDIA_DIA_A_DIA = 90;
// Salários a até 3 dias um do outro contam como um pagamento só (ex.: férias
// no dia 29 + salário no dia 30).
const DIAS_JUNTAR_SALARIOS = 3;

// ---------- Datas (texto ISO "aaaa-mm-dd", sem fuso horário) ----------
function paraData(iso) {
    const [ano, mes, dia] = iso.split("-").map(Number);
    return new Date(Date.UTC(ano, mes - 1, dia));
}
function paraISO(data) {
    return data.toISOString().slice(0, 10);
}
export function somarDias(iso, dias) {
    const data = paraData(iso);
    data.setUTCDate(data.getUTCDate() + dias);
    return paraISO(data);
}
export function diasEntre(inicioISO, fimISO) {
    return Math.round((paraData(fimISO) - paraData(inicioISO)) / 86400000);
}
function ultimoDia(ano, mes) {
    return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}
function primeiroDiaMesAnterior(iso) {
    const [ano, mes] = iso.split("-").map(Number);
    const data = new Date(Date.UTC(ano, mes - 2, 1));
    return paraISO(data);
}

function ehValido(t) {
    return typeof t.valor === "number" && t.valor > 0 && typeof t.data === "string" && t.data.length === 10 && t.banco;
}
function sinal(t) {
    return t.tipo === "ENTRADA" ? t.valor : -t.valor;
}
function ehSalario(t) {
    return t.tipo === "ENTRADA" && PADRAO_SALARIO.test(t.classificacao_saida ?? "");
}
function ehMeioDoMes(iso) {
    return Number(iso.slice(8, 10)) <= 20;
}

// ---------- Saldo de hoje por banco ----------
// A "virada de mês" lança o saldo de fechamento como SAÍDA no mês que acaba
// e ENTRADA no dia 01 do seguinte. Somando tudo do mês passado até hoje, os
// dois lados da virada se anulam e o resultado é o saldo atual, tenha a
// virada deste mês já sido feita ou não.
export function calcularSaldoHojePorBanco(base, hoje) {
    const inicio = primeiroDiaMesAnterior(hoje);
    const porBanco = {};
    base.forEach((t) => {
        if (t.data < inicio || t.data > hoje) return;
        porBanco[t.banco] = (porBanco[t.banco] ?? 0) + sinal(t);
    });
    return porBanco;
}

// ---------- Datas e valores dos salários ----------
function juntarSalarios(base) {
    const porData = {};
    base.filter(ehSalario).forEach((t) => {
        porData[t.data] = (porData[t.data] ?? 0) + t.valor;
    });
    const pagamentos = [];
    Object.keys(porData).sort().forEach((data) => {
        const anterior = pagamentos[pagamentos.length - 1];
        if (anterior && diasEntre(anterior.data, data) <= DIAS_JUNTAR_SALARIOS) {
            anterior.valor += porData[data];
        } else {
            pagamentos.push({ data, valor: porData[data], estimado: false });
        }
    });
    return pagamentos;
}

// Depois do último salário lançado, supõe dia 15 e dia 30 (ou o último dia do
// mês), repetindo o valor do último salário real de cada um dos dois.
function estenderSalarios(pagamentos, quantidadeMinimaDepois, hoje) {
    const lista = [...pagamentos];
    const ultimoValor = { meio: 0, fim: 0 };
    lista.forEach((p) => { ultimoValor[ehMeioDoMes(p.data) ? "meio" : "fim"] = p.valor; });

    const depoisDeHoje = () => lista.filter((p) => p.data > hoje).length;
    let referencia = lista.length > 0 ? lista[lista.length - 1].data : hoje;
    let seguranca = 0;
    while (depoisDeHoje() < quantidadeMinimaDepois && seguranca++ < 48) {
        const [ano, mes, dia] = referencia.split("-").map(Number);
        let proxima;
        if (dia < 15 - DIAS_JUNTAR_SALARIOS) {
            proxima = `${ano}-${String(mes).padStart(2, "0")}-15`;
        } else if (dia <= 20) {
            const fimMes = Math.min(30, ultimoDia(ano, mes));
            proxima = `${ano}-${String(mes).padStart(2, "0")}-${String(fimMes).padStart(2, "0")}`;
        } else {
            const data = new Date(Date.UTC(ano, mes, 15));
            proxima = paraISO(data);
        }
        lista.push({ data: proxima, valor: ultimoValor[ehMeioDoMes(proxima) ? "meio" : "fim"], estimado: true });
        referencia = proxima;
    }
    return lista;
}

// ---------- Gastos do dia a dia ----------
function janelaDiaADia(base, hoje) {
    const inicio = somarDias(hoje, -DIAS_MEDIA_DIA_A_DIA + 1);
    return base.filter((t) => t.tipo === "SAIDA" && t.tipo_mov !== "INTERNO" && t.data >= inicio && t.data <= hoje);
}

// Sugestão inicial: categorias com muitos gastos pequenos nos últimos 90
// dias (pelo menos 10 lançamentos, com média de até R$ 60).
export function sugerirCategoriasDiaADia(transacoes, hoje) {
    const base = transacoes.filter((t) => ehValido(t) && !ehBancoVale(t.banco));
    const porCategoria = {};
    janelaDiaADia(base, hoje).forEach((t) => {
        const chave = t.classificacao_saida || "SEM CLASSIFICAÇÃO";
        porCategoria[chave] ??= { quantidade: 0, soma: 0 };
        porCategoria[chave].quantidade += 1;
        porCategoria[chave].soma += t.valor;
    });
    return Object.entries(porCategoria)
        .filter(([, c]) => c.quantidade >= 10 && c.soma / c.quantidade <= 60)
        .map(([categoria]) => categoria)
        .sort();
}

function calcularTaxaDiaria(base, hoje, categorias) {
    const conjunto = new Set(categorias);
    const soma = janelaDiaADia(base, hoje)
        .filter((t) => conjunto.has(t.classificacao_saida || "SEM CLASSIFICAÇÃO"))
        .reduce((total, t) => total + t.valor, 0);
    return soma / DIAS_MEDIA_DIA_A_DIA;
}

// ---------- Conta principal ----------
export function calcularPlanejamento(transacoes, { hoje, categoriasDiaADia, colchao = null, ciclosFuturos = 3 }) {
    const base = transacoes.filter((t) => ehValido(t) && !ehBancoVale(t.banco));

    const saldoPorBanco = calcularSaldoHojePorBanco(base, hoje);
    const saldoHoje = Object.values(saldoPorBanco).reduce((a, b) => a + b, 0);

    const taxaDiaria = calcularTaxaDiaria(base, hoje, categoriasDiaADia);
    const colchaoUsado = colchao ?? Math.ceil((taxaDiaria * 15) / 50) * 50;

    let pagamentos = estenderSalarios(juntarSalarios(base), ciclosFuturos + 1, hoje);
    let indiceAtual = pagamentos.map((p) => p.data <= hoje).lastIndexOf(true);
    if (indiceAtual === -1) {
        pagamentos = [{ data: `${hoje.slice(0, 8)}01`, valor: 0, estimado: true }, ...pagamentos];
        indiceAtual = 0;
    }

    const ciclos = [];
    for (let k = 0; k <= ciclosFuturos; k++) {
        const pagamento = pagamentos[indiceAtual + k];
        const proximo = pagamentos[indiceAtual + k + 1];
        if (!pagamento || !proximo) break;

        const ehAtual = k === 0;
        const inicio = pagamento.data;
        const fim = somarDias(proximo.data, -1);
        // No ciclo atual, o que já aconteceu (até hoje) já está no saldo.
        const desde = ehAtual ? somarDias(hoje, 1) : inicio;

        const movimentos = base.filter((t) => t.tipo_mov !== "INTERNO" && t.data >= desde && t.data <= fim);
        const entradas = movimentos.filter((t) => t.tipo === "ENTRADA");
        const contas = movimentos.filter((t) => t.tipo === "SAIDA").sort((a, b) => a.data.localeCompare(b.data));
        if (!ehAtual && pagamento.estimado && pagamento.valor > 0) {
            entradas.push({ data: inicio, valor: pagamento.valor, descricao: "SALÁRIO (estimado)", classificacao_saida: "SALARIO", banco: "", estimado: true });
        }

        const totalEntradas = entradas.reduce((s, t) => s + t.valor, 0);
        const totalContas = contas.reduce((s, t) => s + t.valor, 0);
        const totalAportes = contas.filter((t) => PADRAO_INVESTIMENTO.test(t.classificacao_saida ?? "")).reduce((s, t) => s + t.valor, 0);
        const diasRestantes = diasEntre(desde, fim) + 1;
        const reserva = taxaDiaria * Math.max(0, diasRestantes);

        const saldoInicial = ehAtual ? saldoHoje : ciclos[k - 1].saldoFinal;
        const saldoFinal = saldoInicial + totalEntradas - totalContas - reserva;

        ciclos.push({
            inicio, fim, ehAtual,
            salario: { data: pagamento.data, valor: pagamento.valor, estimado: pagamento.estimado },
            proximoSalario: { data: proximo.data, valor: proximo.valor, estimado: proximo.estimado },
            saldoInicial, entradas, contas,
            totalEntradas, totalContas, totalAportes, reserva, diasRestantes,
            necessario: totalContas + reserva,
            saldoFinal
        });
    }

    // Banco a banco, só no ciclo atual (é o que dá para agir agora).
    const bancos = {};
    Object.entries(saldoPorBanco).forEach(([banco, saldo]) => { bancos[banco] = { banco, saldoHoje: saldo, entradas: 0, saidas: 0, primeiraConta: null }; });
    const atual = ciclos[0];
    if (atual) {
        base.filter((t) => t.data > hoje && t.data <= atual.fim).forEach((t) => {
            bancos[t.banco] ??= { banco: t.banco, saldoHoje: 0, entradas: 0, saidas: 0, primeiraConta: null };
            const b = bancos[t.banco];
            if (t.tipo === "ENTRADA") b.entradas += t.valor;
            else {
                b.saidas += t.valor;
                if (!b.primeiraConta || t.data < b.primeiraConta.data) b.primeiraConta = t;
            }
        });
    }
    const listaBancos = Object.values(bancos)
        .map((b) => ({ ...b, saldoFinal: b.saldoHoje + b.entradas - b.saidas }))
        .filter((b) => Math.abs(b.saldoHoje) >= 0.005 || b.entradas > 0 || b.saidas > 0)
        .sort((a, b) => b.saidas - a.saidas || b.saldoHoje - a.saldoHoje);

    const transferencias = sugerirTransferencias(listaBancos);

    const menorSaldo = ciclos.reduce((menor, c) => (menor === null || c.saldoFinal < menor.saldoFinal ? c : menor), null);
    const podeInvestir = menorSaldo ? Math.max(0, menorSaldo.saldoFinal - colchaoUsado) : 0;

    return {
        hoje, saldoHoje, saldoPorBanco, taxaDiaria, colchao: colchaoUsado,
        ciclos, bancos: listaBancos, transferencias, menorSaldo, podeInvestir,
        usouSalarioEstimado: ciclos.some((c) => c.salario.estimado || c.proximoSalario.estimado)
    };
}

// Cobre os bancos que vão ficar negativos usando os que vão sobrar (o que mais
// sobra primeiro), até a data da primeira conta do banco que precisa.
function sugerirTransferencias(bancos) {
    const sobrando = bancos.filter((b) => b.saldoFinal > 0).map((b) => ({ banco: b.banco, disponivel: b.saldoFinal }))
        .sort((a, b) => b.disponivel - a.disponivel);
    const sugestoes = [];
    bancos.filter((b) => b.saldoFinal < -0.005).sort((a, b) => a.saldoFinal - b.saldoFinal).forEach((b) => {
        let falta = -b.saldoFinal;
        for (const origem of sobrando) {
            if (falta <= 0.005) break;
            if (origem.disponivel <= 0.005) continue;
            const valor = Math.min(falta, origem.disponivel);
            origem.disponivel -= valor;
            falta -= valor;
            sugestoes.push({ de: origem.banco, para: b.banco, valor, ate: b.primeiraConta?.data ?? null });
        }
        if (falta > 0.005) sugestoes.push({ de: null, para: b.banco, valor: falta, ate: b.primeiraConta?.data ?? null });
    });
    return sugestoes;
}
