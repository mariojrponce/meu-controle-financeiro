// planejamento.js
// Tela "Planejamento por salário": mostra, ciclo a ciclo (salário → véspera do
// próximo salário), quanto é preciso para pagar as contas, quanto sobra e
// quanto dá para investir sem fazer falta depois. A conta fica em
// planejamento-calculo.js; aqui é só leitura dos dados, preferências e tela.
import { exigirLogin } from "./auth-guard.js";
import { renderizarNav } from "./nav.js";
import { formatarReais, isoParaBR, hojeISO, celulaParaNumero } from "./utils.js";
import { criarSeletorMultiplo } from "./combobox.js";
import { obterCorBanco } from "./cores-bancos.js";
import { obterTransacoes } from "./dados-carteira.js";
import { mostrarToast } from "./ui.js";
import { calcularPlanejamento, sugerirCategoriasDiaADia } from "./planejamento-calculo.js";

const usuario = await exigirLogin();
renderizarNav("planejamento", usuario.email);

// Preferências desta tela — não são dados financeiros, ficam só no navegador.
const CHAVE_PREFERENCIAS = `pref_planejamento_${usuario.uid}`;
function lerPreferencias() {
    try {
        return JSON.parse(localStorage.getItem(CHAVE_PREFERENCIAS)) ?? {};
    } catch {
        return {};
    }
}
function salvarPreferencias(parcial) {
    try {
        localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify({ ...lerPreferencias(), ...parcial }));
    } catch { /* ignora */ }
}

const campoColchao = document.getElementById("campo-colchao");
let todasTransacoes = [];
let seletorDiaADia = null;

campoColchao.addEventListener("change", () => {
    const texto = campoColchao.value.trim();
    const valor = celulaParaNumero(texto);
    salvarPreferencias({ colchao: texto === "" || Number.isNaN(valor) ? null : Math.max(0, valor) });
    recalcular();
});

document.getElementById("btn-atualizar").addEventListener("click", () => carregar(true));

function dataCurta(iso) {
    return isoParaBR(iso).slice(0, 5);
}

function elemento(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined) el.textContent = texto;
    return el;
}

function linhaValor(rotulo, valor, classeValor = "") {
    const linha = elemento("div", "linha-carteira");
    linha.appendChild(elemento("span", "rotulo-linha", rotulo));
    const spanValor = elemento("span", `valor-linha ${classeValor}`, formatarReais(valor));
    linha.appendChild(spanValor);
    return linha;
}

// ---------- Big numbers ----------
function renderizarIndicadores(plano) {
    const atual = plano.ciclos[0];
    document.getElementById("kpi-saldo-hoje").textContent = formatarReais(plano.saldoHoje);
    document.getElementById("kpi-investir").textContent = formatarReais(plano.podeInvestir);
    if (!atual) return;

    const ateQuando = dataCurta(atual.fim);
    document.getElementById("kpi-contas-rotulo").textContent = `Contas + dia a dia até ${ateQuando}`;
    document.getElementById("kpi-contas").textContent = formatarReais(atual.necessario);
    document.getElementById("kpi-sobra-rotulo").textContent = atual.saldoFinal >= 0 ? `Sobra até ${ateQuando}` : `Falta até ${ateQuando}`;
    document.getElementById("kpi-sobra").textContent = formatarReais(Math.abs(atual.saldoFinal));
    const cartao = document.getElementById("cartao-kpi-sobra");
    cartao.classList.toggle("metrica-saldo-pos", atual.saldoFinal >= 0);
    cartao.classList.toggle("metrica-saldo-neg", atual.saldoFinal < 0);
}

