# 10. Critérios e convenções (lista consolidada)

Referência rápida de **todas as regras de decisão** do sistema. Detalhes nos arquivos indicados.

## 10.1 Classificação do lançamento

| Critério | Regra | Onde |
|----------|-------|------|
| Entrada × Saída | campo `tipo` | todos |
| Real × entre contas | `tipo_mov`: EXTERNO = gasto/receita real; INTERNO = entre contas próprias | todos |
| Previsto × Realizado | `data > hoje` = previsto; `data ≤ hoje` = realizado (data local do computador) | Extrato, Dashboard, Exportar, Planejamento |
| Vale | banco começa com um nome da lista de bancos de vale do usuário (padrão: ALELO, PLUXE(E), SODEXO, TICKET, VR, FLASH, CAJU, SWILE) | `js/vale.js`, Configurações |
| Categoria (equiparada) | classificação depois das regras de equiparação do usuário: a **primeira** regra que servir (tipo + classificação de origem + texto opcional na descrição/detalhe) define a categoria; sem regra, é a própria classificação | `js/finalidade.js`, Configurações; usada no Extrato e na Evolução por categoria |
| Salário | ENTRADA com classificação contendo SALARIO/SALÁRIO | Planejamento |
| Aporte (Planejamento) | SAÍDA com classificação contendo INVESTIMENTO | Planejamento |
| Investimento (tela) | classificação exatamente `INVESTIMENTO` | Investimentos |
| Aporte / Resgate (tela) | SAIDA = aporte, ENTRADA = resgate | Investimentos |
| Categoria à parte | escolhida pelo usuário no Dashboard (salva no navegador) | Dashboard |
| Dia a dia | categorias escolhidas; sugestão: ≥ 10 lançamentos e média ≤ R$ 60 em 90 dias | Planejamento |

## 10.2 O que entra em cada total

| Total | Realizado | Previsto | Interno | À parte | Vale |
|-------|:---------:|:--------:|:-------:|:-------:|:----:|
| Extrato: Entradas / Saídas / Saldo | ✅ | ❌ | ✅ | ✅ | filtro |
| Extrato: Saldo previsto | ✅ | ✅ | ✅ | ✅ | filtro |
| Dashboard: Entradas / Saídas / Saldo do período | ✅ | ❌ | ❌ | ❌ | filtro |
| Dashboard: Saldo previsto | ✅ | ✅ | ❌ | ❌ | filtro |
| Dashboard: Transferências internas | ✅ | ❌ | só internos | ❌ | filtro |
| Dashboard: Saldo por banco | ✅ | ❌ | ✅ | ✅ | filtro |
| Dashboard: Previstos / A descontar / Dia a dia | ❌ | ✅ | ✅ | ✅ | filtro |
| Dashboard: Gráficos por classificação e evolução | ✅ | ✅ | ❌ | ❌ | filtro |
| Dashboard: Visões personalizadas | ✅ | ✅ | ✅ | ✅ | filtro |
| Virar mês: saldo apurado | ✅ | ✅ | ✅ | ✅ | ✅ (sem filtro) |
| Planejamento: Saldo hoje | ✅ | ❌ | ✅ | ✅ | padrão sem vale |
| Planejamento: contas/entradas do ciclo | — | ✅ (atual/futuro) | ❌ | ✅ | padrão sem vale |
| Planejamento: cada banco até o próximo salário | — | ✅ | ✅ | ✅ | padrão sem vale |
| Investimentos | ✅ | ✅ | (sempre externo) | ✅ | ✅ (sem filtro) |

## 10.3 Nomes padrão gerados pelo sistema

