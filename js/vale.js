// vale.js
// Dinheiro de vale (alimentação/refeição) só pode ser gasto em certos
// lugares, então não dá pra somar com o dinheiro "livre" dos outros bancos.
// O vale é identificado pelo banco do lançamento (ALELO, PLUXE, ...).

const PADRAO_BANCO_VALE = /^(ALELO|PLUXEE?|SODEXO|TICKET|VR|FLASH|CAJU|SWILE)\b/;

export const OPCOES_FILTRO_VALE = [
    { valor: "", rotulo: "Tudo" },
    { valor: "COM", rotulo: "Só vale (Alelo, Pluxe)" },
    { valor: "SEM", rotulo: "Sem vale" }
];

export function ehBancoVale(banco) {
    return PADRAO_BANCO_VALE.test((banco ?? "").trim().toUpperCase());
}

// modo: "" = tudo, "COM" = só lançamentos de vale, "SEM" = tudo menos vale
export function filtrarPorVale(lista, modo) {
    if (modo === "COM") return lista.filter((t) => ehBancoVale(t.banco));
    if (modo === "SEM") return lista.filter((t) => !ehBancoVale(t.banco));
    return lista;
}

export function preencherSelectVale(select) {
    select.innerHTML = "";
    OPCOES_FILTRO_VALE.forEach(({ valor, rotulo }) => {
        const opcao = document.createElement("option");
        opcao.value = valor;
        opcao.textContent = rotulo;
        select.appendChild(opcao);
    });
}
