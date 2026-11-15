# 13. Segurança

Estado em 15/11/2026, depois da revisão feita com base em
[blueprint_de_seguran_a_defensiva_para_ias.md](blueprint_de_seguran_a_defensiva_para_ias.md).

O sistema **não tem servidor próprio**: são páginas estáticas (GitHub Pages) que falam direto
com o Firebase. Por isso boa parte do blueprint (SQL, hash de senha, JWT, CSRF, SSRF, CORS,
logs de servidor, IA) não se aplica ou é responsabilidade do Firebase.

## 13.1 O que protege os dados

| Camada | Proteção | Onde |
|--------|----------|------|
| Acesso aos lançamentos | Só o dono lê, cria, edita e exclui; o `userId` não pode ser trocado | `firestore.rules` (`carteira`) |
| Formato dos lançamentos | Só os 16 campos previstos; data `aaaa-mm-dd`; valor > 0 e ≤ 1 bilhão; textos com tamanho limitado | `firestore.rules` (`lancamentoValido`) |
| Configurações | Só o dono; só as 5 chaves previstas; listas de até 300 itens | `firestore.rules` (`configuracoes`) |
| Outras coleções | Tudo bloqueado | `firestore.rules` |
| Login | Firebase Authentication (e-mail/senha). Mensagem de erro genérica. Bloqueio de tentativas em excesso pelo Firebase | `js/login.js` |
| Cadastro | **Desativado** no console (Ações do usuário → "Ativar criação"). Usuário novo só pelo console | Console do Firebase |
| Enumeração de e-mails | Proteção ativada no console | Console do Firebase |
| Páginas privadas | `exigirLogin()` redireciona para o login sem sessão | `js/auth-guard.js` |

Um segundo usuário vê o sistema vazio e só os próprios dados; ver [12](12-configuracoes.md)
para o que ele herda do padrão do sistema.

## 13.2 Proteções da página (navegador)

| Item | Como está |
|------|-----------|
| CSP (meta em todas as páginas) | `default-src 'self'`; scripts só de arquivo (`'self'` e `gstatic.com`; `cdnjs` apenas no Dashboard, para o Chart.js). **Sem `'unsafe-inline'` em scripts** |
| Script do `<head>` | `js/tema-inicial.js` (arquivo próprio, para o CSP poder proibir script embutido) |
| Clickjacking | `js/tema-inicial.js` esconde a página se ela for aberta dentro de um iframe de outro site (o GitHub Pages não envia `X-Frame-Options`) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` (meta em todas as páginas) |
| XSS | **Nenhum `innerHTML`** no código. Tudo é montado com `textContent` e os auxiliares de `js/ui.js`: `mostrarMensagem`, `mostrarLinhaMensagem`, `montarCabecalho`, `criarElemento` |
| Bibliotecas | SheetJS 0.20.3, pdf.js e Tesseract servidos de `js/vendor/` com versão fixa. Chart.js do cdnjs com verificação de integridade (SRI). Firebase SDK 10.12.2 do `gstatic.com` |
| Importação | Arquivos lidos só no navegador, nunca enviados. Limite de 10 MB (planilha) e 25 MB (extrato) |
| Logout | Apaga do `localStorage` tudo que termina em `_<uid>`: cache dos lançamentos, cache das configurações, filtros e preferências |

## 13.3 Regras para quem altera o código

1. **Campo novo num lançamento** → incluir em `camposPermitidos()` no `firestore.rules`,
   validar o tipo/tamanho e publicar (`firebase deploy --only firestore:rules`). Sem isso a
   gravação falha com "permission-denied".
2. **Não usar `innerHTML`**, `outerHTML` nem `document.write`. Usar os auxiliares de `js/ui.js`.
3. **Não colocar `<script>` embutido nem `onclick=` no HTML**: o CSP bloqueia.
4. **Biblioteca nova** → baixar para `js/vendor/` com versão fixa e um `VERSAO.txt`; não
   acrescentar domínio ao CSP sem necessidade.
5. **Página nova** → copiar o `<head>` de uma existente (CSP, `Referrer-Policy`, `tema-inicial.js`)
   e chamar `exigirLogin()` antes de montar a tela.
6. **Preferência nova no `localStorage`** → chave terminando em `_<uid>`.
7. **Antes de publicar regras mais rígidas** → conferir se os lançamentos existentes passam
   nelas (um backup em `backup-*/` serve para isso), porque a edição valida o documento inteiro.

## 13.4 O que ficou pendente

| Item | Por quê | Caminho |
|------|---------|---------|
| Restringir a `apiKey` ao domínio | A chave é pública por natureza, mas pode ser limitada a `mariojrponce.github.io` | Google Cloud Console → Credenciais |
| Cabeçalhos HSTS, `X-Content-Type-Options`, `X-Frame-Options` | O GitHub Pages não permite configurar cabeçalhos | Migrar a hospedagem para o Firebase Hosting |
| Sessão e cache no navegador | A sessão do Firebase não expira e os lançamentos ficam em cache (texto puro) por até 6 h; em computador compartilhado é preciso clicar em Sair | Sessão que termina ao fechar o navegador ou saída automática por inatividade |
| Segundo fator / "esqueci a senha" | O login só tem e-mail e senha | Ativar no Firebase e criar as telas |
| Firebase SDK 10.12.2 | Versão de 2024 | Atualizar e testar login e gravação |
| `'unsafe-inline'` em estilos | O CSP ainda permite estilo embutido (há atributos `style` no HTML e no código) | Mover os estilos para o `style.css` |
| Expressão regular nas regras de categoria | Uma expressão mal escrita trava a aba de quem a escreveu | Limitar a palavras simples, se virar problema |
| Repositório público | O GitHub Pages gratuito exige repositório público: ficam visíveis o código, as regras padrão de categoria e as notas de `melhorias/` | Revisar o que é versionado; backups e extratos reais já estão no `.gitignore` |
