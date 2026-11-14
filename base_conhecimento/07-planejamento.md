# 7. Planejamento por salário

Arquivos: `planejamento.html`, `js/planejamento.js` (tela) e `js/planejamento-calculo.js`
(conta, sem tela, testável no Node). Isto é uma conta de fluxo de caixa, não recomendação
de investimento.

## 7.1 Ideia

"O salário do fim do mês paga as contas até a véspera do salário do dia 15; o do dia 15 paga
até a véspera do próximo." Cada intervalo **dia do salário → véspera do próximo salário** é
um **ciclo**. A sobra de um ciclo passa para o seguinte. O menor saldo dessa sequência, menos
um colchão, é o que dá para investir sem fazer falta.

## 7.2 Base usada

1. Só lançamentos válidos: `valor > 0`, `data` com 10 caracteres, banco preenchido.
2. Filtro **Vale** (padrão **Sem vale**).
3. Filtro **Banco** (vazio = todos). As **datas dos ciclos** sempre vêm dos salários de todos os bancos, mesmo filtrando um banco onde o salário não cai.
4. **Transferências internas não entram** nas contas e entradas dos ciclos.

## 7.3 Salários e datas dos ciclos

- **Salário** = `tipo = ENTRADA` e classificação contendo `SALARIO` ou `SALÁRIO`.
- Salários na mesma data são somados. Salários a **até 3 dias** um do outro viram **um pagamento só** (ex.: férias 29/01 + salário 30/01), com a data do primeiro.
- **Salário estimado**: depois do último salário lançado, o sistema cria os próximos:

| Data do salário anterior | Próximo estimado |
|--------------------------|------------------|
| dia < 12 | dia 15 do mesmo mês |
| dia 12 a 20 | dia 30 do mesmo mês (ou último dia, se o mês tem menos de 30) |
| dia > 20 | dia 15 do mês seguinte |

  Valor = o do **último salário real do mesmo tipo** ("meio do mês" = dia ≤ 20; "fim do mês" = dia > 20), no mesmo banco. Gera até ter pelo menos 4 pagamentos depois de hoje **e** passar da data do último lançamento da base (limite de 240). Marcado como "(estimado)".
- Se não há nenhum salário até hoje, o sistema cria um ponto inicial no dia 01 do mês atual com valor 0.

## 7.4 Saldo de hoje
```
Saldo hoje (por banco) = Σ (E − S) de tudo do banco entre o dia 01 do MÊS PASSADO e hoje
Saldo hoje (total)     = Σ dos bancos
```
Por quê: a virada do mês lança o saldo de fechamento como SAÍDA no último dia do mês passado e
ENTRADA no dia 01 deste mês. Somando desde o mês passado, os dois lados se anulam e o resultado
é o saldo real **com ou sem a virada deste mês feita**. Aqui os internos entram (são parte do saldo do banco).

## 7.5 Gastos do dia a dia (reserva)

- **Janela**: últimos **90 dias** (de hoje − 89 até hoje), só SAÍDAS externas.
- **Categorias** escolhidas no ajuste "Gastos do dia a dia". Se o usuário nunca escolheu, a sugestão automática pega categorias com **≥ 10 lançamentos** e **média ≤ R$ 60** na janela (sempre ignorando bancos de vale). Ex. em 03/10/2026: ALIMENTAÇÃO, LANCHE, ONIBUS, UBER ≈ R$ 27/dia.
```
taxa diária = Σ valor das saídas dessas categorias nos 90 dias ÷ 90
reserva do ciclo = taxa diária × dias restantes do ciclo
```

## 7.6 Colchão de segurança
- Digitado no ajuste (aceita `1.500,00` ou `1500`; negativo vira 0) **ou**, em branco, automático:
```
colchão automático = arredondar PARA CIMA, em múltiplos de R$ 50, (taxa diária × 15)
```
(15 dias de dia a dia; ex.: R$ 27/dia → R$ 405 → R$ 450.)

## 7.7 Conta de cada ciclo

Situação: **encerrado** se `fim < hoje`; **futuro** se `início > hoje`; senão **atual**.

### Ciclo encerrado (o que de fato aconteceu)
```
Entradas      = E externas do ciclo (início..fim)
Gastos (n)    = S externas do ciclo
Sobrou/Faltou = Entradas − Gastos
Saldo no fim  = saldo real no último dia do ciclo (mesma regra do §7.4 usando "fim" como hoje)
```

### Ciclo atual
Considera só o que ainda vai acontecer: de **amanhã** até o fim do ciclo (o que já passou está no saldo de hoje).
```
Começa com       = Saldo hoje
+ Ainda entra    = E externas de amanhã até o fim
− Contas (n)     = S externas de amanhã até o fim   (inclui fatura e aportes programados)
− Dia a dia (Nd) = taxa diária × N, N = dias de amanhã até o fim (inclusive)
= Sobra / Falta  = Começa com + Ainda entra − Contas − Dia a dia
Necessário       = Contas + Dia a dia
```

