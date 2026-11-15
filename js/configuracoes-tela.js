// configuracoes-tela.js
// Tela Configurações: listas de sugestões, bancos de vale e regras de
// equiparação de categorias. Nada vale antes de clicar em "Salvar alterações".
import { exigirLogin } from "./auth-guard.js";
import { renderizarNav } from "./nav.js";
import { mostrarToast, confirmarAcao, preencherBotao } from "./ui.js";
import { carregarConfiguracoes, salvarConfiguracoes } from "./configuracoes.js";
import { configuracoesPadrao, limparConfiguracoes, limparNome, LIMITE_ITENS, TAMANHO_MAXIMO_NOME } from "./configuracoes-modelo.js";
import { limparRegra } from "./finalidade.js";
import { obterTransacoes, atualizarTransacoesEmLote } from "./dados-carteira.js";
import { preencherDatalist, normalizarNomeBanco } from "./dados-comuns.js";

const usuario = await exigirLogin();
renderizarNav("configuracoes", usuario.email);

const botaoSalvar = document.getElementById("btn-salvar");
const textoEstado = document.getElementById("texto-estado");
const corpoRegras = document.querySelector("#tabela-regras tbody");

// O que está na tela (ainda não necessariamente salvo). As regras ficam como
// o usuário digitou (origem em texto), para não "consertar" enquanto ele escreve.
let estado = { bancos: [], classificacoes: [], bancosVale: [], regras: [] };
let haAlteracoes = false;

function paraEstado(config) {
    return {
        bancos: [...config.bancos],
        classificacoes: [...config.classificacoes],
        bancosVale: [...config.bancosVale],
        regras: config.regras.map((r) => ({ tipo: r.tipo, de: r.de.join(", "), se: r.se, para: r.para }))
    };
}

function marcarAlterado(alterado = true) {
    haAlteracoes = alterado;
    botaoSalvar.disabled = !alterado;
    if (alterado) textoEstado.textContent = "Há alterações que ainda não foram salvas.";
}

// ---------- Listas simples (bancos, classificações, bancos de vale) ----------
const LISTAS = [
    { id: "lista-bancos", chave: "bancos", rotulo: "banco", exemplo: "Ex.: NUBANK" },
    { id: "lista-classificacoes", chave: "classificacoes", rotulo: "classificação", exemplo: "Ex.: MERCADO" },
    { id: "lista-bancos-vale", chave: "bancosVale", rotulo: "banco de vale", exemplo: "Ex.: ALELO" }
];

function renderizarLista({ id, chave, rotulo, exemplo }) {
    const container = document.getElementById(id);
    container.replaceChildren();

    const itens = document.createElement("div");
    itens.className = "itens-config";
    if (estado[chave].length === 0) {
        const vazio = document.createElement("p");
        vazio.className = "vazio";
        vazio.textContent = "Lista vazia.";
        itens.appendChild(vazio);
    }
    estado[chave].forEach((nome, indice) => {
        const item = document.createElement("span");
        item.className = "item-config";
        const texto = document.createElement("span");
        texto.textContent = nome;
        const remover = document.createElement("button");
        remover.type = "button";
        remover.title = `Remover ${nome}`;
        preencherBotao(remover, "fechar");
        remover.addEventListener("click", () => {
            estado[chave].splice(indice, 1);
            marcarAlterado();
            renderizarLista({ id, chave, rotulo, exemplo });
        });
        item.append(texto, remover);
        itens.appendChild(item);
    });

    const formulario = document.createElement("form");
    formulario.className = "adicionar-config";
    const campo = document.createElement("input");
    campo.type = "text";
    campo.maxLength = TAMANHO_MAXIMO_NOME;
    campo.placeholder = exemplo;
    campo.setAttribute("aria-label", `Novo ${rotulo}`);
    const adicionar = document.createElement("button");
    adicionar.type = "submit";
    adicionar.className = "botao botao-secundario";
    adicionar.textContent = "Adicionar";
    formulario.append(campo, adicionar);
    formulario.addEventListener("submit", (evento) => {
        evento.preventDefault();
        const nome = limparNome(campo.value);
        if (!nome) return campo.focus();
        if (estado[chave].includes(nome)) return mostrarToast(`"${nome}" já está na lista.`, "erro");
        if (estado[chave].length >= LIMITE_ITENS) return mostrarToast(`A lista aceita no máximo ${LIMITE_ITENS} itens.`, "erro");
        estado[chave].push(nome);
        marcarAlterado();
        renderizarLista({ id, chave, rotulo, exemplo });
        document.querySelector(`#${id} input`).focus();
    });

    container.append(itens, formulario);
}

