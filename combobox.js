// combobox.js
// Substitui o <datalist> nativo por dois componentes mais práticos:
//
// 1) criarComboboxTexto — campo de texto com uma lista de sugestões clicáveis
//    (usado no formulário de lançamento: Banco, Classificação). Continua aceitando
//    digitar um valor novo que não esteja na lista.
//
// 2) criarSeletorMultiplo — permite marcar vários itens ao mesmo tempo, sem
//    precisar apagar a seleção anterior para escolher outra (usado nos filtros).

function normalizarBusca(texto) {
  return texto
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function criarComboboxTexto(input, opcoesIniciais = []) {
  let opcoes = opcoesIniciais;
  let apagando = false;

  const wrap = document.createElement("div");
  wrap.className = "combobox-wrap";
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  input.removeAttribute("list");
  input.setAttribute("autocomplete", "off");

  const painel = document.createElement("div");
  painel.className = "combobox-painel";
  wrap.appendChild(painel);

  // Acha a primeira opção que COMEÇA com o texto digitado (autocompletar
  // inline, tipo Excel/barra de endereço: completa e seleciona o restante).
  function melhorSugestao(texto) {
    if (!texto) return null;
    const termo = normalizarBusca(texto);
    return opcoes.find((op) => {
      const opNormalizada = normalizarBusca(op);
      return opNormalizada !== termo && opNormalizada.startsWith(termo);
    }) ?? null;
  }

  function renderizarPainel() {
    const termo = normalizarBusca(input.value);
    const filtradas = termo === "" ? opcoes : opcoes.filter((op) => normalizarBusca(op).includes(termo));

    painel.innerHTML = "";

    if (filtradas.length === 0) {
      const vazio = document.createElement("div");
      vazio.className = "combobox-vazio";
      vazio.textContent = input.value.trim() === "" ? "Comece a digitar..." : "Sem sugestões — será salvo como novo valor";
      painel.appendChild(vazio);
      return;
    }

    filtradas.slice(0, 60).forEach((opcao) => {
      const item = document.createElement("div");
      item.className = "combobox-item";
      item.textContent = opcao;
      item.addEventListener("mousedown", (evento) => {
        evento.preventDefault(); // não deixa o input perder o foco antes do clique
        input.value = opcao;
        fecharPainel();
        input.dispatchEvent(new Event("change"));
      });
      painel.appendChild(item);
    });
  }

  function abrirPainel() {
    renderizarPainel();
    painel.classList.add("aberto");
  }
  function fecharPainel() {
    painel.classList.remove("aberto");
  }

  input.addEventListener("keydown", (evento) => {
    apagando = evento.key === "Backspace" || evento.key === "Delete";
  });

  input.addEventListener("input", () => {
    abrirPainel();

    // Autocompleta enquanto digita (exceto ao apagar) — a parte sugerida fica
    // selecionada, então: continuar digitando substitui; apertar Tab/Enter aceita.
    if (!apagando) {
      const sugestao = melhorSugestao(input.value);
      if (sugestao) {
        const tamanhoDigitado = input.value.length;
        input.value = sugestao;
        input.setSelectionRange(tamanhoDigitado, sugestao.length);
      }
    }
  });

  input.addEventListener("focus", abrirPainel);
  input.addEventListener("blur", () => setTimeout(fecharPainel, 120));

  return {
    atualizarOpcoes(novasOpcoes) {
      opcoes = novasOpcoes;
      if (painel.classList.contains("aberto")) renderizarPainel();
    }
  };
}

export function criarSeletorMultiplo({ container, opcoes = [], selecionados = [], rotuloTodos = "Todos", aoMudar }) {
  let listaOpcoes = opcoes;
  let listaSelecionados = new Set(selecionados);

  container.classList.add("seletor-multiplo");
  container.innerHTML = "";

  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "seletor-multiplo-botao";
  container.appendChild(botao);

  const painel = document.createElement("div");
  painel.className = "seletor-multiplo-painel";
  container.appendChild(painel);

  function textoResumo() {
    if (listaSelecionados.size === 0) return rotuloTodos;
    const itens = Array.from(listaSelecionados);
    return itens.length === 1 ? itens[0] : `${itens[0]} +${itens.length - 1}`;
  }

  function atualizarBotao() {
    botao.innerHTML = "";
    const texto = document.createElement("span");
    texto.textContent = textoResumo();
    const seta = document.createElement("span");
    seta.textContent = "▾";
    seta.style.opacity = "0.6";
    botao.appendChild(texto);
    botao.appendChild(seta);
  }

  function renderizarPainel() {
    painel.innerHTML = "";

    const acoes = document.createElement("div");
    acoes.className = "seletor-multiplo-acoes";

    const botaoTodos = document.createElement("button");
    botaoTodos.type = "button";
    botaoTodos.textContent = "Selecionar todos";
    botaoTodos.addEventListener("click", () => {
      listaSelecionados = new Set(listaOpcoes);
      renderizarPainel();
      atualizarBotao();
      aoMudar?.(Array.from(listaSelecionados));
    });

    const botaoLimpar = document.createElement("button");
    botaoLimpar.type = "button";
    botaoLimpar.textContent = "Limpar";
    botaoLimpar.addEventListener("click", () => {
      listaSelecionados = new Set();
      renderizarPainel();
      atualizarBotao();
      aoMudar?.(Array.from(listaSelecionados));
    });

    acoes.appendChild(botaoTodos);
    acoes.appendChild(botaoLimpar);
    painel.appendChild(acoes);

    if (listaOpcoes.length === 0) {
      const vazio = document.createElement("div");
      vazio.className = "combobox-vazio";
      vazio.textContent = "Nenhuma opção ainda.";
      painel.appendChild(vazio);
    }

    listaOpcoes.forEach((opcao) => {
      const item = document.createElement("label");
      item.className = "seletor-multiplo-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = listaSelecionados.has(opcao);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) listaSelecionados.add(opcao);
        else listaSelecionados.delete(opcao);
        atualizarBotao();
        aoMudar?.(Array.from(listaSelecionados));
      });

      const texto = document.createElement("span");
      texto.textContent = opcao;

      item.appendChild(checkbox);
      item.appendChild(texto);
      painel.appendChild(item);
    });
  }

  botao.addEventListener("click", (evento) => {
    evento.stopPropagation();
    const abrindo = !painel.classList.contains("aberto");
    document.querySelectorAll(".seletor-multiplo-painel.aberto").forEach((p) => p.classList.remove("aberto"));
    if (abrindo) {
      renderizarPainel();
      painel.classList.add("aberto");
    }
  });

  document.addEventListener("click", (evento) => {
    if (!container.contains(evento.target)) painel.classList.remove("aberto");
  });

  atualizarBotao();

  return {
    obterSelecionados: () => Array.from(listaSelecionados),
    definirOpcoes(novasOpcoes) {
      listaOpcoes = novasOpcoes;
      listaSelecionados = new Set(Array.from(listaSelecionados).filter((v) => listaOpcoes.includes(v)));
      atualizarBotao();
      if (painel.classList.contains("aberto")) renderizarPainel();
    },
    definirSelecionados(novosSelecionados) {
      listaSelecionados = new Set(novosSelecionados);
      atualizarBotao();
      if (painel.classList.contains("aberto")) renderizarPainel();
    }
  };
}
