# 💰 Meu Financeiro

Sistema web para registrar e acompanhar transações financeiras, com login individual, dados protegidos no Firebase e uma visão geral tipo dashboard.

## Como funciona

1. **Login**: sem sessão válida, qualquer página redireciona para `login.html`.
2. **Novo lançamento**: ao salvar, grava a transação com o seu `userId`; os campos de Banco e Classificação sugerem valores já usados por você.
3. **Extrato**: mostra tudo que é seu, com filtros por período, banco e movimentação, e totais calculados na hora.
4. **Dashboard**: cruza todas as suas transações para mostrar saldo por banco (entradas − saídas acumuladas), e o resultado do mês atual.