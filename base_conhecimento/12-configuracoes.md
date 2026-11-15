# 12. Configurações

Tela `configuracoes.html` (`js/configuracoes-tela.js`), criada em 15/11/2026. Reúne o que
antes era fixo no código e passou a ser **de cada usuário**, mais a correção de nomes em massa.

Arquivos:

| Arquivo | Papel |
|---------|-------|
| `js/configuracoes-modelo.js` | Padrão do sistema, limpeza dos dados e aplicação nas telas. Sem DOM e sem Firebase (testado em `testes/evolucao.test.mjs`) |
| `js/configuracoes.js` | Lê e grava `configuracoes/{uid}` no Firestore, com cache local de 6 horas |
| `js/configuracoes-tela.js` | A tela |
| `js/finalidade.js`, `js/vale.js`, `js/dados-comuns.js` | Guardam o padrão de cada assunto e a função que troca o que está em uso (`definirRegrasDeFinalidade`, `definirBancosVale`, `definirSugestoes`) |

## 12.1 Como as configurações chegam a todas as telas

1. Toda página privada chama `exigirLogin()`. Depois de confirmar o login, ela chama
   `carregarConfiguracoes(usuario)`.
2. Se há cópia recente no navegador (`config_cache_<uid>`, até 6 horas), usa a cópia. Senão
   lê o documento `configuracoes/{uid}`.
3. Sem documento (usuário nunca salvou) → **padrão do sistema**.
4. As configurações são aplicadas **antes** de a página montar a tela, então sugestões, filtro
   de vale e categorias já saem certos.
5. Se a leitura falhar (sem internet, regra não publicada), a página segue com o padrão e
   registra um aviso no console.

Um usuário novo começa com o padrão do sistema, que são as listas e regras do primeiro
usuário. Ele pode ajustar ou apagar tudo.

## 12.2 Listas simples

| Bloco | Campo gravado | Efeito |
|-------|---------------|--------|
| Bancos sugeridos | `bancos` | Sugestões do campo Banco (Lançar, Transferência, editor, Investimentos) |
| Classificações sugeridas | `classificacoes` | Sugestões do campo Classificação |
| Bancos de vale | `bancosVale` | Quais bancos são vale: filtro "Vale" e separação no Planejamento. Vale para todo banco cujo nome **começa** com um item da lista |

Regras das listas:

- Os nomes são aparados e gravados em **MAIÚSCULAS**, com até 60 caracteres, sem repetidos, até 300 itens.
- Remover uma sugestão **não altera nenhum lançamento**. Um banco ou classificação que já foi
  usado continua sendo sugerido, porque as telas juntam a lista com o que existe nos lançamentos.
- Remover um banco da lista de vale faz esse banco passar a contar como dinheiro comum.
- Lista vazia é respeitada (nenhuma sugestão / nenhum banco de vale).

## 12.3 Equiparação de categorias

