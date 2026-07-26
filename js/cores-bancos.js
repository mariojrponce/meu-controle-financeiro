// cores-bancos.js
// Cores aproximadas da identidade visual de cada banco/carteira, usadas
// nos cartões do dashboard. Se o banco não estiver na lista, usa a cor padrão.

const CORES_CONHECIDAS = [
  { chave: "NUBANK", cor: "#8A05BE" },
  { chave: "INTER", cor: "#FF7A00" },
  { chave: "ITAU", cor: "#EC7000" },
  { chave: "BRADESCO", cor: "#CC092F" },
  { chave: "SANTANDER", cor: "#EC0000" },
  { chave: "CAIXA", cor: "#0033A0" },
  { chave: "BANCO DO BRASIL", cor: "#003087" },
  { chave: "C6", cor: "#242424" },
  { chave: "PICPAY", cor: "#11C76F" },
  { chave: "CLEAR", cor: "#0B1F3A" },
  { chave: "PAGBANK", cor: "#00A868" },
  { chave: "PAGSEGURO", cor: "#00A868" },
  { chave: "XP", cor: "#0B0B0B" },
  { chave: "MERCADO PAGO", cor: "#00AAFF" },
  { chave: "NEON", cor: "#00E0B8" },
  { chave: "ORIGINAL", cor: "#00A65A" },
  { chave: "SICOOB", cor: "#6DB33F" },
  { chave: "SICREDI", cor: "#7AB92D" },
  { chave: "BTG", cor: "#0B2C4E" },
  { chave: "WILL BANK", cor: "#111111" },
  { chave: "NEXT", cor: "#00E28A" },
  { chave: "SAFRA", cor: "#7A1FA2" }
];

const COR_PADRAO = "#059669";

function normalizar(texto) {
  return texto
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function obterCorBanco(nomeBanco) {
  const normalizado = normalizar(nomeBanco ?? "");
  const encontrado = CORES_CONHECIDAS.find((c) => normalizado.includes(c.chave));
  return encontrado ? encontrado.cor : COR_PADRAO;
}
