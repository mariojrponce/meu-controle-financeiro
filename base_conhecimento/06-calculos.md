# 6. Cálculos (Extrato, Dashboard, Vale, gráficos)

Notação usada nas fórmulas:

- `E` = soma dos valores com `tipo = ENTRADA`; `S` = soma com `tipo = SAIDA`.
- `hoje` = data local do computador (`aaaa-mm-dd`).
- **Realizado** = `data ≤ hoje`; **Previsto/futuro** = `data > hoje`.
- **Externo** = `tipo_mov = EXTERNO`; **Interno** = `tipo_mov = INTERNO`.
- **À parte** = classificação marcada em "Categorias à parte" no Dashboard.
- Lançamento sem `valor` numérico é ignorado em todos os cálculos.

## 6.0 Período dos filtros (Extrato e Dashboard)

Escolher Ano/Mês preenche "Dia início" e "Dia fim":

| Seleção | Dia início | Dia fim |
|---------|-----------|---------|
| Nenhum mês, ano atual | 01/01/ano | **hoje** |
| Nenhum mês, outro ano | 01/01/ano | 31/12/ano |
| Meses marcados, maior mês = mês atual | dia 01 do menor mês | **hoje** |
| Meses marcados, maior mês ≠ mês atual | dia 01 do menor mês | último dia do maior mês |

Depois disso, cada lançamento precisa: `início ≤ data ≤ fim` **e** mês da data ∈ meses marcados
(se houver meses marcados). Ex.: marcar Janeiro e Março exclui Fevereiro.

> ⚠️ Com o filtro padrão (mês atual), **Dia fim = hoje**. Os previstos do resto do mês ficam
> de fora até mudar o Dia fim para o último dia do mês (ou marcar também um mês futuro).

Ordem dos outros filtros: Banco (igual), Movimentação (igual), Vale, Situação (só Extrato),
Detalhe **contém**, Descrição **contém** (o texto do filtro é passado para maiúsculas).

## 6.1 Extrato

Sobre a lista **já filtrada** (todos os filtros, inclusive internos se "Movimentação = Todas"):

```
Entradas            = E (realizados)
Saídas              = S (realizados)
Saldo do período    = Entradas − Saídas
Saldo previsto      = Saldo do período + (E − S dos previstos)
```
- O cartão do saldo fica verde se ≥ 0, vermelho se < 0.
- **Diferença para o Dashboard:** o Extrato **não** exclui internos nem categorias à parte. Para ver só gasto/receita real, filtre Movimentação = Externo.
- Filtro Situação: "Só previstas" = `data > hoje`; "Só realizadas" = `data ≤ hoje`.

## 6.2 Dashboard

### Cartões principais (só realizados)

Para cada lançamento realizado do período:
1. Se a classificação é **à parte** → vai só para o cartão da categoria à parte.
2. Senão, se é **interno** → soma em "Transferências internas".
3. Senão (externo) → entra no saldo.

```
Entradas no período        = E (realizados, externos, fora das à parte)
Saídas no período          = S (realizados, externos, fora das à parte)
Saldo do período           = Entradas no período − Saídas no período
Transferências internas    = Σ valor dos internos realizados (ENTRADA + SAÍDA, os dois lados somados)
Saldo previsto             = Saldo do período + (E − S dos previstos externos, fora das à parte)
```

### Saldo por carteira / banco
Para cada banco, com **todos** os lançamentos realizados do período (externos, internos e à parte):
```
Entradas(banco) = E ; Saídas(banco) = S ; Saldo(banco) = E − S
```
Cartões ordenados do maior para o menor saldo. Num mês com virada feita, isso é o saldo real do banco até hoje.

### Categorias à parte
Por categoria marcada, com os realizados do período: Entradas, Saídas, Saldo = E − S.
"Previsto (futuro) por categoria à parte": E e S dos **previstos** de cada categoria, em barras agrupadas. Total: "Entradas: … · Saídas: …".

