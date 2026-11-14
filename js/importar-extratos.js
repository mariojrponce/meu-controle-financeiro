// importar-extratos.js
// Tela "Importar → Extratos do banco": lê os arquivos, mostra a conferência
// de cada um, a revisão linha a linha e grava só o que você confirmar.
// A lógica (leitura, classificação, conciliação) fica em js/extratos/ — aqui
// é só a tela.
import { exigirLogin } from "./auth-guard.js";
import { mostrarToast, confirmarAcao } from "./ui.js";
import { formatarReais, isoParaBR, hojeISO } from "./utils.js";
import { obterTransacoes, gravarImportacaoExtratos, desfazerImportacaoExtratos, excluirTransacaoPorId } from "./dados-carteira.js";
import { lerArquivoExtrato, EXTENSOES_ACEITAS } from "./extratos/ler-arquivo.js";
import { prepararImportacao, conferirSaldos, montarGravacao, problemasDaLinha, STATUS, ACAO } from "./extratos/conciliacao.js";

const usuario = await exigirLogin(); // a navegação já é montada pelo importar.js
const CHAVE_TITULAR = `pref_importacao_titular_${usuario.uid}`;

const inputExtratos = document.getElementById("input-extratos");
const zona = document.getElementById("zona-extratos");
const campoTitular = document.getElementById("titular-nomes");
const areaArquivos = document.getElementById("area-arquivos");
const areaSaldos = document.getElementById("area-saldos");
const areaRevisao = document.getElementById("area-revisao");
const areaFaltantes = document.getElementById("area-faltantes");
const areaUltima = document.getElementById("area-ultima-importacao");

const estado = {
  arquivos: [],          // [{ nome, extrato } | { nome, erro }]
  base: [],
  resultado: null,
  filtro: "gravar",
  edicoes: new Map(),    // idExterno → { acao, sugestao } (o que você mudou na revisão)
  ultimaImportacao: null
};

// ---------------------------------------------------------------- titular

function lerTitularSalvo() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_TITULAR)) ?? { nomes: [], cpfs: [] };
  } catch {
    return { nomes: [], cpfs: [] };
  }
}

function salvarTitular(titular) {
  try { localStorage.setItem(CHAVE_TITULAR, JSON.stringify(titular)); } catch { /* só conveniência */ }
}

function titularDoCampo() {
  const salvo = lerTitularSalvo();
  const nomes = campoTitular.value.split("\n").map((n) => n.trim().toUpperCase()).filter(Boolean);
  return { nomes, cpfs: salvo.cpfs ?? [] };
}

campoTitular.value = (lerTitularSalvo().nomes ?? []).join("\n");
campoTitular.addEventListener("change", () => {
  salvarTitular(titularDoCampo());
  if (estado.arquivos.length) reprocessar();
});

// ---------------------------------------------------------------- leitura dos arquivos

function avisarLeitura(texto) {
  areaArquivos.innerHTML = "";
  areaArquivos.appendChild(el("p", { classe: "vazio", texto }));
}

async function adicionarArquivos(lista) {
  if (!lista.length) return;
  areaArquivos.innerHTML = "<p class='vazio'>Lendo arquivos...</p>";
  for (const arquivo of lista) {
    let lido;
    try {
      lido = await lerArquivoExtrato(arquivo, { aoProgredir: avisarLeitura });
    } catch (erro) {
      console.error("Erro ao ler", arquivo.name, erro);
      lido = { erro: "Não consegui abrir este arquivo (está corrompido ou protegido por senha?)." };
    }
    // subir o mesmo arquivo de novo substitui o anterior
    estado.arquivos = estado.arquivos.filter((a) => a.nome !== arquivo.name);
    estado.arquivos.push({ nome: arquivo.name, ...lido });
  }
  try {
    estado.base = await obterTransacoes(usuario);
  } catch (erro) {
    console.error("Erro ao carregar lançamentos:", erro);
    mostrarToast("Não consegui carregar seus lançamentos para comparar. Tente de novo.", "erro");
    return;
  }
  reprocessar();
}

