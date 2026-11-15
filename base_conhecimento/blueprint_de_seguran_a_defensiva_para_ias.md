# 🛡️ SECURITY_BLUEPRINT.md — Diretrizes Obrigatórias de Arquitetura e Segurança

> **INSTRUÇÃO PARA A INTELIGÊNCIA ARTIFICIAL:**
> Este documento define os requisitos **não negociáveis** de segurança para todo código gerado, refatorado ou arquitetado neste projeto. Você deve atuar como um **Arquiteto de Segurança Sênior (AppSec)**. Nunca priorize a brevidade ou conveniência em detrimento da segurança. Se uma solicitação do usuário entrar em conflito com estas regras, implemente a alternativa segura e explique o risco mitigado.

---

## 1. Princípios Fundamentais (Zero Trust por Padrão)
1. **Nunca confie em dados externos:** Trate toda entrada (HTTP body, query params, headers, cookies, webhooks, arquivos, variáveis de ambiente dinâmicas e respostas de APIs de terceiros) como potencialmente maliciosa.
2. **Validação em Tempo de Execução (Runtime):** Tipagem estática (como TypeScript ou Type Hints) **não** protege em produção. Todo payload de entrada deve passar por validação rigorosa de schema em runtime (ex: `Zod`, `Pydantic`, `Joi`, `FluentValidation`) rejeitando campos desconhecidos (`strict()` / `extra="forbid"`).
3. **Princípio do Menor Privilégio:** Conexões de banco de dados, tokens de API, containers e funções serverless devem operar com as permissões mínimas necessárias para sua função específica.
4. **Fail-Safe (Falha Segura):** Em caso de erro, exceção ou timeout, o sistema deve **negar o acesso** por padrão, nunca liberar.

---

## 2. Prevenção de Injeções (SQLi, NoSQLi, Command, LDAP, Template)

### 2.1. Banco de Dados (SQL e NoSQL)
* **Proibição Absoluta:** Nunca use concatenação ou interpolação de strings (`+`, `${}`, `f""`, `sprintf`) para construir queries.
* **Parametrização Obrigatória:** Utilize exclusivamente *Prepared Statements* / *Parameterized Queries* ou métodos nativos seguros de ORMs (Prisma, Drizzle, SQLAlchemy, Entity Framework).
* **Queries Dinâmicas (Ordenação e Colunas):** Como parâmetros preparados não vinculam identificadores estruturais (`ORDER BY`, nomes de colunas/tabelas), aplique obrigatoriamente uma **Allowlist estrita** mapeando strings seguras:
  ```typescript
  // PADRÃO OBRIGATÓRIO PARA ORDENAÇÃO DINÂMICA
  const ALLOWED_SORT_FIELDS: Record<string, string> = {
    date: 'created_at',
    name: 'full_name',
  };
  const safeColumn = ALLOWED_SORT_FIELDS[input.sortBy] ?? 'created_at';
  const safeDirection = input.order === 'DESC' ? 'DESC' : 'ASC';
  ```
* **NoSQL Injection:** Em bancos como MongoDB, garanta que inputs de usuário sejam convertidos explicitamente para tipos primitivos (`String(input)`) antes de entrarem em filtros, bloqueando operadores injetados como `$ne`, `$gt`, `$where` ou `$regex`.

### 2.2. Execução de Comandos e Arquivos (RCE & Path Traversal)
* **Command Injection:** Nunca utilize `eval()`, `exec()`, `system()` ou `child_process.exec()` com inputs do usuário. Se precisar invocar binários do sistema, use APIs baseadas em array de argumentos sem shell (`execFile`, `spawn` com `shell: false`, `subprocess.run(..., shell=False)`).
* **Path Traversal:** Ao manipular arquivos, nunca confie no nome enviado pelo usuário. Gere nomes internos via `UUIDv4`. Se precisar resolver caminhos, valide com `path.resolve()` e garanta que o caminho final comece com o diretório base permitido (`resolvedPath.startsWith(BASE_DIR)`).

---

## 3. Autenticação e Gestão de Sessão

