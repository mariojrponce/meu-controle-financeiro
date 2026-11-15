# Base de conhecimento — Meu Financeiro

> Referência completa de **como o sistema funciona**: telas, formas de inserir valores,
> transferências, cálculos e critérios. Tudo aqui foi levantado **direto do código**
> (`js/*.js`, `*.html`, `firestore.rules`) em 21/10/2026, versão **v1.7.0**, e revisado em
> **15/11/2026** (tela Configurações, coluna/filtro de Categoria no Extrato, atalho do
> Dashboard para o Extrato e reforços de segurança).
> Quando um documento antigo (`melhorias/*.status.md`) diz uma coisa e o código faz
> outra, vale o código, e a diferença está anotada.

## Índice

| # | Arquivo | Assunto |
|---|---------|---------|
| 1 | [01-visao-geral-e-glossario.md](01-visao-geral-e-glossario.md) | O que é o sistema, arquitetura, termos usados em todo lugar |
| 2 | [02-modelo-de-dados.md](02-modelo-de-dados.md) | Campos de um lançamento, regras do Firestore, cache e dados salvos no navegador |
| 3 | [03-telas.md](03-telas.md) | Cada tela: para que serve, o que mostra, filtros, botões |
| 4 | [04-inserir-valores.md](04-inserir-valores.md) | Todas as formas de lançar/editar/excluir, como digitar data, valor, banco, classificação |
| 5 | [05-transferencias-e-virada-de-mes.md](05-transferencias-e-virada-de-mes.md) | Transferência entre contas e virada de saldo de mês |
| 6 | [06-calculos.md](06-calculos.md) | Fórmulas de Extrato, Dashboard, Vale, gráficos e previstos |
| 7 | [07-planejamento.md](07-planejamento.md) | Planejamento por salário: ciclos, reserva, colchão, "pode investir" |
| 8 | [08-investimentos.md](08-investimentos.md) | Gestão de investimentos: aporte, resgate, dono, "onde está aplicado" |
| 9 | [09-importar-e-exportar.md](09-importar-e-exportar.md) | Importação de planilha e exportação .xlsx no modelo da planilha real |
| 10 | [10-criterios-e-convencoes.md](10-criterios-e-convencoes.md) | Lista consolidada de regras, nomes padrão e critérios de decisão |
| 11 | [11-limitacoes-e-pontos-de-atencao.md](11-limitacoes-e-pontos-de-atencao.md) | Comportamentos que podem surpreender, limitações e pendências |
| 12 | [12-configuracoes.md](12-configuracoes.md) | Tela Configurações: sugestões, bancos de vale, regras de equiparação e correção de nomes em massa |
| 13 | [13-seguranca.md](13-seguranca.md) | O que protege o sistema (regras, CSP, cabeçalhos, dados no navegador) e o que ficou pendente |
| — | [blueprint_de_seguran_a_defensiva_para_ias.md](blueprint_de_seguran_a_defensiva_para_ias.md) | Diretrizes de segurança usadas como referência na revisão (o item 13 diz o que se aplica aqui) |

## Resumo em 10 linhas

1. Todo dinheiro é registrado como **lançamento** (uma linha) na coleção `carteira` do Firestore. As preferências de cada usuário (sugestões, bancos de vale, regras de categoria) ficam em `configuracoes/{uid}`.
2. Cada lançamento tem **tipo** (ENTRADA/SAIDA) e **movimentação** (EXTERNO = dinheiro real entrando ou saindo; INTERNO = movimento entre suas próprias contas).
3. **Previsto** = data do lançamento **depois de hoje**. **Realizado** = data **até hoje**. Não existe campo de situação: a data decide.
4. **Saldo de um banco num mês** = soma (entradas − saídas) dos lançamentos daquele banco no mês. O saldo passa de um mês para o outro pela **virada de mês** (par de lançamentos INTERNOS "VALOR EM CARTEIRA").
5. **Transferência interna** = 2 lançamentos INTERNOS: SAÍDA na origem ("PIX PARA X") + ENTRADA no destino ("PIX DE Y"), classificação `CONTROLE INTERNO`.
6. Os totais de **Entradas/Saídas do Dashboard** ignoram INTERNOS e "categorias à parte". O **Extrato** soma tudo o que está filtrado.
7. **Vale** (ALELO, PLUXE…) é reconhecido pelo nome do banco (lista ajustável em Configurações) e pode ser incluído, isolado ou excluído em quase todas as telas.
8. **Investimento** = lançamento com classificação `INVESTIMENTO`. Aporte = SAÍDA, resgate = ENTRADA. Os campos extras `investimento` e `dono_carteira` agrupam esses lançamentos.
9. **Planejamento** divide o tempo em ciclos de salário (dia do salário até a véspera do próximo) e projeta sobra/falta, reserva para o dia a dia e quanto dá para investir.
10. Todo texto é salvo **em MAIÚSCULAS**, data em ISO `aaaa-mm-dd`, valor sempre **positivo** (o sinal vem do tipo).