inputExtratos.addEventListener("change", async (evento) => {
  await adicionarArquivos([...evento.target.files]);
  inputExtratos.value = "";
});
zona.addEventListener("dragover", (e) => { e.preventDefault(); zona.classList.add("arrastando"); });
zona.addEventListener("dragleave", () => zona.classList.remove("arrastando"));
zona.addEventListener("drop", (e) => {
  e.preventDefault();
  zona.classList.remove("arrastando");
  adicionarArquivos([...e.dataTransfer.files].filter((f) => EXTENSOES_ACEITAS.test(f.name)));
});

// Roda a conciliação de novo (arquivo novo, titular mudou) mantendo o que você já editou.
function reprocessar() {
  const extratos = estado.arquivos.filter((a) => a.extrato).map((a) => a.extrato);
  const titularSalvo = titularDoCampo();
  estado.resultado = prepararImportacao({ extratos, base: estado.base, titularSalvo, hoje: hojeISO() });

  // lembra o nome/CPF reconhecidos para a próxima vez (ex.: subir só o CSV do Nubank)
  salvarTitular(estado.resultado.titular);
  campoTitular.value = estado.resultado.titular.nomes.join("\n");

  estado.resultado.linhas.forEach((linha) => {
    const editada = estado.edicoes.get(linha.movimento.idExterno);
    if (editada) Object.assign(linha, { acao: editada.acao, sugestao: editada.sugestao });
  });
  renderizarTudo();
}

function registrarEdicao(linha) {
  estado.edicoes.set(linha.movimento.idExterno, { acao: linha.acao, sugestao: linha.sugestao });
}

// ---------------------------------------------------------------- utilidades de tela

function el(tag, { classe, texto, titulo } = {}, filhos = []) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  if (titulo) elemento.title = titulo;
  filhos.forEach((f) => f && elemento.appendChild(f));
  return elemento;
}

function periodoTexto(periodo) {
  if (!periodo) return "";
  return periodo.inicio === periodo.fim ? isoParaBR(periodo.inicio) : `${isoParaBR(periodo.inicio)} a ${isoParaBR(periodo.fim)}`;
}

const ROTULO_CONFIANCA = { alta: "Confiança alta", media: "Confiança média", baixa: "Confiança baixa", nenhuma: "Sem sugestão", manual: "Editado por você" };

// ---------------------------------------------------------------- arquivos

function renderizarArquivos() {
  areaArquivos.innerHTML = "";
  if (!estado.arquivos.length) return;
  const lista = el("div", { classe: "lista-arquivos" });

  estado.arquivos.forEach((arquivo) => {
    const caixa = el("div", { classe: `arquivo-lido${arquivo.erro ? " com-erro" : ""}` });
    const topo = el("div", { classe: "arquivo-lido-topo" });
    const itens = el("ul");

    if (arquivo.erro) {
      topo.appendChild(el("span", { texto: "⚠️ Não lido" }));
      itens.appendChild(el("li", { texto: arquivo.erro }));
    } else {
      const e = arquivo.extrato;
      const conferenciasOk = e.conferencias.every((c) => c.ok);
      topo.appendChild(el("span", { texto: `${conferenciasOk ? "✅" : "❌"} ${e.rotulo}` }));
      topo.appendChild(el("span", { texto: `${e.movimentos.length} movimento(s) · ${periodoTexto(e.periodo)}` }));
      e.conferencias.forEach((c) => {
        const detalhe = c.texto ?? `banco ${formatarReais(c.esperado)} · lido ${formatarReais(c.obtido)}`;
        itens.appendChild(el("li", {}, [
          el("span", { classe: c.ok ? "ok-texto" : "erro-texto", texto: c.ok ? "confere " : "NÃO confere " }),
          document.createTextNode(`— ${c.rotulo}: ${detalhe}`)
        ]));
      });
      if (!conferenciasOk) itens.appendChild(el("li", { classe: "erro-texto", texto: "A leitura deste arquivo não fechou com os totais do banco. Confira as linhas dele com atenção antes de gravar." }));
      e.avisos.forEach((a) => itens.appendChild(el("li", { texto: a })));
    }

    const remover = el("button", { classe: "botao botao-secundario botao-pequeno", texto: "Remover" });
    remover.addEventListener("click", () => {
      estado.arquivos = estado.arquivos.filter((a) => a !== arquivo);
      if (estado.arquivos.length) reprocessar();
      else limparTudo();
    });
    topo.appendChild(remover);

    caixa.appendChild(topo);
    caixa.appendChild(el("div", { classe: "arquivo-lido-nome", texto: arquivo.nome }));
    caixa.appendChild(itens);
    lista.appendChild(caixa);
  });
  areaArquivos.appendChild(el("h3", { texto: "Arquivos lidos", classe: "secao-titulo" }));
  areaArquivos.appendChild(lista);
}

