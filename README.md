# 💰 Meu Financeiro

Sistema web para registrar e acompanhar transações financeiras, com login individual, dados protegidos no Firebase e uma visão geral tipo dashboard.

## 🐞 Sobre o bug do extrato "não encontrado"

A causa era a consulta ao Firestore combinar `where("userId", "==", ...)` com `orderBy("data")`. Esse tipo de combinação exige um **índice composto** no banco; sem ele, a consulta falha e a tela ficava mostrando "nenhuma transação encontrada" mesmo com dados salvos.

**Correção:** a consulta agora só filtra por `userId`, e a ordenação por data é feita no próprio navegador. Resultado igual, sem depender de nenhum índice extra — o problema não deve mais acontecer.

## Novidades desta versao

- **Design novo**, com tema de cores consistente, cartões, navegação fixa no topo e layout responsivo.
- **Dropdowns pesquisáveis** para Banco e Classificação: comece a digitar e as opções filtram sozinhas. Vêm pré-carregadas com os valores que já apareciam na sua planilha (NUBANK, CLEAR, ALUGUEL, INTERNET, TRANSPORTE etc.) e o sistema aprende sozinho — qualquer valor novo que você digitar passa a ser sugestão nas próximas vezes.
- **Campo de data inteligente**: digite e as barras (`/`) são inseridas automaticamente, ou **cole uma data copiada de um extrato bancário** (em qualquer formato comum — `25/07/2026`, `2026-07-25`, `25-07-2026` etc.) que o sistema reconhece e converte sozinho.
- **Dashboard** novo (`dashboard.html`): saldo total de todas as carteiras, quanto entrou e saiu no mês atual, saldo por banco/carteira, e as maiores categorias de gasto do mês — no espírito das telas de resumo que você tinha na planilha.

## Estrutura de arquivos

| Arquivo | Função |
|---|---|
| `login.html` / `login.js` | Tela de entrada (e-mail e senha) |
| `index.html` / `app.js` | Formulário de novo lançamento |
| `extrato.html` / `extrato.js` | Extrato com filtros e resumo de totais |
| `dashboard.html` / `dashboard.js` | Visão geral: saldo por banco, mês atual, categorias |
| `firebase-config.js` | Conexão com o Firebase, usada por todas as páginas |
| `auth-guard.js` | Bloqueia páginas sem login |
| `nav.js` | Barra de navegação compartilhada e botão "Sair" |
| `dados-comuns.js` | Listas de sugestão de bancos/classificações (baseadas na sua planilha) |
| `utils.js` | Conversão de datas (BR ↔ ISO), reconhecimento de data colada, formatação de moeda |
| `style.css` | Visual (cores, tipografia, componentes) de todas as páginas |
| `firestore.rules` | Regras de segurança do banco de dados |

## Como funciona

1. **Login**: sem sessão válida, qualquer página redireciona para `login.html`.
2. **Novo lançamento**: ao salvar, grava a transação com o seu `userId`; os campos de Banco e Classificação sugerem valores já usados por você.
3. **Extrato**: mostra tudo que é seu, com filtros por período, banco e movimentação, e totais calculados na hora.
4. **Dashboard**: cruza todas as suas transações para mostrar saldo por banco (entradas − saídas acumuladas), e o resultado do mês atual.

## Segurança (mantida desta versão para a anterior)

- Login obrigatório (Firebase Authentication).
- Cada transação pertence a um `userId`; ninguém vê dados de outro usuário.
- Regras do Firestore (`firestore.rules`) bloqueiam qualquer leitura/gravação fora dessas condições, mesmo que alguém tente ignorar o site e falar direto com o banco.
- Todo texto digitado pelo usuário é exibido como texto puro (nunca interpretado como HTML/JavaScript), o que evita XSS.
- Edição e exclusão de lançamentos continuam bloqueadas por padrão, para não perder histórico por engano.

## Publicando as atualizações

1. Suba todos os arquivos deste pacote para onde seu site já está hospedado, **substituindo os antigos** (a estrutura de nomes é a mesma).
2. Nada muda nas regras do Firestore — se você já publicou o `firestore.rules` da versão anterior, não precisa fazer nada de novo ali.
3. Teste: entre, cadastre uma transação, veja se ela aparece no extrato, e confira o Dashboard.