// ---------- "O que fazer agora" ----------
function renderizarRecomendacoes(plano) {
    const lista = document.getElementById("recomendacoes");
    lista.innerHTML = "";
    const adicionar = (texto, tipo = "info") => lista.appendChild(elemento("li", `recomendacao recomendacao-${tipo}`, texto));

    const atual = plano.ciclos[0];
    if (!atual) {
        adicionar("Não encontrei salários lançados para montar os ciclos. Lance o salário (classificação SALARIO) para o sistema saber quando o dinheiro entra.", "alerta");
        return;
    }

    const proximo = `${isoParaBR(atual.proximoSalario.data)}${atual.proximoSalario.estimado ? " (estimado)" : ""}`;
    const qtdContas = atual.contas.length;
    adicionar(
        `Até ${isoParaBR(atual.fim)} (véspera do próximo salário, em ${proximo}) você ainda tem ${qtdContas} conta${qtdContas === 1 ? "" : "s"} lançada${qtdContas === 1 ? "" : "s"} somando ${formatarReais(atual.totalContas)}` +
        (atual.reserva > 0 ? `, mais uns ${formatarReais(atual.reserva)} de gastos do dia a dia.` : ".")
    );
    if (atual.saldoFinal >= 0) {
        adicionar(`Pagando tudo isso, sobram ${formatarReais(atual.saldoFinal)} até o próximo salário.`, "ok");
    } else {
        adicionar(`⚠️ Faltam ${formatarReais(-atual.saldoFinal)} para pagar tudo até ${isoParaBR(atual.fim)}. Segure gastos ou adie alguma conta.`, "alerta");
    }

    plano.transferencias.forEach((t) => {
        const prazo = t.ate ? ` até ${isoParaBR(t.ate)}` : "";
        if (t.de) adicionar(`🔀 Transfira ${formatarReais(t.valor)} de ${t.de} para ${t.para}${prazo}, senão ${t.para} fica negativo.`, "alerta");
        else adicionar(`⚠️ ${t.para} vai ficar ${formatarReais(t.valor)} negativo${prazo} e nenhum outro banco tem sobra para cobrir.`, "alerta");
    });

    plano.ciclos.slice(1).filter((c) => c.saldoFinal < 0).forEach((c) => {
        adicionar(
            `⚠️ No ciclo de ${dataCurta(c.inicio)} a ${dataCurta(c.fim)} o dinheiro não fecha: faltam ${formatarReais(-c.saldoFinal)}. ` +
            `Você terá ${formatarReais(c.saldoInicial + c.totalEntradas)} e vai precisar de ${formatarReais(c.necessario)} ` +
            `(${formatarReais(c.totalContas)} em contas + ${formatarReais(c.reserva)} do dia a dia).`,
            "alerta"
        );
    });

    const ultimo = plano.ciclos[plano.ciclos.length - 1];
    const menor = plano.menorSaldo;
    const aportesProgramados = plano.ciclos.reduce((soma, c) => soma + c.totalAportes, 0);
    if (menor.saldoFinal < 0 && aportesProgramados > 0) {
        const cobre = aportesProgramados >= -menor.saldoFinal;
        adicionar(
            `💡 Você tem ${formatarReais(aportesProgramados)} em aportes de investimento já programados até ${isoParaBR(ultimo.fim)}. ` +
            (cobre
                ? `Reduzir ${formatarReais(-menor.saldoFinal)} desses aportes já evita faltar dinheiro.`
                : "Mesmo sem esses aportes ainda faltaria dinheiro, então vale rever as contas também."),
            "info"
        );
    }
    if (plano.podeInvestir > 0) {
        adicionar(
            `📈 Dá para investir ${formatarReais(plano.podeInvestir)} agora. Mesmo pagando todas as contas lançadas até ${isoParaBR(ultimo.fim)}, seu saldo não fica abaixo do colchão de ${formatarReais(plano.colchao)}. ` +
            `O momento mais apertado é o fim do ciclo de ${dataCurta(menor.inicio)} a ${dataCurta(menor.fim)}, com ${formatarReais(menor.saldoFinal)}.`,
            "ok"
        );
    } else {
        adicionar(
            `💰 Melhor deixar em caixa por enquanto. No fim do ciclo de ${dataCurta(menor.inicio)} a ${dataCurta(menor.fim)} seu saldo chega a ${formatarReais(menor.saldoFinal)}, ` +
            `abaixo do colchão de ${formatarReais(plano.colchao)}. Investir agora faria falta para pagar as contas.`,
            "info"
        );
    }

    if (plano.usouSalarioEstimado) {
        adicionar("Alguns salários ainda não estão lançados. Usei o valor do último salário do mesmo dia (marcados como \"estimado\").", "info");
    }
}