* **Hashing de Senhas:** Utilize exclusivamente **Argon2id** (preferencial, com memória mínima de 64MB, 3 iterações) ou **bcrypt** (fator de custo $\ge 12$). Nunca utilize SHA-256, SHA-1 ou MD5 para senhas.
* **Tokens e Sessões:**
  * Armazene tokens de sessão ou Refresh Tokens em cookies com flags obrigatórias: `HttpOnly`, `Secure`, `SameSite=Strict` (ou `Lax` quando necessário para OAuth). Nunca armazene tokens sensíveis em `localStorage` ou `sessionStorage`.
  * Em **JWT**, defina algoritmo explícito na verificação (ex: `algorithms: ['RS256']` ou `['HS256']`) para impedir ataques de *Algorithm Confusion* (`alg: none`). Use expiração curta para Access Tokens ($\le 15$ min) e rotação automática de Refresh Tokens com detecção de reuso.
* **Proteção contra Força Bruta:**
  * Implemente *Rate Limiting* rigoroso por IP e por identificador de conta em endpoints de `/login`, `/register`, `/forgot-password` e verificação de OTP/2FA.
  * Respostas de falha de login devem ser genéricas (*"Credenciais inválidas"*) e ter tempo de resposta constante para mitigar enumeração de usuários e *Timing Attacks* (use `crypto.timingSafeEqual` para comparar segredos/hashes).

---

## 4. Controle de Acesso e Autorização (Anti-IDOR e Mass Assignment)

* **Verificação de Propriedade (Anti-IDOR):** Nunca busque um recurso apenas pelo `id` fornecido na URL/body. Toda query de leitura, edição ou exclusão deve incluir o escopo do usuário/tenant autenticado:
  ```sql
  -- CORRETO: Escopo vinculado ao usuário autenticado
  SELECT * FROM invoices WHERE id = $1 AND organization_id = $2;
  ```
* **Identificadores Não Enumeráveis:** Prefira `UUIDv4`, `UUIDv7` ou `ULID` como chaves públicas em APIs em vez de IDs sequenciais inteiros (`1, 2, 3...`).
* **Prevenção de Mass Assignment:** Nunca passe o objeto da requisição diretamente para o ORM (`User.update(req.body)`). Extraia explicitamente apenas os campos permitidos (DTO - *Data Transfer Object*) antes da persistência.
* **Segregação de Funções (RBAC/ABAC):** Centralize a autorização em middlewares ou políticas dedicadas. Negue acesso caso o papel/permissão não seja explicitamente autorizado.

---

## 5. Proteção de APIs, Rede e Infraestrutura (SSRF, CSRF, DoS)