Regras que levam um lançamento para a **categoria** usada hoje, quando a forma de classificar
mudou com o tempo. Afetam só a visão: a "Evolução por categoria" do Dashboard (com "Equiparar
categorias pela finalidade" ligado) e a lista que o Extrato abre quando se clica num valor de
lá. O Extrato em si mostra e filtra pela **classificação gravada**. O lançamento gravado não muda.

Cada regra:

| Coluna na tela | Campo | Significado |
|----------------|-------|-------------|
| Tipo | `tipo` | Gasto (`SAIDA`) ou Recebimento (`ENTRADA`) |
| Classificações de origem | `de` | Uma ou mais classificações (separadas por vírgula na tela) |
| Só quando o texto tiver | `se` | Opcional. Expressão testada em **descrição + detalhe**, sem acento e em maiúsculas. Palavras separadas por `|` (ex.: `PASSE|ONIBUS`). Aceita expressão regular (`\b` = palavra inteira). Em branco = qualquer texto |
| Vira a categoria | `para` | Categoria de destino |

Como é aplicada (`finalidadeDe` em `js/finalidade.js`):

1. As regras são testadas **de cima para baixo**; vale a **primeira** cujo tipo e classificação
   de origem batem e cujo texto (se houver) aparece.
2. Nenhuma regra serve → a categoria é a própria classificação.
3. As regras valem para lançamentos de **qualquer ano**.

Na tela dá para adicionar, excluir e subir/descer regras. Ao salvar, regra sem origem, sem
destino ou com expressão inválida fica em vermelho e o salvamento é recusado. A expressão é
normalizada (sem acento, maiúsculas, preservando escapes como `\b`).

Padrão do sistema (17 regras em `REGRAS_PADRAO`), em resumo: TRANSPORTE → UBER ou ONIBUS;
DAS/MEI, Spotify, celular → DESP MENSAL; COMPRAS CASA → COMPRAS CASA 108N; lanche para casa →
CASA LANCHE; imóvel (MRV/Caixa) → INVESTIMENTOS e aplicações → INVESTIMENTO; resgates e FGTS →
RESGATES DE INVEST.; devolução de empréstimo → DEVOLUÇÃO.

## 12.4 Salvar e restaurar

- **Salvar alterações**: grava as três listas e as regras no Firestore, aplica na hora e
  atualiza a cópia local. Fica desativado enquanto não há alteração.
- **Restaurar padrão**: põe na tela as listas e regras do padrão do sistema; só vale depois de salvar.
- Sair da página com alterações não salvas mostra o aviso do navegador.
- Ao abrir, a tela sempre busca a versão mais recente no Firestore e diz se o usuário está no
  padrão ou em configurações salvas.

## 12.5 Corrigir nomes nos lançamentos (em massa)

Para quando um **banco** ou uma **classificação** foi escrito errado em vários lançamentos.

1. "O que corrigir": Classificação ou Banco.
2. "Nome atual": lista de todos os nomes usados nos lançamentos, com a quantidade de cada um.
3. "Nome correto": digitar ou escolher um nome existente.
4. Confirmação → o nome é trocado em **todos** os lançamentos que tinham o antigo.

Regras:

- Grava **na hora**, direto nos lançamentos (`atualizarTransacoesEmLote` em
  `js/dados-carteira.js`); não depende de "Salvar alterações".
- Se o nome correto já existe, os lançamentos **se juntam** a ele e não dá para separar depois
  (a confirmação avisa quantos já existem).
- Banco: o nome novo passa pela padronização dos formulários (`BANCO DO BRASIL` → `BB`).
  Transferências e viradas de mês entram na correção. O campo `banco_investimento` não é alterado.
- Se o nome antigo estava em Bancos sugeridos, Classificações sugeridas ou Bancos de vale, a
  lista é ajustada na tela (aí é preciso salvar). Se alguma regra de equiparação cita a
  classificação antiga, aparece um aviso para conferir.
- Gravação em lotes de 450; cada lote é tudo ou nada. Em caso de erro, o cache local é
  descartado e a lista é recarregada.
- A lista de nomes vem do cache de até 6 horas (ver limitação 15c em
  [11](11-limitacoes-e-pontos-de-atencao.md)).

## 12.6 Aplicar regras aos lançamentos

As regras de equiparação só mudam a categoria na hora de mostrar. Este bloco **grava** essa
categoria como a classificação dos lançamentos, para classificação e categoria passarem a
ser a mesma coisa (e o Extrato aberto pelo Dashboard trazer uma classificação só).

1. **Ver o que mudaria**: para cada lançamento, compara a classificação gravada com
   `finalidadeDe(t)` usando as regras **já salvas** (com alterações pendentes na tela, pede
   para salvar antes). Agrupa por troca: tipo + classificação atual → categoria, com a
   quantidade de lançamentos.
2. Cada troca tem uma caixa de seleção. Trocas em que a classificação atual ou a nova contém
   `INVEST` vêm **desmarcadas**, com aviso: a tela Investimentos reconhece o investimento pela
   classificação exatamente `INVESTIMENTO` e o Planejamento pelos aportes que contêm
   `INVESTIMENTO`; gravar essas trocas muda o que aparece nessas telas.
3. **Gravar em N lançamentos**: depois da confirmação, regrava `classificacao_saida` dos
   grupos marcados (`atualizarTransacoesEmLote`, lotes de 450) e refaz a prévia.

Cuidados:

- **Não há desfazer.** A classificação antiga é substituída; antes, exportar o ano pelo Extrato
  (ou ter um backup do Firestore).
- Se a gravação cair no meio, parte dos grupos já foi regravada; a prévia refeita mostra só o
  que falta.
- Depois de gravar, as regras que só serviam para aqueles lançamentos antigos podem ser
  apagadas. Regras com "só quando o texto tiver" continuam úteis para lançamentos novos que
  forem gravados com a classificação antiga.
- Usa o cache local dos lançamentos (mesma limitação 15c).

## 12.7 O que não está nesta tela

- **Categorias à parte** e **visões personalizadas**: continuam no Dashboard, salvas só no navegador.
- **Colchão e gastos do dia a dia**: continuam no Planejamento.
- **Apelidos de banco** (`BANCO DO BRASIL` → `BB`): fixos em `js/dados-comuns.js`.