// ---------------------------------------------------------------- saldos

function renderizarSaldos() {
  areaSaldos.innerHTML = "";
  const saldos = conferirSaldos(estado.resultado, estado.base);
  if (!saldos.length) return;
  const grade = el("div", { classe: "saldos-conferencia" });
  saldos.forEach((s) => {
    const caixa = el("div", { classe: `saldo-banco ${s.ok ? "ok" : "diferente"}` });
    caixa.appendChild(el("b", { texto: `${s.ok ? "✅" : "⚠️"} ${s.banco} em ${isoParaBR(s.data)}` }));
    caixa.appendChild(el("div", { texto: `No banco: ${formatarReais(s.saldoBanco)}` }));
    caixa.appendChild(el("div", { texto: `No sistema depois de gravar: ${formatarReais(s.saldoDepois)}` }));
    if (s.semAbertura) {
      caixa.appendChild(el("div", { classe: "dica-campo", texto: "Sem virada de mês neste mês para esse banco — faça a virada para conferir o saldo." }));
    } else if (!s.ok) {
      caixa.appendChild(el("div", { classe: "erro-texto", texto: `Diferença: ${formatarReais(s.saldoBanco - s.saldoDepois)}. Veja os lançamentos "no sistema, mas não no extrato" abaixo.` }));
    }
    grade.appendChild(caixa);
  });
  areaSaldos.appendChild(el("h3", { texto: "Saldo: banco × sistema", classe: "secao-titulo" }));
  areaSaldos.appendChild(el("p", { classe: "dica-campo", texto: "Conta do mesmo jeito que o Dashboard: virada do dia 01 + lançamentos do mês até a data do extrato. Previstos só entram se o extrato confirmou." }));
  areaSaldos.appendChild(grade);
}

// ---------------------------------------------------------------- revisão

function precisaAtencao(linha) {
  if (linha.status === STATUS.DIVERGENTE) return true;
  if (linha.acao !== ACAO.LANCAR) return false;
  return problemasDaLinha(linha).length > 0 || !["alta", "manual"].includes(linha.sugestao.confianca);
}

const FILTROS = [
  { id: "gravar", rotulo: "A gravar", testa: (l) => l.acao !== ACAO.NADA || l.status === STATUS.NOVO || l.status === STATUS.DIVERGENTE },
  { id: "atencao", rotulo: "Precisam de atenção", testa: precisaAtencao, classe: "pilula-aviso" },
  { id: "ja", rotulo: "Já lançados", testa: (l) => l.status === STATUS.JA_LANCADO, classe: "pilula-ok" },
  { id: "ignorados", rotulo: "Ignorados", testa: (l) => l.status === STATUS.IGNORADO, classe: "pilula-info" },
  { id: "todos", rotulo: "Todos", testa: () => true }
];

function opcoesDeAcao(linha) {
  if (linha.status === STATUS.DIVERGENTE) return [[ACAO.CORRIGIR, "Corrigir no sistema"], [ACAO.LANCAR, "Lançar como novo"], [ACAO.NADA, "Não mexer"]];
  if (linha.status === STATUS.JA_LANCADO) return [[ACAO.NADA, "Já lançado"], [ACAO.LANCAR, "Lançar mesmo assim"]];
  if (linha.status === STATUS.IGNORADO) return [[ACAO.NADA, "Ignorado"], [ACAO.LANCAR, "Lançar mesmo assim"]];
  return [[ACAO.LANCAR, "Lançar"], [ACAO.NADA, "Não lançar"]];
}

