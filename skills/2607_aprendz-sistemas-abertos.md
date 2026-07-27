---
name: aprendz-sistemas-abertos
description: Checklist de segurança, gráficos (Chart.js) e armadilhas de filtro para apps client-side estáticos com Firebase Auth + Firestore (sem backend próprio, sem bundler). Use ao criar ou revisar um projeto desse tipo — dashboards financeiros/pessoais, CRUDs simples com login, apps hospedados em GitHub Pages/Firebase Hosting.
---

# Aprendizados: sistemas abertos (client-side + Firebase)

Compilado a partir do projeto "Meu Financeiro" (app estático em JS puro, Firebase
Auth + Firestore, sem bundler, dependências via CDN). Serve como ponto de partida
para qualquer projeto com a mesma arquitetura: HTML/CSS/JS direto no navegador,
Firebase como backend-as-a-service, libs de terceiros carregadas via CDN.

## 1. Segurança em apps client-side com Firebase

### Firestore Rules
- Validar **tipo E tamanho** de todo campo de texto que o cliente envia, não só
  os numéricos/enum. `maxlength` no HTML é cosmético — quem chama a API do
  Firestore direto (fetch, script, DevTools) ignora isso.
  ```
  function camposDeTextoValidos(dados) {
    return dados.descricao is string && dados.descricao.size() > 0 && dados.descricao.size() <= 120
           && dados.banco is string && dados.banco.size() > 0 && dados.banco.size() <= 60;
  }
  ```
- No `allow update`, travar campos que não podem trocar de dono:
  ```
  allow update: if request.auth.uid == resource.data.userId
                && request.resource.data.userId == resource.data.userId   // <- sem isso, dá pra "abandonar" o doc
                && ...
  ```
- Bloquear qualquer coleção não prevista: `match /{document=**} { allow read, write: if false; }` no final.

### Sessão / logout
- `signOut()` sozinho **não limpa** cache local. Se o app guarda dados em
  `localStorage` (cache de leitura, preferências), limpar tudo no logout —
  senão dados financeiros continuam legíveis em máquina compartilhada.
- Padronizar as chaves de cache/preferência terminando em `_${uid}` permite
  limpar tudo de um usuário com um único loop genérico, sem manter uma lista
  manual de "o que limpar":
  ```js
  function limparDadosLocaisDoUsuario(uid) {
    const sufixo = `_${uid}`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const chave = localStorage.key(i);
      if (chave && chave.endsWith(sufixo)) localStorage.removeItem(chave);
    }
  }
  // chamar ANTES do signOut() acabar (capturar uid antes: auth.currentUser?.uid,
  // porque depois do signOut() ele vira null)
  ```

### Scripts de CDN (supply chain)
- Toda tag `<script src="https://cdn.../lib.js">` sem `npm install` precisa de
  **SRI** (`integrity` + `crossorigin="anonymous"`).
- **Nunca confiar cegamente** no hash publicado pelo CDN — baixar o arquivo e
  calcular o hash você mesmo antes de shipar:
  ```bash
  curl -s "https://api.cdnjs.com/libraries/<lib>/<versao>?fields=sri"   # hash publicado
  curl -sL "https://cdnjs.cloudflare.com/ajax/libs/<lib>/<versao>/arquivo.min.js" -o /tmp/lib.js
  openssl dgst -sha512 -binary /tmp/lib.js | base64                     # confere se bate
  ```
- Fixar versão exata na URL (nunca `@latest`).

### Content-Security-Policy
- Mesmo em app 100% estático, vale um `<meta http-equiv="Content-Security-Policy">`.
- Antes de escrever a política, auditar o que a página realmente usa:
  ```bash
  grep -oE 'style="[^"]*"' *.html | wc -l      # inline style? precisa style-src 'unsafe-inline'
  grep -n '<style' *.html                       # bloco <style>? mesma regra acima
  grep -oE 'on[a-z]+="[^"]*"' *.html            # onclick etc? precisa script-src 'unsafe-inline' (evitar!)
  grep -n '<script' *.html                      # scripts inline sem src? idem
  ```
