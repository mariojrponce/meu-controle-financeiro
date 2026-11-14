# 12. Guia Completo de Implementação UX/UI e Identidade Visual

> **Documento Técnico de Handoff (Design → Engenharia)**  
> **Produto:** Meu Financeiro (v1.7.0+) — Stack: HTML + CSS + JS puro (ES Modules), sem frameworks e sem build.  
> **Fontes Normativas:** *Manual de Identidade Visual Meu Financeiro (v1.0)* + *Boas Práticas em UX e UI Design (Garrett, Nielsen, Gestalt e Psicologia Cognitiva)*.

---

## 12.1 Objetivo e Filosofia de Implementação

Este guia traduz a **Identidade Visual oficial do Meu Financeiro** e os **fundamentos científicos de UX/UI** em regras objetivas de código, CSS Variables, padrões de interação e critérios de aceite para os desenvolvedores.

### Pilares da Marca na Interface
* **Confiável e Estruturada:** O **Azul Profundo (`#01264B`)** e o **Azul Principal (`#0876D1`)** ancoram a navegação, títulos e ações primárias.
* **Clara e Sem Ruído (Lei de Hick e Pregnância da Forma):** O sistema substitui uma planilha densa. Cada elemento extra na tela compete com os números; evite bordas pesadas, gradientes decorativos em dados e excesso de cores simultâneas.
* **Positiva e Semântica:** O **Verde (`#35B96A`)** é reservado estritamente para entradas, saldo positivo e metas cumpridas. O **Laranja (`#F59A00`)** atua como cor de acento e atenção moderada (nunca dominante).
* **Prática e Veloz (Limiar de Doherty < 400ms & Lei de Fitts):** A interface deve responder instantaneamente aos filtros (`250ms` debounce), suportar teclado (`Tab`, `Enter`, autocompletar) e oferecer alvos de clique confortáveis.

---

## 12.2 Aplicação Oficial da Marca (Logotipo e Assets)

Os desenvolvedores devem respeitar rigorosamente as regras da **Seção 2 e 6 do Manual de Identidade Visual**:

### Estrutura de Pastas de Marca
Manter em `/assets/brand/` os arquivos oficiais:
* `logo-horizontal.svg` / `.png` (composição completa: símbolo carteira + divisor + "Meu Financeiro" + linha degradê).
* `logo-horizontal-dark.svg` (versão negativa/clara para fundos escuros, garantindo legibilidade do nome "Financeiro").
* `logo-horizontal-sepia.svg` (versão monocromática marrom `#2C2216` para o tema Sépia).
* `simbolo-carteira.svg` (apenas o ícone da carteira, sem texto).
* `favicon-32.png`, `favicon-48.png`, `icon-192.png`, `icon-512.png`.

### Regras de Uso por Contexto

| Local na Aplicação | Versão Obrigatória | Dimensão / Área de Respiro | Proibições |
|--------------------|--------------------|----------------------------|------------|
| **Tela de Login (`login.html`)** | `logo-horizontal` (adaptada ao tema) | Largura entre `240px` e `300px`. Margem livre mínima equivalente à altura do botão branco da carteira. | Não colocar sobre fundo azul escuro sem a variante negativa. |
| **Cabeçalho / Topo Desktop** | `logo-horizontal` | Largura mínima de **`220px`** (abaixo disso o texto perde leitura). | Não esticar (`object-fit: contain` obrigatório) nem aplicar `box-shadow` ou `drop-shadow` pesado. |
| **Menu Lateral Recolhido / Mobile** | `simbolo-carteira.svg` | Altura mínima de **`28px`** (ideal **`32px` a `36px`**). | Não usar a versão completa com texto em espaços menores que `220px`. |
| **Exportação / Impressão** | `logo-horizontal` ou monocromática | Largura mínima `45mm` em impressão; discreta no cabeçalho/rodapé. | Não competir com as tabelas financeiras. |

---

## 12.3 Arquitetura de Cores e Tokens CSS (`:root`)

