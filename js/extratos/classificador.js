// extratos/classificador.js
// Sugere Descrição, Detalhe e Classificação para um movimento do extrato,
// APRENDENDO com os lançamentos que você já fez (nada de lista fixa de regras).
//
// Como funciona:
// 1. O texto do banco ("Uber UBER *TRIP HELP.U", "SUPERBIG SUPERMERCADO") é
//    comparado com os Detalhes que você já usou ("UBER", "SUPER BIG"),
//    sem espaços nem pontuação. Ganha o Detalhe mais parecido.
// 2. Entre os lançamentos com esse Detalhe, a Classificação é escolhida por
//    votos: lançamentos recentes, do mesmo banco e com VALOR PARECIDO pesam
//    mais (ex.: GIGANTE de R$ 300 → COMPRAS CASA; de R$ 20 → LANCHE).
// 3. Lançamentos que vieram de importação guardam o texto original do banco
//    (`texto_banco`). Quando o mesmo texto aparece de novo, a sugestão vem
//    direto do que você confirmou da última vez — é assim que ele "aprende"
//    com as suas correções.
import { normalizar, compactar, diasEntre } from "./comum.js";

export const DETALHE_CARTAO = "BRADESCO CREDITO";

const PALAVRAS_RUIDO = new Set([
  "COMPRA", "NO", "DEBITO", "VIA", "NUPAY", "PIX", "QR", "CODE", "DINAMICO", "ESTATICO",
  "LTDA", "SA", "S", "A", "ME", "EIRELI", "EPP", "DL", "PAG", "MP", "IFD", "EBN", "PG", "INSTITUICAO", "DE", "DA", "DO"
]);

// Texto "limpo" do banco, usado como chave de aprendizado e guardado no
// lançamento como `texto_banco`. Tira palavras genéricas e códigos com número
// (ex.: "DL*Spotify P478E" → "SPOTIFY", "ASSAI ATACADISTA LJ176" → "ASSAI ATACADISTA").
export function chaveTexto(texto) {
  const palavras = normalizar(texto).replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const limpas = palavras.filter((p, i) => !/\d/.test(p) && !PALAVRAS_RUIDO.has(p) && p !== palavras[i - 1]);
  return (limpas.length ? limpas : palavras).join(" ").slice(0, 120);
}

function ehVirada(doc) {
  return /VIRADA/.test(normalizar(doc.classificacao_saida)) || /^VIR_MES/.test(normalizar(doc.saida));
}

// Para compras no cartão, o Detalhe é sempre "BRADESCO CREDITO" e o lugar
// fica no começo da Descrição: "JBUFFET - ALMOÇO - 07/10".
function partesDescricaoCartao(descricao) {
  const partes = String(descricao ?? "").split(" - ").map((p) => p.trim());
  const semData = partes.filter((p) => !/^\d{2}\/\d{2}$/.test(p));
  const lugar = /^P\d+\/P\d+$/.test(semData[0] ?? "") ? semData[1] : semData[0];
  const meio = semData.filter((p) => p !== lugar && !/^P\d+\/P\d+$/.test(p)).join(" - ");
  return { lugar: lugar ?? "", meio };
}

function chaveCompacta(texto) {
  return compactar(chaveTexto(texto));
}

function primeiraPalavra(texto) {
  return chaveTexto(texto).split(" ")[0] ?? "";
}

function adicionar(mapa, chave, rotulo, doc) {
  if (!chave || chave.length < 3) return;
  if (!mapa.has(chave)) mapa.set(chave, { chave, rotulo, docs: [] });
  mapa.get(chave).docs.push(doc);
}

export function criarModeloClassificacao(base, { hoje }) {
  const porTextoBanco = new Map();
  const porDetalhe = new Map();
  const porDescricao = new Map();
  const classificacoes = new Map();

  base.forEach((doc) => {
    if (doc.tipo_mov !== "EXTERNO" || ehVirada(doc) || !doc.classificacao_saida) return;
    if (doc.data > hoje) return; // previsto ainda não é exemplo confiável
    classificacoes.set(doc.classificacao_saida, (classificacoes.get(doc.classificacao_saida) ?? 0) + 1);

    if (doc.texto_banco) adicionar(porTextoBanco, compactar(doc.texto_banco), doc.saida, doc);

    if (normalizar(doc.saida) === DETALHE_CARTAO) {
      const { lugar } = partesDescricaoCartao(doc.descricao);
      adicionar(porDetalhe, chaveCompacta(lugar), lugar, doc);
    } else if (doc.saida) {
      adicionar(porDetalhe, chaveCompacta(doc.saida), doc.saida, doc);
    }
    adicionar(porDescricao, chaveCompacta(String(doc.descricao).split(" - ")[0]), doc.descricao, doc);
  });

  return { porTextoBanco, porDetalhe, porDescricao, classificacoes, hoje };
}

