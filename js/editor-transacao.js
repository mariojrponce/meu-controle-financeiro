// editor-transacao.js
// Modal de edição de um lançamento já salvo — usado tanto no Extrato quanto
// na tela de Lançar (lista de últimos lançamentos).
import { ligarCampoDataInteligente, normalizarDataDigitada, brParaISO, isoParaBR } from "./utils.js";
import { criarComboboxTexto } from "./combobox.js";
import { mostrarToast, ligarFechamentoPorFundo } from "./ui.js";
import { normalizarNomeBanco } from "./dados-comuns.js";

// Retorna uma Promise: resolve com os dados editados, ou null se cancelado.
// O mesmo formulário também é usado para CRIAR um lançamento novo (ex: botão
// "+" do Extrato): basta passar um objeto parcial em `transacao` (com os
// campos já conhecidos) e personalizar `titulo`/`textoSalvar`.
export function abrirEditorTransacao(transacao, { bancosSugeridos = [], classificacoesSugeridas = [], investimentosSugeridos = [], titulo = "Editar lançamento", textoSalvar = "Salvar alterações", mostrarDono = false, mostrarInvestimento = false } = {}) {
  return new Promise((resolve) => {
    const fundo = document.createElement("div");
    fundo.className = "modal-fundo";

    const caixa = document.createElement("div");
    caixa.className = "modal-caixa modal-caixa-editor";
    caixa.innerHTML = `
      <h3>${titulo}</h3>
      <form id="form-editor-transacao">
        <label>Valor (R$)</label>
        <input type="number" id="editor-valor" step="0.01" min="0.01" required>

        <label>Data</label>
        <input type="text" id="editor-data" required placeholder="dd/mm/aaaa">

        <label>Descrição</label>
        <input type="text" id="editor-descricao" required maxlength="120">

        <label>Detalhe (onde gastou / de onde recebeu)</label>
        <input type="text" id="editor-saida" maxlength="120">

        <label>Banco</label>
        <input type="text" id="editor-banco" required maxlength="60">

        ${mostrarInvestimento ? `
        <label>Investimento</label>
        <input type="text" id="editor-investimento" maxlength="60" placeholder="Ex: CDB Bradesco...">
        ` : ""}

        ${mostrarDono ? `
        <label>Dono da carteira</label>
        <input type="text" id="editor-dono" maxlength="60" placeholder="Ex: Eu, Mayara...">
        ` : ""}

        <label>Tipo</label>
        <select id="editor-tipo">
          <option value="SAIDA">Saída</option>
          <option value="ENTRADA">Entrada</option>
        </select>

        <label>Movimentação</label>
        <select id="editor-tipo-mov">
          <option value="EXTERNO">Externo (Gasto/Receita real)</option>
          <option value="INTERNO">Interno (Transferência)</option>
        </select>

        <label>Classificação</label>
        <input type="text" id="editor-classificacao" required maxlength="60">

        <div class="modal-acoes" style="margin-top:20px;">
          <button type="button" id="editor-cancelar" class="botao botao-secundario">Cancelar</button>
          <button type="submit" class="botao botao-primario" style="margin:0;">${textoSalvar}</button>
        </div>
      </form>
    `;
    fundo.appendChild(caixa);
    document.body.appendChild(fundo);
    requestAnimationFrame(() => fundo.classList.add("aberto"));

    const campoValor = caixa.querySelector("#editor-valor");
    const campoData = caixa.querySelector("#editor-data");
    const campoDescricao = caixa.querySelector("#editor-descricao");
    const campoSaida = caixa.querySelector("#editor-saida");
    const campoBanco = caixa.querySelector("#editor-banco");
    const campoInvestimento = caixa.querySelector("#editor-investimento");
    const campoDono = caixa.querySelector("#editor-dono");
    const campoTipo = caixa.querySelector("#editor-tipo");
    const campoTipoMov = caixa.querySelector("#editor-tipo-mov");
    const campoClassificacao = caixa.querySelector("#editor-classificacao");

    campoValor.value = transacao.valor ?? "";
    campoData.value = isoParaBR(transacao.data);
    campoDescricao.value = transacao.descricao ?? "";
    campoSaida.value = transacao.saida ?? "";
    campoBanco.value = transacao.banco ?? "";
    if (campoInvestimento) campoInvestimento.value = transacao.investimento ?? "";
    if (campoDono) campoDono.value = transacao.dono_carteira ?? "";
    campoTipo.value = transacao.tipo ?? "SAIDA";
    campoTipoMov.value = transacao.tipo_mov ?? "EXTERNO";
    campoClassificacao.value = transacao.classificacao_saida ?? "";

    ligarCampoDataInteligente(campoData);
    criarComboboxTexto(campoBanco, bancosSugeridos);
    criarComboboxTexto(campoClassificacao, classificacoesSugeridas);
    if (campoInvestimento) criarComboboxTexto(campoInvestimento, investimentosSugeridos);

    function finalizar(resultado) {
      fundo.classList.remove("aberto");
      setTimeout(() => fundo.remove(), 150);
      resolve(resultado);
    }

    caixa.querySelector("#editor-cancelar").addEventListener("click", () => finalizar(null));
    ligarFechamentoPorFundo(fundo, () => finalizar(null));

    caixa.querySelector("#form-editor-transacao").addEventListener("submit", (evento) => {
      evento.preventDefault();

      const valor = parseFloat(campoValor.value);
      const dataNormalizada = normalizarDataDigitada(campoData.value);
      const dataISO = dataNormalizada ? brParaISO(dataNormalizada) : null;
      const descricao = campoDescricao.value.trim().toUpperCase();
      const saida = campoSaida.value.trim().toUpperCase();
      const banco = normalizarNomeBanco(campoBanco.value.trim().toUpperCase());
      const tipo = campoTipo.value;
      const tipo_mov = campoTipoMov.value;
      const classificacao_saida = campoClassificacao.value.trim().toUpperCase();

      if (!valor || valor <= 0 || !descricao || !banco || !classificacao_saida) {
        mostrarToast("Preencha todos os campos obrigatórios.", "erro");
        return;
      }
      if (!dataISO) {
        campoData.classList.add("campo-invalido");
        mostrarToast("Data inválida. Use dd/mm/aaaa.", "erro");
        return;
      }

      const dadosEditados = { valor, data: dataISO, descricao, saida, banco, tipo, tipo_mov, classificacao_saida };
      if (campoInvestimento) dadosEditados.investimento = campoInvestimento.value.trim().toUpperCase();
      if (campoDono) dadosEditados.dono_carteira = campoDono.value.trim().toUpperCase();

      finalizar(dadosEditados);
    });
  });
}
