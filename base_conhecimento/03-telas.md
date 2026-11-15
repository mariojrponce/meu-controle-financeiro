# 3. Telas

Elementos comuns a todas as telas privadas (visual segue a **identidade visual v1.0**, ver 3.0 abaixo):

- **Menu lateral** (desktop ≥ 1024 px) com a logo (clique → Lançar) e as telas em três grupos: **Registrar** (Lançar, Importar, Transferência, Virar mês), **Acompanhar** (Dashboard, Extrato, Investimentos, Planejamento) e **Ajustar** (Configurações); no rodapé, e-mail, botão de tema e Sair. **Tablet (768–1023 px):** menu recolhido, só ícones e o símbolo da carteira. **Celular (< 768 px):** topo com o símbolo, a engrenagem de **Configurações**, o tema e Sair + barra inferior com os 8 itens (rótulos curtos: Lançar, Importar, Transf., Virar, Dash, Extrato, Invest., Plano).
- **Tema**: Claro → Escuro → Sépia → Claro (cada clique avança; ícones sol / lua / livro). Sem escolha manual, o tema segue o horário: **06h–18h claro, fora disso escuro**. A escolha manual fica gravada e passa a valer sempre, até trocar de novo. No Sépia a logo fica monocromática marrom.
- **Avisos (toast)**: mensagem discreta no canto, some em ~2,2 s (faixa verde = sucesso, vermelha = erro).
- **Janelas flutuantes (modais)**: fecham com Cancelar, ou clicando fora **somente se o clique começar e terminar no fundo escuro**. Assim, selecionar um texto dentro da janela e soltar o mouse fora não fecha a janela nem perde o que foi digitado. A janela de detalhes do ciclo (Planejamento) fecha também com **Esc**.
- **Tabelas**: clicar no cabeçalho ordena (▲/▼, clique de novo inverte). Células não quebram linha; a página inteira rola (sem barra de rolagem interna).
- **Excluir** sempre pede confirmação ("Essa ação não pode ser desfeita"). Botões de excluir nunca são preenchidos (contorno/ícone), para evitar clique sem querer.
- **Filtros** (Extrato, Dashboard, Investimentos) agrupados em **Período**, **Escopo** e **Texto**; no celular ficam recolhidos em "Filtros".

### 3.0 Identidade visual aplicada (v1.10)

Fonte: pasta `identidade visual/` (manual em PDF + guias). Resumo do que vale no código:

| Item | Regra |
|------|-------|
| Cores | Só tokens de `style.css` (`--brand-*`, `--bg-*`, `--texto-*`, `--cor-entrada`, `--cor-saida`, `--cor-alerta`, `--cor-previsto`, `--cor-interno`...) nos 3 temas. Azul domina; verde = entrada/saldo positivo; vermelho = saída/erro; laranja só como acento de atenção. Os gráficos leem os tokens (`corDoTema()` em `graficos.js`). Exceção: cores das marcas dos bancos (`cores-bancos.js`), que são dado. |
| Marca | `assets/brand/`: símbolo da carteira (recortado do logo original, sem fundo), versão sépia, logo horizontal e ícones (favicon 32/48, 180, 192, 512). A logo horizontal das telas é montada (símbolo + divisor + "Meu / Financeiro" + linha degradê) para trocar de cor com o tema. |
| Tipografia | Inter 400–700 em tudo; Nunito 800 só no nome da marca. Página 22 px/700, seção 16 px/600, corpo 14 px, rótulos 12 px. Valores com números tabulares, à direita, sem quebrar. |
| Ícones | `assets/icones.svg`: conjunto linear único (traço 1,8). Emojis só como sinal em textos de aviso. |
| Componentes | Cards raio 12 px; campos e botões 40 px (44 px no celular), raio 8 px; selos/pílulas raio 999 px. KPIs neutros com **cor + sinal + rótulo** (nunca só cor). Linhas previstas com borda azul à esquerda. |

---

## 3.1 ➕ Lançar (`index.html`)

**Objetivo:** lançar uma transação rápido.

**Formulário "Nova transação"**

