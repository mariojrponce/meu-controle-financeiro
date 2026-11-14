# 4. Como inserir, editar e excluir valores

## 4.0 Todas as portas de entrada

| Onde | Botão | Cria | Campos fixos automáticos |
|------|-------|------|--------------------------|
| Lançar | Salvar transação | 1 lançamento | — |
| Extrato | + Novo lançamento | 1 lançamento (pré-preenchido pelos filtros) | — |
| Transferência | Transferir | 2 lançamentos | `tipo_mov = INTERNO`, classificação `CONTROLE INTERNO`, descrições `PIX PARA…`/`PIX DE…` |
| Virar mês | Remanejar valor | 2 lançamentos | `tipo_mov = INTERNO`, classificação `VIRADA DE MÊS`, descrição `VALOR EM CARTEIRA`, detalhe `VIR_MES_…` |
| Investimentos | + Lançamento / + Aportar / + Resgatar | 1 lançamento | `tipo_mov = EXTERNO`, classificação `INVESTIMENTO` |
| Importar | Importar N lançamentos | N lançamentos | — |

Todos gravam pela mesma função (`criarTransacao` ou `importarTransacoes`), então **qualquer
lançamento, de qualquer origem, pode ser editado ou excluído pelo Extrato** como um normal.

## 4.1 Data

Campo de texto que entende vários jeitos de digitar (`ligarCampoDataInteligente`, em
Lançar, editor, Transferência e filtros de Investimentos):

| Você digita | Vira | Quando |
|-------------|------|--------|
| `07072026` | `07/07/2026` | **Na hora**, enquanto digita (máscara automática, só quando digita números/barras) |
| `7/7/26` | `07/07/2026` | Ao sair do campo |
| `7-7-2026`, `7.7.2026`, `7 7 2026` | `07/07/2026` | Ao sair do campo (aceita `/ - .` ou espaço) |
| `26/07` | `26/07/<ano atual>` | Ao sair do campo (sem ano = ano atual, como no Excel) |
| Colar `Pagamento em 2026-07-07 …` | `07/07/2026` | Ao colar: procura `aaaa-mm-dd`, `dd/mm/aaaa` ou `dd/mm/aa` dentro do texto |

- Ano com 2 dígitos vira `20aa`.
- Data inválida → campo fica destacado em vermelho (sem pop-up) e, ao salvar, aparece "Data inválida. Use dd/mm/aaaa.".
- Validação: mês 1–12 e dia 1–31 (não confere se o dia existe no mês, ver [11](11-limitacoes-e-pontos-de-atencao.md)).

**Campos "Dia início / Dia fim" (Extrato e Dashboard)** usam outra versão (`ligarCampoFiltroData`): aceitam tudo acima **e também só o dia** (`5` → `05/<mês do filtro>/<ano do filtro>`). O mês usado é o primeiro mês marcado no filtro, ou o mês atual. Não têm a máscara automática.

## 4.2 Valor

- Campo numérico, mínimo **0,01**, passo 0,01.
- **Sempre positivo.** Para saída não se digita "-": escolhe-se **Tipo = Saída**.
- Valor vazio, zero ou negativo → "Preencha todos os campos obrigatórios.".
- Na tela, valores aparecem como `R$ 1.234,56` (pt-BR), com `+` verde para entrada e `-` vermelho para saída.

## 4.3 Textos (descrição, detalhe, banco, classificação, investimento, dono)

- Espaços nas pontas são removidos e **tudo vira MAIÚSCULAS** ao salvar.
- Limites: descrição/detalhe 120 caracteres; banco/classificação/investimento/dono/onde está aplicado 60.
- Obrigatórios: descrição, banco, classificação (e, em Investimentos, investimento e dono).

## 4.4 Banco: sugestões e nome padrão