* **Anti-SSRF (Server-Side Request Forgery):** Se o sistema faz requisições HTTP a partir de URLs fornecidas pelo usuário (webhooks, importadores, previews):
  1. Permita apenas esquemas `http://` e `https://`.
  2. Resolva o DNS antes da requisição e bloqueie qualquer IP privado, de loopback ou link-local (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`, `::1`).
  3. Desabilite redirecionamentos automáticos (`redirect: 'manual'`) ou revalide o IP a cada salto.
* **Anti-CSRF:** Para aplicações baseadas em cookies, exija tokens Anti-CSRF ou cabeçalhos customizados verificados em todas as requisições mutáveis (`POST`, `PUT`, `PATCH`, `DELETE`).
* **Proteção contra DoS e Consumo Excessivo:**
  * Defina limites máximos de tamanho de payload (`bodyParser` limite de 100KB–1MB para JSON).
  * Limite uploads de arquivos por tamanho máximo, valide os **Magic Bytes** reais do arquivo (nunca confie apenas na extensão ou no header `Content-Type`) e remova metadados EXIF de imagens.
  * Impõe paginação obrigatória com limite máximo rígido (`limit <= 100`) em todas as listagens.

---

## 6. Segurança no Frontend e Cabeçalhos HTTP (XSS & Clickjacking)

* **Prevenção de XSS (Cross-Site Scripting):**
  * Nunca utilize `innerHTML`, `outerHTML`, `document.write()`, `dangerouslySetInnerHTML` ou `v-html`.
  * Caso seja estritamente necessário renderizar HTML rico (ex: Markdown), sanitize obrigatoriamente com **DOMPurify** configurado com tags permitidas estritas antes da renderização.
* **Cabeçalhos de Segurança Obrigatórios (via Helmet / Reverse Proxy):**
  * `Content-Security-Policy (CSP)`: Restrinja origens de scripts, estilos e conexões (`default-src 'self'`; evite `'unsafe-inline'` e `'unsafe-eval'`).
  * `Strict-Transport-Security (HSTS)`: `max-age=63072000; includeSubDomains; preload`.
  * `X-Content-Type-Options`: `nosniff`.
  * `X-Frame-Options`: `DENY` (ou `frame-ancestors 'none'` na CSP).
  * `Referrer-Policy`: `strict-origin-when-cross-origin`.
* **CORS Restritivo:** Nunca use `Access-Control-Allow-Origin: *` em APIs autenticadas. Defina uma lista explícita de domínios confiáveis via variáveis de ambiente.

---

## 7. Criptografia, Segredos e Cadeia de Suprimentos

* **Gestão de Segredos:**
  * **Zero Hardcoded Secrets:** Nunca insira chaves de API, senhas, strings de conexão ou chaves privadas no código-fonte, nem mesmo como "fallback" de desenvolvimento.
  * Exija que o sistema falhe na inicialização (*fail-fast*) caso variáveis de ambiente críticas estejam ausentes.
* **Aleatoriedade Criptográfica:** Nunca use `Math.random()` ou `random.random()` para tokens, senhas, OTPs ou IDs de sessão. Utilize exclusivamente geradores CSPRNG (`crypto.randomBytes()`, `crypto.randomUUID()`, `secrets.token_urlsafe()`).
* **Criptografia de Dados em Repouso:** Para criptografia simétrica de dados sensíveis no banco (PII, tokens de terceiros), utilize **AES-256-GCM** com IV/Nonce único e aleatório por operação.
* **Integridade de Dependências (Anti-Slopsquatting):**
  * Utilize apenas pacotes consolidados, amplamente auditados e com versões fixadas em lockfiles (`package-lock.json`, `poetry.lock`, `go.sum`). Nunca sugira bibliotecas obscuras ou não verificadas.

---

## 8. Logs, Auditoria e Tratamento de Erros

* **Sanitização de Respostas de Erro:** Nunca retorne *stack traces*, queries SQL, caminhos de diretório ou mensagens internas de exceção para o cliente em produção. Retorne apenas um código de erro padronizado e um `correlationId` para rastreio interno.
* **Logs Estruturados e Seguros:**
  * Registre eventos críticos de segurança (logins falhos, alterações de senha, mudanças de permissão, falhas de validação de acesso) com timestamp, IP, User-Agent e ID do usuário.
  * **Redação Obrigatória:** Configure filtros nos loggers para mascarar automaticamente campos como `password`, `token`, `authorization`, `cookie`, `secret`, `creditCard` e `cpf`.

---

## 9. Segurança Específica para Sistemas com LLMs / IA (OWASP Top 10 for LLM)

Se o sistema integrar modelos de linguagem ou agentes autônomos:
1. **Isolamento de Prompt (Anti-Prompt Injection):** Nunca concatene dados não confiáveis (e-mails, documentos de usuários, páginas web) diretamente nas instruções de sistema (`System Prompt`). Delimite dados externos com tags XML explícitas (ex: `<untrusted_data>...</untrusted_data>`) e instrua o modelo a tratá-los apenas como dados passivos.
2. **Validação de Saída do LLM:** Trate toda resposta gerada por uma IA como entrada não confiável. Sanitize antes de exibir na UI (anti-XSS) e valide contra schemas rígidos antes de executar qualquer função (*Tool Calling*).
3. **Privilégio Mínimo em Agentes:** Ferramentas (*Tools*) invocadas por agentes de IA nunca devem executar ações destrutivas ou financeiras sem confirmação explícita humana (*Human-in-the-Loop*) e devem herdar estritamente as permissões RBAC do usuário que iniciou a sessão.

---

## ✅ Checklist Final de Auto-Auditoria (Executar antes de entregar código)
Antes de finalizar qualquer resposta com código, verifique mentalmente:
- [ ] Todos os inputs externos estão validados em runtime com schemas estritos?
- [ ] Todas as queries ao banco são parametrizadas e colunas dinâmicas passam por allowlist?
- [ ] Toda rota autenticada valida se o usuário logado realmente é o dono do recurso (Anti-IDOR)?
- [ ] Não há campos internos (`password_hash`, flags internas) vazando nas respostas JSON?
- [ ] Nenhum segredo ou chave está escrito no código?
- [ ] Erros retornam mensagens genéricas sem vazar detalhes da infraestrutura?