A paleta abaixo reconcilia os **códigos oficiais do Manual de Marca** (`#01264B`, `#0876D1`, `#28B8E8`, `#35B96A`, `#F59A00`) com os **3 temas obrigatórios do sistema** (`Claro`, `Escuro` e `Sépia`), garantindo contraste mínimo **WCAG AA ($\ge 4.5:1$ para texto e $\ge 3:1$ para gráficos)**.

> **Regra de Código:** É proibido usar cores hexadecimais hardcoded nos arquivos HTML/CSS/JS das telas. Todo componente deve consumir exclusivamente os tokens abaixo.

### CSS Base de Tokens (`css/tokens.css`)

```css
:root,
[data-theme="light"] {
  /* Paleta Institucional (Manual de Marca) */
  --brand-azul-profundo: #01264B;
  --brand-azul-principal: #0876D1;
  --brand-azul-claro: #28B8E8;
  --brand-verde: #35B96A;
  --brand-laranja: #F59A00;

  /* Superfícies e Fundos */
  --bg-pagina: #F4F6F9;
  --bg-superficie: #FFFFFF;
  --bg-superficie-alt: #F8FAFC;
  --bg-sidebar: #FFFFFF;
  --borda-sutil: #E2E8F0;
  --borda-foco: #0876D1;

  /* Tipografia */
  --texto-principal: #01264B;      /* Azul profundo da marca para títulos e números fortes */
  --texto-corpo: #0F172A;          /* Leitura de tabelas e descrições */
  --texto-secundario: #475569;     /* Rótulos, datas, detalhes e metadados */
  --texto-inverso: #FFFFFF;

  /* Ações Interativas */
  --cor-primaria: #0876D1;
  --cor-primaria-hover: #065FA8;
  --cor-primaria-suave: rgba(8, 118, 209, 0.10);

  /* Semântica Financeira (Contraste WCAG AA garantido) */
  --cor-entrada: #1E8E4E;          /* Derivado do Verde #35B96A com contraste >= 4.5:1 sobre branco */
  --cor-entrada-bg: #E8F8EE;
  --cor-saida: #C81E1E;            /* Vermelho semântico para saídas e erros */
  --cor-saida-bg: #FDE8E8;
  --cor-alerta: #B45309;           /* Derivado do Laranja #F59A00 com contraste >= 4.5:1 */
  --cor-alerta-acento: #F59A00;    /* Uso em ícones, bordas e gráficos */
  --cor-alerta-bg: #FEF3C7;
  --cor-previsto: #0876D1;         /* Lançamentos futuros (data > hoje) */
  --cor-previsto-bg: #E0F2FE;
  --cor-interno: #475569;          /* Transferências e virada de mês */
  --cor-interno-bg: #F1F5F9;

  /* Elevação */
  --sombra-card: 0 1px 3px rgba(1, 38, 75, 0.06), 0 1px 2px rgba(1, 38, 75, 0.04);
  --sombra-dropdown: 0 10px 25px -5px rgba(1, 38, 75, 0.12);
}

[data-theme="dark"] {
  --brand-azul-profundo: #E2E8F0;
  --brand-azul-principal: #38BDF8;
  --brand-azul-claro: #28B8E8;
  --brand-verde: #35B96A;
  --brand-laranja: #F59A00;

  /* Nunca usar #000000 puro */
  --bg-pagina: #0F172A;
  --bg-superficie: #1E293B;
  --bg-superficie-alt: #263349;
  --bg-sidebar: #162032;
  --borda-sutil: #334155;
  --borda-foco: #38BDF8;

  --texto-principal: #F8FAFC;
  --texto-corpo: #E2E8F0;
  --texto-secundario: #94A3B8;
  --texto-inverso: #0F172A;

  --cor-primaria: #28B8E8;         /* Azul claro da marca adaptado para fundo escuro */
  --cor-primaria-hover: #56C7ED;
  --cor-primaria-suave: rgba(40, 184, 232, 0.15);

  /* Tons dessaturados para não vibrar no escuro */
  --cor-entrada: #4ADE80;
  --cor-entrada-bg: rgba(53, 185, 106, 0.16);
  --cor-saida: #F87171;
  --cor-saida-bg: rgba(248, 113, 113, 0.16);
  --cor-alerta: #FBBF24;
  --cor-alerta-acento: #F59A00;
  --cor-alerta-bg: rgba(245, 154, 0, 0.16);
  --cor-previsto: #60A5FA;
  --cor-previsto-bg: rgba(96, 165, 250, 0.16);
  --cor-interno: #94A3B8;
  --cor-interno-bg: rgba(148, 163, 184, 0.14);

  --sombra-card: 0 1px 3px rgba(0, 0, 0, 0.35);
  --sombra-dropdown: 0 12px 28px rgba(0, 0, 0, 0.5);
}

[data-theme="sepia"] {
  --brand-azul-profundo: #2C2216;
  --brand-azul-principal: #8C5319;
  --brand-azul-claro: #A66A2C;
  --brand-verde: #267347;
  --brand-laranja: #C77700;

  --bg-pagina: #F4ECD8;
  --bg-superficie: #FAF4E6;
  --bg-superficie-alt: #EFE5CE;
  --bg-sidebar: #F7EFE0;
  --borda-sutil: #DCD0B8;
  --borda-foco: #8C5319;

  --texto-principal: #2C2216;
  --texto-corpo: #3B2E1E;
  --texto-secundario: #6B5B45;
  --texto-inverso: #FAF4E6;

  --cor-primaria: #8C5319;         /* Substitui o azul por tom quente conforme Manual p. 6 */
  --cor-primaria-hover: #704112;
  --cor-primaria-suave: rgba(140, 83, 25, 0.12);

  --cor-entrada: #1E6B3A;
  --cor-entrada-bg: #DCEAD9;
  --cor-saida: #A62626;
  --cor-saida-bg: #F2D8D5;
  --cor-alerta: #9A5B0D;
  --cor-alerta-acento: #C77700;
  --cor-alerta-bg: #F3E4C6;
  --cor-previsto: #4E448A;
  --cor-previsto-bg: #E5E2F5;
  --cor-interno: #6B5B45;
  --cor-interno-bg: #EAE0CA;

  --sombra-card: 0 1px 3px rgba(44, 34, 22, 0.08);
  --sombra-dropdown: 0 10px 25px rgba(44, 34, 22, 0.15);
}
```