// ---------- Regras de equiparação ----------
function campoRegra(regra, propriedade, { placeholder, rotulo, maximo = 600 }) {
    const campo = document.createElement("input");
    campo.type = "text";
    campo.value = regra[propriedade] ?? "";
    campo.placeholder = placeholder;
    campo.maxLength = maximo;
    campo.setAttribute("aria-label", rotulo);
    campo.addEventListener("input", () => {
        regra[propriedade] = campo.value;
        campo.classList.remove("campo-invalido");
        marcarAlterado();
    });
    return campo;
}

function celulaCom(...elementos) {
    const td = document.createElement("td");
    td.append(...elementos);
    return td;
}

function botaoRegra(nomeIcone, titulo, classe, aoClicar, desativado = false) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = classe;
    botao.title = titulo;
    botao.disabled = desativado;
    preencherBotao(botao, nomeIcone);
    botao.addEventListener("click", aoClicar);
    return botao;
}

function moverRegra(indice, passo) {
    const destino = indice + passo;
    if (destino < 0 || destino >= estado.regras.length) return;
    [estado.regras[indice], estado.regras[destino]] = [estado.regras[destino], estado.regras[indice]];
    marcarAlterado();
    renderizarRegras();
}

function renderizarRegras() {
    corpoRegras.replaceChildren();
    if (estado.regras.length === 0) {
        const linha = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 5;
        td.className = "vazio";
        td.textContent = "Nenhuma regra: a Categoria fica igual à Classificação do lançamento.";
        linha.appendChild(td);
        corpoRegras.appendChild(linha);
        return;
    }
    estado.regras.forEach((regra, indice) => {
        const linha = document.createElement("tr");

        const tipo = document.createElement("select");
        tipo.setAttribute("aria-label", "Tipo do lançamento");
        [["SAIDA", "Gasto"], ["ENTRADA", "Recebimento"]].forEach(([valor, texto]) => {
            const opcao = document.createElement("option");
            opcao.value = valor;
            opcao.textContent = texto;
            tipo.appendChild(opcao);
        });
        tipo.value = regra.tipo;
        tipo.addEventListener("change", () => { regra.tipo = tipo.value; marcarAlterado(); });

        const acoes = document.createElement("div");
        acoes.className = "acoes-linha";
        const subir = botaoRegra("seta", "Subir a regra (ela passa a ser testada antes)", "botao-icone-primario botao-subir", () => moverRegra(indice, -1), indice === 0);
        const descer = botaoRegra("seta", "Descer a regra (ela passa a ser testada depois)", "botao-icone-primario botao-descer", () => moverRegra(indice, 1), indice === estado.regras.length - 1);
        const excluir = botaoRegra("excluir", "Excluir a regra", "botao-icone-perigo", () => {
            estado.regras.splice(indice, 1);
            marcarAlterado();
            renderizarRegras();
        });
        acoes.append(subir, descer, excluir);

        const tdAcoes = celulaCom(acoes);
        tdAcoes.className = "col-acoes";
        linha.append(
            celulaCom(tipo),
            celulaCom(campoRegra(regra, "de", { placeholder: "Ex.: TRANSPORTE, UBER", rotulo: "Classificações de origem" })),
            celulaCom(campoRegra(regra, "se", { placeholder: "Qualquer texto", rotulo: "Só quando o texto tiver" })),
            celulaCom(campoRegra(regra, "para", { placeholder: "Ex.: UBER", rotulo: "Vira a categoria", maximo: TAMANHO_MAXIMO_NOME })),
            tdAcoes
        );
        corpoRegras.appendChild(linha);
    });
}

function renderizarTudo() {
    LISTAS.forEach(renderizarLista);
    renderizarRegras();
}

// Converte as regras da tela para o formato gravado; marca em vermelho as que
// não servem e devolve null nesse caso.
function regrasDaTela() {
    const linhas = [...corpoRegras.querySelectorAll("tr")];
    let primeiraInvalida = null;
    const regras = estado.regras.map((regra, indice) => {
        const campos = linhas[indice]?.querySelectorAll("input") ?? [];
        const [campoDe, campoSe, campoPara] = campos;
        const de = regra.de.split(",").map((c) => c.trim()).filter(Boolean);
        let expressaoValida = true;
        if (regra.se.trim()) { try { new RegExp(regra.se); } catch { expressaoValida = false; } }
        campoDe?.classList.toggle("campo-invalido", de.length === 0);
        campoSe?.classList.toggle("campo-invalido", !expressaoValida);
        campoPara?.classList.toggle("campo-invalido", !regra.para.trim());
        const limpa = expressaoValida ? limparRegra({ tipo: regra.tipo, de, se: regra.se, para: regra.para }) : null;
        if (!limpa) primeiraInvalida ??= (de.length === 0 ? campoDe : !expressaoValida ? campoSe : campoPara) ?? null;
        return limpa;
    });
    if (regras.some((r) => !r)) {
        primeiraInvalida?.focus();
        return null;
    }
    return regras;
}

