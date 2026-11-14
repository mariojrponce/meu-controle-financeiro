# 3. Telas

Elementos comuns a todas as telas privadas:

- **Menu lateral** (desktop) / **barra inferior** (celular) com as 8 telas, e-mail do usuário, botão de tema e 🚪 Sair.
- **Tema**: ☀️ Claro → 🌙 Escuro → 📜 Sépia → Claro (cada clique avança). Sem escolha manual, o tema segue o horário: **06h–18h claro, fora disso escuro**. A escolha manual fica gravada e passa a valer sempre, até trocar de novo.
- **Avisos (toast)**: mensagem discreta no canto, some em ~2,2 s (verde = sucesso, vermelho = erro).
- **Janelas flutuantes (modais)**: fecham com Cancelar, ou clicando fora **somente se o clique começar e terminar no fundo escuro**. Assim, selecionar um texto dentro da janela e soltar o mouse fora não fecha a janela nem perde o que foi digitado. A janela de detalhes do ciclo (Planejamento) fecha também com **Esc**.
- **Tabelas**: clicar no cabeçalho ordena (▲/▼, clique de novo inverte). Células não quebram linha; a página inteira rola (sem barra de rolagem interna).
- **Excluir** sempre pede confirmação ("Essa ação não pode ser desfeita").

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
| Descrição | texto | "Contém" (em maiúsculas), filtra enquanto digita |
| Detalhe | texto | "Contém", filtra enquanto digita |
| Movimentação | Todas / Externo / Interno | |
| Vale | Tudo / Só vale / Sem vale | |
| Situação | Todas / Só previstas / Só realizadas | Prevista = data > hoje |

Botões: **Pesquisar**, **Mês atual** (volta ao padrão e ordenação por data ↓), **🔄 Atualizar dados**.
Padrão ao abrir pela 1ª vez: mês atual, do dia 01 até hoje. Depois, abre com o último filtro usado.

**Tabela:** Data (com selo "Previsto" se futuro) · Descrição · Detalhe · Movimentação (🔁 Interno / 🌐 Externo) · Banco · Classificação · Valor · Ações. Ordem padrão: data decrescente (lembrada).

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

1. **Cartões:** Saldo do período · Entradas no período · Saídas no período · 🔁 Transferências internas · 📅 Saldo previsto. Entradas/Saídas consideram só movimentações **externas**.
2. **📅 Lançamentos previstos (futuros):** Data + selo Previsto + aviso de vencimento, Descrição, Banco, Classificação, Valor. Ordem por data crescente.
   - Aviso só para **saídas**: 🟡 "Vence em N dias" (4 a 7 dias), 🔴 "Vence em N dias" / "Vence amanhã" (até 3 dias).
3. **⏰ A descontar por banco (previsto):** um cartão por banco com "A entrar (previsto)" e "A descontar (previsto)". Ordem: quem mais vai descontar primeiro.
4. **📆 Previsto por banco, dia a dia:** um bloco recolhível por banco. Dentro, uma linha por **detalhe** (lançamentos com o mesmo Detalhe são somados), com Período (primeira–última data e "(Nx)"), Detalhe, Entrando, Saindo.
5. **💳 Saldo por carteira / banco (no período):** cartão por banco com Entradas, Saídas, Saldo (com a cor do banco).
6. **🍱 Categorias à parte:** ⚙️ Configurar → marcar classificações que não devem se misturar com o saldo. Um cartão por categoria (Entradas, Saídas, Saldo, 🗑 remover).
7. **📅 Previsto (futuro) por categoria à parte:** barras agrupadas Entradas previstas × Saídas previstas.
8. **💵 Entradas por categoria** (barras) e **📈 Evolução mensal de entradas** (linha jan–dez).
9. **📌 Maiores gastos do período por classificação** (barras) e **📈 Evolução mensal de gastos** (linha jan–dez).
   - Clicar numa categoria (barra, espaço vazio ou nome) destaca ela e a evolução passa a mostrar só ela (selo "só SALARIO ✕"). Clicar de novo ou no ✕ volta ao total.
   - Todo gráfico mostra o selo **Total: R$ …** ao lado do título.
10. **🧩 Suas visões personalizadas:** ➕ Nova visão → Título, Filtrar por (nenhum / classificação / banco / detalhe / descrição) + valor, Agrupar por (detalhe / classificação / banco / descrição), Tipo (só saídas / só entradas / ambos). Cada visão vira um gráfico de barras com Total e botão 🗑 Remover.

---

## 3.5 🔀 Transferência (`transferencia.html`)

**Objetivo:** registrar PIX/transferência entre seus próprios bancos com um formulário só.

Campos: Valor, Data, Banco de origem, Banco de destino, Detalhe (opcional). Botão **Transferir** → confirmação → cria 2 lançamentos.
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

E-mail e senha (Firebase). Erro: "E-mail ou senha inválidos.". Se já estiver logado, vai direto para Lançar. Não há tela de cadastro: o usuário é criado no console do Firebase.
