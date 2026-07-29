# Guia e Investigação: Visualização de Dados e Ergonomia de Dashboards (Tabelas, Gráficos, Cores e Tipografia)

Este documento compila conhecimentos científicos, princípios de percepção visual (Gestalt, Cleveland & McGill, Colin Ware), psicologia cognitiva (Teoria da Carga Cognitiva, Efeito de Divisão de Atenção) e diretrizes de acessibilidade (WCAG 2.1/2.2) para o design e desenvolvimento de dashboards executivos e operacionais.

Ele serve como complemento ao [alinhamento_paginas_ux_ui.md](file:///home/note/projetos/sistema-financeiro/skills/alinhamento_paginas_ux_ui.md) e ao [guia_leitura_telas.md](file:///home/note/projetos/sistema-financeiro/skills/guia_leitura_telas.md).

---

## 1. Fundamentos da Percepção Visual de Dados

### 1.1. Hierarquia da Percepção Gráfica (Cleveland & McGill, 1984, 1985)
Os estatísticos William S. Cleveland e Robert McGill conduziram pesquisas seminais sobre como o sistema visual humano processa diferentes codificações visuais de dados numéricos. Eles estabeleceram uma hierarquia rigorosa de precisão perceptiva (do mais preciso ao menos preciso):

1. **Posição em uma Escala Comum (*Position on a Common Scale*):** Ex.: Gráficos de barras alinhados no mesmo eixo Y ou X, gráficos de pontos. **(Mais preciso)**
2. **Posição em Escalas Não-Alinhadas (*Position on Unaligned Scales*):** Ex.: Gráficos de barras lado a lado em eixos descentralizados.
3. **Comprimento / Largura (*Length*):** Ex.: Comprimento de segmentos ou linhas desancoradas.
4. **Ângulo e Inclinação (*Angle / Slope*):** Ex.: Fatias de gráfico de pizza (*pie charts*), inclinação de linhas em gráficos de rosca.
5. **Área (*Area*):** Ex.: Gráficos de bolha (*bubble charts*), treemaps.
6. **Volume e Curvatura (*Volume / Curvature*):** Ex.: Objetos 3D em dashboards.
7. **Saturação e Matiz de Cor (*Color Saturation / Hue*):** Ex.: Mapas de calor (*heatmaps*). **(Menos preciso para valores exatos)**

> [!IMPORTANT]
> **Implicação Prática para Dashboards:**
> Gráficos de barras e tabelas numéricas operam no topo absoluto da hierarquia perceptiva (Posição em Escala Comum e Leitura Simbólica Exata). Gráficos de pizza e elementos 3D possuem menor precisão perceptiva e devem ser evitados em análises críticas.

### 1.2. Atributos Pré-Atentivos (*Preattentive Processing* - Treisman, 1985; Ware, 2012)
O cérebro humano possui mecanismos de processamento visual inconsciente que ocorrem no córtex visual primário em menos de **200 milissegundos** (antes mesmo da atenção consciente ser acionada).

* **Atributos Principais:** Cor (matiz/intensidade), Tamanho, Orientação, Posição e Espaçamento.
* **Uso em Dashboards:** Utilizar cores vibrantes ou tamanho ampliado exclusivamente para os dados que exigem **ação imediata** (ex.: um KPI fora da meta ou um alerta de erro). Se múltiplos elementos aleatórios usarem cores chamativas, o efeito pré-atentivo é destruído pelo ruído gráfico.

---

## 2. Arquitetura de Tabelas em Dashboards Executivos e Operacionais

Tabelas em dashboards não são meros recursos secundários; são a ferramenta primária quando a precisão e a busca pontual de dados são o objetivo do usuário.

### 2.1. Quando Usar Tabelas vs. Gráficos (Stephen Few, 2006)

| Use Tabelas Quando: | Use Gráficos Quando: |
| :--- | :--- |
| O usuário precisa consultar **valores individuais exatos**. | O objetivo é identificar **tendências, padrões ou anomalias**. |
| Os dados envolvem **múltiplas unidades de medida** simultâneas (ex.: R$, %, quantidade). | O objetivo é comparar a **forma ou inclinação** das variações ao longo do tempo. |
| É necessário cruzar categorias com **rótulos descritivos longos**. | O usuário precisa comparar rapidamente o **tamanho relativo** entre poucas categorias. |

### 2.2. Micro-Gráficos em Células (*Sparklines* e *Bullet Graphs*)
Em dashboards modernos, tabelas de alta densidade se beneficiam da inclusão de micro-gráficos vetoriais incorporados diretamente nas células:

* **Sparklines (Edward Tufte):** Gráficos de linha em miniatura (sem eixos ou rótulos pesados) inseridos em células para mostrar a tendência dos últimos 12 meses ao lado do valor numérico exato.
* **Bullet Graphs (Stephen Few):** Substituem medidores (*gauges*) complexos por uma barra horizontal compacta em célula, mostrando o valor atual, a meta e as faixas de desempenho (ruim, satisfatório, excelente).

---

## 3. Ergonomia e Leitura em Gráficos de Barras (*Bar Charts*)

O gráfico de barras é o recurso mais eficiente para comparação visual de categorias quantitativas. No entanto, sua eficácia depende do cumprimento de regras ergonômicas estritas.

### 3.1. Barras Horizontais vs. Barras Verticais (Colunas)

```
BARRAS VERTICAIS (Categorias Curtas)        BARRAS HORIZONTAIS (Rótulos Longos)
------------------------------------        -----------------------------------
R$ 100 |  [X]                               Categoria Longa A  | [X]============>
R$  50 |  [X]   [X]                         Categoria Longa B  | [X]=======>
R$   0 +-------------------                 Categoria Longa C  | [X]=============>
         Jan    Fev                                            +-----------------
                                                               R$ 0     R$ 50   R$ 100
```

1. **Barras Verticais (Gráficos de Coluna):**
   * **Caso de Uso:** Dados temporais discretos (meses, trimestres, anos) ou poucas categorias (3 a 7) com nomes curtíssimos.
2. **Barras Horizontais:**
   * **Caso de Uso:** O padrão-ouro quando os rótulos das categorias possuem mais de 8–10 caracteres (ex.: nomes de produtos, departamentos, regiões).
   * **Vantagem Ergonomica:** Permite a leitura do rótulo da esquerda para a direita na posição horizontal natural, sem rotação visual.

### 3.2. Orientação do Texto e Rótulos (Widdoks & Brath, 2014)

> [!WARNING]
> **Jamais Incline Rótulos de Texto (45° ou 90°):**
> Estudos empíricos de leitura (Widdoks & Brath, 2014) comprovaram que texto rotacionado a 45° ou 90° reduz a velocidade de escaneamento ocular em até **205%** e aumenta a taxa de erro de associação em 32%.
> **Solução:** Se os rótulos do eixo X não couberem na horizontal, altere o gráfico imediatamente para **Barras Horizontais**.

### 3.3. Ordenação Intencional das Barras
* **Ordenação por Valor (*Order by Magnitude*):** Em dados categóricos sem ordem cronológica intrínseca, ordene as barras sempre do maior para o menor valor (ou vice-versa).
* **Benefício:** Reduz o movimento sacádico ocular de busca aleatória, permitindo que o usuário identifique o TOP 3 instantaneamente.
* **Exceção:** Manter a ordem lógica quando existir sequência natural (ex.: faixas etárias, etapas de funil, dias da semana).

### 3.4. Espaçamento, Proporções e a Regra do Eixo Zero (*Zero Baseline*)

#### A. Proporção da Largura (*Bar-to-Gap Ratio*)
* O espaço em branco (*gap*) entre duas barras adjacentes deve ter entre **50% e 70% da largura da barra**.
* *Se o gap for muito grande (> 100%):* As barras parecem elementos isolados e a comparação visual falha.
* *Se o gap for muito pequeno (< 20%):* As barras se fundem em um bloco denso, parecendo um histograma.

#### B. A Regra Inviolável do Eixo Zero (*Zero Baseline Constraint*)
Como os gráficos de barras codificam quantidades pela **área visual e comprimento** do retângulo a partir da linha de base:
* O eixo quantitativo **deve obrigatoriamente iniciar em ZERO**.
* Truncar o eixo (iniciar em 90 para destacar uma variação entre 92 e 95) distorce a proporção visual e induz o usuário a interpretar uma variação de 3% como se fosse de 300% (violação da integridade de dados de Tufte).

---

## 4. Colorações e Semântica de Cores em DataVis

A cor em dashboards deve ser tratada como **informação quantitativa e semântica**, e jamais como decoração estética aleatória.

### 4.1. Tipos de Paletas e Aplicação Ergonômica

1. **Paleta Sequencial (Monocromática / Gradiente):**
   * **Uso:** Dados quantitativos contínuos de menor para maior valor.
   * **Regra:** Usar variações de luminosidade/saturação do mesmo matiz (ex.: azul claro a azul marinho escuro).
2. **Paleta Divergente:**
   * **Uso:** Dados que possuem um ponto neutro ou meta central (ex.: variação percentual com valores positivos e negativos).
   * **Regra:** Duas cores de matizes opostos divergindo a partir de um tom neutro intermediário (cinza/branco).
3. **Paleta Qualitativa / Categorizada:**
   * **Uso:** Diferenciar categorias sem ordenação numérica (ex.: departamentos da empresa).
   * **A Regra dos 5-7 (Sweller / Miller):** **Não utilize mais de 5 a 7 cores distintas em um mesmo dashboard.** Mais de 7 cores saturadas excedem a capacidade de retenção da memória de trabalho visual.

```
SEMÂNTICA RECOMENDADA DE CORES EM DASHBOARDS
===================================================================
Status / Métrica        Matiz Sugerido        Contraste (WCAG 2.1)
----------------        --------------        --------------------
Positivo / No Prazo     Verde-Esmeralda/Teal  Cumpri min. 3:1 (Gráfico)
Alerta / Atenção        Laranja / Âmbar       Cumpri min. 4.5:1 (Texto)
Crítico / Erro          Vermelho-Carmesim     Evitar vermelho puro (#FF0000)
Neutro / Comparativo    Cinza-Chumbo / Azul   Usado para linhas de base
```

### 4.2. Acessibilidade de Cores (Daltonismo & WCAG 1.4.1 / 1.4.3)

> [!IMPORTANT]
> **Critério de Sucesso WCAG 1.4.1 (Uso de Cor - Nível A):**
> A cor não deve ser o único meio visual para transmitir informação, indicar uma ação ou distinguir um elemento visual.

* **O Problema do Vermelho/Verde Solitário:** A deuteranopia e a protanopia afetam cerca de 8% da população masculina. Para estes leitores, vermelho e verde são percebidos como tons idênticos de marrom/amarelo.
* **Soluções Obrigatórias:**
  1. **Redundância de Forma/Símbolo:** Acompanhar valores coloridos com ícones diretos ($\uparrow$ Verde, $\downarrow$ Vermelho, $\Delta$ Laranja).
  2. **Substituição de Par de Cores:** Utilizar pares acessíveis como **Azul vs. Laranja** ou **Verde-Teal vs. Vermelho-Bordô**.
  3. **Contraste Mínimo (WCAG 1.4.3):** Taxa de contraste de no mínimo 4.5:1 para rótulos de texto e 3:1 para barras/elementos gráficos atrativos.

---

## 5. Posicionamento de Textos, Rótulos e Legendas

### 5.1. Legendas Diretas (*Direct Labeling*) vs. Legendas Distantes (Sweller, 1990)

#### O Efeito de Divisão de Atenção (*Split-Attention Effect*)
Quando um gráfico utiliza uma caixa de legenda separada no topo ou no rodape, a mente do usuário é forçada a realizar **buscas cruzadas constantes** (olhar a cor da barra $\rightarrow$ olhar a legenda no topo $\rightarrow$ voltar para a barra). Isso consome carga cognitiva extrínseca desnecessária.

```
INCORRETO (Split-Attention / Legenda Distante)     CORRETO (Direct Labeling)
-----------------------------------------------     ------------------------
[ ] Produto A  [ ] Produto B                        Produto A: R$ 1.500 [X]===========>
                                                    Produto B: R$   800 [X]=====>
[X]===========> (O que é esta barra?)
[X]=====>       (O que é esta barra?)
```

* **Diretriz de Design:** Sempre que possível, utilize **Legendas Diretas (*Direct Labeling*)**, posicionando o nome da série e o valor exato no final ou ao lado da própria barra/linha.

### 5.2. Posicionamento de Rótulos de Dados (*Data Labels*)

| Tipo de Gráfico | Posicionamento do Rótulo de Valor | Regra de Estilo |
| :--- | :--- | :--- |
| **Barras Verticais** | **Topo Externo (*Outside End*)** imediatamente acima da barra. | Texto na cor neutra escura do sistema. |
| **Barras Horizontais** | **Direita Externa (*Outside End*)** ao final da barra. | Mantém o texto alinhado com a margem do gráfico. |
| **Barras Empilhadas** | **Centro Interno (*Inside Center*)** de cada segmento. | **Cálculo de Luminância:** Alternar texto para branco em segmentos escuros e escuro em segmentos claros. |

---

## 6. Matriz Recomendada de Decisão em DataVis

| Tipo de Tarefa Analítica | Visualização Indicada | Orientação de Texto | Lógica de Cores | Alinhamento Primário |
| :--- | :--- | :--- | :--- | :--- |
| **Consulta de Valor Exato / Multivariado** | **Tabela de Dados** | Horizontal padrão | Cores neutras / Badges de status | Texto à Esquerda, Números à Direita |
| **Comparar Categorias (Rótulos Longos)** | **Gráfico de Barras Horizontais** | Horizontal padrão | Cor única neutra (Destaque para TOP 1) | Rótulos à Esquerda (`text-align: right`) |
| **Série Temporal Curta (Ex.: 12 Meses)** | **Gráfico de Colunas Verticais** | Horizontal (Meses abreviados) | Sequencial ou Neutra | Eixo Y à Esquerda, Eixo X no Rodapé |
| **Comparação de Meta / Desempenho** | **Bullet Graph / Sparkline** | Horizontal inline | Divergente (Verde/Cinza/Vermelho) | Alinhado no topo da célula |
| **Composição de Partes de um Todo** | **Gráfico de Barras Empilhadas 100%** | Legenda direta | Qualitativa (máx 4 cores) | Rotulado internamente com luminância |

---

## 7. Referências e Leituras Essenciais

1. **Cleveland, W. S., & McGill, R. (1984).** *"Graphical Perception: Theory, Tasks, and Display Tests in the Analysis of Real Data."* Journal of the American Statistical Association, 79(387), 531-554.
2. **Cleveland, W. S., & McGill, R. (1985).** *"Graphical perception: The visual decoding of quantitative information on graphical displays of data."* Journal of the Royal Statistical Society: Series A, 148(3), 193-210.
3. **Ware, C. (2012).** *"Information Visualization: Perception for Design."* (3rd ed.). Morgan Kaufmann.
4. **Few, S. (2006).** *"Information Dashboard Design: The Effective Visual Communication of Data."* O'Reilly Media / Analytics Press.
5. **Few, S. (2012).** *"Show Me the Numbers: Designing Tables and Graphs for Enlightenment."* Analytics Press.
6. **Tufte, E. R. (1983).** *"The Visual Display of Quantitative Information."* Graphics Press.
7. **Sweller, J. (1990).** *"Cognitive load theory, learning difficulty, and instructional design."* Learning and Instruction, 4(4), 295-312.
8. **Treisman, A. (1985).** *"Preattentive processing in vision."* Computer Vision, Graphics, and Image Processing, 31(2), 156-177.
9. **Munzner, T. (2014).** *"Visualization Analysis and Design."* CRC Press.
10. **Widdoks, M., & Brath, R. (2014).** *"Rotated Text Legibility in Data Visualizations."* Proceedings of IEEE Information Visualization.
11. **W3C / Web Accessibility Initiative (WAI).** *"Web Content Accessibility Guidelines (WCAG) 2.1 / 2.2 - SC 1.4.1 Use of Color & SC 1.4.3 Contrast (Minimum)."*
