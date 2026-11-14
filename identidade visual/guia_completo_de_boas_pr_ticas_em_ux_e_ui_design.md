# Guia Prático e Teórico de Boas Práticas em UX e UI Design

> **Baseado na monografia:** *Boas práticas em UX e UI Design: Um guia prático e teórico para projetar interfaces digitais intuitivas* (Anna Lara Nascimento Pontes, UFC, 2022).  
> **Objetivo:** Fornecer um manual estruturado, replicável e embasado cientificamente (Psicologia Cognitiva, Heurísticas de Nielsen, Gestalt e Metodologia de Garrett) para projetar qualquer sistema digital de forma consciente e intuitiva.

---

## 1. Fundamentos: O que é UX e UI Design?

* **UX (User Experience / Experiência do Usuário):** É o "recheio" do produto. Abrange os aspectos emocionais, subjetivos, experienciais e funcionais. Seu objetivo é atender às necessidades reais dos usuários, garantir a usabilidade e criar sistemas fáceis de usar, intuitivos, funcionais e acessíveis.
* **UI (User Interface / Interface do Usuário):** É a "cobertura" e a decoração do produto. É a superfície visual e interativa — aquilo que vemos, tocamos e interagimos (cores, tipografia, ícones, botões, layout).
* **IHC (Interação Humano-Computador):** Estuda o fenômeno da interação entre pessoas e sistemas computacionais, unindo aspectos **pragmáticos** (produtividade, eficiência, prevenção de erros) e **hedônicos** (prazer no uso, estética).
* **Regra de Ouro:** UX e UI são interdependentes, mas uma UI visualmente impecável não salva uma UX falha. Antes de desenhar telas, é preciso entender as necessidades reais do usuário e a viabilidade técnica do sistema (banco de dados, componentes implementáveis e *Design System*).

---

## 2. Metodologia de Projeto: Os 5 Planos de Garrett

Para criar interfaces coerentes e intuitivas em qualquer projeto, siga este fluxo de cinco camadas, partindo do **mais abstrato (conceito)** para o **mais concreto (visual)**:

### Plano 1: Estratégia *(Por que estamos criando este sistema?)*
* **Foco:** Alinhar os objetivos do negócio/produto com as necessidades reais dos usuários.
* **Como executar:**
  * Desapegue-se de achismos e faça pesquisas com usuários reais (questionários, entrevistas semiestruturadas com perguntas abertas e fechadas sem induzir respostas).
  * Mapeie o contexto de uso (ex.: o usuário usa dois monitores? Usa no celular com uma mão?).
* **Entregáveis:** Definição do problema, lista de necessidades dos usuários e **Mapas de Jornada do Usuário** (mapeando ações, pensamentos, emoções, oportunidades e métricas nas fases *Antes*, *Durante* e *Depois* do uso).

### Plano 2: Escopo *(O que exatamente vamos construir?)*
* **Foco:** Traduzir as necessidades levantadas na Estratégia em requisitos claros, escritos em linguagem universal (sem jargões técnicos que gerem ruído na equipe).
* **Como executar:**
  * **Requisitos Funcionais:** Recursos e comportamentos técnicos que o sistema deve ter (ex.: campo de busca com filtros, modo noturno, favoritar conteúdo).
  * **Requisitos de Conteúdo:** Informações, textos, mídias e dados que precisam ser exibidos.
  * **Priorização:** Classifique cada requisito em **Alta**, **Média** ou **Baixa prioridade** para viabilizar o cronograma.

### Plano 3: Estrutura *(Como o sistema funciona e se organiza?)*
* **Foco:** Sair do abstrato para o concreto por meio do **Design de Interação** e da **Arquitetura da Informação**.
* **Como executar:** Organize hierarquicamente quais informações e funcionalidades vêm em primeiro plano e como as telas se conectam.
* **Entregável:** **Mapa do Site / Fluxograma de Navegação** (diagrama estrutural separando blocos de conteúdo e funcionalidades).

### Plano 4: Esqueleto *(Onde cada elemento fica na tela?)*
* **Foco:** Diagramação, posicionamento de componentes, **Design de Interface**, **Design de Navegação** e **Design de Informação** — **sem aplicar cores ou tipografia refinada ainda**.
* **Como executar:**
  * Faça rabiscos no papel para explorar layouts rapidamente (*"rasgar papel é barato; rasgar código é caro"*).
  * Evolua para protótipos navegáveis simples para validar fluxos.