### Lançamentos previstos e avisos
- Lista todos os previstos do período (inclusive internos e à parte), por data crescente.
- `dias = data − hoje` (dias de calendário).
- Aviso só em **SAÍDA** e só se `dias ≤ 7`: 🔴 urgente se `dias ≤ 3` ("Vence amanhã" quando 1), senão 🟡 atenção.

### A descontar por banco (previsto)
Por banco, com **todos** os previstos do período (inclui internos e à parte, porque o débito acontece de verdade naquela conta):
```
A entrar (previsto)    = E (previstos do banco)
A descontar (previsto) = S (previstos do banco)
```
Ordem: maior "a descontar" primeiro.

### Previsto por banco, dia a dia
Mesmos previstos, agrupados por banco e depois por **chave = Detalhe** (ou Descrição, se o Detalhe estiver vazio). Para cada grupo: soma de entradas, soma de saídas, número de ocorrências, primeira e última data. Bancos ordenados por total de saídas.

### Gráficos por classificação (barras)
Usam **realizados + previstos** do período, **sem internos** e **sem à parte**:
```
Entradas por categoria[c] = E da classificação c
Maiores gastos[c]          = S da classificação c
```
Sem classificação → "SEM CLASSIFICAÇÃO". Barras do maior para o menor. Selo `Total = Σ das barras`.

### Evolução mensal (linhas, entradas e gastos)
- Sempre **12 meses, jan a dez**, do ano do "Dia início" (ou do Ano do filtro).
- Usa **o ano inteiro**, ignorando o mês e os dias filtrados, mas respeitando Banco, Movimentação, Vale, Detalhe e Descrição.
- Mesmas exclusões dos gráficos por classificação (sem internos, sem à parte, realizado + previsto).
```
Evolução[m] = Σ valor do tipo (ENTRADA ou SAIDA) com mês da data = m
```
- Com uma categoria clicada, soma só aquela classificação.
- Meses com zero ficam sem rótulo. Selo `Total = Σ dos 12 meses`.

### Visões personalizadas
Sobre os lançamentos do período (realizado + previsto, **inclusive internos**):
1. Se há "Filtrar por": mantém os que têm o campo **contendo** o valor (ex.: `UBER` pega `UBER EATS`).
2. Tipo: só SAIDA, só ENTRADA, ou ambos.
3. Agrupa pelo campo escolhido (vazio → "SEM VALOR") e soma `valor`.

> Com "Entradas e saídas", os valores são **somados** (não subtraídos): mostra volume, não saldo.

## 6.3 Filtro de Vale (`js/vale.js`)

```
é vale  ⇔  banco (sem espaços nas pontas, maiúsculo) começa com
           ALELO | PLUXE | PLUXEE | SODEXO | TICKET | VR | FLASH | CAJU | SWILE  (palavra inteira)
```
| Opção | Mantém |
|-------|--------|
| Tudo (padrão em Extrato, Dashboard e Lançar) | todos |
| Só vale (Alelo, Pluxe) | só lançamentos de banco vale |
| Sem vale (padrão no Planejamento) | todos menos vale |

Propriedade: `Tudo = Só vale + Sem vale` em qualquer total. Ex. real (01/08–31/12/2026): Entradas R$ 9.736,36 = R$ 1.392,53 + R$ 8.343,83.

Telas com o filtro: Lançar (últimos), Extrato (tabela, totais e exportação), Dashboard (tudo), Planejamento (tudo). Sem o filtro: Transferência, Virar mês, Investimentos, Importar.

## 6.4 Saldo por banco num mês (Virar mês)
```
saldo(banco, aaaa-mm) = E − S de todos os lançamentos do banco com data em aaaa-mm
```
(Detalhes em [05](05-transferencias-e-virada-de-mes.md#52-virada-de-mês).)

## 6.5 Formatação

- Moeda: `R$` + espaço que não quebra + número pt-BR com 2 casas (`R$ 1.234,56`).
- Datas: ISO no banco, `dd/mm/aaaa` na tela, `Mês/aa` nos rótulos de período (ex.: `Outubro/26`), `Out/26` nos eixos.
- Ordenação de colunas: numérica para valor, alfabética (sem diferenciar maiúscula) para o resto; data ISO ordena certo como texto.
