// dados-comuns.js
// Sugestões iniciais para os campos de Banco e Classificação, com base
// no que já aparecia na sua planilha "Despesas Mensais". O sistema também
// aprende sozinho: qualquer banco/classificação novos que você digitar
// passam a aparecer como sugestão nas próximas vezes.

export const BANCOS_SUGERIDOS = [
  "NUBANK",
  "NUBANK CAIXINHA",
  "CLEAR",
  "PAGBANK",
  "INTER",
  "ITAÚ",
  "BRADESCO",
  "SANTANDER",
  "CAIXA",
  "BB",
  "C6 BANK",
  "PICPAY"
];

// Apelidos/nomes alternativos de um mesmo banco — sempre gravados com o
// nome padrão à direita, para não duplicar o mesmo banco com nomes
// diferentes nos filtros e nos totais por banco.
const APELIDOS_BANCO = {
  "BANCO DO BRASIL": "BB"
};

// Aplica o nome padrão do banco (ex: "BANCO DO BRASIL" -> "BB"). Espera o
// texto já em maiúsculas/aparado (mesmo padrão salvo no banco de dados).
export function normalizarNomeBanco(nomeBanco) {
  return APELIDOS_BANCO[nomeBanco] ?? nomeBanco;
}

export const CLASSIFICACOES_SUGERIDAS = [
  "ALUGUEL",
  "ENERGIA",
  "GÁS",
  "ÁGUA",
  "INTERNET",
  "CELULAR",
  "TRANSPORTE",
  "CAIXINHA",
  "RAÇÃO GATOS",
  "MENSAL",
  "DESP MENSAL",
  "MERCADO",
  "LAZER",
  "SAÚDE",
  "EDUCAÇÃO",
  "INVESTIMENTO",
  "SALÁRIO",
  "OUTROS"
];

// Junta a lista sugerida com valores já usados nas transações do usuário,
// sem repetir e em ordem alfabética.
export function mesclarSugestoes(sugeridas, usadas) {
  const conjunto = new Set(sugeridas);
  usadas.forEach(valor => {
    if (valor) conjunto.add(valor.toUpperCase());
  });
  return Array.from(conjunto).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function preencherDatalist(idDatalist, valores) {
  const datalist = document.getElementById(idDatalist);
  if (!datalist) return;
  datalist.innerHTML = ""; // limpa opções anteriores
  valores.forEach((valor) => {
    const opcao = document.createElement("option");
    opcao.value = valor; // atribuição via propriedade, não via HTML — sem risco de injeção
    datalist.appendChild(opcao);
  });
}