function campoTexto(linha, campo, maximo, lista) {
  const input = el("input");
  input.type = "text";
  input.maxLength = maximo;
  input.value = linha.sugestao?.[campo] ?? "";
  if (lista) input.setAttribute("list", lista);
  input.addEventListener("change", () => {
    linha.sugestao = { ...linha.sugestao, [campo]: input.value.trim().toUpperCase(), confianca: "manual" };
    registrarEdicao(linha);
    renderizarRevisao();
  });
  return input;
}

function celulaSituacao(linha) {
  const td = el("td", { classe: "situacao" });
  const confianca = linha.sugestao?.confianca;
  const rotulos = { NOVO: "Novo", JA_LANCADO: "Já lançado", DIVERGENTE: "Diferente do sistema", IGNORADO: "Ignorado" };
  const topo = el("div");
  if (linha.acao === ACAO.LANCAR && confianca) topo.appendChild(el("span", { classe: `confianca confianca-${confianca}`, titulo: ROTULO_CONFIANCA[confianca] }));
  topo.appendChild(el("b", { texto: rotulos[linha.status] }));
  td.appendChild(topo);
  const problemas = problemasDaLinha(linha);
  if (problemas.length) td.appendChild(el("span", { classe: "motivo erro-texto", texto: problemas.join(" · ") }));
  const motivo = linha.motivoStatus || (linha.acao === ACAO.LANCAR ? linha.sugestao?.motivo : "");
  if (motivo) td.appendChild(el("span", { classe: "motivo", texto: motivo }));
  if (linha.correspondente && linha.status !== STATUS.NOVO) {
    const d = linha.correspondente;
    td.appendChild(el("span", { classe: "motivo", texto: `No sistema: ${d.descricao} · ${d.classificacao_saida}` }));
  }
  return td;
}

function linhaDaTabela(linha) {
  const m = linha.movimento;
  // Cor da linha (guia de identidade): pronta = verde, precisa de atenção = laranja, erro = vermelho.
  const temProblema = problemasDaLinha(linha).length > 0;
  const classeLinha = linha.acao === ACAO.NADA ? "linha-inativa"
    : temProblema ? "linha-problema"
    : precisaAtencao(linha) ? "linha-atencao"
    : "linha-pronta";
  const tr = el("tr", { classe: classeLinha });

  const select = el("select", { classe: "acao-linha" });
  opcoesDeAcao(linha).forEach(([valor, rotulo]) => {
    const opcao = el("option", { texto: rotulo });
    opcao.value = valor;
    select.appendChild(opcao);
  });
  select.value = linha.acao;
  select.addEventListener("change", () => {
    linha.acao = select.value;
    if (linha.acao === ACAO.LANCAR && !linha.sugestao) {
      linha.sugestao = { descricao: (m.contraparte || m.historico).toUpperCase(), saida: "", classificacao_saida: "", tipo_mov: "EXTERNO", confianca: "manual" };
    }
    registrarEdicao(linha);
    renderizarSaldos();
    renderizarRevisao();
  });
  tr.appendChild(el("td", {}, [select]));
  tr.appendChild(celulaSituacao(linha));

  const tdData = el("td", { texto: isoParaBR(m.data) });
  tdData.appendChild(el("span", { classe: "motivo", texto: m.banco }));
  if (m.dataOriginal) tdData.appendChild(el("span", { classe: "motivo", texto: `compra ${isoParaBR(m.dataOriginal)}${m.parcela ? ` · parcela ${m.parcela}` : ""}` }));
  tr.appendChild(tdData);
  tr.appendChild(el("td", { classe: "texto-banco" }, [
    document.createTextNode(m.contraparte || m.historico),
    m.contraparte ? el("small", { texto: m.historico }) : null
  ]));
  const sinal = m.tipo === "SAIDA" ? "-" : "+";
  tr.appendChild(el("td", { classe: m.tipo === "SAIDA" ? "saida" : "entrada", texto: `${sinal} ${formatarReais(m.valor)}` }));

  if (linha.acao === ACAO.LANCAR) {
    tr.appendChild(el("td", {}, [campoTexto(linha, "descricao", 120)]));
    tr.appendChild(el("td", {}, [campoTexto(linha, "saida", 120)]));
    tr.appendChild(el("td", {}, [campoTexto(linha, "classificacao_saida", 60, "lista-classificacoes")]));
    const mov = el("select", { classe: "mov-linha" });
    ["EXTERNO", "INTERNO"].forEach((v) => { const o = el("option", { texto: v === "EXTERNO" ? "Externo" : "Interno" }); o.value = v; mov.appendChild(o); });
    mov.value = linha.sugestao.tipo_mov;
    mov.addEventListener("change", () => {
      linha.sugestao = { ...linha.sugestao, tipo_mov: mov.value, confianca: "manual" };
      registrarEdicao(linha);
      renderizarRevisao();
    });
    tr.appendChild(el("td", {}, [mov]));
  } else {
    const d = linha.correspondente;
    tr.appendChild(el("td", { texto: d?.descricao ?? "—" }));
    tr.appendChild(el("td", { texto: d?.saida ?? "—" }));
    tr.appendChild(el("td", { texto: d?.classificacao_saida ?? "—" }));
    tr.appendChild(el("td", { texto: d ? (d.tipo_mov === "INTERNO" ? "Interno" : "Externo") : "—" }));
  }
  return tr;
}