### Regra de Proporção Cromática (Regra 60-30-10)
* **60% Neutros de Superfície:** `--bg-pagina` e `--bg-superficie` garantem descanso visual.
* **30% Azul Institucional:** `--brand-azul-profundo` e `--cor-primaria` estruturam cabeçalhos, títulos, navegação e gráficos principais.
* **10% Acentos Semânticos:** `--cor-entrada` (Verde), `--cor-saida` (Vermelho) e `--brand-laranja` (`#F59A00`). **Nunca use laranja como cor dominante** nem coloque grandes blocos verdes e vermelhos competindo lado a lado.

### Integração Dinâmica com Chart.js
Ao instanciar ou atualizar gráficos em `js/dashboard.js` (e ao trocar o tema), leia os tokens computados via JS:

```javascript
function obterPaletaGraficos() {
  const s = getComputedStyle(document.documentElement);
  return {
    azulPrincipal: s.getPropertyValue('--cor-primaria').trim(),
    azulApoio: s.getPropertyValue('--brand-azul-claro').trim(),
    entrada: s.getPropertyValue('--cor-entrada').trim(),
    saida: s.getPropertyValue('--cor-saida').trim(),
    alerta: s.getPropertyValue('--cor-alerta-acento').trim(),
    texto: s.getPropertyValue('--texto-corpo').trim(),
    grade: s.getPropertyValue('--borda-sutil').trim()
  };
}
```

---

## 12.4 Tipografia, Espaçamento e Geometria