async function salvar() {
    const regras = regrasDaTela();
    if (!regras) return mostrarToast("Há regras incompletas ou com texto inválido (em vermelho). Corrija ou exclua antes de salvar.", "erro");

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";
    try {
        const salva = await salvarConfiguracoes(usuario, limparConfiguracoes({ ...estado, regras }));
        estado = paraEstado(salva);
        renderizarTudo();
        marcarAlterado(false);
        textoEstado.textContent = "Configurações salvas. Já valem em todas as telas.";
        mostrarToast("Configurações salvas!", "sucesso");
    } catch (erro) {
        console.error("Erro ao salvar as configurações:", erro?.code ?? erro);
        botaoSalvar.disabled = false;
        mostrarToast(erro?.code === "permission-denied"
            ? "O Firebase recusou a gravação: as regras novas do Firestore (firestore.rules) ainda não foram publicadas."
            : "Erro ao salvar. Confira a internet e tente de novo.", "erro");
    } finally {
        botaoSalvar.textContent = "Salvar alterações";
    }
}

botaoSalvar.addEventListener("click", salvar);

document.getElementById("btn-nova-regra").addEventListener("click", () => {
    if (estado.regras.length >= LIMITE_ITENS) return mostrarToast(`São aceitas no máximo ${LIMITE_ITENS} regras.`, "erro");
    estado.regras.push({ tipo: "SAIDA", de: "", se: "", para: "" });
    marcarAlterado();
    renderizarRegras();
    corpoRegras.querySelector("tr:last-child input")?.focus();
});

document.getElementById("btn-restaurar").addEventListener("click", async () => {
    const confirmou = await confirmarAcao({
        titulo: "Restaurar o padrão do sistema?",
        mensagem: "As listas e as regras desta tela voltam ao padrão do sistema. Só vale depois de clicar em Salvar alterações.",
        textoConfirmar: "Restaurar",
        textoCancelar: "Cancelar"
    });
    if (!confirmou) return;
    estado = paraEstado(configuracoesPadrao());
    renderizarTudo();
    marcarAlterado();
});

// ---------- Corrigir nomes (classificação ou banco) nos lançamentos já gravados ----------
const formCorrigir = document.getElementById("form-corrigir");
const campoCorrigirCampo = document.getElementById("corrigir-campo");
const campoCorrigirDe = document.getElementById("corrigir-de");
const campoCorrigirPara = document.getElementById("corrigir-para");
const botaoCorrigir = document.getElementById("btn-corrigir");
let transacoes = [];

// Cada campo corrigível: como se chama, como o nome novo é limpo e quais
// listas desta tela (sugestões / bancos de vale) podem citar o nome antigo.
const CAMPOS_CORRIGIVEIS = {
    classificacao_saida: { nome: "classificação", limpar: limparNome, listas: ["classificacoes"] },
    // Banco usa o mesmo nome padrão dos formulários (ex.: "BANCO DO BRASIL" vira "BB").
    banco: { nome: "banco", limpar: (texto) => normalizarNomeBanco(limparNome(texto)), listas: ["bancos", "bancosVale"] }
};

function preencherNomesUsados() {
    const campo = campoCorrigirCampo.value;
    const contagem = new Map();
    transacoes.forEach((t) => {
        if (t[campo]) contagem.set(t[campo], (contagem.get(t[campo]) ?? 0) + 1);
    });
    const nomes = [...contagem.keys()].sort((a, b) => a.localeCompare(b, "pt-BR"));

    campoCorrigirDe.replaceChildren();
    const primeira = document.createElement("option");
    primeira.value = "";
    primeira.textContent = nomes.length ? "Escolha..." : "Nenhum lançamento ainda";
    campoCorrigirDe.appendChild(primeira);
    nomes.forEach((nome) => {
        const opcao = document.createElement("option");
        opcao.value = nome;
        const quantidade = contagem.get(nome);
        opcao.textContent = `${nome} (${quantidade} ${quantidade === 1 ? "lançamento" : "lançamentos"})`;
        campoCorrigirDe.appendChild(opcao);
    });
    preencherDatalist("lista-nomes-usados", nomes);
    botaoCorrigir.disabled = nomes.length === 0;
}

campoCorrigirCampo.addEventListener("change", () => {
    campoCorrigirPara.value = "";
    preencherNomesUsados();
});