function renderizarRevisao() {
  areaRevisao.innerHTML = "";
  const resultado = estado.resultado;
  if (!resultado || !resultado.linhas.length) return;
  const linhas = resultado.linhas;

  areaRevisao.appendChild(el("h3", { texto: "Revisão linha a linha", classe: "secao-titulo" }));
  areaRevisao.appendChild(el("p", {
    classe: "dica-campo",
    texto: "Bolinha verde = sugestão com confiança alta; amarela/vermelha = confira. Ao mudar a classificação, o sistema aprende: na próxima importação, o mesmo texto do banco já vem com a sua escolha."
  }));

  const pilulas = el("div", { classe: "resumo-linhas" });
  FILTROS.forEach((f) => {
    const quantidade = linhas.filter(f.testa).length;
    const botao = el("button", { classe: `pilula ${f.classe ?? ""} ${estado.filtro === f.id ? "ativa" : ""}`, texto: `${f.rotulo} (${quantidade})` });
    botao.type = "button";
    botao.addEventListener("click", () => { estado.filtro = f.id; renderizarRevisao(); });
    pilulas.appendChild(botao);
  });
  areaRevisao.appendChild(pilulas);

  const datalist = el("datalist");
  datalist.id = "lista-classificacoes";
  resultado.classificacoesConhecidas.forEach((c) => { const o = el("option"); o.value = c; datalist.appendChild(o); });
  areaRevisao.appendChild(datalist);

  const filtro = FILTROS.find((f) => f.id === estado.filtro) ?? FILTROS[0];
  const visiveis = linhas.filter(filtro.testa);
  const wrapper = el("div", { classe: "tabela-scroll" });
  const tabela = el("table");
  tabela.id = "tabela-revisao";
  const thead = el("thead");
  const cabecalho = el("tr");
  ["Ação", "Situação", "Data", "No extrato", "Valor", "Descrição", "Detalhe", "Classificação", "Mov."].forEach((t) => {
    const th = el("th", { texto: t });
    if (t === "Valor") th.className = "col-valor";
    cabecalho.appendChild(th);
  });
  thead.appendChild(cabecalho);
  tabela.appendChild(thead);
  const tbody = el("tbody");
  if (!visiveis.length) {
    const td = el("td", { classe: "vazio", texto: "Nada aqui." });
    td.colSpan = 9;
    tbody.appendChild(el("tr", {}, [td]));
  }
  visiveis
    .slice()
    .sort((a, b) => a.movimento.banco.localeCompare(b.movimento.banco) || a.movimento.data.localeCompare(b.movimento.data))
    .forEach((linha) => tbody.appendChild(linhaDaTabela(linha)));
  tabela.appendChild(tbody);
  wrapper.appendChild(tabela);
  areaRevisao.appendChild(wrapper);

  // ---- barra de gravar
  const aLancar = linhas.filter((l) => l.acao === ACAO.LANCAR);
  const aCorrigir = linhas.filter((l) => l.acao === ACAO.CORRIGIR);
  const comProblema = linhas.filter((l) => problemasDaLinha(l).length);
  const barra = el("div", { classe: "barra-gravar" });
  const botao = el("button", { classe: "botao botao-primario", texto: `Gravar ${aLancar.length} lançamento(s)${aCorrigir.length ? ` e ${aCorrigir.length} correção(ões)` : ""}` });
  botao.disabled = (!aLancar.length && !aCorrigir.length) || comProblema.length > 0;
  botao.addEventListener("click", () => gravar(botao));
  barra.appendChild(botao);
  if (comProblema.length) {
    barra.appendChild(el("span", { classe: "erro-texto", texto: `${comProblema.length} linha(s) sem classificação/descrição — complete ou marque "Não lançar".` }));
  }
  const limpar = el("button", { classe: "botao botao-secundario", texto: "Limpar tudo" });
  limpar.addEventListener("click", limparTudo);
  barra.appendChild(limpar);
  areaRevisao.appendChild(barra);
}