// ---------- Bancos no ciclo atual ----------
function renderizarBancos(plano) {
    const container = document.getElementById("grade-bancos-ciclo");
    container.innerHTML = "";
    if (plano.bancos.length === 0) {
        container.appendChild(elemento("p", "vazio", "Nenhum banco com saldo ou conta prevista."));
        return;
    }
    plano.bancos.forEach((b) => {
        const cor = obterCorBanco(b.banco);
        const cartao = elemento("div", "cartao-carteira");
        cartao.style.borderTopColor = cor;

        const nome = elemento("div", "nome-banco");
        const ponto = elemento("span", "ponto-banco");
        ponto.style.background = cor;
        nome.appendChild(ponto);
        nome.appendChild(document.createTextNode(b.banco));
        cartao.appendChild(nome);

        cartao.appendChild(linhaValor("Saldo hoje", b.saldoHoje));
        if (b.entradas > 0) cartao.appendChild(linhaValor("+ A entrar", b.entradas, "valor-positivo"));
        cartao.appendChild(linhaValor("− A pagar", b.saidas, b.saidas > 0 ? "valor-negativo" : ""));
        const linhaFinal = linhaValor("Fica com", b.saldoFinal, b.saldoFinal >= 0 ? "valor-positivo" : "valor-negativo");
        linhaFinal.classList.add("saldo");
        cartao.appendChild(linhaFinal);
        if (b.saldoFinal < -0.005 && b.primeiraConta) {
            cartao.appendChild(elemento("p", "aviso-banco", `⚠️ Primeira conta em ${isoParaBR(b.primeiraConta.data)}: ${b.primeiraConta.descricao ?? ""}`));
        }
        container.appendChild(cartao);
    });
}

// ---------- Ciclos ----------
function tabelaLancamentos(lista, classeValor) {
    const tabela = document.createElement("table");
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>Data</th><th>Descrição</th><th>Banco</th><th style='text-align:right;'>Valor</th></tr>";
    tabela.appendChild(thead);
    const corpo = document.createElement("tbody");
    lista.forEach((t) => {
        const linha = document.createElement("tr");
        linha.appendChild(elemento("td", "", isoParaBR(t.data)));
        const descricao = [t.descricao, t.saida].filter(Boolean).join(" · ");
        linha.appendChild(elemento("td", "", descricao + (t.classificacao_saida ? ` (${t.classificacao_saida})` : "")));
        linha.appendChild(elemento("td", "", t.banco || "—"));
        const tdValor = elemento("td", classeValor, formatarReais(t.valor));
        tdValor.style.textAlign = "right";
        linha.appendChild(tdValor);
        corpo.appendChild(linha);
    });
    tabela.appendChild(corpo);
    const rolagem = elemento("div", "tabela-scroll");
    rolagem.appendChild(tabela);
    return rolagem;
}

function renderizarCiclos(plano) {
    const container = document.getElementById("grade-ciclos");
    container.innerHTML = "";
    if (plano.ciclos.length === 0) {
        container.appendChild(elemento("p", "vazio", "Sem salários lançados para montar os ciclos."));
        return;
    }

    plano.ciclos.forEach((c) => {
        const cartao = elemento("div", `cartao-ciclo ${c.ehAtual ? "cartao-ciclo-atual" : ""} ${c.saldoFinal < 0 ? "cartao-ciclo-negativo" : ""}`);

        const cabecalho = elemento("div", "cartao-ciclo-cabecalho");
        cabecalho.appendChild(elemento("span", "cartao-ciclo-periodo", `${dataCurta(c.inicio)} → ${dataCurta(c.fim)}`));
        if (c.ehAtual) cabecalho.appendChild(elemento("span", "selo-ciclo", "Agora"));
        cartao.appendChild(cabecalho);

        const salario = c.salario;
        cartao.appendChild(elemento("p", "cartao-ciclo-salario",
            `Salário de ${dataCurta(salario.data)}: ${formatarReais(salario.valor)}${salario.estimado ? " (estimado)" : ""}`));

        cartao.appendChild(linhaValor(c.ehAtual ? "Saldo hoje" : "Começa com", c.saldoInicial));
        cartao.appendChild(linhaValor(c.ehAtual ? "+ Ainda entra" : "+ Entradas (salário e outras)", c.totalEntradas, "valor-positivo"));
        cartao.appendChild(linhaValor(`− Contas (${c.contas.length})`, c.totalContas, "valor-negativo"));
        if (c.totalAportes > 0) cartao.appendChild(linhaValor("   dos quais aportes programados", c.totalAportes));
        cartao.appendChild(linhaValor(`− Dia a dia (${c.diasRestantes} dias)`, c.reserva, "valor-negativo"));
        const linhaFinal = linhaValor(c.saldoFinal >= 0 ? "= Sobra" : "= Falta", Math.abs(c.saldoFinal), c.saldoFinal >= 0 ? "valor-positivo" : "valor-negativo");
        linhaFinal.classList.add("saldo");
        cartao.appendChild(linhaFinal);

        cartao.appendChild(elemento("p", "cartao-ciclo-resumo", c.saldoFinal >= 0
            ? `Precisa de ${formatarReais(c.necessario)} para pagar tudo. Sobram ${formatarReais(c.saldoFinal)} para o próximo ciclo.`
            : `Precisa de ${formatarReais(c.necessario)} para pagar tudo e vão faltar ${formatarReais(-c.saldoFinal)}.`));

        if (c.contas.length > 0) {
            const detalhes = elemento("details", "cartao-ciclo-detalhes");
            detalhes.appendChild(elemento("summary", "", c.contas.length === 1 ? "Ver a conta" : `Ver as ${c.contas.length} contas`));
            detalhes.appendChild(tabelaLancamentos(c.contas, "saida"));
            cartao.appendChild(detalhes);
        }
        if (c.entradas.length > 0) {
            const detalhes = elemento("details", "cartao-ciclo-detalhes");
            detalhes.appendChild(elemento("summary", "", c.entradas.length === 1 ? "Ver a entrada" : `Ver as ${c.entradas.length} entradas`));
            detalhes.appendChild(tabelaLancamentos(c.entradas, "entrada"));
            cartao.appendChild(detalhes);
        }

        container.appendChild(cartao);
    });
}

