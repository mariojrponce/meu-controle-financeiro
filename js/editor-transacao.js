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
//
// `contextoInvestimento: true` liga o modo usado pela tela de Investimentos:
// troca os campos Movimentação/Classificação (que lá são sempre fixos,
// Externo/INVESTIMENTO) por Investimento + Dono da carteira, e relabela o
// Tipo pra Aporte/Resgate. Nesse modo também aparece o campo opcional "Onde
// está aplicado" (`banco_investimento`): o Banco continua sendo a conta de
// onde o dinheiro saiu (pro saldo do Extrato/Dashboard bater), e esse campo
// diz onde ele de fato está investido (ex: saiu do BRADESCO, está no
// MERCADO BITCOIN).
export function abrirEditorTransacao(transacao, {
  bancosSugeridos = [],
  classificacoesSugeridas = [],
  investimentosSugeridos = [],
  donosSugeridos = [],
  aplicadosSugeridos = [],
  titulo = "Editar lançamento",
  textoSalvar = "Salvar alterações",
  contextoInvestimento = false
} = {}) {
  return new Promise((resolve) => {
    const fundo = document.createElement("div");
    fundo.className = "modal-fundo";

    const caixa = document.createElement("div");
    caixa.className = "modal-caixa modal-caixa-editor";
    caixa.innerHTML = `
      <h3>${titulo}</h3>
      <form id="form-editor-transacao">
        <div class="grade-campos">
          <div class="campo">
            <label for="editor-valor">Valor (R$)</label>
            <input type="number" id="editor-valor" step="0.01" min="0.01" required inputmode="decimal">
          </div>
          <div class="campo">
            <label for="editor-data">Data</label>
            <input type="text" id="editor-data" required placeholder="dd/mm/aaaa" inputmode="numeric">
          </div>

          <div class="campo campo-inteiro">
            <label for="editor-descricao">Descrição</label>
            <input type="text" id="editor-descricao" required maxlength="120">
          </div>

          <div class="campo campo-inteiro">
            <label for="editor-saida">Detalhe <span class="dica-inline">(onde gastou / de onde recebeu)</span></label>
            <input type="text" id="editor-saida" maxlength="120">
          </div>

          <div class="campo ${contextoInvestimento ? "campo-inteiro" : ""}">
            <label for="editor-banco">${contextoInvestimento ? "Banco <span class=\"dica-inline\">(conta de onde saiu / para onde voltou)</span>" : "Banco"}</label>
            <input type="text" id="editor-banco" required maxlength="60">
          </div>

          ${contextoInvestimento ? `
          <div class="campo campo-inteiro">
            <label for="editor-aplicado">Onde está aplicado <span class="dica-inline">(opcional; vazio = descobre pelo Detalhe)</span></label>
            <input type="text" id="editor-aplicado" maxlength="60" placeholder="Ex.: Bradesco, Mercado Bitcoin">
          </div>
          <div class="campo">
            <label for="editor-investimento">Investimento</label>
            <input type="text" id="editor-investimento" required maxlength="60" placeholder="Ex.: CDB Bradesco">
          </div>
          <div class="campo">
            <label for="editor-dono">Dono da carteira</label>
            <input type="text" id="editor-dono" required maxlength="60" placeholder="Ex.: Eu, Mayara">
          </div>
          ` : ""}

          <div class="campo ${contextoInvestimento ? "campo-inteiro" : ""}">
            <label for="editor-tipo">Tipo</label>
            <select id="editor-tipo">
              ${contextoInvestimento ? `
              <option value="SAIDA">Aporte (dinheiro indo para o investimento)</option>
              <option value="ENTRADA">Resgate (dinheiro voltando para a conta)</option>
              ` : `
              <option value="SAIDA">Saída</option>
              <option value="ENTRADA">Entrada</option>
              `}
            </select>
          </div>

          ${contextoInvestimento ? "" : `
          <div class="campo">
            <label for="editor-tipo-mov">Movimentação</label>
            <select id="editor-tipo-mov">
              <option value="EXTERNO">Externo (real)</option>
              <option value="INTERNO">Interno (entre contas)</option>
            </select>
          </div>
          <div class="campo">
            <label for="editor-classificacao">Classificação</label>
            <input type="text" id="editor-classificacao" required maxlength="60">
          </div>
          `}
        </div>

        <div class="modal-acoes" style="margin-top: var(--e-6);">
          <button type="button" id="editor-cancelar" class="botao botao-secundario">Cancelar</button>
          <button type="submit" class="botao botao-primario">${textoSalvar}</button>
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
    const campoAplicado = caixa.querySelector("#editor-aplicado");
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
    if (campoAplicado) campoAplicado.value = transacao.banco_investimento ?? "";
    campoTipo.value = transacao.tipo ?? "SAIDA";
    if (campoTipoMov) campoTipoMov.value = transacao.tipo_mov ?? "EXTERNO";
    if (campoClassificacao) campoClassificacao.value = transacao.classificacao_saida ?? "";

    ligarCampoDataInteligente(campoData);
    criarComboboxTexto(campoBanco, bancosSugeridos);
    if (campoClassificacao) criarComboboxTexto(campoClassificacao, classificacoesSugeridas);
    if (campoInvestimento) criarComboboxTexto(campoInvestimento, investimentosSugeridos);
    if (campoDono) criarComboboxTexto(campoDono, donosSugeridos);
    if (campoAplicado) criarComboboxTexto(campoAplicado, aplicadosSugeridos);

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
      const tipo_mov = campoTipoMov ? campoTipoMov.value : "EXTERNO";
      const classificacao_saida = campoClassificacao ? campoClassificacao.value.trim().toUpperCase() : "INVESTIMENTO";
      const investimento = campoInvestimento ? campoInvestimento.value.trim().toUpperCase() : "";
      const dono_carteira = campoDono ? campoDono.value.trim().toUpperCase() : "";
      const banco_investimento = campoAplicado ? normalizarNomeBanco(campoAplicado.value.trim().toUpperCase()) : "";

      if (!valor || valor <= 0 || !descricao || !banco || (campoClassificacao && !classificacao_saida)) {
        mostrarToast("Preencha todos os campos obrigatórios.", "erro");
        return;
      }
      if (contextoInvestimento && (!investimento || !dono_carteira)) {
        mostrarToast("Preencha todos os campos obrigatórios.", "erro");
        return;
      }
      if (!dataISO) {
        campoData.classList.add("campo-invalido");
        mostrarToast("Data inválida. Use dd/mm/aaaa.", "erro");
        return;
      }

      const dadosEditados = { valor, data: dataISO, descricao, saida, banco, tipo, tipo_mov, classificacao_saida };
      if (campoInvestimento) dadosEditados.investimento = investimento;
      if (campoDono) dadosEditados.dono_carteira = dono_carteira;
      if (campoAplicado) dadosEditados.banco_investimento = banco_investimento;

      finalizar(dadosEditados);
    });
  });
}
