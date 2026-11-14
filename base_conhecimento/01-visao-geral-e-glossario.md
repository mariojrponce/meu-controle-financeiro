# 1. Visão geral e glossário

## O que é

**Meu Financeiro** é um sistema web pessoal de controle financeiro que substitui a
planilha `Despesas Mensais - 2026.xlsx` (aba `ENTRADAS  SAIDAS`). Um único usuário por
conta, login com e-mail e senha.

## Arquitetura

| Item | Como é |
|------|--------|
| Frontend | HTML + CSS + JavaScript puro (ES Modules), **sem framework e sem build** |
| Login | Firebase Authentication (e-mail/senha) |
| Banco de dados | Cloud Firestore, **uma única coleção**: `carteira` |
| Bibliotecas (CDN) | Firebase SDK 10.12.2, Chart.js 4.5.0 + datalabels 2.2.0 (Dashboard), SheetJS/XLSX 0.18.5 (Importar e Extrato) |
| Hospedagem | GitHub Pages (`mariojrponce.github.io/meu-controle-financeiro`); regras do Firestore publicadas com `firebase deploy --only firestore:rules` |
| Versões | Tags git `vX.Y.Z` desde a rodada 03-10-26 (atual: **v1.7.0**) |

Toda página privada chama `exigirLogin()` (`js/auth-guard.js`): sem sessão, redireciona
para `login.html`. Ao sair, o sistema apaga do navegador tudo que termina com `_<uid>`
(cache e filtros).

## Mapa de telas (menu)

| Menu | Arquivo | Script | Para quê |
|------|---------|--------|----------|
| ➕ Lançar | `index.html` | `js/app.js` | Lançamento rápido + últimos 10 |
| 📥 Importar | `importar.html` | `js/importar.js` | Importar planilha em lote |
| 📋 Extrato | `extrato.html` | `js/extrato.js` | Lista completa, filtros, totais, exportar |
| 📊 Dashboard | `dashboard.html` | `js/dashboard.js` | Saldos, previstos, gráficos |
| 🔀 Transferência | `transferencia.html` | `js/transferencia.js` | Transferência entre bancos próprios |
| 🔁 Virar mês | `virar-mes.html` | `js/virar-mes.js` | Passar o saldo de um mês para o seguinte |
| 📈 Investimentos | `investimentos.html` | `js/investimentos.js` | Aportes, resgates, por investimento e por dono |
| 🧭 Planejamento | `planejamento.html` | `js/planejamento.js` + `js/planejamento-calculo.js` | Ciclos de salário, sobra, quanto investir |
| — | `login.html` | `js/login.js` | Entrar |

No celular, o menu vira barra inferior com rótulos curtos (Transf., Virar, Invest., Plano).

## Glossário

| Termo | Significado no sistema |
|-------|------------------------|
| **Lançamento / transação** | Um documento da coleção `carteira`: uma entrada ou saída de dinheiro em um banco, numa data. |
| **Entrada** | `tipo = "ENTRADA"`: dinheiro chegando no banco. Mostrado em verde com `+`. |
| **Saída** | `tipo = "SAIDA"`: dinheiro saindo do banco. Mostrado em vermelho com `-`. |
| **Externo** | `tipo_mov = "EXTERNO"` (🌐): gasto ou receita real, dinheiro que entra ou sai da sua vida financeira. |
| **Interno** | `tipo_mov = "INTERNO"` (🔁): movimento entre suas próprias contas (transferência, virada de mês). Não é gasto nem receita. |
| **Descrição** | Campo `descricao`: o que é o lançamento (ex.: `COMPRA NO MERCADO`). Obrigatório. |
| **Detalhe** | Campo `saida`: onde gastou / de onde recebeu (ex.: `MERCADO EXTRA`). Opcional. *O nome do campo é `saida` por herança da planilha.* |
| **Banco / carteira** | Campo `banco`: a conta onde o dinheiro está (NUBANK, BB, PLUXE, DINHEIRO FISICO…). |
| **Classificação** | Campo `classificacao_saida`: categoria (ALUGUEL, MERCADO, SALARIO, INVESTIMENTO…). Obrigatória, usada também para entradas. |
| **Previsto** | Lançamento com data **maior que hoje**. Aparece com selo "Previsto" e linha destacada. |
| **Realizado** | Lançamento com data **até hoje** (inclusive). |
| **Vale** | Lançamento cujo banco é de benefício (ALELO, PLUXE/PLUXEE, SODEXO, TICKET, VR, FLASH, CAJU, SWILE). |
| **Categoria à parte** | Classificação que o usuário marcou no Dashboard para ficar fora do saldo "de verdade" (ex.: vale alimentação). Configuração local do navegador. |
| **Virada de mês** | Par de lançamentos INTERNOS que leva o saldo de um banco do último dia do mês para o dia 01 do mês seguinte. |
| **Transferência interna** | Par de lançamentos INTERNOS entre dois bancos diferentes na mesma data. |
| **Aporte / Resgate** | Na tela Investimentos: aporte = SAÍDA (dinheiro indo para o investimento), resgate = ENTRADA (voltando). |
| **Dono da carteira** | Campo `dono_carteira`: de quem é a fatia de um investimento (EU, MAYARA…). |
| **Ciclo** | No Planejamento: do dia em que o salário cai até a véspera do próximo salário. |
| **Colchão** | No Planejamento: valor que sempre fica em caixa e nunca é sugerido para investir. |
| **Dia a dia / reserva** | No Planejamento: estimativa de gastos ainda não lançados (lanche, uber…), pela média diária dos últimos 90 dias. |