### Fonte e Alinhamento Numérico
* **Família:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` (importada via Google Fonts nos pesos `400`, `500`, `600`, `700`).
* **Regra Obrigatória para Valores Financeiros:**
  ```css
  .valor, .kpi-valor, td.num, th.num {
    font-variant-numeric: tabular-nums;
    text-align: right;
    white-space: nowrap;
  }
  ```
* **Prefixo e Sinal:** Formatar em `pt-BR` com espaço não quebrável (`\u00A0`): `+ R$ 1.250,00` (Entrada) ou `- R$ 420,90` (Saída). Nunca quebrar linha entre `R$` e o número.

### Escala Tipográfica Oficial

| Elemento | Tamanho | Peso | Cor | Observação |
|----------|---------|------|-----|------------|
| **KPI Principal (Cards Topo)** | `24px` (`1.5rem`) | `700` | `--texto-principal` ou semântica | Saldo do período, Saldo hoje, Pode investir |
| **Título de Página (`h1`)** | `20px–22px` | `700` | `--texto-principal` | Título único no topo da área útil |
| **Título de Seção / Card (`h2`)** | `16px` (`1rem`) | `600` | `--texto-principal` | Títulos de gráficos, blocos e modais |
| **Corpo, Inputs e Tabelas** | `14px` (`0.875rem`) | `400` / `500` | `--texto-corpo` | Altura de linha `1.45` |
| **Labels, Badges e Metadados** | `12px` (`0.75rem`) | `500` / `600` | `--texto-secundario` | Rótulos acima dos campos, datas secundárias |

### Grid de Espaçamento e Raios de Borda
* **Escala de Espaçamento (múltiplos de `4px` e `8px`):** `4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`.
* **Raios de Borda (`border-radius`):**
  * Cards, tabelas e modais: **`12px`** (faixa recomendada: `8–14px`).
  * Inputs, selects e botões: **`8px`**.
  * Badges, pills e chips de filtro: **`999px`** (pílula).
* **Bordas:** `1px solid var(--borda-sutil)`. Evitar bordas grossas (`>= 2px`), exceto no estado `:focus-visible` ou borda lateral semântica de `3px` em cards de destaque.

---

## 12.5 Leis da Psicologia Cognitiva e Gestalt Aplicadas ao Código

Os programadores devem aplicar estas regras na montagem do HTML e CSS:

1. **Lei da Proximidade (Gestalt) em Formulários:**
   * O `<label>` deve ficar a **`4px`–`6px`** acima do seu `<input>`, enquanto a distância entre um campo e o próximo deve ser de **`16px`**.
   * Todo `<label>` deve ter o atributo `for="id-do-campo"` para expandir a área de clique (Lei de Fitts). Nunca substitua `<label>` apenas por `placeholder`.

2. **Lei da Semelhança e Segregação (Gestalt):**
   * Todos os botões primários (ex.: *Salvar transação*, *Pesquisar*, *Transferir*) compartilham exatamente o mesmo estilo (`background: var(--cor-primaria)`, `color: var(--texto-inverso)`).
   * Ações destrutivas (ex.: *Excluir*, *Limpar filtros*) **nunca** usam preenchimento primário; usam botão secundário/ghost (`border: 1px solid var(--borda-sutil)` ou ícone discreto com hover em `--cor-saida-bg`) para prevenir cliques acidentais (Lei de Fitts).

3. **Lei de Miller e *Chunking* (Agrupamento):**
   * Barras de filtro com muitos campos (como *Extrato* e *Dashboard*) devem ser agrupadas visualmente em blocos lógicos: **Bloco Temporal** (Ano, Mês, Início, Fim) + **Bloco de Escopo** (Banco, Movimentação, Vale, Situação) + **Bloco Textual** (Detalhe, Descrição).

4. **Reconhecimento em Vez de Memorização (Heurística #6):**
   * **Não depender apenas da cor (Acessibilidade):** Toda informação financeira deve combinar **3 sinais redundantes**:
     1. **Cor** (`--cor-entrada`, `--cor-saida`, `--cor-alerta`).
     2. **Sinal ou Ícone** (`+`, `-`, `🌐`, `🔁`, `🔴`, `🟡`).
     3. **Rótulo Textual** (`Previsto`, `Vence amanhã`, `Aporte`, `Resgate`).

5. **Controle e Liberdade do Usuário (Heurística #3 & Lei de Postel):**
   * **Modais Seguros:** Implementar fechamento por clique externo **apenas** comparando `event.target` no `mousedown` e no `mouseup` (ambos devem ser o overlay `.modal-backdrop`).
   * **Feedback de Status (< 400ms):** Ao clicar em *Salvar* ou *Importar*, desabilitar o botão imediatamente, exibir texto de estado (`Salvando...`) e disparar o *toast* discreto por `2.2s` após conclusão.

---

## 12.6 Especificação de Componentes Padrão

### 1. Shell de Navegação (Desktop vs. Mobile)
* **Desktop (`>= 1024px`):**
  * Sidebar fixa à esquerda (`width: 230px`, `background: var(--bg-sidebar)`, `border-right: 1px solid var(--borda-sutil)`).
  * Topo da sidebar: `logo-horizontal.svg` (`220px` ou símbolo + título).
  * Itens do menu: altura `42px`, `border-radius: 8px`, padding `0 12px`, gap `10px`. Item ativo recebe `background: var(--cor-primaria-suave)` e `color: var(--cor-primaria)` com `font-weight: 600`.
  * Rodapé da sidebar: e-mail do usuário truncado (`text-overflow: ellipsis`), botão seletor de tema (`☀️ / 🌙 / 📜`) e botão `🚪 Sair`.
* **Mobile (`< 768px`):**
  * Sidebar oculta; ativa-se a **Bottom Navigation Bar** fixa (`height: 60px`, `padding-bottom: env(safe-area-inset-bottom)`), exibindo os ícones e rótulos curtos (`Lançar`, `Extrato`, `Dash`, `Transf.`, `Virar`, `Invest.`, `Plano`). Área mínima de toque de `44px × 44px`.

### 2. Cartões de KPI (Resumo)
```html
<article class="kpi-card">
  <span class="kpi-label">SALDO DO PERÍODO</span>
  <strong class="kpi-valor positivo">+ R$&nbsp;3.420,50</strong>
  <span class="kpi-meta">Realizados externos</span>
