# 2. Modelo de dados

## 2.1 Coleção `carteira` (Firestore)

Uma coleção só. Cada documento é um lançamento. Não existem coleções de bancos,
categorias ou investimentos: as listas são deduzidas dos próprios lançamentos.

| Campo | Tipo | Obrigatório | Regra | Observação |
|-------|------|-------------|-------|------------|
| `userId` | string | sim | igual ao `uid` de quem está logado | Preenchido automaticamente. Não pode mudar na edição. |
| `data` | string | sim | ISO `aaaa-mm-dd` | Na tela sempre aparece `dd/mm/aaaa`. |
| `valor` | number | sim | `> 0` | **Sempre positivo.** O sinal vem do `tipo`. |
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

| `importacao_id` | string | não | — | Só em lançamentos vindos de **extrato importado**: `IMP-aaaammdd-hhmmss` (agrupa a importação, permite desfazer). |
| `id_externo` | string | não | — | Identificador do movimento no banco (ex.: `NUBANK|<uuid>`, `BRADESCO|data|docto|valor`). Reimportar o mesmo extrato não duplica. |
| `texto_banco` | string | não | até 120 | Texto do banco "limpo" (ex.: `UBER TRIP HELP U`). É com ele que a importação **aprende**: o mesmo texto no próximo extrato já vem com a sua classificação. |

> Os campos opcionais não são validados pelas regras do Firestore (campos extras são
> permitidos), só pelo formulário / pela importação.

## 2.2 Regras de segurança (`firestore.rules`)

- **Ler / excluir**: só se logado e `userId` do documento = usuário logado.
- **Criar**: logado, `userId` = usuário, `valor` número > 0, `data` string, `tipo` ∈ {ENTRADA, SAIDA},
  `tipo_mov` ∈ {INTERNO, EXTERNO}, textos dentro dos limites acima.
- **Editar**: as mesmas validações, e o `userId` não pode ser trocado.
- Qualquer outra coleção: tudo bloqueado.

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

Nada disso é dado financeiro; serve só para lembrar preferências.

| Chave | Conteúdo | Apagada no logout? |
|-------|----------|--------------------|
| `carteira_cache_<uid>` | Cache das transações (§2.3) | Sim |
| `filtro_extrato_<uid>` | Último filtro e ordenação do Extrato | Sim |
| `filtro_dashboard_<uid>` | Último filtro do Dashboard | Sim |
| `pref_dashboard_categorias_separadas_<uid>` | Lista de categorias "à parte" | Sim |
| `pref_dashboard_visoes_<uid>` | Visões personalizadas do Dashboard | Sim |
| `pref_planejamento_<uid>` | Colchão, categorias do dia a dia e filtros do Planejamento | Sim |
| `investimentos_banco_aplicado` | Chip "Onde está aplicado" escolhido | **Não** (não tem uid) |
| `tema_meu_financeiro` | Tema escolhido manualmente (light/dark/sepia) | Não |
| `pref_importacao_titular_<uid>` | Seu nome/CPF parcial como aparecem nos bancos (reconhece transferências entre suas contas) | Sim |

Consequência: trocar de navegador ou de computador perde categorias à parte, visões
personalizadas e ajustes do Planejamento (os lançamentos continuam no Firestore).
