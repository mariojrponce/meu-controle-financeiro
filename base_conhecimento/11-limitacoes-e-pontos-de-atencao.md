# 11. Limitações e pontos de atenção

Comportamentos do código atual (v1.7.0) que podem surpreender. Nenhum foi alterado: estão
aqui para orientar o uso e futuras melhorias.

## 11.1 Que afetam números

| # | Ponto | Efeito | Contorno / sugestão |
|---|-------|--------|---------------------|
| 1 | Filtro padrão termina em **hoje** | Com "Mês atual", os previstos do resto do mês não aparecem no Extrato/Dashboard e o Saldo previsto = Saldo do período | Mudar "Dia fim" para o último dia do mês |
| 2 | Extrato soma internos | Transferências e viradas inflam Entradas e Saídas do Extrato (saldo não muda) | Filtrar Movimentação = Externo |
| 3 | "Transferências internas" do Dashboard soma os dois lados | Uma transferência de R$ 300 aparece como R$ 600 | Ler como "volume movimentado" |
| 4 | Visão personalizada com "Entradas e saídas" soma tudo positivo | Não é saldo, é volume | Criar duas visões (só entradas / só saídas) |
| 5 | `INVESTIMENTO` × `INVESTIMENTOS` | A tela Investimentos só vê o singular; o Planejamento vê os dois | Unificar as classificações (editar lançamentos) |
| 6 | Aportes contam como gasto no Dashboard | Meses com aporte grande parecem meses de muito gasto (ex.: mai/26 ≈ R$ 19.897) | Marcar INVESTIMENTO como "categoria à parte" no Dashboard, se quiser vê-lo separado |
| 7 | Saldo por banco é por período | Sem a virada de mês feita, o saldo de um banco num mês não inclui o que sobrou do mês anterior | Fazer a virada todo mês |
| 8 | Previsões dependem do que foi lançado | Não existe recorrência/parcelamento automático; conta não lançada deixa o Planejamento otimista | Lançar contas futuras (ou importar) |

## 11.2 Que afetam a integridade dos dados

| # | Ponto | Risco |
|---|-------|-------|
| 9 | Transferência e virada gravam 2 lançamentos separados | Se a 2ª gravação falhar (internet caiu), fica só um lado. Conferir no Extrato após erro |
| 10 | Editar/excluir um lado de transferência ou virada não mexe no outro | Lados desencontrados. Sempre ajustar os dois |
| 11 | Virar mês não bloqueia repetição para outro destino | Remanejar o mesmo mês para dois destinos diferentes duplicaria o saldo (para o mesmo mês o banco some da lista, o que evita a repetição) |
| 12 | Importação de **planilha** sem verificação de duplicados (a de **extratos** verifica — ver 9.0) | Importar a mesma planilha 2× duplica tudo |
| 13 | Data aceita dia 1–31 sem conferir o mês | `31/02/2026` é aceito e gravado como `2026-02-31` (fica fora de filtros por mês de fevereiro que terminam em 28) |
| 14 | Histórico "BANCO DO BRASIL" | Lançamentos antigos com esse nome não foram migrados para `BB` (decisão do usuário). Aparecem como banco separado até serem editados |
| 15 | Sem desfazer/lixeira | Exclusão é definitiva |
| 15a | Correção de nomes em massa (Configurações) não tem desfazer | Se o nome novo já existia, os lançamentos se juntam e não dá para separar depois. Com mais de 450 lançamentos a gravação é em lotes: se cair no meio, parte fica com o nome novo (basta repetir a correção) |
| 15e | "Aplicar regras aos lançamentos" (Configurações) substitui a classificação antiga sem desfazer | Exportar um backup antes. Trocas ligadas a investimento vêm desmarcadas porque mudam o que a tela Investimentos mostra |
| 15b | Correção de banco em massa não altera `banco_investimento` ("onde está aplicado") | Esse campo continua com o nome antigo até ser editado em Investimentos |
| 15c | A correção em massa usa o cache local | Lançamento feito em outro aparelho nas últimas 6 h pode ficar de fora; usar "🔄 Atualizar dados" antes |
| 15d | Regras do Firestore recusam campo desconhecido | Código novo que grave um campo fora da lista de `firestore.rules` falha com "permission-denied" até a regra ser atualizada e publicada |