</article>
```
* Padding: `16px 20px`, `background: var(--bg-superficie)`, `border: 1px solid var(--borda-sutil)`, `border-radius: 12px`, `box-shadow: var(--sombra-card)`.
* Grid responsivo: `grid-template-columns: repeat(auto-fit, minmax(210px, 1fr))`, `gap: 16px`.

### 3. Badges / Selos Semânticos
* `Previsto`: `background: var(--cor-previsto-bg); color: var(--cor-previsto);`
* `Vence em 4–7 dias`: `background: var(--cor-alerta-bg); color: var(--cor-alerta);` (`🟡`)
* `Vence em <= 3 dias / amanhã`: `background: var(--cor-saida-bg); color: var(--cor-saida);` (`🔴`)
* `Interno`: `background: var(--cor-interno-bg); color: var(--cor-interno);` (`🔁`)

### 4. Estados de Inputs e Combobox
Todo input (`<input>`, `<select>`) deve estilizar explicitamente os **4 estados**:
1. **Default:** `border: 1px solid var(--borda-sutil); background: var(--bg-superficie); height: 40px; border-radius: 8px;`
2. **Focus:** `outline: none; border-color: var(--borda-foco); box-shadow: 0 0 0 3px var(--cor-primaria-suave);`
3. **Invalid / Erro:** `border-color: var(--cor-saida); background: var(--cor-saida-bg);` (aplicado inline na data inválida sem `alert()`).
4. **Disabled:** `opacity: 0.6; cursor: not-allowed; background: var(--bg-superficie-alt);`

### 5. Tabelas de Dados
* **Regra Estrutural:** Não criar `max-height` com barra de rolagem vertical interna nas tabelas; deixar a página rolar naturalmente. Envolver apenas em `<div class="table-responsive">` (`overflow-x: auto`) para telas estreitas.
* **Linhas:** `min-height: 44px`, hover em `var(--bg-superficie-alt)`.
* **Linhas Previstas (`data > hoje`):** Adicionar classe `.linha-prevista` com `border-left: 3px solid var(--cor-previsto)` e fundo levemente diferenciado.
* **Ordenação:** `<th>` clicável exibe `▲` ou `▼` com `color: var(--cor-primaria)` na coluna ativa.

---

## 12.7 Diretrizes Visuais Específicas por Tela

1. **`login.html`:** Card centralizado (`max-width: 400px`) sobre `--bg-pagina`, logotipo horizontal completo com generoso respiro superior/inferior, assinatura opcional *"Organização e clareza para acompanhar suas finanças."*, botão "Mostrar/ocultar senha" e mensagem de erro inline em `--cor-saida-bg`.
2. **`index.html` (➕ Lançar):** Formulário em grid limpo no topo com foco automático no campo **Valor**; abaixo, tabela "Últimos 10 lançamentos" com filtro rápido de **Vale** (`Tudo` / `Só vale` / `Sem vale`).
3. **`importar.html` (📥 Importar):** Stepper visual claro (`1. Selecionar Extrato` → `2. Revisão e Classificação` → `3. Conferência de Saldo`). Usar `--cor-entrada-bg` para linhas prontas, `--cor-alerta-bg` para divergências/baixa confiança e `--cor-saida-bg` para erros.
4. **`extrato.html` (📋 Extrato):** Barra de filtros recolhível no mobile (`<details>`), 4 KPIs de resumo, botões `⬇️ Exportar .xlsx` (secundário) e `+ Novo lançamento` (primário) alinhados à direita acima da tabela.
5. **`dashboard.html` (📊 Dashboard):**
   * **Ordem visual:** KPIs → Transferências internas (faixa discreta) → Saldo por Carteira → Radar de Previstos (2 colunas: lista cronológica + A descontar por banco) → Categorias à parte → Gráficos pareados (`Barras` à esquerda + `Evolução Jan–Dez` à direita, com selo `Total: R$ ...` no título) → Visões personalizadas.
   * **Interação de filtro no gráfico:** Ao clicar numa categoria nas barras, destacar a barra selecionada e exibir badge removível `[ só CATEGORIA ✕ ]` no gráfico de evolução ao lado.
6. **`transferencia.html` (🔀 Transferência) e `virar-mes.html` (🔁 Virar mês):** Usar indicador visual direcional (`Origem ➔ Destino`) para evitar inversão acidental de contas ou meses.
7. **`investimentos.html` (📈 Investimentos):** Chips horizontais "Onde está aplicado" no topo; cartões de investimento/dono com botões expansíveis `[+]` para inspecionar aportes e resgates sem abrir nova página.
8. **`planejamento.html` (🧭 Planejamento):** Destacar o card **"💡 O que fazer agora"** logo abaixo dos KPIs com borda esquerda de `4px` em `--cor-primaria` (ou `--cor-alerta-acento` se houver falta de saldo). Nos bloquinhos de ciclos: borda `--cor-entrada` para **Atual**, `--cor-previsto` para **Futuro**, e opacidade reduzida (`filter: grayscale(0.85)`) para **Encerrado**.

---

## 12.8 Checklist de Code Review (Definition of Done Visual)

Antes de aprovar qualquer Pull Request ou commit de interface, o desenvolvedor deve validar:

- [ ] **Zero cores hardcoded:** Todas as cores vêm de `var(--...)` e funcionam nos temas **Claro**, **Escuro** e **Sépia** (incluindo os gráficos do Chart.js).
- [ ] **Integridade da Logo:** Proporção preservada, versão adequada ao tamanho (`>= 220px` horizontal ou `>= 28px` símbolo) e contraste validado no fundo.
- [ ] **Tipografia Tabular:** `font-variant-numeric: tabular-nums` e alinhamento à direita aplicados em todos os valores monetários.
- [ ] **Redundância Semântica:** Nenhum estado (Entrada, Saída, Previsto, Vencimento, Erro) depende apenas de cor; todos possuem ícone/sinal e texto.
- [ ] **Alvos e Acessibilidade:** Inputs possuem `<label for="...">`, botões têm área mínima de `44px` no mobile, foco de teclado (`:focus-visible`) está visível e contraste atinge WCAG AA (`>= 4.5:1`).
- [ ] **Comportamento de Modal e Filtros:** Modais não fecham ao arrastar seleção de texto para fora; filtros de texto possuem debounce de `250ms`.