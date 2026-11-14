# 9. Importar e exportar

## 9.0 Importar extratos dos bancos (`importar.html`, `js/importar-extratos.js`, `js/extratos/`)

Fluxo principal da tela Importar: você sobe os extratos, o sistema lê linha por linha, sugere
tudo, compara com o que já está lançado e confere o saldo. **Nada é gravado antes da revisão.**
Tudo roda no navegador (pdf.js fica em `js/vendor/pdfjs/`): sem servidor, sem CDN, sem IA.

### Formatos lidos

| Banco | Arquivo | Conferência da leitura |
|-------|---------|------------------------|
| Nubank conta | `.csv` do app (o PDF não — o CSV tem id único por transação) | sem totais no CSV; rendimento do mês só sai no PDF (lançar à mão) |
| Banco do Brasil | `.csv` (Latin-1) | saldo anterior + movimentos = saldo final |
| Bradesco conta | PDF "Bradesco Celular" | totais de crédito/débito, saldo final e **saldo linha a linha** |
| Bradesco cartão | PDF da **fatura fechada** (a aberta é imagem) | compras − créditos = total da fatura |
| Pluxee | PDF do app | só o "Saldo total" (comparado com o sistema) |
| Santander | PDF "Extrato Consolidado Inteligente" ou **comprovante do PIX** | totais de crédito/débito |
| Caixa | PDF é imagem → **não lido** (lançar à mão) | — |

O arquivo é identificado sozinho. Arquivos não suportados (investimentos CDB, habitação, PDF-imagem,
comprovantes de outros bancos) aparecem com a explicação do porquê.

### Regras de decisão (em ordem)

| Situação | Resultado |
|----------|-----------|
| `GASTOS CARTAO DE CREDITO` / pagamento de fatura no extrato da conta | **Ignorado** (as compras entram pela fatura; senão contaria 2×) |
| Compra na fatura do Bradesco | banco BRADESCO, **data = vencimento**, detalhe `BRADESCO CREDITO`, descrição `LUGAR - O QUE - dd/mm` (data da compra) |
| Parcela (`06/10`) | copia descrição/classificação da parcela anterior (`P5/P10 - AMAZON - 15/05` → `P6/P10 ...`) |
| `RESG/VENCTO CDB` / `APLICACAO CDB` | EXTERNO, `INVESTIMENTO`, detalhe `<BANCO> INVESTIMENTO`, `investimento = CDB <BANCO>` |
| PIX de/para **você mesmo** (nome ou CPF do titular) | INTERNO, `CONTROLE INTERNO`, `PIX PARA <BANCO>` / `PIX DE <BANCO>` (banco descoberto pelo código no texto do Nubank ou pela outra ponta: outro extrato do lote ou lançamento interno já no sistema, até 3 dias) |
| PIX vindo do **Santander** (conta-salário) | EXTERNO, `SALARIO` (confirmado pelo extrato ou comprovante do Santander; sem eles, pela proximidade de um salário no sistema) |
| Demais | classificador (abaixo) |

O **Santander não vira banco no sistema**: é conta de passagem (saldo sempre 0). Seu extrato/comprovante só serve para reconhecer o salário no Bradesco.

### Classificador (`js/extratos/classificador.js`)

1. Texto do banco limpo (`DL*Spotify P478E` → `SPOTIFY`) é comparado com os **Detalhes** já usados
   (e, no cartão, com o começo da Descrição). Se o mesmo texto já foi importado antes (`texto_banco`), usa direto o que você confirmou.
2. Classificação por votos dos lançamentos parecidos: pesam mais os **recentes** (meia-vida ~2 meses), do **mesmo banco** e de **valor parecido** (GIGANTE R$ 300 → COMPRAS CASA; R$ 20 → LANCHE).
3. Confiança: **alta** (≥ 75% dos votos e ≥ 3 exemplos), **média** (≥ 50% e ≥ 2), **baixa**, **nenhuma** (precisa classificar).
   Medido com a base real (out–nov/2026, sem ver o futuro): alta acerta ~91%; interno × externo 100%.

### Comparação com o sistema

| Status | Quando | Ação padrão |
|--------|--------|-------------|
| Já lançado | mesmo `id_externo`, ou mesmo banco + tipo + valor com data até 3 dias | não grava |
| Diferente do sistema | parecido (até 10% ou R$ 1, mesma classificação) ou **previsto** com outra data | **Corrigir no sistema** (atualiza valor/data do lançamento existente) |
| Novo | resto | Lançar |

Compras do cartão só são comparadas com lançamentos `BRADESCO CREDITO`, e as da conta nunca com eles.
"**No sistema, mas não no extrato**": lançamentos do mesmo banco/período que o banco não mostra (lançado no banco errado, duplicado…) — com botão para excluir.

### Conferência do saldo
Mesma conta do Dashboard: virada de entrada do dia 01 + lançamentos do mês até a data do extrato
(sem a virada de saída; previstos só se o extrato confirmou). Mostra banco × sistema **depois de gravar**.
Sem virada no mês → avisa que não dá para conferir.

### Gravar e desfazer
Tudo num `writeBatch` (atômico até 450 operações). Cada lançamento leva `importacao_id`, `id_externo` e `texto_banco`.
Depois de gravar aparece **Desfazer esta importação** (apaga os criados e volta os valores corrigidos).

