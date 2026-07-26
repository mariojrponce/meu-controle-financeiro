# Sistema de Controle Financeiro — versão segura

## O que mudou em relação ao sistema anterior

| Problema no sistema antigo | Correção aplicada |
|---|---|
| Qualquer pessoa com o link podia ler e gravar transações (sem login) | Login obrigatório com Firebase Authentication em todas as páginas |
| Todas as transações de todo mundo ficavam misturadas | Cada lançamento agora grava `userId`, e o extrato só mostra os seus |
| `extrato.js` inseria texto do usuário direto no HTML (`innerHTML`) → risco de XSS | Trocado por `textContent`, que nunca executa código |
| Não havia resumo automático (entradas, saídas, saldo) | Adicionado painel de totais no topo do extrato, no espírito da sua planilha |
| Sem regras de segurança no banco (Firestore) | Arquivo `firestore.rules` restringindo leitura/escrita ao dono dos dados |

**Sobre a chave do Firebase (`apiKey`):** ela não é um segredo — serve só para identificar o projeto, e é normal que apareça no código do navegador. Quem protege os dados de verdade são as regras do Firestore abaixo. Ainda assim, se você suspeita que os dados já foram acessados por terceiros (já que o sistema ficou aberto), vale revisar a coleção `transacoes` no Console do Firebase por lançamentos estranhos.

## Passo a passo para colocar no ar

### 1. Ativar o login no Firebase
1. Abra o [Console do Firebase](https://console.firebase.google.com/) → projeto `meucontrolefinanceiro-85d6e`.
2. Menu **Build > Authentication > Sign-in method**.
3. Ative o provedor **E-mail/senha**.
4. Na aba **Users**, clique em **Add user** e crie seu usuário (e-mail + senha) — é esse login que você vai usar no `login.html`.

### 2. Publicar as regras de segurança
1. Menu **Build > Firestore Database > Regras**.
2. Apague o conteúdo atual e cole o conteúdo do arquivo `firestore.rules`.
3. Clique em **Publicar**.

### 3. Hospedar os arquivos
Envie estes arquivos para onde seu site já está hospedado (ex: Firebase Hosting, Netlify, GitHub Pages):
```
login.html
login.js
index.html
app.js
extrato.html
extrato.js
firebase-config.js
auth-guard.js
```
> Se ainda não usa Firebase Hosting, o comando `firebase deploy` (com o Firebase CLI) publica tudo isso junto com as regras.

### 4. Testar
1. Acesse `login.html`, entre com o usuário criado no passo 1.
2. Você será levado a `index.html` (novo lançamento).
3. Clique em "Ver Extrato" para conferir os totais e o filtro.
4. Teste o botão **Sair**.
5. Confirme que, sem estar logado, o acesso direto a `index.html` ou `extrato.html` te manda de volta para o login.

## Se quiser evoluir depois
- Múltiplos usuários/família: dá pra liberar leitura compartilhada trocando a regra de `read` para um grupo de UIDs autorizados.
- Editar/apagar lançamentos: hoje está bloqueado de propósito (regra `allow update, delete: if false`) para evitar apagar histórico sem querer. Posso liberar isso com um botão de confirmação, se quiser.
- Gráficos e metas (como as abas de simulação da sua planilha): dá pra adicionar uma página de resumo mensal por categoria.