| Campo | Padrão | Observação |
|-------|--------|------------|
| Valor (R$) | vazio | Número, mínimo 0,01, 2 casas |
| Data | vazio | Data inteligente (ver [04](04-inserir-valores.md#41-data)) |
| Descrição | vazio | Obrigatória, até 120 |
| Detalhe (onde gastou / de onde recebeu) | vazio | Opcional, até 120 |
| Banco | vazio | Sugestões + aceita novo, até 60 |
| Tipo | **Saída** | Saída / Entrada |
| Movimentação | **Externo** | Externo (Gasto/Receita real) / Interno (Transferência) |
| Classificação | vazio | Sugestões + aceita nova, até 60 |

Botão **Salvar transação** → grava, mostra "Salvo!", limpa o formulário e recarrega a lista.

**Tabela "Últimos lançamentos"**: os **10 últimos criados** (ordem de criação, não de data),
colunas Data, Descrição, Banco, Valor, Ações (✏️ editar / 🗑 excluir). Tem filtro **Vale**
(Tudo / Só vale / Sem vale), aplicado antes de cortar os 10.

---

## 3.2 📥 Importar (`importar.html`)

**Objetivo:** subir muitos lançamentos de uma vez a partir de `.xlsx`, `.csv` ou `.txt`.

1. **Baixar modelo** (`modelo-carteira.xlsx`).
2. **Subir o arquivo** → o sistema lê a primeira aba, reconhece as colunas e valida linha a linha.
3. Mostra pílulas "✅ N prontas para importar" e "⚠️ N com erro (não serão importadas)" e uma prévia com #, Data, Descrição, Banco, Tipo, Valor e Status (passe o mouse em ❌ para ver o motivo).
4. Botão **Importar N lançamentos válidos** → confirmação → grava em lotes, mostrando "Importando... x/N".

Detalhes das regras em [09-importar-e-exportar.md](09-importar-e-exportar.md).

---

## 3.3 📋 Extrato (`extrato.html`)

**Objetivo:** ver, filtrar, editar e exportar todos os lançamentos.

**Largura:** é a única tela que usa **toda a largura** ao lado do menu (classe `pagina-larga`;
as outras param em 1320 px). Com isso a tabela cabe sem barra de rolagem horizontal em telas
de computador; Descrição, Detalhe, Banco e Classificação quebram linha se faltar
espaço. A rolagem lateral só volta em telas bem estreitas (celular).

**Cabeçalho:** ⬇️ **Exportar .xlsx** e **+ Novo lançamento**.

**Cartões de resumo:** Entradas · Saídas · Saldo do período (verde/vermelho) · 📅 Saldo previsto.
(Fórmulas em [06-calculos.md](06-calculos.md#61-extrato).)

**Filtros**

| Filtro | Tipo | Comportamento |
|--------|------|---------------|
| Ano | lista | Anos que existem nos dados + ano atual |
| Mês | múltipla escolha | Escolher meses preenche Dia início/Dia fim; lançamentos fora dos meses marcados ficam de fora (mesmo que estejam entre eles) |
| Dia início / Dia fim | data | Aceita data completa ou **só o dia** (completa com mês/ano do filtro) |
| Banco | múltipla escolha | Bancos existentes nos dados |
| Classificação | múltipla escolha | Classificação **gravada** no lançamento. Lista = classificações que existem nos dados |
| Tipo | Entradas e saídas / Só entradas / Só saídas | |
| Descrição | texto | "Contém" (em maiúsculas), filtra enquanto digita |
| Detalhe | texto | "Contém", filtra enquanto digita |
| Movimentação | Todas / Externo / Interno | |
| Vale | Tudo / Só vale / Sem vale | |
| Situação | Todas / Só previstas / Só realizadas | Prevista = data > hoje |

Botões: **Pesquisar**, **Mês atual** (volta ao padrão e ordenação por data ↓), **🔄 Atualizar dados**.
Padrão ao abrir pela 1ª vez: mês atual, do dia 01 até hoje. Depois, abre com o último filtro usado.

**Tabela:** Data (com selo "Previsto" se futuro) · Descrição · Detalhe · Movimentação (🔁 Interno / 🌐 Externo) · Banco · Classificação · Valor · Ações. Ordem padrão: data decrescente (lembrada). O Extrato mostra só a **classificação gravada**; a categoria equiparada (depois das regras) não tem coluna nem filtro próprio aqui.

**Chegando pelo Dashboard:** clicar num valor da "Evolução por categoria" abre o Extrato com
os filtros no endereço (`extrato.html?origem=dashboard&cat=...&ano=...&meses=...&tipo=...&mov=EXTERNO`,
mais banco, vale, descrição e detalhe do Dashboard). O Extrato aplica esses filtros **no lugar**
do último filtro salvo e limpa o endereço (um F5 não reaplica). A categoria do Dashboard vira um
**filtro temporário**, mostrado numa faixa acima da tabela ("Vindo do Dashboard: só os
lançamentos que entram na categoria X") com o botão **Tirar este filtro**. Ele filtra pela
categoria equiparada (para a lista bater com o valor clicado), não é salvo e some também em
"Mês atual". Por isso podem aparecer lançamentos com classificações diferentes na mesma lista
(ex.: TRANSPORTE antigo dentro da categoria UBER).

**+ Novo lançamento** abre o mesmo formulário do editor, **pré-preenchido pelos filtros**:

| Campo | Preenchimento |
|-------|---------------|
| Data | Dia **01** do mês do "Dia início" (ex.: filtro 05/07/26–31/07/26 → 01/07/2026); sem filtro de data → hoje |
| Banco | O banco filtrado, **só se houver exatamente 1** banco marcado; senão vazio |
| Descrição / Detalhe | O texto digitado nos filtros correspondentes |
| Movimentação | A do filtro (se não for "Todas") |

---

## 3.4 📊 Dashboard (`dashboard.html`)

**Objetivo:** visão geral do período: saldos, previstos, por banco e gráficos.

**Filtros:** os mesmos do Extrato, **sem** Situação. Botões Pesquisar, Mês atual, 🔄 Atualizar dados. Lembra o último filtro.

**Seções, na ordem da tela** (fórmulas em [06-calculos.md](06-calculos.md#62-dashboard)):

1. **Cartões:** Saldo do período · Entradas (+) · Saídas (−) · Saldo previsto. Entradas/Saídas consideram só movimentações **externas**.
2. **Faixa discreta:** Transferências internas no período (não entram em Entradas nem Saídas).
3. **Saldo por carteira:** cartão por banco com Entradas, Saídas, Saldo (borda com a cor do banco).
4. **Radar de previstos**, de cima para baixo:
   - **A descontar por banco:** um cartão por banco com "A entrar (previsto)" e "A descontar (previsto)".
   - **Lista por data** (largura toda, sem rolagem lateral; a descrição quebra linha): Data + selo Previsto + aviso de vencimento, Descrição, Banco, Classificação, Valor. Aviso só para **saídas**: 🟡 "Vence em N dias" (4 a 7 dias), 🔴 "Vence em N dias" / "Vence amanhã" (até 3 dias).
   - **Dia a dia, por banco:** um bloco recolhível por banco, uma linha por detalhe (Período, Detalhe, Entrando, Saindo).
5. **Evolução por categoria** (alternar **Gastos** / **Recebimentos**), conta em `js/evolucao-categorias.js` (equiparação de categorias em `js/finalidade.js`):
   - **Resumo:** total do período no ano do filtro × **mesmos meses** do ano anterior, com a variação em R$ e % ("você está gastando mais/menos"). No ano corrente o período vai de jan até o mês atual (inclui os previstos do mês); em anos passados, o ano inteiro.
   - **Gráfico:** mês a mês, linha do ano (cheia, em destaque; meses que ainda não chegaram tracejados, só previstos) × ano anterior (a mesma cor mais clara, tracejada). Cada ponto mostra o valor (ano atual em negrito, ano anterior apagado). O tooltip mostra os dois valores e a diferença.
   - **Tabela:** cada categoria em 4 linhas × Jan–Dez — ano atual (em destaque), ano anterior (mais claro), **Dif. R$** e **Dif. %** de cada mês — mais a coluna do período comparável (Jan–mês atual). R$ sem centavos; passar o mouse mostra o exato. Gasto subindo = vermelho ▲, caindo = verde ▼ (recebimentos ao contrário); "novo" quando não havia no ano anterior; meses que ainda não chegaram ficam sem diferença. Grupo **Total** no fim.
   - **Equiparar categorias pela finalidade** (ligado por padrão): a classificação mudou ao longo dos anos (TRANSPORTE virou UBER e ONIBUS; DAS/MEI e Spotify viraram DESP MENSAL; COMPRAS CASA virou COMPRAS CASA 108N...). Ligado, cada lançamento entra na categoria usada hoje, olhando classificação + descrição + detalhe — só na visão, o lançamento gravado não muda. Categorias com **≈** receberam lançamentos de outra classificação (passar o mouse no nome mostra de onde). As regras são de cada usuário e são editadas na tela **Configurações** ([12](12-configuracoes.md)); o padrão do sistema fica em `js/finalidade.js`.
   - **Clicar num valor** (de um mês ou da coluna do período, nas linhas do ano atual e do ano anterior) abre o **Extrato** já filtrado pela categoria, ano e mês(es) daquele valor (ver 3.3). Só com a equiparação ligada; a linha Total e a categoria "SEM CLASSIFICAÇÃO" não têm atalho. O total do Extrato pode diferir do valor clicado quando houver lançamentos de categorias à parte (o Dashboard os exclui, o Extrato não).
   - **Clicar no nome da categoria** (ou nas linhas Dif. R$ / Dif. %) mostra ela no gráfico e no resumo (selo "só CATEGORIA ✕" para voltar ao total).
   - Mesmas regras dos outros gráficos: usa os filtros de banco, vale, movimentação e texto (o período do filtro só define o ano); não conta transferências internas nem as categorias à parte.
6. **Categorias à parte:** Configurar → marcar classificações que não devem se misturar com o saldo. Um cartão por categoria (Entradas, Saídas, Saldo, remover) + gráfico do previsto por categoria à parte.
7. **Entradas** e **Gastos**, cada um com dois gráficos lado a lado: barras por categoria/classificação (azul) e **Evolução Jan–Dez** (linha verde/vermelha).
   - Clicar numa categoria destaca ela e a evolução passa a mostrar só ela (selo "só SALARIO ✕"). Clicar de novo ou no ✕ volta ao total.
   - Todo gráfico mostra o selo **Total: R$ …** ao lado do título.
8. **Suas visões personalizadas:** Nova visão → Título, Filtrar por (nenhum / classificação / banco / detalhe / descrição) + valor, Agrupar por, Tipo. Cada visão vira um gráfico de barras com Total e botão Remover.

---

## 3.5 🔀 Transferência (`transferencia.html`)

**Objetivo:** registrar PIX/transferência entre seus próprios bancos com um formulário só.

Campos: Valor, Data, **De** ➔ **Para** (lado a lado, com seta), Detalhe (opcional). Um resumo ao vivo ("NUBANK ➔ BRADESCO · R$ 150,00") mostra a direção antes de confirmar. Botão **Transferir** → confirmação → cria 2 lançamentos.
Tabela **Últimas transferências internas**: os 10 últimos lançamentos INTERNOS criados (inclui viradas de mês), com editar/excluir.
Regras completas em [05-transferencias-e-virada-de-mes.md](05-transferencias-e-virada-de-mes.md).

---

## 3.6 🔁 Virar mês (`virar-mes.html`)

**Objetivo:** levar o saldo de cada banco de um mês para o seguinte.

Seletores: Mês/Ano de origem e Mês/Ano de destino (padrão: origem = mês passado, destino = mês atual).
Tabela: só bancos com saldo ≠ 0 no mês de origem (Banco, Saldo apurado, botão **Remanejar valor**).
Regras em [05-transferencias-e-virada-de-mes.md](05-transferencias-e-virada-de-mes.md#52-virada-de-mês).

---

## 3.7 📈 Investimentos (`investimentos.html`)

**Objetivo:** visão só dos lançamentos com classificação `INVESTIMENTO`, organizada por investimento e por dono.

Seções: botões 🔄 Atualizar dados e **+ Lançamento** → cartões Total aportado / Total resgatado / Saldo investido → chips **Onde está aplicado** → **Por investimento** → **Por dono** (com [+] Aportado / [+] Resgatado expansíveis e botões + Aportar / + Resgatar) → tabela **Movimentações de investimento** com filtros.
Regras em [08-investimentos.md](08-investimentos.md).

---

## 3.8 🧭 Planejamento (`planejamento.html`)

**Objetivo:** saber quanto precisa até o próximo salário, quanto sobra e quanto dá para investir.

Seções: filtros (Ciclos, Ano, Banco, Vale; Limpar filtros) → cartões 💳 Saldo hoje · Contas até o próximo salário · Sobra/Falta até o próximo salário · 📈 Pode investir sem fazer falta → **💡 O que fazer agora** (lista de recomendações) → **🏦 Cada banco até o próximo salário** → **📆 Ciclos de salário** (bloquinhos; clicar abre os lançamentos do ciclo) → **⚙️ Como a conta é feita (ajustes)**: Colchão de segurança e Gastos do dia a dia.
Regras em [07-planejamento.md](07-planejamento.md).

---

## 3.9 Login (`login.html`)

E-mail e senha (Firebase). Erro: "E-mail ou senha não conferem." (genérico de propósito). Se já estiver logado, vai direto para Lançar. Não há tela de cadastro e a criação de contas está **desativada** no Firebase (Authentication → Configurações → Ações do usuário): um usuário novo só é criado pelo console ("Adicionar usuário"). Cada usuário vê só os próprios lançamentos e configurações.

---

## 3.10 ⚙️ Configurações (`configuracoes.html`)

**Objetivo:** ajustar, por usuário, as sugestões e as regras que antes eram fixas no código, e corrigir nomes errados em massa. Detalhes em [12-configuracoes.md](12-configuracoes.md).

Blocos: **Bancos sugeridos** · **Classificações sugeridas** · **Bancos de vale** · **Corrigir nomes nos lançamentos** (classificação ou banco) · **Aplicar regras aos lançamentos** (grava a categoria das regras como classificação, com prévia e seleção) · **Equiparação de categorias** (tabela de regras). No topo: **Restaurar padrão** e **Salvar alterações** (as listas e regras só valem depois de salvar; a correção de nomes e a aplicação das regras gravam na hora).
