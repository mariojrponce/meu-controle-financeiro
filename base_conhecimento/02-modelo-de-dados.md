# 2. Modelo de dados

## 2.1 Coleção `carteira` (Firestore)

Cada documento é um lançamento. Não existem coleções de bancos, categorias ou
investimentos: as listas são deduzidas dos próprios lançamentos (as **sugestões** e as
regras de cada usuário ficam em `configuracoes/{uid}`, ver §2.5).

| Campo | Tipo | Obrigatório | Regra | Observação |
|-------|------|-------------|-------|------------|
| `userId` | string | sim | igual ao `uid` de quem está logado | Preenchido automaticamente. Não pode mudar na edição. |
| `data` | string | sim | ISO `aaaa-mm-dd` (formato conferido pelas regras) | Na tela sempre aparece `dd/mm/aaaa`. |
| `valor` | number | sim | `> 0` e `≤ 1.000.000.000` | **Sempre positivo.** O sinal vem do `tipo`. |
| `tipo` | string | sim | `ENTRADA` ou `SAIDA` | Sem acento. |
| `tipo_mov` | string | sim | `EXTERNO` ou `INTERNO` | |
| `descricao` | string | sim | 1 a 120 caracteres | Maiúsculas. |
| `saida` | string | sim (pode ser `""`) | 0 a 120 caracteres | É o **Detalhe**. Maiúsculas. |
| `banco` | string | sim | 1 a 60 caracteres | Maiúsculas, nome normalizado (ver §4.4). |
| `classificacao_saida` | string | sim | 1 a 60 caracteres | Maiúsculas. Vale para entradas também. |
| `criadoEm` | Timestamp | auto | `serverTimestamp()` | Usado para ordenar "últimos lançamentos". |
| `investimento` | string | não | até 60 | Só em lançamentos feitos/editados na tela Investimentos. |
| `dono_carteira` | string | não | até 60 | Só Investimentos. |
| `banco_investimento` | string | não | até 60 | Só Investimentos: "onde está aplicado". |

| `importacao_id` | string | não | até 200 | Só em lançamentos vindos de **extrato importado**: `IMP-aaaammdd-hhmmss` (agrupa a importação, permite desfazer). |
| `id_externo` | string ou nulo | não | até 300 | Identificador do movimento no banco (ex.: `NUBANK|<uuid>`, `BRADESCO|data|docto|valor`). Reimportar o mesmo extrato não duplica. |
| `texto_banco` | string | não | até 300 nas regras (a importação grava até 120) | Texto do banco "limpo" (ex.: `UBER TRIP HELP U`). É com ele que a importação **aprende**: o mesmo texto no próximo extrato já vem com a sua classificação. |

> Desde 15/11/2026 as regras do Firestore aceitam **somente os 16 campos acima**: um
> lançamento com qualquer outro campo é recusado. Os opcionais podem faltar, ser nulos ou
> ser texto dentro do limite. Para gravar um campo novo é preciso incluí-lo em
> `camposPermitidos()` no `firestore.rules` e publicar as regras.

## 2.2 Regras de segurança (`firestore.rules`)

Coleção `carteira`:

- **Ler / excluir**: só se logado e `userId` do documento = usuário logado.
- **Criar**: logado, `userId` = usuário e o lançamento passa em `lancamentoValido()`: só os
  campos previstos, `valor` número > 0 e ≤ 1 bilhão, `data` no formato `aaaa-mm-dd`,
  `tipo` ∈ {ENTRADA, SAIDA}, `tipo_mov` ∈ {INTERNO, EXTERNO}, textos dentro dos limites acima,
  `criadoEm` (se existir) do tipo data/hora.
- **Editar**: as mesmas validações sobre o documento **depois** da edição, e o `userId` não pode ser trocado.

Coleção `configuracoes` (documento com ID = `uid`):