## 11.3 Que afetam a interface

| # | Ponto |
|---|-------|
| 16 | Cor do banco: o mapa tem a chave `BANCO DO BRASIL`, mas o nome padrão gravado é `BB`, então o BB aparece com a cor padrão (verde) |
| 17 | Preferências (categorias à parte, visões, ajustes do Planejamento, chip de Investimentos) ficam no navegador: outro navegador/computador começa do zero, e **sair da conta também as apaga**. As da tela Configurações ficam no Firestore e não se perdem |
| 18 | O tema não é apagado no logout (o chip "Onde está aplicado" passou a ser apagado em 15/11/2026) |
| 19 | Cache de 6 h: dados lançados em outro aparelho só aparecem depois de 6 h ou com "🔄 Atualizar dados" |
| 20 | Após atualizar o sistema, o navegador pode usar `.js` antigos: usar **Ctrl+Shift+R** em cada página |
| 21 | Gráficos desenhados "por software" e sem animação, para corrigir canvas quebrado no Chrome com aceleração de GPU |
| 22 | Configurações ficam em cache por 6 h: uma mudança feita em outro aparelho pode demorar esse tempo para aparecer (abrir a tela Configurações busca a versão nova) |
| 23 | Um usuário novo começa com o **padrão do sistema**, que são as listas e regras do primeiro usuário (ex.: TRANSPORTE → UBER/ONIBUS, "COMPRAS CASA 108N"). Ele ajusta ou apaga em Configurações |
| 24 | "Só quando o texto tiver" aceita expressão regular: uma expressão mal escrita pode travar a aba de quem a escreveu (não afeta outros usuários) |
| 25 | O valor clicado na Evolução por categoria pode não bater com o total do Extrato aberto quando há lançamentos de categorias à parte (o Dashboard exclui, o Extrato não) |

## 11.4 Diferenças entre documentação antiga e código

| Documento | Diz | Código faz |
|-----------|-----|-----------|
| `melhorias/02-08-26.status.md` (item 7) | "Previsto por banco, dia a dia" com uma linha por lançamento | Agrupa por **Detalhe** (ou Descrição), com período primeira–última data e "(Nx)" |
| `PROJECT_CONTEXT.md` | Lista de campos sem `investimento`, `dono_carteira`, `banco_investimento`; não cita transferência, virar mês, investimentos, planejamento no mapa | Esses campos e telas existem (ver [02](02-modelo-de-dados.md) e [03](03-telas.md)) |
| `PROJECT_CONTEXT.md` (corrigido em 15/11/2026) | Chart.js e SheetJS via jsDelivr | Chart.js vem de `cdnjs.cloudflare.com` com SRI; SheetJS 0.20.3 é servido de `js/vendor/xlsx/` |

## 11.5 Ideias já estudadas e não implementadas
- Tela "Fechamento do mês" (parcialmente atendida pelo Planejamento): `melhorias/03-10-26.status.md` §7.
- Planejamento de resgate e rentabilidade de investimentos: `melhorias/09-08-26.investimentos-base-conhecimento.md`.
- Migração `BANCO DO BRASIL` → `BB`: agora dá para fazer pela tela Configurações → "Corrigir nomes nos lançamentos" (Banco), sem código.
- Trazer as "categorias à parte" do Dashboard para a tela Configurações (hoje ficam só no navegador).
- Segurança: restringir a `apiKey` ao domínio, migrar para o Firebase Hosting (cabeçalhos HTTP) e sessão curta/saída por inatividade (ver [13](13-seguranca.md)).
