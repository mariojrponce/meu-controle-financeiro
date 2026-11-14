# 5. Transferências entre contas e virada de mês

As duas operações seguem o **mesmo padrão**: um movimento entre contas próprias vira
**dois lançamentos INTERNOS** que se anulam no total geral. Eles são lançamentos normais
(editáveis e excluíveis pelo Extrato) e aparecem com o selo 🔁 Interno.

## 5.1 Transferência interna (`transferencia.html`, `js/transferencia.js`)

### Formulário

| Campo | Obrigatório | Regra |
|-------|-------------|-------|
| Valor (R$) | sim | > 0 |
| Data | sim | data inteligente |
| Banco de origem (de onde sai) | sim | sugestões, maiúsculas, `BANCO DO BRASIL`→`BB` |
| Banco de destino (para onde vai) | sim | idem; **não pode ser igual à origem** |
| Detalhe | não | até 120, maiúsculas |

Fluxo: **Transferir** → confirmação "Transferir R$ X de "ORIGEM" para "DESTINO" em dd/mm/aaaa?" → grava → "Transferência registrada!" → formulário limpo.

### O que é gravado (exemplo: R$ 300,00 do NUBANK para o BB em 10/10/2026, detalhe "COMPLETAR FATURA")

| # | data | banco | tipo | tipo_mov | descricao | saida (detalhe) | classificacao_saida | valor |
|---|------|-------|------|----------|-----------|-----------------|---------------------|-------|
| 1 | 2026-10-10 | NUBANK | SAIDA | INTERNO | PIX PARA BB | COMPLETAR FATURA | CONTROLE INTERNO | 300 |
| 2 | 2026-10-10 | BB | ENTRADA | INTERNO | PIX DE NUBANK | COMPLETAR FATURA | CONTROLE INTERNO | 300 |

### Efeito nos números

- **Saldo de cada banco**: NUBANK −300, BB +300 (o saldo por banco soma internos).
- **Saldo/Entradas/Saídas do período (Dashboard)**: não mudam (internos são ignorados).
- **Cartão "🔁 Transferências internas"** do Dashboard: soma +600 (os **dois** lados são somados).
- **Extrato**: entra nos totais de Entradas (+300) e Saídas (+300); o saldo do período não muda.
- **Planejamento**: não entra nas contas/entradas dos ciclos, mas mexe no saldo de hoje de cada banco; transferências **futuras** contam em "Cada banco até o próximo salário".
- **Data futura** é permitida: vira dois previstos (úteis para planejar cobrir um banco).

### Tabela "Últimas transferências internas"

Os **10 últimos lançamentos com `tipo_mov = INTERNO`** por ordem de criação (inclui os da
virada de mês e internos lançados à mão). Editar sugere só a classificação `CONTROLE INTERNO`.

### Dica: quando usar
O Planejamento sugere transferências ("🔀 Transfira R$ X de A para B até dd/mm") quando um
banco vai ficar negativo. Essa tela é o jeito de registrar essa transferência.

---

## 5.2 Virada de mês (`virar-mes.html`, `js/virar-mes.js`)

Substitui a "VIRADA MES" manual da planilha.

### Por que existe
O sistema calcula o saldo de um banco **por mês** (soma do que aconteceu no mês). Para o
saldo do mês seguinte começar com o que sobrou, é preciso um lançamento de abertura. A
virada cria esse par: tira o saldo do mês que acaba e coloca no dia 01 do próximo.

### Tela

- Seletores **Mês/Ano de origem** e **Mês/Ano de destino**. Padrão ao abrir: origem = mês passado, destino = mês atual (vira de ano sozinho: Dez/26 → Jan/27).
- Anos disponíveis: ano passado, atual, próximo e todos os anos que existem nos dados.
- Lista **só os bancos com saldo diferente de zero** (|saldo| ≥ R$ 0,005) no mês de origem, do maior para o menor saldo.

### Saldo apurado
```
saldo(banco, mês de origem) = Σ valor das ENTRADAS do banco no mês − Σ valor das SAÍDAS do banco no mês
```
Conta **tudo** do mês (externo e interno, realizado e previsto, inclusive a virada de abertura do próprio mês).

### Botão "Remanejar valor"
Confirmação "Remanejar R$ X de "BANCO" de Mês/aaaa para Mês/aaaa?" e grava:

| # | data | tipo (saldo positivo) | tipo (saldo negativo) |
|---|------|-----------------------|-----------------------|
| 1 | **último dia do mês de origem** | SAIDA | ENTRADA |
| 2 | **dia 01 do mês de destino** | ENTRADA | SAIDA |

Campos comuns aos dois: `valor = |saldo|`, `banco` = o banco, `tipo_mov = INTERNO`,
`descricao = VALOR EM CARTEIRA`, `classificacao_saida = VIRADA DE MÊS`,
`saida (detalhe) = VIR_MES_<MÊS ORIGEM>-<AA>_<MÊS DESTINO>-<AA>`.

**Exemplo:** PLUXE com R$ 152,40 em setembro/2026 → origem set/2026, destino out/2026:

| data | banco | tipo | descricao | detalhe | valor |
|------|-------|------|-----------|---------|-------|
| 2026-09-30 | PLUXE | SAIDA | VALOR EM CARTEIRA | VIR_MES_SETEMBRO-26_OUTUBRO-26 | 152,40 |
| 2026-10-01 | PLUXE | ENTRADA | VALOR EM CARTEIRA | VIR_MES_SETEMBRO-26_OUTUBRO-26 | 152,40 |

Resultado: setembro do PLUXE fecha em **zero** (por isso o banco **some da lista** depois de
remanejado) e outubro abre com +152,40.

### Critérios
- Remanejar **banco por banco** (um clique por banco).
- Origem e destino não precisam ser meses seguidos (o sistema não impede), mas o padrão é mês seguinte.
- Lançamentos novos no mês de origem **depois** da virada fazem o saldo dele voltar a ser ≠ 0, e o banco reaparece na lista: basta remanejar de novo a diferença.
- O Planejamento soma "do 1º dia do mês passado até hoje", e os dois lados da virada se anulam. Assim o saldo de hoje fica certo **tendo ou não** feito a virada do mês atual.