* **Entregáveis:** Rabiscos (sketches) e **Wireframes / Protótipo de Baixa Fidelidade**.

### Plano 5: Superfície *(Qual é a aparência e sensação final?)*
* **Foco:** **Design Sensorial**. Materialização visual aplicando teoria das cores, tipografia, iconografia, estados de componentes, microinterações e leis da Gestalt/Psicologia.
* **Entregáveis:** **Guia de Estilo (Style Guide)** e **Protótipo de Alta Fidelidade** (incluindo versões responsivas para telas menores).

---

## 3. As 10 Heurísticas de Nielsen + Leis da Psicologia Cognitiva

Heurísticas são diretrizes gerais que reduzem o esforço mental do usuário. Abaixo está o cruzamento de cada heurística com seu fundamento na Psicologia Cognitiva e como aplicá-la na prática:

### 3.1. Visibilidade do status do sistema
* **Base Psicológica — Limiar de Doherty:** A produtividade aumenta exponencialmente quando o sistema e o usuário interagem em um ritmo abaixo de **$400\text{ ms}$**, garantindo que nenhuma das partes fique esperando sem resposta.
* **Como replicar:**
  * Comunique explicitamente o que está acontecendo em tempo real.
  * Use barras de progresso lineares únicas (nunca exiba múltiplas barras de progresso simultâneas para etapas diferentes).
  * Utilize indicadores de progresso em vídeos/cursos, destaques de borda na opção selecionada e *skeleton screens* (desfoque/esqueleto) enquanto imagens ou dados carregam.

### 3.2. Combinação entre o sistema e o mundo real
* **Base Psicológica — Modelos Mentais:** Estruturas de conhecimento que os indivíduos criam com base em suas experiências prévias para entender o mundo.
* **Como replicar:**
  * Use palavras, frases e conceitos familiares ao público-alvo; evite termos orientados ao banco de dados ou jargões técnicos.
  * Utilize metáforas visuais do mundo físico (*skeumorfismo* funcional), como o ícone de **lupa** para pesquisar e o **sino** para notificações.
  * Considere a faixa etária e cultura dos usuários (ex.: um disquete pode não fazer sentido para gerações mais novas).

### 3.3. Controle e liberdade do usuário
* **Base Psicológica — Lei de Postel (Princípio da Robustez):** *"Seja conservador no que você faz, seja liberal no que aceita dos outros."* O sistema deve ser tolerante e resiliente às ações inesperadas ou indesejadas do usuário.
* **Como replicar:**
  * Forneça "saídas de emergência" claramente marcadas para sair de estados indesejados sem burocracia.
  * Implemente recursos de **Desfazer** e **Refazer** (incluindo suporte a atalhos como `Ctrl + Z`).
  * Em ações destrutivas ou drásticas (ex.: apagar conta ou conversa), exiba um modal de confirmação com opção clara de **Cancelar**.

### 3.4. Consistência e padrões
* **Base Psicológica — Lei de Jakob e Modelos Mentais:** Os usuários passam a maior parte do tempo em *outros* sites e sistemas; portanto, esperam que o seu funcione da mesma maneira que os que já conhecem.
* **Como replicar:**
  * **Não invente controles novos e arbitrários** (ex.: controles rotativos 3D complexos ou botões que exigem segurar por vários segundos sem necessidade).
  * Respeite convenções estabelecidas (ex.: clicar no logotipo no cabeçalho redireciona para a página inicial).
  * Mantenha consistência interna de cores, ícones (mesmo estilo de traço/preenchimento), botões, layouts e tom de voz em todas as telas. Quebre padrões apenas se houver um ganho claro de eficiência ou proposta temática intencional.

### 3.5. Prevenção de erros
* **Base Psicológica — Lei de Fitts:** O tempo para atingir um alvo depende da distância até ele e do seu tamanho. Alvos de toque/clique precisam ser grandes o suficiente para seleção precisa.
* **Como replicar:**
  * Previna **deslizes inconscientes** (quando o usuário age no "piloto automático") antes que o erro ocorra.
  * Use restrições de formato e máscaras de entrada (ex.: seletores de hora/data que aceitam apenas números válidos).
  * Insira instruções preventivas abaixo dos campos (ex.: regras de criação de senha) e ofereça o recurso **"Mostrar senha"**.
  * **Hierarquia de alvos (Lei de Fitts):** Dê área de clique grande e preenchida para o botão principal, e área menor (ex.: botão estilo link, sem fundo) para ações destrutivas como "Apagar" ou "Limpar", evitando cliques acidentais.

