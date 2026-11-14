// finalidade.js
// Equipara as categorias de anos diferentes pela FINALIDADE do gasto — sem DOM,
// testável no Node. Só muda a VISÃO (Evolução por categoria); o lançamento
// gravado continua como está.
//
// Por quê: a classificação mudou ao longo dos anos. O que em 2024/2025 era
// "TRANSPORTE" virou "UBER" e "ONIBUS" em 2026; o DAS/MEI saiu de "IMPOSTOS"
// para "DESP MENSAL"; "COMPRAS CASA" passou a se chamar "COMPRAS CASA 108N"...
// Comparando pelo nome, a categoria nova aparece como "novo" e a antiga como
// "caiu 100%", quando o gasto é o mesmo. Aqui cada lançamento é levado para a
// categoria que você usa HOJE, olhando a classificação + descrição + detalhe.
//
// As regras valem para todos os anos (inclusive o atual), então lançamentos
// do mesmo tipo caem sempre no mesmo lugar. Vieram da leitura do histórico
// (backup de 14/11/2026); para ajustar, edite as listas abaixo.

function normalizar(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

const em = (...nomes) => { const conjunto = new Set(nomes); return (c) => conjunto.has(c); };

// Ônibus: recarga de passe/carteirinha (PIU, ZPLMB, agência de transporte) ou saque para colocar de passe.
const ONIBUS = /\bPASSES?\b|ONIBUS|CARTEIRINHA|CARTEIRA CIDADAO|\bPIU\b|ZP ?LMB|LMB TECNOLOGIA|TRANSPORTE PUBLICO|AGENCIA TRANSPORTE/;
// Financiamento/obra do imóvel (MRV, Caixa), que fica em INVESTIMENTOS; o resto é aplicação financeira.
const IMOVEL = /\bMRV\b|\bCAIXA\b|SEGURO|ENCARGO|PROJETO|PARCELA|\bSINAL\b|\bM0\d\d\b/;
const LANCHE_PARA_CASA = /LANCHE.*\bCASA\b|\bCASA\b.*LANCHE/;

// Cada regra: tipo, categorias de origem, (opcional) texto que precisa aparecer, destino.
// A primeira que servir vale. `texto` = descrição + detalhe, sem acento, em maiúsculas.
const REGRAS = [
  // --- Transporte: TRANSPORTE (até abr/26) = UBER (corridas de app, inclui 99) + ONIBUS ---
  { tipo: "SAIDA", de: em("TRANSPORTE"), se: /CELULAR/, para: "DESP MENSAL" },
  { tipo: "SAIDA", de: em("TRANSPORTE", "UBER", "ONIBUS"), se: ONIBUS, para: "ONIBUS" },
  { tipo: "SAIDA", de: em("TRANSPORTE"), para: "UBER" },

  // --- Contas do mês: DAS/MEI, Spotify, celular e boleto da torre = DESP MENSAL ---
  { tipo: "SAIDA", de: em("IMPOSTOS"), se: /DAS\/MEI|DESP MENSAL/, para: "DESP MENSAL" },
  { tipo: "SAIDA", de: em("DESPESAS", "DESP MENSAL"), se: /CONTA (DE )?TELEFONE/, para: "CONTA CASA 108N" },
  { tipo: "SAIDA", de: em("DESPESAS"), se: /SPOTIFY|CELULAR|RECARGA|PAGU?E? FACIL|\bTORRE\b|DAS\/MEI/, para: "DESP MENSAL" },

  // --- Corte de cabelo: estava em DESPESAS, hoje vai em DIVERSOS ---
  { tipo: "SAIDA", de: em("DESPESAS"), se: /CABELO|CABELEIREIRO|STHIL/, para: "DIVERSOS" },

  // --- Confraternização e presentes, que ficavam espalhados ---
  { tipo: "SAIDA", de: em("LAZER", "DIVERSOS", "DESPESAS"), se: /CONFRAT/, para: "CONFRATERNIZAÇÃO" },
  { tipo: "SAIDA", de: em("DIVERSOS"), se: /PRESENTE|ANIVERS|CHA (DE )?FRAUDA/, para: "PRESENTE" },

  // --- Lanche comprado para casa: estava em LANCHE ou COMPRAS CASA, hoje é CASA LANCHE ---
  { tipo: "SAIDA", de: em("LANCHE", "COMPRAS CASA", "COMPRAS CASA 108N"), se: LANCHE_PARA_CASA, para: "CASA LANCHE" },

  // --- Compras de casa: COMPRAS CASA foi renomeada para COMPRAS CASA 108N em out/26 ---
  { tipo: "SAIDA", de: em("COMPRAS CASA"), para: "COMPRAS CASA 108N" },

  // --- Imóvel (INVESTIMENTOS) × dinheiro guardado/aplicado (INVESTIMENTO) ---
  { tipo: "SAIDA", de: em("INVESTIMENTOS", "INVESTIMENTO"), se: IMOVEL, para: "INVESTIMENTOS" },
  { tipo: "SAIDA", de: em("INVESTIMENTOS", "INVESTIMENTO", "RENDA FIXA", "MOEDA VIRTUAL", "NUBANK CAIXINHA", "POUPANÇA"), para: "INVESTIMENTO" },

  { tipo: "SAIDA", de: em("EMPRESTAR VALOR"), para: "EMPRESTAR" },

  // --- Recebimentos ---
  // Resgates de aplicação estavam em 6 nomes diferentes; FGTS ficava em ADIANTAMENTO.
  { tipo: "ENTRADA", de: em("ADIANTAMENTO"), se: /FGTS/, para: "RESGATES DE INVEST." },
  { tipo: "ENTRADA", de: em("INVESTIMENTO", "INVESTIMENTOS", "NUBANK CAIXINHA", "POUPANÇA", "MOEDA VIRTUAL"), para: "RESGATES DE INVEST." },
  // Devolução de empréstimo ficava em RESTORNO; hoje é DEVOLUÇÃO.
  { tipo: "ENTRADA", de: em("RESTORNO"), se: /EMPRESTIMO/, para: "DEVOLUÇÃO" }
];

// Categoria em que o lançamento entra na comparação entre anos.
export function finalidadeDe(t) {
  const categoria = t?.classificacao_saida ?? "";
  let texto = null;
  for (const regra of REGRAS) {
    if (regra.tipo !== t.tipo || !regra.de(categoria)) continue;
    if (regra.se) {
      texto ??= normalizar(`${t.descricao ?? ""} | ${t.saida ?? ""}`);
      if (!regra.se.test(texto)) continue;
    }
    return regra.para;
  }
  return categoria;
}