async function carregarNomesUsados() {
    try {
        transacoes = await obterTransacoes(usuario);
        preencherNomesUsados();
    } catch (erro) {
        console.error("Erro ao carregar os lançamentos:", erro?.code ?? erro);
        campoCorrigirDe.replaceChildren(new Option("Erro ao carregar os lançamentos", ""));
    }
}

formCorrigir.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const campo = campoCorrigirCampo.value;
    const info = CAMPOS_CORRIGIVEIS[campo];
    const de = campoCorrigirDe.value;
    const para = info.limpar(campoCorrigirPara.value);
    if (!de) return campoCorrigirDe.focus();
    if (!para) return campoCorrigirPara.focus();
    if (para === de) return mostrarToast("O nome correto é igual ao atual.", "erro");

    const ids = transacoes.filter((t) => t[campo] === de).map((t) => t.id);
    const jaExistem = transacoes.filter((t) => t[campo] === para).length;
    const confirmou = await confirmarAcao({
        titulo: `Corrigir ${ids.length} ${ids.length === 1 ? "lançamento" : "lançamentos"}?`,
        mensagem: `Todo lançamento com ${info.nome} "${de}" passa a ser "${para}".`
            + (jaExistem ? ` Já existem ${jaExistem} lançamentos como "${para}": eles vão se juntar, e depois não dá para separar de volta automaticamente.` : ""),
        textoConfirmar: "Corrigir",
        textoCancelar: "Cancelar"
    });
    if (!confirmou) return;

    botaoCorrigir.disabled = true;
    try {
        await atualizarTransacoesEmLote(usuario, ids, { [campo]: para }, (feitos, total) => {
            botaoCorrigir.textContent = `Corrigindo ${feitos} de ${total}...`;
        });
        transacoes = transacoes.map((t) => (t[campo] === de ? { ...t, [campo]: para } : t));
        preencherNomesUsados();
        campoCorrigirPara.value = "";

        // As listas e as regras desta tela podem citar o nome antigo.
        const avisos = [];
        let ajustouLista = false;
        info.listas.forEach((chave) => {
            const posicao = estado[chave].indexOf(de);
            if (posicao === -1) return;
            if (estado[chave].includes(para)) estado[chave].splice(posicao, 1);
            else estado[chave][posicao] = para;
            renderizarLista(LISTAS.find((l) => l.chave === chave));
            ajustouLista = true;
        });
        if (ajustouLista) {
            marcarAlterado();
            avisos.push("as listas desta tela foram ajustadas (salve as alterações)");
        }
        if (campo === "classificacao_saida") {
            const citaNasRegras = estado.regras.some((r) => r.para.trim().toUpperCase() === de || r.de.split(",").some((c) => c.trim().toUpperCase() === de));
            if (citaNasRegras) avisos.push(`há regras de equiparação que ainda citam "${de}"; confira-as`);
        }
        mostrarToast(`${ids.length} ${ids.length === 1 ? "lançamento corrigido" : "lançamentos corrigidos"}${avisos.length ? `; ${avisos.join("; ")}` : ""}.`, "sucesso");
    } catch (erro) {
        console.error("Erro ao corrigir o nome:", erro?.code ?? erro);
        mostrarToast("Erro ao corrigir: parte dos lançamentos pode não ter sido alterada. Recarregue a página e confira.", "erro");
        try { transacoes = await obterTransacoes(usuario, { forcarAtualizacao: true }); preencherNomesUsados(); } catch { /* fica como está */ }
    } finally {
        botaoCorrigir.textContent = "Corrigir lançamentos";
        botaoCorrigir.disabled = campoCorrigirDe.options.length <= 1;
    }
});

// Avisa antes de sair da página com alterações não salvas.
window.addEventListener("beforeunload", (evento) => {
    if (haAlteracoes) evento.preventDefault();
});

try {
    // Sempre busca do Firestore aqui, para editar a versão mais recente (de qualquer aparelho).
    const { config, personalizada } = await carregarConfiguracoes(usuario, { forcarAtualizacao: true });
    estado = paraEstado(config);
    textoEstado.textContent = personalizada
        ? "Estas são as suas configurações salvas."
        : "Você ainda usa o padrão do sistema. Ajuste o que quiser e clique em Salvar alterações.";
} catch (erro) {
    console.error("Erro ao carregar as configurações:", erro?.code ?? erro);
    estado = paraEstado(configuracoesPadrao());
    textoEstado.textContent = erro?.code === "permission-denied"
        ? "Não foi possível ler suas configurações: as regras novas do Firestore (firestore.rules) ainda não foram publicadas. Mostrando o padrão do sistema."
        : "Não foi possível ler suas configurações agora. Mostrando o padrão do sistema.";
}
renderizarTudo();
carregarNomesUsados();