| Operação | descricao | saida (detalhe) | classificacao_saida | tipo_mov |
|----------|-----------|-----------------|---------------------|----------|
| Transferência, lado origem | `PIX PARA <DESTINO>` | o digitado (opcional) | `CONTROLE INTERNO` | INTERNO |
| Transferência, lado destino | `PIX DE <ORIGEM>` | o digitado (opcional) | `CONTROLE INTERNO` | INTERNO |
| Virada de mês (2 lados) | `VALOR EM CARTEIRA` | `VIR_MES_<MÊS>-<AA>_<MÊS>-<AA>` | `VIRADA DE MÊS` | INTERNO |
| Investimento | o digitado | o digitado | `INVESTIMENTO` | EXTERNO |
| Salário estimado (só na conta, não é gravado) | `SALÁRIO (estimado)` | — | `SALARIO` | — |

## 10.4 Datas geradas

| Situação | Data |
|----------|------|
| Virada: lado que sai | último dia do mês de origem |
| Virada: lado que entra | dia 01 do mês de destino |
| Transferência | a mesma data nos dois lados |
| "+ Novo lançamento" no Extrato | dia 01 do mês do Dia início do filtro (ou hoje) |
| Filtro padrão Extrato/Dashboard | dia 01 do mês atual até hoje |
| Virar mês padrão | origem = mês passado, destino = mês atual |
| Salário estimado | 15 e 30 (ou último dia do mês) |
| Ciclo | do salário até a véspera do próximo salário |

## 10.5 Padrões de gravação

- Textos: sem espaços nas pontas e em **MAIÚSCULAS**.
- Banco: `BANCO DO BRASIL` → `BB`.
- Valor: número positivo, 2 casas.
- Data: ISO `aaaa-mm-dd`.
- `userId` e `criadoEm` automáticos.
- Operações de 2 lançamentos (transferência, virada) gravam um depois do outro (não é atômico).

## 10.6 Limites e números fixos

| Item | Valor |
|------|-------|
| Descrição / Detalhe | até 120 caracteres |
| Banco / Classificação / Investimento / Dono / Onde está aplicado | até 60 caracteres |
| Valor mínimo | R$ 0,01 |
| Últimos lançamentos (Lançar) / últimas transferências | 10 |
| Validade do cache | 6 horas |
| Lote de importação | 400 linhas |
| Tamanho máximo de arquivo na importação | 10 MB (planilha) e 25 MB por arquivo (extrato PDF/CSV/imagem) |
| Valor máximo de um lançamento (regras do Firestore) | R$ 1.000.000.000 |
| Listas de Configurações | até 300 itens cada (bancos, classificações, bancos de vale, regras) |
| Lote de correção de nomes em massa | 450 lançamentos por lote (cada lote é tudo ou nada) |
| Cache das configurações | 6 horas |
| Aviso de vencimento | ≤ 7 dias (🟡), ≤ 3 dias (🔴), só saídas |
| Saldo considerado "zero" | |saldo| < R$ 0,005 |
| Juntar salários | até 3 dias de diferença |
| Janela do dia a dia | 90 dias |
| Colchão automático | 15 dias de dia a dia, arredondado para cima em múltiplos de R$ 50 |
| Horizonte do Planejamento | ciclo atual + 3 |
| Tema automático | claro das 06h às 18h, escuro fora disso |
| Filtros de texto | aplicam 250 ms depois de parar de digitar |
| Toast | some em ~2,2 s |

## 10.7 Ordenações padrão

| Lista | Ordem |
|-------|-------|
| Extrato / Investimentos | data decrescente |
| Últimos lançamentos / transferências | criação mais recente primeiro |
| Previstos (Dashboard) | data crescente |
| Saldo por banco | maior saldo primeiro |
| A descontar / Previsto dia a dia | maior saída primeiro |
| Barras de categoria | maior valor primeiro |
| Virar mês | maior saldo primeiro |
| Por investimento / Por dono / chips | maior saldo investido primeiro |
| Planejamento – bancos | maior "a pagar" primeiro |
| Planejamento – ciclos | atual → futuros (mais próximo) → encerrados (mais recente) |
| Sugestões (combobox) | alfabética pt-BR |