- Modelo que cobre Firebase Auth + Firestore + um CDN:
  ```
  default-src 'self';
  script-src 'self' https://www.gstatic.com https://cdnjs.cloudflare.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com;
  object-src 'none'; base-uri 'self'; form-action 'self';
  ```
- `frame-ancestors` e `sandbox` **não funcionam** via `<meta>` (só via header HTTP) — nem incluir, é ruído.
- Testar depois: subir com `python3 -m http.server`, abrir no navegador, checar
  console por `Refused to` / `Content Security Policy` — CSP quebrada não dá
  erro de sintaxe, só bloqueia silenciosamente em runtime.

### Deploy das regras via CLI
- `firebase.json` + `.firebaserc` versionados evitam depender de copiar/colar
  regra manualmente no console (fácil esquecer de publicar uma mudança):
  ```json
  // firebase.json
  { "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" } }
  // .firebaserc
  { "projects": { "default": "<project-id-do-firebase-config.js>" } }
  ```
- `firebase-tools` exige Node ≥20. Se o sistema tiver Node mais antigo, **não**
  usar `sudo npm install -g` (cria arquivos root-owned, dor de cabeça depois).
  Instalar via nvm, que resolve permissão E versão de uma vez:
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
  nvm install 20 && nvm use 20
  npm install -g firebase-tools
  ```
- Editar o arquivo local de regras **não** muda produção — precisa
  `firebase deploy --only firestore:rules` (ou publicar manualmente).

### apiKey do Firebase
- Não é segredo (é só identificador do projeto), pode ficar versionado. A
  segurança de verdade é Auth + Firestore Rules. Ainda assim, vale restringir
  a key por domínio no Google Cloud Console → Credenciais.

## 2. Gráficos com Chart.js num app sem bundler

### Setup
- Chart.js via CDN + SRI (mesmo padrão de qualquer outra lib de CDN acima).
  Build `chart.umd.min.js` expõe `Chart` como global — funciona direto num
  `<script>` clássico carregado ANTES do `<script type="module">` que usa ele
  (scripts clássicos executam na hora; módulos só depois de tudo, então a
  ordem no HTML já garante isso).
- Se quiser valores escritos direto na barra/ponto (não só tooltip no hover),
  precisa do plugin **`chartjs-plugin-datalabels`** (Chart.js sozinho não
  faz isso) — mesmo padrão CDN+SRI, registrar uma vez: `Chart.register(ChartDataLabels)`.

### Cor: valide antes de usar, não confie no óbvio
- Se o app já tem uma convenção de cor (ex: verde=entrada, vermelho=saída),
  ela funciona bem para **uma barra de uma cor só** (comparação de magnitude,
  sem identidade a distinguir). Mas em um gráfico com **2+ séries lado a lado**
  (ex: entradas x saídas agrupadas), a identidade de cada série importa — e
  verde/vermelho é a combinação clássica que falha para daltonismo
  vermelho-verde. Rode o validador antes de decidir:
  ```bash
  node scripts/validate_palette.js "#16a34a,#dc2626" --mode light --surface "#ffffff"
  # → FAIL (ΔE 5.0, abaixo do piso de 6-8)
  node scripts/validate_palette.js "#2a78d6,#eb6834" --mode light --surface "#ffffff"
  # → PASS (ΔE 24.7) — use este par pra séries lado a lado
  ```
  (script vem da skill `dataviz`). Não precisa trocar a cor do resto do app —
  só a paleta usada nesse gráfico específico de múltiplas séries.

### Evitar "Canvas is already in use"
- Todo gráfico que é re-renderizado (ex: toda vez que o usuário muda um filtro)
  precisa destruir a instância anterior antes de criar outra no mesmo canvas:
  ```js
  const instancias = new Map();
  function destruir(id) { instancias.get(id)?.destroy(); instancias.delete(id); }
  // destruir(id) sempre no início da função que cria o gráfico
  ```

### Rótulos de dado (datalabels) sem cortar/sobrepor
- Barra horizontal com rótulo no fim da barra: dar folga na escala do valor,
  senão o rótulo da maior barra é cortado na borda do gráfico:
  ```js
  scales: { x: { suggestedMax: maiorValor * 1.18 } }   // ~18% de folga
  plugins: { datalabels: { anchor: "end", align: "end", clamp: true } }
  ```
- Gráfico de **linha**: o ponto nas pontas (primeiro/último) tem o rótulo
  colidindo com o eixo Y (primeiro ponto) ou cortando na borda direita
  (último ponto) se usar `align: "top"` fixo. Alinhar dinamicamente por
  índice resolve:
  ```js
  align: (ctx) => {
    if (ctx.dataIndex === 0) return "right";
    if (ctx.dataIndex === ctx.dataset.data.length - 1) return "left";
    return "top";
  }
  ```
  mais um pouco de `layout.padding` (`top`, `left`, `right`) pra dar espaço.

### Altura dinâmica em barra horizontal
- Barra horizontal com N categorias fica espremida se a altura do container
  for fixa. Calcular a altura a partir da quantidade de itens:
  ```js
  canvas.parentElement.style.height = `${Math.min(420, Math.max(160, n * 34))}px`;
  ```

## 3. Armadilha de filtro: "realizado" vs "previsto/futuro"

Se o app distingue lançamentos já realizados (data ≤ hoje) de futuros/previstos
(data > hoje) — comum em dashboards financeiros — **cuidado onde essa
distinção se aplica**:

- Faz sentido restringir a **realizado apenas** para números que representam
  "quanto dinheiro eu já tenho de verdade" (saldo do período, entradas/saídas
  já ocorridas, saldo por banco).
- **Não** faz sentido aplicar a mesma restrição em gráficos de **composição/
  tendência do período filtrado** (gasto por categoria, evolução mensal,
  visões personalizadas). Se esses gráficos só olham para "realizado", filtrar
  um período **inteiramente futuro** (ex: mês que ainda não chegou) deixa tudo
  vazio — mesmo havendo lançamentos cadastrados — porque nada nesse período
  "já aconteceu" ainda.
- Fix: separar os dois cálculos. Totais/saldo usam a lista já filtrada por
  data ≤ hoje; gráficos de composição/tendência usam a lista **filtrada
  completa** (sem esse corte adicional), aplicando só as outras exclusões que
  já fizerem sentido (ex: transferência interna, categoria tratada à parte).

## 4. Consistência de UI: ordem dos filtros = ordem da tabela

Se uma tela tem filtros de texto que correspondem a colunas de uma tabela
logo abaixo, a ordem dos campos de filtro deve bater com a ordem das colunas
(ex: "Descrição" antes de "Detalhe" no filtro, se a tabela mostra Descrição
antes de Detalhe). Divergência aqui é pequena mas quebra a expectativa de
quem já decorou onde cada coisa fica.

## 5. Metodologia (como validar sem "achismo")

- **SRI**: nunca copiar hash publicado sem baixar o arquivo e recalcular
  (`openssl dgst -sha512 -binary arquivo | base64`) — o hash publicado pode
  estar desatualizado ou a lib pode ter mudado de versão sem avisar.
- **CSP**: testar de verdade num navegador (servidor estático local +
  `read_console_messages` filtrando por "Content Security Policy"/"Refused"),
  não só ler a política e assumir que está certa — CSP falha silenciosamente
  em runtime, não é erro de sintaxe.
- **Cor/acessibilidade**: rodar o validador da skill `dataviz`
  (`scripts/validate_palette.js`) em vez de "olhar e achar que dá pra
  distinguir" — ΔE abaixo do piso é invisível pra quem tem daltonismo, mesmo
  parecendo óbvio pra quem não tem.
- **Lógica de filtro/cálculo**: quando não dá pra testar end-to-end (ex: sem
  credencial de login pra ver o app real), escrever um teste isolado em Node
  reproduzindo só a lógica em questão com dados de exemplo, rodar, conferir
  o resultado esperado — mais rápido e mais confiável que ler o código e
  confiar que está certo.
- **Renderização visual** (gráficos, layout): montar uma página HTML de teste
  isolada (fora do projeto ou temporária dentro dele) que importa os módulos
  reais com dados de exemplo, abrir no navegador, tirar screenshot — sem
  isso, bug de sobreposição/corte de rótulo só aparece em produção.
- Sempre limpar arquivos e servidores de teste temporários depois de validar.
