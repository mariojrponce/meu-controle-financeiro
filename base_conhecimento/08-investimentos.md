# 8. Gestão de Investimentos

Arquivos: `investimentos.html`, `js/investimentos.js`; modal em `js/editor-transacao.js`
(modo `contextoInvestimento`). Decisões de origem em `melhorias/09-08-26.investimentos-base-conhecimento.md`.

## 8.1 Princípios (decididos com o usuário em 09/08/2026)

1. **Sem coleção nova**: investimentos são lançamentos comuns da `carteira` com classificação `INVESTIMENTO`.
2. **Aporte continua contando** como saída no Extrato/Dashboard (o dinheiro saiu do banco corrente). A tela é só uma visão organizada.
3. **Dono** é uma etiqueta (`dono_carteira`), não outro usuário. O sistema continua com um usuário só.
4. Aporte e resgate do mesmo investimento são ligados pelo campo **`investimento`** (nome), não pela descrição.
5. Valores são **principal** (aportado − resgatado), **sem rendimento**.

## 8.2 Quais lançamentos entram
```
classificacao_saida (sem espaços nas pontas, maiúsculo) == "INVESTIMENTO"   (exatamente)
```
Todo o histórico, sem recorte de data. Lançamentos com `INVESTIMENTOS` (plural) **não** aparecem aqui.

## 8.3 Lançar / editar (modal de investimento)

| Campo | Obrigatório | Observação |
|-------|-------------|------------|
| Valor, Data, Descrição | sim | iguais ao lançamento normal |
| Detalhe | não | |
| Banco | sim | **Conta de onde o dinheiro saiu / pra onde voltou** (para o saldo do Extrato bater) |
| Onde está aplicado (`banco_investimento`) | não | Onde o dinheiro de fato está (ex.: saiu do BRADESCO, está no MERCADO BITCOIN). Vazio = o sistema descobre (§8.5) |
| Investimento | sim | Nome, ex.: `CDB BRADESCO`. Agrupa aporte + resgate |
| Dono da carteira | sim | Ex.: `EU`, `MAYARA` |
| Tipo | sim | **Aporte** = SAIDA (padrão) · **Resgate** = ENTRADA |

Gravado automaticamente: `tipo_mov = EXTERNO`, `classificacao_saida = INVESTIMENTO`, textos em maiúsculas.

Ao **editar**, o modal já mostra em "Onde está aplicado" o banco que o sistema deduziu. Salvando, esse valor passa a ficar gravado.

### Pré-preenchimento
- **+ Lançamento**: Tipo = Aporte; "Onde está aplicado" = chip selecionado (se houver).
- **+ Aportar / + Resgatar** (cartão de um dono): Tipo conforme o botão, Dono = o do cartão. Se esse dono tem **exatamente 1** investimento (dentro do chip selecionado), preenche também Investimento, Banco (do último lançamento criado dele) e Onde está aplicado. Com mais de um, deixa em branco para escolher.

### Exemplo: resgate parcial para pagar um transporte
Aporte: `APLICAÇÃO CDB`, investimento `CDB - MAYARA`, dono `MAYARA`, BRADESCO, Aporte R$ 994,00.
Resgate: descrição `UBER`, mesmo investimento `CDB - MAYARA`, dono `MAYARA`, Resgate R$ 50,00.
→ Saldo investido de `CDB - MAYARA` = 994 − 50 = **R$ 944,00**, e o registro mostra o motivo.

## 8.4 Cálculos
```
Aportado  = Σ valor com tipo SAIDA
Resgatado = Σ valor com tipo ENTRADA
Saldo investido = Aportado − Resgatado
```
Aplicado em: cartões do topo, cada chip, cada investimento, cada dono, e a linha de resumo da tabela.

| Bloco | Agrupamento | Mostra | Ordem |
|-------|-------------|--------|-------|
| Total aportado / resgatado / Saldo investido | tudo do chip selecionado | 3 cartões | — |
| **Por investimento** | `investimento` (vazio → "Investimento não definido") | Aplicado em, Conta de origem (se diferente), Aportado, Resgatado, Saldo; se há > 1 dono, quebra "Por dono" (aportes − resgates de cada) | maior saldo primeiro |
| **Por dono** | `dono_carteira` (vazio → "Sem dono definido") | [+] Aportado e [+] Resgatado (clicar abre mini-extrato "data — detalhe — valor"), Saldo, botões + Aportar / + Resgatar | maior saldo primeiro |

## 8.5 "Onde está aplicado" (banco aplicado)

Cada lançamento recebe um banco aplicado, nesta prioridade:

1. **`banco_investimento`** preenchido no modal.
2. **Banco predominante do mesmo investimento**: entre os lançamentos do mesmo `investimento`, conta as pistas (campo explícito ou banco achado no texto); vence a mais frequente, desempate pela data mais recente. Assim um resgate com detalhe "UBER" fica no mesmo lugar do aporte.
3. **Banco achado no texto**: procura no Detalhe e depois na Descrição um nome de banco **inteiro** (`BB` não casa com `HOBBY`, `INTER` não casa com `INTERNO`). Candidatos: bancos sugeridos + `MERCADO BITCOIN` + todos os bancos usados, do nome mais longo para o mais curto (`NUBANK CAIXINHA` antes de `NUBANK`). Ignora acentos.
4. O próprio **`banco`** (conta de origem).
5. Nada → "Banco não definido".

**Chips**: "Todos" + um chip por banco aplicado com o saldo investido nele (maior primeiro). Escolher um chip filtra **toda a tela** e o saldo passa a ser o valor que deve bater com o app daquele banco (sem rendimento). A escolha fica salva no navegador.

## 8.6 Filtros da tabela de movimentações

| Filtro | Regra |
|--------|-------|
| Data início / fim | data inteligente; filtra ao sair do campo, Enter, ou ao completar 10 caracteres |
| Investimento, Dono | múltipla escolha (opções = só as do chip selecionado) |
| Banco | múltipla; casa com a conta de origem **ou** com onde está aplicado |
| Descrição, Detalhe | contém, sem diferenciar acento/maiúscula |
| Tipo | Todos / Aporte / Resgate |

Linha de resumo: `N movimentações · Aportes R$ · Resgates R$ · Líquido R$`.
Tabela: Data, Investimento, Descrição, Detalhe, Dono, Banco (+ "aplicado em X" quando diferente), Tipo (📥 Aporte / 📤 Resgate), Valor, Ações. Ordem padrão: data decrescente.

## 8.7 Relação com as outras telas
- **Extrato/Dashboard**: aporte é saída externa, resgate é entrada externa (contam nos totais e nos gráficos como classificação INVESTIMENTO).
- **Planejamento**: aportes futuros (classificação contendo INVESTIMENTO) são contas do ciclo e podem ser sugeridos para redução.
- Lançamentos antigos de INVESTIMENTO sem `investimento`/`dono_carteira` caem em "Investimento não definido"/"Sem dono definido" até serem editados (✏️).

## 8.8 Fora de escopo (não construído)
Planejamento de resgate (data-alvo), rentabilidade/valor atual, acesso real de outra pessoa.
