# PROJECT CONTEXT: Meu Financeiro

> Este arquivo fornece uma visão geral de alta densidade de informação para agentes de IA entenderem o projeto rapidamente, economizando tokens e tempo de processamento.

---

## 1. Visão Geral (Overview)

- **Nome do Projeto**: Meu Financeiro (`sistema-financeiro`)
- **Proposta**: Aplicação web SPA/MPA leve para controle de finanças pessoais com autenticação de usuário e persistência no Firebase Firestore.
- **Arquitetura**: Frontend em HTML5 semântico, Vanilla CSS3 (Custom Properties) e Vanilla Javascript (ES Modules nativos). **Sem bundler, sem frameworks (React/Vue/Node build)**.
- **Hospedagem & Backend**: Firebase Hosting, Firebase Authentication e Cloud Firestore Database.

---

## 2. Tecnologias & Dependências Exteriores

| Categoria | Tecnologia / Lib | Origem / Versão | Função |
| :--- | :--- | :--- | :--- |
| **Backend & Auth** | Firebase SDK v10.12.2 | CDN (`gstatic.com`) | Autenticação (Auth) e Banco de Dados (Firestore) |
| **Gráficos** | Chart.js | CDN (`jsdelivr.net`) | Gráficos de rosca/barras no Dashboard |
| **Importação** | SheetJS (XLSX) | CDN (`cdn.jsDelivr.net`) | Parser de arquivos Excel (`.xlsx`/`.csv`) |
| **Estilização** | CSS3 Vanilla | `style.css` | Variáveis CSS, layout responsivo (Flexbox/Grid), suporte a temas |

---

## 3. Estrutura de Arquivos (File Map)

```
├── index.html / js/app.js               # Lançamento rápido de transações + lista dos últimos 10
├── dashboard.html / js/dashboard.js     # Visão geral, saldos por banco, totais do mês e relatórios
├── extrato.html / js/extrato.js         # Extrato completo com filtros por período/banco/tipo e exportação
├── importar.html / js/importar.js       # Importação em lote de transações via planilha Excel
├── login.html / js/login.js             # Tela de login e registro via Firebase Auth
├── firestore.rules                      # Regras de segurança e validações de esquema do Firestore
├── style.css                            # Estilos globais e componentes UI
└── js/
    ├── auth-guard.js                    # Proteção de rotas (redireciona para login.html se deslogado)
    ├── combobox.js                      # Componente de autocompletar inteligente
    ├── cores-bancos.js                  # Mapeamento de cores de marcas de bancos (Nubank, Itaú, etc.)
    ├── dados-carteira.js                # Camada CRUD para a coleção 'carteira' do Firestore
    ├── dados-comuns.js                  # Sugestões de bancos e categorias baseados no histórico
    ├── editor-transacao.js              # Modal/Interface de edição de lançamentos
    ├── firebase-config.js               # Configuração e inicialização dos serviços Firebase
    ├── graficos.js                      # Inicialização e renderização dos gráficos Chart.js
    ├── importacao.js                    # Processamento de linhas da planilha importada
    ├── nav.js                           # Componente de cabeçalho e navegação comum
    ├── preferencias-dashboard.js        # Persistência de filtros do dashboard no localStorage
    ├── preferencias-filtros.js          # Persistência de filtros do extrato no localStorage
    ├── tabela-ordenavel.js              # Utilitário para ordenação interativa de tabelas HTML
    ├── ui.js                            # Sistema de Toast Notifications e modais
    └── utils.js                         # Formatação de moeda (BRL), datas (BR/ISO) e ordenações
```

---

## 4. Esquema de Dados (Firestore Schema)

Coleção Principal: `carteira` (Documentos vinculados ao `userId` do usuário autenticado)

| Campo | Tipo | Validação / Limite | Descrição |
| :--- | :--- | :--- | :--- |
| `userId` | `string` | Obrigatório (`auth.uid`) | ID do usuário proprietário |
| `data` | `string` | ISO `YYYY-MM-DD` | Data da movimentação |
| `descricao` | `string` | 1 a 120 caracteres | Descrição da transação |
| `banco` | `string` | 1 a 60 caracteres | Nome da instituição financeira |
| `tipo` | `string` | `'ENTRADA'` \| `'SAIDA'` | Direção do fluxo financeiro |
| `tipo_mov` | `string` | `'INTERNO'` \| `'EXTERNO'` | Tipo da movimentação |
| `valor` | `number` | Número > 0 | Valor em Reais (BRL) |
| `classificacao_saida` | `string` | 1 a 60 caracteres | Categoria/Classificação |
| `saida` | `string` | 0 a 120 caracteres | Detalhes adicionais (opcional) |
| `criadoEm` | `Timestamp` | Automático | Data/hora de criação do registro |

---

## 5. Regras de Negócio e Convenções do Código

1. **Segurança de Dados**:
   - As permissões no Firestore são restritas ao `request.auth.uid == resource.data.userId`.
   - Nenhuma transação pode ser alterada ou lida por outro usuário (`firestore.rules`).
2. **Estilo & Componentização**:
   - Código JS modular utilizando ES Modules (`import`/`export`).
   - Evitar frameworks pesados; priorizar rotinas leves e utilitários em Vanilla JS.
3. **Formatação & Tratamento de Datas**:
   - No HTML: Inputs de data usam formato brasileiro `DD/MM/AAAA` ou inteligente via `utils.js`.
   - No Firestore: Datas são salvas em string ISO `YYYY-MM-DD` para facilidade de ordenação.
   - Moedas são exibidas usando `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
4. **Navegação & Guards**:
   - Todas as páginas privadas devem invocar `exigirLogin()` de `./js/auth-guard.js` antes de renderizar a interface.

---

## 6. Comandos e Deploy

- **Deploy do Firestore Rules**: `firebase deploy --only firestore:rules`
- **Deploy Geral**: `firebase deploy`
- **Execução Local**: Servidor estático simples (ex: `npx serve .`, `python3 -m http.server 8000` ou extensão Live Server).