- **Ler / excluir**: só o próprio usuário.
- **Criar / editar**: só o próprio usuário, só os campos `bancos`, `classificacoes`,
  `bancosVale`, `regras` e `atualizadoEm`, cada lista com até 300 itens.

Qualquer outra coleção: tudo bloqueado.

Publicar: `firebase deploy --only firestore:rules`.

## 2.3 Cache local das transações (`js/dados-carteira.js`)

Para não estourar a cota gratuita de leitura do Firestore, todas as telas usam o mesmo cache:

| Item | Valor |
|------|-------|
| Chave no `localStorage` | `carteira_cache_<uid>` |
| Validade | **6 horas**. Depois disso, a próxima tela busca tudo de novo. |
| Versão | `VERSAO_CACHE = 2` (aumentar força todos a rebuscar) |
| Botão "🔄 Atualizar dados" | Ignora o cache e busca do Firestore (Extrato, Dashboard, Investimentos, Planejamento) |
| Criar / editar / excluir / importar | Atualizam o Firestore **e** o cache local na hora (sem rebuscar) |
| `criadoEmMs` | Cópia numérica de `criadoEm` (milissegundos), porque o Timestamp não sobrevive ao JSON do cache |

A busca traz **todos** os lançamentos do usuário (sem filtro de data). Todos os filtros
são aplicados no navegador.

## 2.4 O que fica salvo no navegador (`localStorage`)

Fora o cache das transações, nada disso é dado financeiro; serve só para lembrar preferências.

| Chave | Conteúdo | Apagada no logout? |
|-------|----------|--------------------|
| `carteira_cache_<uid>` | Cache das transações (§2.3) | Sim |
| `filtro_extrato_<uid>` | Último filtro e ordenação do Extrato | Sim |
| `filtro_dashboard_<uid>` | Último filtro do Dashboard | Sim |
| `pref_dashboard_categorias_separadas_<uid>` | Lista de categorias "à parte" | Sim |
| `pref_dashboard_visoes_<uid>` | Visões personalizadas do Dashboard | Sim |
| `pref_planejamento_<uid>` | Colchão, categorias do dia a dia e filtros do Planejamento | Sim |
| `config_cache_<uid>` | Cópia das configurações do usuário (§2.5), válida por 6 horas | Sim |
| `investimentos_banco_aplicado_<uid>` | Chip "Onde está aplicado" escolhido (a chave antiga, sem uid, é migrada e apagada ao abrir Investimentos) | Sim |
| `tema_meu_financeiro` | Tema escolhido manualmente (light/dark/sepia) | Não |
| `pref_importacao_titular_<uid>` | Seu nome/CPF parcial como aparecem nos bancos (reconhece transferências entre suas contas) | Sim |

Consequência: trocar de navegador ou de computador (ou sair da conta) perde categorias à
parte, visões personalizadas e ajustes do Planejamento. Os lançamentos e as configurações
da tela Configurações continuam no Firestore.

## 2.5 Coleção `configuracoes` (Firestore)

Um documento por usuário, com ID igual ao `uid`. Guarda o que é ajustado na tela
Configurações ([12](12-configuracoes.md)). Quem nunca salvou não tem documento e usa o
**padrão do sistema**.

| Campo | Tipo | Conteúdo |
|-------|------|----------|
| `bancos` | lista de textos | Bancos sugeridos ao lançar |
| `classificacoes` | lista de textos | Classificações sugeridas ao lançar |
| `bancosVale` | lista de textos | Começos de nome que identificam banco de vale |
| `regras` | lista de objetos `{ tipo, de: [..], se, para }` | Regras de equiparação de categorias, na ordem em que são testadas |
| `atualizadoEm` | Timestamp | Preenchido ao salvar |

Leitura: uma vez a cada 6 horas por navegador (cache em `config_cache_<uid>`); a tela
Configurações sempre busca a versão mais recente. Limpeza e padrão ficam em
`js/configuracoes-modelo.js` (sem DOM, com testes em `testes/evolucao.test.mjs`).