// ---------- Ajustes ----------
function prepararAjustes(plano, categoriasDisponiveis, categoriasEscolhidas) {
    const preferencias = lerPreferencias();
    campoColchao.value = preferencias.colchao == null ? "" : String(preferencias.colchao).replace(".", ",");
    campoColchao.placeholder = `Automático: ${formatarReais(plano.colchao)}`;
    document.getElementById("dica-colchao").textContent = preferencias.colchao == null
        ? `Dinheiro que sempre fica em caixa para imprevistos. Em branco, usa ${formatarReais(plano.colchao)} (15 dias de gastos do dia a dia). Nunca é sugerido para investir.`
        : "Dinheiro que sempre fica em caixa para imprevistos. Nunca é sugerido para investir. Apague o valor para voltar ao automático.";
    document.getElementById("dica-dia-a-dia").textContent =
        `Categorias de gastos que ainda não estão lançados (lanche, uber, ônibus...). Média atual: ${formatarReais(plano.taxaDiaria)} por dia (últimos 90 dias), reservada para os dias que faltam em cada ciclo.`;

    if (!seletorDiaADia) {
        seletorDiaADia = criarSeletorMultiplo({
            container: document.getElementById("seletor-dia-a-dia"),
            opcoes: categoriasDisponiveis,
            selecionados: categoriasEscolhidas,
            rotuloTodos: "Nenhuma (sem reserva)",
            aoMudar: (selecionados) => {
                salvarPreferencias({ categoriasDiaADia: selecionados });
                recalcular();
            }
        });
    } else {
        seletorDiaADia.definirOpcoes(categoriasDisponiveis);
    }
}

function recalcular() {
    const hoje = hojeISO();
    const preferencias = lerPreferencias();
    const categoriasEscolhidas = preferencias.categoriasDiaADia ?? sugerirCategoriasDiaADia(todasTransacoes, hoje);
    const plano = calcularPlanejamento(todasTransacoes, {
        hoje,
        categoriasDiaADia: categoriasEscolhidas,
        colchao: preferencias.colchao ?? null
    });

    const categoriasDisponiveis = [...new Set(todasTransacoes.filter((t) => t.tipo === "SAIDA").map((t) => t.classificacao_saida).filter(Boolean))].sort();
    prepararAjustes(plano, categoriasDisponiveis, categoriasEscolhidas);

    renderizarIndicadores(plano);
    renderizarRecomendacoes(plano);
    renderizarBancos(plano);
    renderizarCiclos(plano);
}

async function carregar(forcarAtualizacao = false) {
    try {
        todasTransacoes = await obterTransacoes(usuario, { forcarAtualizacao });
        recalcular();
        if (forcarAtualizacao) mostrarToast("Dados atualizados.", "sucesso");
    } catch (erro) {
        console.error("Erro ao carregar planejamento:", erro);
        document.getElementById("recomendacoes").innerHTML = "<li>Erro ao carregar dados. Verifique o console (F12).</li>";
    }
}

carregar();