- **Sugestões iniciais**: NUBANK, NUBANK CAIXINHA, CLEAR, PAGBANK, INTER, ITAÚ, BRADESCO, SANTANDER, CAIXA, BB, C6 BANK, PICPAY, mais **todos os bancos já usados** nos seus lançamentos (sem repetir, em ordem alfabética).
- **Apelidos**: ao salvar, `BANCO DO BRASIL` vira `BB` (em Lançar, editor, Transferência e Importar). Para unificar outro apelido, adicionar em `APELIDOS_BANCO` (`js/dados-comuns.js`).
- Bancos de **vale** são reconhecidos pelo começo do nome: ALELO, PLUXE, PLUXEE, SODEXO, TICKET, VR, FLASH, CAJU, SWILE.

## 4.5 Classificação: sugestões

Sugestões iniciais: ALUGUEL, ENERGIA, GÁS, ÁGUA, INTERNET, CELULAR, TRANSPORTE, CAIXINHA,
RAÇÃO GATOS, MENSAL, DESP MENSAL, MERCADO, LAZER, SAÚDE, EDUCAÇÃO, INVESTIMENTO, SALÁRIO,
OUTROS, mais todas as já usadas.

Classificações com efeito especial no sistema:

| Classificação | Efeito |
|---------------|--------|
| Qualquer uma com `SALARIO`/`SALÁRIO` (entrada) | Define as datas dos ciclos no Planejamento |
| `INVESTIMENTO` (exatamente) | Aparece na tela Investimentos |
| Qualquer uma contendo `INVESTIMENTO` | Conta como "aporte" no Planejamento |
| `CONTROLE INTERNO` | Usada pela tela Transferência |
| `VIRADA DE MÊS` | Usada pela tela Virar mês |
| As marcadas como "à parte" no Dashboard | Ficam fora do saldo e dos gráficos principais do Dashboard |

## 4.6 Campo com sugestões (combobox)

- Ao focar, abre a lista; ao digitar, filtra por "contém" (ignora acento e maiúscula).
- **Autocompleta** enquanto digita: completa com a primeira opção que **começa** com o texto e deixa o resto selecionado. Continuar digitando substitui; Tab/Enter aceita. Ao apagar, não autocompleta.
- Aceita valor novo ("Sem sugestões — será salvo como novo valor").

## 4.7 Tipo e Movimentação: como escolher

| Situação | Tipo | Movimentação |
|----------|------|--------------|
| Gasto (mercado, conta, uber) | Saída | Externo |
| Salário, presente, reembolso | Entrada | Externo |
| PIX do Nubank para o BB | use a tela **Transferência** (ou 2 lançamentos Interno) | Interno |
| Passar saldo de um mês para o outro | use a tela **Virar mês** | Interno |
| Aporte em investimento | use a tela **Investimentos** (Aporte = Saída) | Externo |
| Resgate de investimento | Investimentos (Resgate = Entrada) | Externo |
| Lançamento futuro (conta agendada) | normal, com **data futura** | — vira "Previsto" sozinho |

## 4.8 Editar

- ✏️ em Lançar, Extrato, Transferência ou Investimentos abre o mesmo modal com todos os campos.
- Salvar regrava valor, data, descrição, detalhe, banco, tipo, movimentação e classificação (as mesmas regras de maiúsculas, banco padrão e validação).
- No modal da tela Investimentos, Movimentação e Classificação não aparecem: ao salvar viram `EXTERNO` e `INVESTIMENTO`.
- Editar **um lado** de uma transferência/virada **não altera o outro lado**: ajuste os dois.

## 4.9 Excluir

🗑 → confirmação "Excluir lançamento?" → apaga do Firestore e do cache. Não existe lixeira nem desfazer. Em transferências e viradas, apague **os dois** lançamentos.

## 4.10 Lançamentos futuros (previstos)

Não há campo "previsto". Basta lançar com **data futura**. Enquanto a data for maior que hoje:
- aparece com selo "Previsto" no Extrato e na tabela de previstos do Dashboard;
- não entra no "Saldo do período", mas entra no "Saldo previsto";
- entra em "A descontar por banco" e no Planejamento como conta/entrada do ciclo.
No dia seguinte à data, vira realizado sozinho. Não há recorrência automática: contas que se repetem precisam ser lançadas uma a uma (ou importadas).