### 3.6. Reconhecimento em vez de memorização
* **Base Psicológica — Lei de Miller e *Chunking*:** A memória de trabalho humana retém em média apenas **$7 \pm 2$** itens simultaneamente. O *chunking* consiste em agrupar informações em blocos/categorias lógicas para facilitar a retenção.
* **Como replicar:**
  * Não obrigue o usuário a decorar informações de uma tela para usar em outra.
  * Agrupe listas extensas em categorias visuais claras (*chunking*).
  * Prefira campos de múltipla escolha a perguntas abertas sempre que possível.
  * Diferencie visualmente links já visitados (ex.: mudança de cor) e ofereça tabelas de comparação lado a lado para produtos ou planos.

### 3.7. Flexibilidade e eficiência de uso
* **Base Psicológica — Lei de Postel:** Sistemas flexíveis acomodam tanto iniciantes (que precisam de orientação) quanto usuários experientes (que buscam velocidade).
* **Como replicar:**
  * Ofereça aceleradores discretos para usuários avançados: atalhos de teclado, gestos rápidos (ex.: toque duplo para curtir) e personalização de área de trabalho.
  * Garanta navegação completa via teclado (tecla `Tab`), o que acelera o uso e promove acessibilidade para pessoas com deficiência visual ou motora.
  * Permita múltiplas formas de autenticação ou execução de tarefas frequentes.

### 3.8. Design estético e minimalista
* **Base Psicológica — Lei de Hick:** O tempo necessário para tomar uma decisão aumenta proporcionalmente ao número e à complexidade das opções disponíveis (carga cognitiva).
* **Como replicar:**
  * Minimalismo não é apenas "pouca cor", mas sim **ausência de ruído informacional**. Cada elemento extra compete com os elementos relevantes.
  * Exiba na tela principal apenas o essencial para a decisão imediata do usuário.
  * Oculte detalhes secundários sob demanda (ex.: botões de *"Saiba mais"*, acordeões ou abas).

### 3.9. Ajude os usuários a reconhecer, diagnosticar e se recuperar de erros
* **Base Psicológica — Regra do Pico-Final:** As pessoas julgam uma experiência inteira com base em como se sentiram no seu **ponto mais intenso (pico)** e no **final**, não na média de todos os momentos.
* **Como replicar:**
  * Nunca exiba apenas códigos técnicos frios (ex.: `Error 404` ou `NullPointerException`).
  * Escreva mensagens educadas, claras e construtivas explicando o que aconteceu em linguagem humana.
  * Combine texto com ícones ou ilustrações amigáveis (um toque de humor leve ajuda a reverter um pico negativo).
  * Sempre forneça uma **ação imediata de recuperação** (ex.: botão *"Voltar para o início"*, sugestões de termos parecidos na busca ou link para suporte).

### 3.10. Ajuda e documentação
* **Base Psicológica — Lei de Tesler (Lei da Conservação da Complexidade):** Para qualquer sistema existe uma quantidade de complexidade irredutível; se o sistema não puder ser mais simplificado, a interface deve absorver e explicar essa complexidade.
* **Como replicar:**
  * **Ajuda Proativa:** Familiarize o usuário antes que ele erre. Coloque microtextos explicativos logo abaixo de gráficos complexos ou formulários técnicos, e utilize ícones de informação (`i`) com *tooltips* explicativos.
  * **Ajuda Reativa:** Para dúvidas pontuais, mantenha uma seção de **Perguntas Frequentes (FAQ)** ou central de ajuda acessível a qualquer momento, organizada por categorias.

---

## 4. Leis da Gestalt Aplicadas ao Design de Interfaces (UI)

O cérebro humano percebe o conjunto antes de analisar elementos isolados. Utilize as **8 Leis da Gestalt** para construir layouts equilibrados e escaneáveis:

1. **Unidade:** Um elemento pode ser percebido como um todo ou como parte de um conjunto. *Na UI:* Um card de produto é uma unidade completa, enquanto sua foto, título e preço são subunidades internas.
2. **Segregação:** Capacidade de diferenciar unidades entre si ou do fundo por meio de contraste, cor, forma, textura ou peso tipográfico. *Na UI:* Usar negrito para títulos e peso regular para textos corridos; diferenciar visualmente botões primários de secundários.
3. **Unificação:** Harmonia visual obtida quando elementos repetem padrões simétricos ou estruturais iguais. *Na UI:* Grades de cards com mesmas dimensões, alinhamentos, bordas e posicionamento de botões.
4. **Fechamento:** Tendência do cérebro em completar formas inacabadas ou interpretar figuras no espaço negativo. *Na UI:* Criação de ícones minimalistas limpos e logotipos memoráveis.
5. **Continuidade:** Disposição de elementos que conduzem o olhar sequencialmente em uma direção sem quebras bruscas. *Na UI:* Menus e submenus alinhados em cascata, listas verticais e carrosséis horizontais.
6. **Proximidade:** Elementos próximos entre si são percebidos como pertencentes ao mesmo grupo funcional. *Na UI:* Em formulários, o rótulo (*label*) deve ficar bem próximo do seu campo de entrada (*input*) e ter um espaçamento maior até o próximo campo.
7. **Semelhança:** Elementos com aparência similar (cor, forma, tamanho) são interpretados como tendo a mesma função. *Na UI:* Padronizar a aparência de todos os links ou tags. *(Atenção: não deixe ícones de funções distintas parecidos demais em cor e formato, pois isso obriga o usuário a parar e pensar para diferenciá-los).*
8. **Pregnância da Forma:** O cérebro busca estruturas simples, equilibradas, regulares e de rápida leitura. *Na UI:* Evitar fontes decorativas irregulares em interfaces; priorizar famílias tipográficas limpas e legíveis (ex.: *Roboto*, *Inter*, *Open Sans*) e alto contraste.

---

## 5. Checklist Prático de UI e Guia de Estilo (Style Guide)

Antes de finalizar qualquer interface ou passar telas para o desenvolvimento, valide os seguintes componentes:

### Paleta de Cores e Acessibilidade
* [ ] **Cores Principais definidas:** Fundo neutro (claro/escuro), cor de texto com alto contraste e cor de destaque para ações principais (CTAs).
* [ ] **Cores Secundárias definidas:** Tons mais suaves para categorização, tags, ilustrações e estados de feedback (sucesso, alerta, erro).
* [ ] **Contraste e Daltonismo:** Nenhum texto pequeno possui baixo contraste. As informações não dependem *apenas* da cor para serem entendidas (acompanhe cores de erro/sucesso com ícones e texto).
* [ ] **Conforto Visual:** Considere oferecer suporte a **Modo Noturno (Dark Mode)** e controles de acessibilidade tipográfica (`A-`, `A`, `A+`).

### Tipografia e Leitura Web
* [ ] **Hierarquia Clara:** Tamanhos e pesos bem definidos para `H1` (ex.: `28px`), `H2` (`24px`), `H3` (`18px`), `H4`/Corpo (`14px` a `16px`) e legendas.
* [ ] **Escaneabilidade:** Evite blocos de texto muito largos ou rolagens infinitas sem pausas visuais. Intercale textos curtos com imagens, ícones ou listas.

### Formulários e Campos de Entrada (Inputs)
* [ ] **Rótulos (*Labels*) sempre visíveis:** Nunca use apenas *placeholders* dentro do campo no lugar do rótulo, pois o texto some quando o usuário começa a digitar, forçando a memória.
* [ ] **Área de Clique Expandida:** Associe o clique no texto do rótulo (*label*) à ativação automática do campo (*input*).
* [ ] **Todos os 4 Estados Projetados:**
  1. **Ativado (Padrão):** Borda neutra clara.
  2. **Selecionado (Foco):** Borda destacada na cor primária do sistema.
  3. **Desativado:** Fundo acinzentado e texto com menor contraste indicando indisponibilidade.
  4. **Erro:** Borda vermelha + ícone de alerta + mensagem explicativa objetiva logo abaixo do campo indicando como corrigir.

### Botões e Componentes Interativos
* [ ] **Hierarquia de Botões:**
  * **Primário / CTA:** Fundo preenchido (maior peso visual e área de clique).
  * **Secundário:** Apenas contorno (*outline*) ou fundo sutil.
  * **Link:** Apenas texto (ideal para ações terciárias ou destrutivas como "Cancelar/Excluir").
* [ ] **Todos os Estados Projetados:** Padrão, *Hover* (passar o mouse), Selecionado/Ativo e Inativo/Desabilitado.
* [ ] **Iconografia:** Ícones que não são universalmente óbvios devem vir acompanhados de rótulo textual ou *tooltip* explicativo.