function prefixoComum(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

// Quão bem o texto do banco (alvo) bate com um Detalhe já usado (chave).
// Ex.: "UBERTRIPHELPU" contém "UBER"; "ASSAIATACADISTA" e "ASSAIATACADO"
// começam igual; "JOAOSILVAC" e "JOAOSILVAPINTOR" têm o mesmo nome.
function pontuar(alvo, chave, palavraAlvo, palavraChave) {
  if (alvo === chave) return chave.length + 2;
  if (chave.length >= 4 && alvo.includes(chave)) return chave.length;
  if (chave.length === 3 && alvo.startsWith(chave)) return 3;
  if (alvo.length >= 4 && chave.includes(alvo)) return alvo.length;
  const comum = prefixoComum(alvo, chave);
  if (comum >= 6 && comum >= 0.6 * Math.min(alvo.length, chave.length)) return comum - 1;
  if (palavraAlvo.length >= 6 && palavraAlvo === palavraChave) return palavraAlvo.length - 1;
  return 0;
}

function melhoresChaves(mapa, alvo, tipo, peso = 1) {
  let melhor = 0;
  let escolhidas = [];
  const palavraAlvo = alvo.palavra;
  mapa.forEach((grupo) => {
    if (!grupo.docs.some((d) => d.tipo === tipo)) return;
    grupo.palavra ??= primeiraPalavra(grupo.rotulo).replace(/[^A-Z0-9]/g, "");
    const pontos = pontuar(alvo.compacto, grupo.chave, palavraAlvo, grupo.palavra) * peso;
    if (pontos > melhor) { melhor = pontos; escolhidas = [grupo]; }
    else if (pontos === melhor && pontos > 0) escolhidas.push(grupo);
  });
  return { pontos: melhor, grupos: escolhidas };
}

function pesoDoc(doc, movimento, hoje) {
  // Suas categorias mudam com o tempo (ex.: COMPRAS CASA → COMPRAS CASA 108N),
  // então o que foi lançado nos últimos meses pesa bem mais.
  const idade = Math.max(0, diasEntre(doc.data, hoje));
  const recencia = 0.15 + 3 * Math.exp(-idade / 75);
  const razao = Math.abs(Math.log(Math.max(doc.valor, 0.01) / Math.max(movimento.valor, 0.01)));
  const valorParecido = Math.exp(-1.5 * razao);
  const mesmoBanco = doc.banco === movimento.banco ? 1.5 : 1;
  return recencia * valorParecido * mesmoBanco;
}

function maisVotado(docs, chaveDe, pesoDe) {
  const votos = new Map();
  docs.forEach((d) => {
    const chave = chaveDe(d);
    if (!chave) return;
    votos.set(chave, (votos.get(chave) ?? 0) + pesoDe(d));
  });
  const ordenado = [...votos].sort((a, b) => b[1] - a[1]);
  const total = ordenado.reduce((s, [, v]) => s + v, 0);
  return { valor: ordenado[0]?.[0] ?? null, parcela: total ? ordenado[0][1] / total : 0 };
}

// Maiúsculas mantendo acentos (é como os lançamentos já estão gravados).
function maiusculas(texto) {
  return String(texto ?? "").toUpperCase().replace(/\s+/g, " ").trim();
}

function ddmm(iso) {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "";
}

// Devolve { descricao, saida, classificacao_saida, confianca, motivo }.
// confianca: "alta" | "media" | "baixa" | "nenhuma" (sem histórico parecido).
function procurar(modelo, texto, tipo) {
  const chave = chaveTexto(texto);
  const compacto = compactar(chave);
  if (!compacto) return { grupos: [], origem: "", pontos: 0 };
  const aprendido = modelo.porTextoBanco.get(compacto);
  if (aprendido && aprendido.docs.some((d) => d.tipo === tipo)) return { grupos: [aprendido], origem: "aprendido", pontos: 1000 };
  const alvo = { compacto, palavra: chave.split(" ")[0] ?? "" };
  const porDetalhe = melhoresChaves(modelo.porDetalhe, alvo, tipo);
  const porDescricao = melhoresChaves(modelo.porDescricao, alvo, tipo, 0.8);
  const vencedor = porDetalhe.pontos >= porDescricao.pontos ? porDetalhe : porDescricao;
  return vencedor.pontos >= 3 ? { grupos: vencedor.grupos, origem: "parecido", pontos: vencedor.pontos } : { grupos: [], origem: "", pontos: 0 };
}

export function sugerirClassificacao(modelo, movimento) {
  const ehCartao = Boolean(movimento.extra?.cartaoCredito);
  const textoBase = movimento.contraparte || movimento.historico;
  const chave = chaveTexto(textoBase);

  let busca = procurar(modelo, textoBase, movimento.tipo);
  // Sem achar pela contraparte, tenta pelo histórico ("Dep dinheiro ATM"), menos
  // no cartão — lá o histórico é sempre o mesmo e só confundiria.
  if (!busca.grupos.length && !ehCartao && movimento.contraparte && movimento.historico) {
    busca = procurar(modelo, movimento.historico, movimento.tipo);
  }
  const { grupos, origem } = busca;

  const docs = grupos.flatMap((g) => g.docs).filter((d) => d.tipo === movimento.tipo);
  const textoLimpo = maiusculas(textoBase).slice(0, 120);
  if (!docs.length) {
    return {
      descricao: ehCartao ? `${textoLimpo} - ${ddmm(movimento.dataOriginal)}` : textoLimpo,
      saida: ehCartao ? DETALHE_CARTAO : textoLimpo,
      classificacao_saida: "",
      confianca: "nenhuma",
      motivo: "Nenhum lançamento parecido no histórico.",
      textoBanco: chave
    };
  }

  const peso = (d) => pesoDoc(d, movimento, modelo.hoje);
  const classificacao = maisVotado(docs, (d) => d.classificacao_saida, peso);
  const daClasse = docs.filter((d) => d.classificacao_saida === classificacao.valor);
  const rotuloGrupo = grupos[0].rotulo;

  let descricao;
  let saida;
  if (ehCartao) {
    const docsCartao = daClasse.filter((d) => normalizar(d.saida) === DETALHE_CARTAO);
    const lugar = maisVotado(docsCartao, (d) => partesDescricaoCartao(d.descricao).lugar, peso).valor
      ?? maiusculas(rotuloGrupo).split(" - ")[0];
    const meio = maisVotado(docsCartao, (d) => partesDescricaoCartao(d.descricao).meio, peso).valor;
    descricao = [lugar, meio, ddmm(movimento.dataOriginal)].filter(Boolean).join(" - ");
    saida = DETALHE_CARTAO;
  } else {
    descricao = maisVotado(daClasse, (d) => d.descricao, peso).valor;
    saida = maisVotado(daClasse, (d) => d.saida, peso).valor ?? textoLimpo;
  }

  const n = docs.length;
  // Poucos exemplos = pouca certeza, mesmo com 100% dos votos.
  let confianca = "baixa";
  if (classificacao.parcela >= 0.75 && (n >= 3 || origem === "aprendido")) confianca = "alta";
  else if (classificacao.parcela >= 0.5 && (n >= 2 || origem === "aprendido")) confianca = "media";

  const percentual = Math.round(classificacao.parcela * 100);
  const motivo = origem === "aprendido"
    ? `Mesmo texto do banco já importado antes (${n}x) → ${classificacao.valor}.`
    : `Parecido com "${rotuloGrupo}" (${n} lançamento${n > 1 ? "s" : ""}); ${percentual}% dos votos em ${classificacao.valor}.`;

  return {
    descricao: maiusculas(descricao).slice(0, 120),
    saida: maiusculas(saida).slice(0, 120),
    classificacao_saida: classificacao.valor,
    confianca,
    motivo,
    textoBanco: chave
  };
}