// ---------------------------------------------------------------- faltantes

function renderizarFaltantes() {
  areaFaltantes.innerHTML = "";
  const faltantes = estado.resultado?.faltantes ?? [];
  if (!faltantes.length) return;
  const caixa = el("div", { classe: "faltantes" });
  caixa.appendChild(el("h3", { classe: "secao-titulo", texto: `No sistema, mas não no extrato (${faltantes.length})` }));
  caixa.appendChild(el("p", {
    classe: "dica-campo",
    texto: "Lançamentos do sistema, no mesmo banco e período dos extratos, que o banco não mostra. Pode ser lançamento no banco errado, duplicado, ou algo que o extrato não traz (ex.: rendimento do Nubank, que só sai no PDF). Nada aqui é apagado sozinho."
  }));
  const wrapper = el("div", { classe: "tabela-scroll" });
  const tabela = el("table");
  const thead = el("thead", {}, [el("tr", {}, ["Data", "Banco", "Descrição", "Detalhe", "Classificação", "Valor", ""].map((t) => el("th", { texto: t })))]);
  const tbody = el("tbody");
  faltantes.forEach(({ doc }) => {
    const excluir = el("button", { classe: "botao-icone-perigo", texto: "🗑", titulo: "Excluir este lançamento do sistema" });
    excluir.addEventListener("click", async () => {
      const ok = await confirmarAcao({ titulo: "Excluir lançamento?", mensagem: `Apagar "${doc.descricao}" de ${formatarReais(doc.valor)} em ${isoParaBR(doc.data)} (${doc.banco})? Não dá para desfazer.` });
      if (!ok) return;
      try {
        await excluirTransacaoPorId(usuario, doc.id);
        estado.base = estado.base.filter((d) => d.id !== doc.id);
        mostrarToast("Lançamento excluído.", "sucesso");
        reprocessar();
      } catch (erro) {
        console.error(erro);
        mostrarToast("Erro ao excluir. Tente de novo.", "erro");
      }
    });
    tbody.appendChild(el("tr", {}, [
      el("td", { texto: isoParaBR(doc.data) }),
      el("td", { texto: doc.banco }),
      el("td", { texto: doc.descricao }),
      el("td", { texto: doc.saida }),
      el("td", { texto: doc.classificacao_saida }),
      el("td", { classe: doc.tipo === "SAIDA" ? "saida" : "entrada", texto: `${doc.tipo === "SAIDA" ? "-" : "+"} ${formatarReais(doc.valor)}` }),
      el("td", {}, [excluir])
    ]));
  });
  tabela.appendChild(thead);
  tabela.appendChild(tbody);
  wrapper.appendChild(tabela);
  caixa.appendChild(wrapper);
  areaFaltantes.appendChild(caixa);
}

// ---------------------------------------------------------------- gravar / desfazer

function novoIdImportacao() {
  const agora = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `IMP-${agora.getFullYear()}${p(agora.getMonth() + 1)}${p(agora.getDate())}-${p(agora.getHours())}${p(agora.getMinutes())}${p(agora.getSeconds())}`;
}