### Ciclo futuro
Igual ao atual, mas do **início** ao fim do ciclo, e:
- **Começa com** = Sobra/Falta do ciclo anterior (encadeado). Se o anterior for encerrado, usa o saldo de hoje.
- Se o salário que abre o ciclo é **estimado** (valor > 0 e no banco filtrado), ele entra como entrada "SALÁRIO (estimado)". Salário já lançado entra normalmente pelos lançamentos.

### Aportes
`Aportes do ciclo` = saídas cuja classificação **contém** `INVESTIMENTO` (pega INVESTIMENTO e INVESTIMENTOS). Já estão dentro de "Contas"; são separados só para a recomendação.

## 7.8 Indicadores do topo

| Cartão | Fórmula |
|--------|---------|
| 💳 Saldo hoje (sem vale) | §7.4 |
| Contas + dia a dia até dd/mm | `Necessário` do ciclo atual |
| Sobra / Falta até dd/mm | `|Sobra/Falta|` do ciclo atual (verde/vermelho) |
| 📈 Pode investir sem fazer falta | ver abaixo |

```
horizonte       = ciclo atual + 3 seguintes (~2 meses)
menor saldo     = menor "Sobra/Falta" entre os ciclos do horizonte
Pode investir   = máximo(0, menor saldo − colchão)
```

## 7.9 Cada banco até o próximo salário
Para o ciclo atual, por banco:
```
Saldo hoje  = §7.4 do banco
+ A entrar  = E previstas do banco de amanhã até o fim do ciclo
− A pagar   = S previstas do banco no mesmo intervalo
Fica com    = Saldo hoje + A entrar − A pagar
```
Aqui **entram também transferências internas futuras** (mexem no saldo daquele banco).
Aparecem bancos com saldo ≠ 0 ou algo previsto. Ordem: quem mais paga primeiro. Se "Fica com" < 0, mostra "⚠️ Primeira conta em dd/mm: descrição".

## 7.10 Sugestão de transferências
1. Bancos que sobram (Fica com > 0), do que mais sobra para o que menos.
2. Bancos que faltam (Fica com < 0), do mais negativo para o menos.
3. Para cada banco que falta, pega de quem sobra (o que mais sobra primeiro) até cobrir. Prazo = data da primeira conta do banco que precisa.
4. Se ninguém tem sobra suficiente, avisa que o banco vai ficar negativo e nenhum outro cobre.

## 7.11 "O que fazer agora" (ordem das mensagens)
1. Até dd/mm (véspera do próximo salário) você ainda tem N contas somando R$ X, mais R$ Y do dia a dia.
2. ✅ Sobram R$ X **ou** ⚠️ Faltam R$ X (segure gastos ou adie alguma conta).
3. 🔀 Transferências sugeridas (§7.10).
4. ⚠️ Cada ciclo futuro do horizonte que fecha negativo, com quanto terá e quanto precisa.
5. 💡 Se o menor saldo é negativo e há aportes programados no horizonte: reduzir R$ X dos aportes resolve (ou "mesmo sem eles ainda faltaria").
6. 📈 "Dá para investir R$ X agora" **ou** 💰 "Melhor deixar em caixa", indicando o ciclo mais apertado.
7. Aviso se algum salário do horizonte foi estimado.
Sem nenhum salário lançado: pede para lançar o salário com classificação SALARIO.

## 7.12 Bloquinhos de ciclos
- Todos os ciclos da base, do primeiro salário até o último lançamento.
- Ordem: 🟢 Ciclo atual → 🔮 Futuros (do mais próximo) → ✔️ Encerrados (do mais recente). Encerrados em cinza (voltam à cor no mouse).
- Filtros **Ciclos** e **Ano** só escolhem quais bloquinhos aparecem (Ano: ciclo que começa ou termina no ano). **Banco** e **Vale** mudam todas as contas da página.
- Clicar (ou Enter/Espaço) abre a janela com as tabelas de Contas/Gastos e Entradas do ciclo.

## 7.13 Preferências
Salvas em `pref_planejamento_<uid>`: `colchao`, `categoriasDiaADia`, `filtros {situacao, ano, bancos, vale}`. "Limpar filtros" volta a Todos / Todos / Todos os bancos / **Sem vale**.

## 7.14 Limitações
- Só enxerga contas **lançadas** como previstas. Conta recorrente não lançada deixa a previsão otimista.
- A reserva é média, não prevê gastos grandes pontuais.
- Não modela parcelamentos ou faturas ainda não lançados.
