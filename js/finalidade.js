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
// do mesmo tipo caem sempre no mesmo lugar. As regras padrão vieram da leitura
// do histórico (backup de 14/11/2026); cada usuário pode trocar as suas na
// tela Configurações (configuracoes.js chama definirRegrasDeFinalidade).

function normalizar(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

// Texto da regra ("só quando tiver...") no mesmo formato do texto comparado:
// sem acento e em maiúsculas — sem mexer nos escapes (\b, \d...).
export function normalizarExpressao(expressao) {
  return String(expressao ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\\.|[a-z]/g, (m) => (m.length === 2 ? m : m.toUpperCase())).trim();
}

// Ônibus: recarga de passe/carteirinha (PIU, ZPLMB, agência de transporte) ou saque para colocar de passe.
const ONIBUS = "\\bPASSES?\\b|ONIBUS|CARTEIRINHA|CARTEIRA CIDADAO|\\bPIU\\b|ZP ?LMB|LMB TECNOLOGIA|TRANSPORTE PUBLICO|AGENCIA TRANSPORTE";
// Financiamento/obra do imóvel (MRV, Caixa), que fica em INVESTIMENTOS; o resto é aplicação financeira.
const IMOVEL = "\\bMRV\\b|\\bCAIXA\\b|SEGURO|ENCARGO|PROJETO|PARCELA|\\bSINAL\\b|\\bM0\\d\\d\\b";
const LANCHE_PARA_CASA = "LANCHE.*\\bCASA\\b|\\bCASA\\b.*LANCHE";

// Regras padrão do sistema (podem ser trocadas pelas do usuário na tela Configurações).
// Cada regra: tipo, categorias de origem (`de`), texto que precisa aparecer (`se`,
// opcional — expressão regular sobre descrição + detalhe, sem acento, em maiúsculas)
// e o destino (`para`). A primeira que servir vale.
export const REGRAS_PADRAO = [
  // --- Transporte: TRANSPORTE (até abr/26) = UBER (corridas de app, inclui 99) + ONIBUS ---
  { tipo: "SAIDA", de: ["TRANSPORTE"], se: "CELULAR", para: "DESP MENSAL" },
  { tipo: "SAIDA", de: ["TRANSPORTE", "UBER", "ONIBUS"], se: ONIBUS, para: "ONIBUS" },
  { tipo: "SAIDA", de: ["TRANSPORTE"], se: "", para: "UBER" },

  // --- Contas do mês: DAS/MEI, Spotify, celular e boleto da torre = DESP MENSAL ---
  { tipo: "SAIDA", de: ["IMPOSTOS"], se: "DAS/MEI|DESP MENSAL", para: "DESP MENSAL" },
  { tipo: "SAIDA", de: ["DESPESAS", "DESP MENSAL"], se: "CONTA (DE )?TELEFONE", para: "CONTA CASA 108N" },
  { tipo: "SAIDA", de: ["DESPESAS"], se: "SPOTIFY|CELULAR|RECARGA|PAGU?E? FACIL|\\bTORRE\\b|DAS/MEI", para: "DESP MENSAL" },

  // --- Corte de cabelo: estava em DESPESAS, hoje vai em DIVERSOS ---
  { tipo: "SAIDA", de: ["DESPESAS"], se: "CABELO|CABELEIREIRO|STHIL", para: "DIVERSOS" },

  // --- Confraternização e presentes, que ficavam espalhados ---
  { tipo: "SAIDA", de: ["LAZER", "DIVERSOS", "DESPESAS"], se: "CONFRAT", para: "CONFRATERNIZAÇÃO" },
  { tipo: "SAIDA", de: ["DIVERSOS"], se: "PRESENTE|ANIVERS|CHA (DE )?FRAUDA", para: "PRESENTE" },

  // --- Lanche comprado para casa: estava em LANCHE ou COMPRAS CASA, hoje é CASA LANCHE ---
  { tipo: "SAIDA", de: ["LANCHE", "COMPRAS CASA", "COMPRAS CASA 108N"], se: LANCHE_PARA_CASA, para: "CASA LANCHE" },

  // --- Compras de casa: COMPRAS CASA foi renomeada para COMPRAS CASA 108N em out/26 ---
  { tipo: "SAIDA", de: ["COMPRAS CASA"], se: "", para: "COMPRAS CASA 108N" },

  // --- Imóvel (INVESTIMENTOS) × dinheiro guardado/aplicado (INVESTIMENTO) ---
  { tipo: "SAIDA", de: ["INVESTIMENTOS", "INVESTIMENTO"], se: IMOVEL, para: "INVESTIMENTOS" },
  { tipo: "SAIDA", de: ["INVESTIMENTOS", "INVESTIMENTO", "RENDA FIXA", "MOEDA VIRTUAL", "NUBANK CAIXINHA", "POUPANÇA"], se: "", para: "INVESTIMENTO" },

  { tipo: "SAIDA", de: ["EMPRESTAR VALOR"], se: "", para: "EMPRESTAR" },

  // --- Recebimentos ---
  // Resgates de aplicação estavam em 6 nomes diferentes; FGTS ficava em ADIANTAMENTO.
  { tipo: "ENTRADA", de: ["ADIANTAMENTO"], se: "FGTS", para: "RESGATES DE INVEST." },
  { tipo: "ENTRADA", de: ["INVESTIMENTO", "INVESTIMENTOS", "NUBANK CAIXINHA", "POUPANÇA", "MOEDA VIRTUAL"], se: "", para: "RESGATES DE INVEST." },
  // Devolução de empréstimo ficava em RESTORNO; hoje é DEVOLUÇÃO.
  { tipo: "ENTRADA", de: ["RESTORNO"], se: "EMPRESTIMO", para: "DEVOLUÇÃO" }
];

// Confere uma regra vinda da tela/banco e devolve-a limpa, ou null se não servir
// (sem origem, sem destino ou com expressão inválida).
export function limparRegra(regra) {
  const tipo = regra?.tipo === "ENTRADA" ? "ENTRADA" : "SAIDA";
  const de = [...new Set((Array.isArray(regra?.de) ? regra.de : []).map((c) => String(c ?? "").trim().toUpperCase()).filter(Boolean))];
  const para = String(regra?.para ?? "").trim().toUpperCase();
  const se = normalizarExpressao(regra?.se);
  if (!de.length || !para) return null;
  if (se) { try { new RegExp(se); } catch { return null; } }
  return { tipo, de, se, para };
}

function compilar(regras) {
  return regras.map(limparRegra).filter(Boolean).map((r) => ({ tipo: r.tipo, de: new Set(r.de), se: r.se ? new RegExp(r.se) : null, para: r.para }));
}

let regrasAtivas = compilar(REGRAS_PADRAO);

// Troca as regras em uso (chamado ao carregar as configurações do usuário).
export function definirRegrasDeFinalidade(regras) {
  regrasAtivas = compilar(Array.isArray(regras) ? regras : REGRAS_PADRAO);
}

// Categoria em que o lançamento entra na comparação entre anos.
export function finalidadeDe(t) {
  const categoria = t?.classificacao_saida ?? "";
  let texto = null;
  for (const regra of regrasAtivas) {
    if (regra.tipo !== t.tipo || !regra.de.has(categoria)) continue;
    if (regra.se) {
      texto ??= normalizar(`${t.descricao ?? ""} | ${t.saida ?? ""}`);
      if (!regra.se.test(texto)) continue;
    }
    return regra.para;
  }
  return categoria;
}