### Testes
`npm test` — testes com dados inventados sempre; com os extratos reais de `modelo-extratos/` e o backup
(pastas fora do git) quando existirem. `testes/leitores.html` mostra o que cada leitor entende de um arquivo (sem login, não grava nada).

## 9.1 Importar planilha (`importar.html`, `js/importar.js`, `js/importacao.js`)

Agora fica numa seção recolhida no fim da tela Importar.

### Arquivos aceitos
`.xlsx` (e outros que o SheetJS lê), `.csv`, `.txt` (UTF-8). Só a **primeira aba** é lida. A primeira linha é o cabeçalho.

### Reconhecimento das colunas
O cabeçalho é comparado sem acento, sem diferenciar maiúscula e com espaços virando `_`:

| Campo | Nomes de coluna aceitos | Obrigatória |
|-------|-------------------------|-------------|
| data | `data` | sim |
| valor | `valor` | sim |
| descricao | `descricao`, `descrição` | sim |
| saida (detalhe) | `saida`, `saída`, `detalhe` | não |
| banco | `banco` | sim |
| tipo | `tipo` | sim |
| tipo_mov | `tipo_mov`, `tipomov`, `movimentacao`, `movimentação` | sim |
| classificacao_saida | `classificacao_saida`, `classificação_saida`, `classificacao`, `classificação`, `categoria` | sim |

Faltando coluna obrigatória → "Não encontrei as colunas: …" e nada é processado.
Modelo pronto: `modelo-carteira.xlsx` (botão "Baixar modelo"), com as abas `Lançamentos`
(cabeçalho `data, valor, descricao, saida, banco, tipo, tipo_mov, classificacao_saida` e uma
linha de exemplo: `25/07/2026 · COMPRA NO MERCADO · MERCADO EXTRA · NUBANK · SAIDA · EXTERNO · MERCADO`)
e `Instruções`. A aba `Lançamentos` precisa continuar sendo a primeira.

> Atenção: o modelo de importação usa os **nomes do sistema** (`descricao` = descrição,
> `saida` = detalhe). O arquivo **exportado** usa os nomes da planilha antiga, que são
> trocados (§9.2). Para reimportar um arquivo exportado, renomeie as colunas.

### Conversão e validação de cada linha

| Campo | Conversão | Erro se |
|-------|-----------|---------|
| data | Data do Excel, número serial do Excel (base 30/12/1899) ou texto (`dd/mm/aaaa`, `d/m/aa`, `dd-mm-aaaa`, `dd/mm` = ano atual…) | não reconhece → "data inválida" |
| valor | Número, ou texto: tira `R$` e espaços; se tem vírgula, ponto = milhar e vírgula = decimal (`1.234,56`); senão ponto = decimal (`150.50`) | vazio, não número ou ≤ 0 → "valor inválido" |
| descricao | maiúsculas | vazia |
| banco | maiúsculas + `BANCO DO BRASIL`→`BB` | vazio |
| classificacao_saida | maiúsculas | vazia |
| saida | maiúsculas | — |
| tipo | maiúsculas, sem acento (`Saída` → `SAIDA`) | ≠ ENTRADA/SAIDA |
| tipo_mov | maiúsculas, sem acento | ≠ INTERNO/EXTERNO |

Linhas com erro **não** são importadas. As válidas são gravadas em **lotes de 400**.
Se der erro no meio: "Erro durante a importação. Confira o extrato — parte pode já ter sido salva." (não há desfazer).
A importação não grava `investimento`, `dono_carteira` nem `banco_investimento`.
**Não há verificação de duplicados**: importar o mesmo arquivo duas vezes duplica tudo.

## 9.2 Exportar .xlsx (`js/exportar-excel.js`, botão no Extrato)

- Exporta **exatamente o que está filtrado** no Extrato (para tudo, limpe os filtros antes). Sem lançamentos → aviso de erro.
- Arquivo: `Despesas Mensais - aaaa-mm-dd.xlsx` (data de hoje), aba `ENTRADAS  SAIDAS` (dois espaços), no modelo da planilha real.

| Coluna | Conteúdo | Formato |
|--------|----------|---------|
| VALOR | valor (positivo) | `R$ #,##0.00` |
| SAIDA | **descrição** (`descricao`) | |
| DESCRICAO | **detalhe** (`saida`) | |
| BANCO | banco | |
| DATA | data como número de data do Excel | `dd/mm/yyyy` |
| SITUACAO | `PREVISTO` se data > hoje; senão `RECEBIDO` (entrada) ou `PAGO` (saída) | |
| TIPO | ENTRADA / SAIDA | |
| MES | nome do mês em maiúsculas (ex.: `OUTUBRO`) | |
| ANO | ano | |
| TIPO_MOV | INTERNO / EXTERNO | |
| DIA | dia do mês | |
| CLASSIFICACAO SAIDA | classificação | |
| DIA_SEMANA | dia da semana por extenso (ex.: `terça-feira`) | |

- **SAIDA/DESCRICAO trocados de propósito**: na planilha original, "SAIDA" guarda a descrição principal e "DESCRICAO" o detalhe.
- Larguras de coluna copiadas da planilha original.
- Diferença deliberada: data em `dd/mm/yyyy` (a original usava `mm-dd-yy`).
- SITUACAO é deduzida pela data. A planilha original permitia marcar manualmente.
