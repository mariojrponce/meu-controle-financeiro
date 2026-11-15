// vale.js
// Dinheiro de vale (alimentação/refeição) só pode ser gasto em certos
// lugares, então não dá pra somar com o dinheiro "livre" dos outros bancos.
// O vale é identificado pelo banco do lançamento (ALELO, PLUXE, ...).

// Padrão do sistema; cada usuário pode trocar a lista na tela Configurações.
export const BANCOS_VALE_PADRAO = ["ALELO", "PLUXE", "PLUXEE", "SODEXO", "TICKET", "VR", "FLASH", "CAJU", "SWILE"];

function montarPadrao(nomes) {
    const limpos = nomes.map((n) => String(n ?? "").trim().toUpperCase()).filter(Boolean);
    if (!limpos.length) return null;
    const escapados = limpos.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    // O nome do banco precisa COMEÇAR com um dos nomes da lista (ex.: "ALELO REFEIÇÃO").
    return new RegExp(`^(${escapados.join("|")})(?![A-Z0-9])`);
}

let padraoBancoVale = montarPadrao(BANCOS_VALE_PADRAO);

// Troca a lista de bancos de vale em uso (chamado ao carregar as configurações do usuário).
export function definirBancosVale(nomes) {
    padraoBancoVale = montarPadrao(Array.isArray(nomes) ? nomes : BANCOS_VALE_PADRAO);
}

export const OPCOES_FILTRO_VALE = [
    { valor: "", rotulo: "Tudo" },
    { valor: "COM", rotulo: "Só vale (Alelo, Pluxe)" },
    { valor: "SEM", rotulo: "Sem vale" }
];

export function ehBancoVale(banco) {
    return padraoBancoVale ? padraoBancoVale.test((banco ?? "").trim().toUpperCase()) : false;
}

// modo: "" = tudo, "COM" = só lançamentos de vale, "SEM" = tudo menos vale
export function filtrarPorVale(lista, modo) {
    if (modo === "COM") return lista.filter((t) => ehBancoVale(t.banco));
    if (modo === "SEM") return lista.filter((t) => !ehBancoVale(t.banco));
    return lista;
}

export function preencherSelectVale(select) {
    select.replaceChildren();
    OPCOES_FILTRO_VALE.forEach(({ valor, rotulo }) => {
        const opcao = document.createElement("option");
        opcao.value = valor;
        opcao.textContent = rotulo;
        select.appendChild(opcao);
    });
}