async function gravar(botao) {
  const importacaoId = novoIdImportacao();
  const gravacao = montarGravacao(estado.resultado.linhas, importacaoId);
  const confirmou = await confirmarAcao({
    titulo: "Gravar importação?",
    mensagem: `Vou criar ${gravacao.criar.length} lançamento(s)${gravacao.corrigir.length ? ` e corrigir ${gravacao.corrigir.length}` : ""}. Depois dá para desfazer pelo botão que aparece aqui.`,
    textoConfirmar: "Gravar",
    textoCancelar: "Voltar"
  });
  if (!confirmou) return;

  botao.disabled = true;
  botao.textContent = "Gravando...";
  try {
    const idsCriados = await gravarImportacaoExtratos(usuario, gravacao, (feitas, total) => {
      botao.textContent = `Gravando... ${feitas}/${total}`;
    });
    estado.ultimaImportacao = { importacaoId, idsCriados, corrigidos: gravacao.corrigir };
    mostrarToast(`${gravacao.criar.length} lançamento(s) gravado(s)!`, "sucesso");
    limparTudo({ manterUltima: true });
  } catch (erro) {
    console.error("Erro ao gravar importação:", erro);
    mostrarToast("Erro ao gravar. Nada deste lote foi salvo — tente de novo.", "erro");
    botao.disabled = false;
    renderizarRevisao();
  }
}

function renderizarUltimaImportacao() {
  areaUltima.innerHTML = "";
  const ultima = estado.ultimaImportacao;
  if (!ultima) return;
  const caixa = el("div", { classe: "ultima-importacao" });
  caixa.appendChild(el("span", { texto: `✓ Importação ${ultima.importacaoId} gravada: ${ultima.idsCriados.length} lançamento(s) novo(s)${ultima.corrigidos.length ? `, ${ultima.corrigidos.length} corrigido(s)` : ""}.` }));
  const desfazer = el("button", { classe: "botao botao-secundario botao-pequeno", texto: "Desfazer esta importação" });
  desfazer.addEventListener("click", async () => {
    const ok = await confirmarAcao({
      titulo: "Desfazer importação?",
      mensagem: `Apaga os ${ultima.idsCriados.length} lançamento(s) criados e volta os valores corrigidos.`,
      textoConfirmar: "Desfazer",
      textoCancelar: "Cancelar"
    });
    if (!ok) return;
    desfazer.disabled = true;
    try {
      await desfazerImportacaoExtratos(usuario, ultima);
      estado.ultimaImportacao = null;
      mostrarToast("Importação desfeita.", "sucesso");
      renderizarUltimaImportacao();
    } catch (erro) {
      console.error(erro);
      mostrarToast("Erro ao desfazer. Tente de novo.", "erro");
      desfazer.disabled = false;
    }
  });
  caixa.appendChild(desfazer);
  areaUltima.appendChild(caixa);
}

function limparTudo({ manterUltima = false } = {}) {
  estado.arquivos = [];
  estado.resultado = null;
  estado.edicoes.clear();
  estado.filtro = "gravar";
  if (!manterUltima) estado.ultimaImportacao = null;
  renderizarTudo();
}

// Etapas no topo: 1 selecionar → 2 revisar → 3 conferir e gravar.
function marcarEtapas() {
  const etapas = document.querySelectorAll("#etapas-importacao li[data-etapa]");
  const gravou = !estado.resultado && estado.ultimaImportacao;
  const atual = gravou ? 4 : estado.resultado ? 2 : 1;
  etapas.forEach((li) => {
    const n = Number(li.dataset.etapa);
    li.classList.toggle("etapa-feita", n < atual);
    li.classList.toggle("etapa-atual", n === atual || (atual === 2 && n === 3));
    if (n === atual) li.setAttribute("aria-current", "step");
    else li.removeAttribute("aria-current");
  });
}

function renderizarTudo() {
  marcarEtapas();
  renderizarArquivos();
  if (estado.resultado) {
    renderizarSaldos();
    renderizarRevisao();
    renderizarFaltantes();
  } else {
    areaSaldos.innerHTML = "";
    areaRevisao.innerHTML = "";
    areaFaltantes.innerHTML = "";
  }
  renderizarUltimaImportacao();
}
