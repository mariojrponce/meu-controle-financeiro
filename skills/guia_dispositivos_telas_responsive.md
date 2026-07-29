# Guia de Design Responsivo e Multi-Dispositivos: Smartwatches, Celulares, Foldables, Tablets, Desktops e Smart TVs

Este documento é uma **base de conhecimento técnica e científica** fundamentada em pesquisas de Interação Humano-Computador (HCI), diretrizes oficiais das fabricantes (Apple HIG, Google Material Design, Android TV, watchOS), normas internacionais de acessibilidade (WCAG 2.2, ISO 9241-307) e boas práticas de engenharia de software para a criação de sites e web apps perfeitamente adaptáveis a qualquer tela e dispositivo.

Ele complementa o [guia_leitura_telas.md](file:///home/note/Documentos/guia_leitura_telas.md) e o [alinhamento_paginas_ux_ui.md](file:///home/note/Documentos/alinhamento_paginas_ux_ui.md).

---

## 1. Conceitos Fundamentais de Displays e Ergonomia Visual

Para que uma interface funcione em qualquer tela, é necessário compreender três variáveis fisiológicas e técnicas: **Densidade de Pixels**, **Distância de Visão** e **Ângulo Subtendido**.

### 1.1. Pixels Físicos vs. Pixels Lógicos (CSS Pixels & DPR)
* **Pixel Físico:** O ponto de iluminação real de hardware na matriz da tela (ex.: 3840x2160 numa TV 4K ou 1170x2532 num iPhone).
* **Device Pixel Ratio (DPR):** A proporção entre pixels físicos e pixels lógicos do CSS ($DPR = \frac{\text{Pixels Físicos}}{\text{Pixels CSS}}$).
* **CSS Pixels / Pixels Lógicos:** A unidade abstrata usada no código CSS. Garantem que um botão de `44px` tenha tamanho físico legível em telas com densidades extremamente diferentes (Retina Displays, AMOLED 450+ PPI).

### 1.2. Distância de Visão (*Viewing Distance*) e Tamanho Angular
O tamanho de um elemento na tela deve escalar conforme a distância de onde o usuário o observa:

| Categoria | Distância Média de Uso | Tamanho de Botão Recomendado | Altura Mínima de Texto (Corpo) | Método de Entrada Principal |
| :--- | :--- | :--- | :--- | :--- |
| **Smartwatch (Wearable)** | 25 cm - 35 cm | 38px - 44px (ou 100% da largura) | 14px - 16px | Toque + Corona Física / Voz |
| **Smartphone** | 30 cm - 45 cm | 44px (iOS) / 48px (Android) | 16px | Toque (Polegar / Indicador) |
| **Tablet** | 40 cm - 55 cm | 44px - 48px | 16px - 18px | Toque + Stylus + Teclado |
| **Laptop / Desktop** | 50 cm - 70 cm | 32px - 40px (Ponteiro fino) | 16px - 18px | Mouse + Teclado + Trackpad |
| **Smart TV (10-Foot UI)** | 2,5 m - 4,0 m | 60px - 80px+ (com estado de foco) | 20px - 24px+ | Controle Remoto (D-Pad) |

---

## 2. Diretrizes Específicas por Categoria de Dispositivo

---

### 2.1. Smartwatches e Wearables (watchOS, Wear OS)
Dispositivos vestíveis exigem o paradigma de **Glanceability** (informação absorvível em 2 a 5 segundos).

* **Formatos de Tela:** Circulares (ex.: Galaxy Watch, Pixel Watch) e Retangulares (Apple Watch).
* **Diretrizes de Layout:**
  * **Design Escuro Padrão:** Fundo preto absoluto (`#000000`) aproveita telas OLED/AMOLED, economizando bateria e ocultando as bordas físicas do relógio.
  * **Tipografia de Alto Contraste:** Fontes sem serifa, peso *Medium* ou *Bold*, e tamanhos não inferiores a `14px`.
  * **Toque em Tela Cheia:** Evitar múltiplos botões pequenos lado a lado. Usar listas verticais e botões que ocupam toda a largura útil (*full-width buttons*).
  * **Rolagem:** Suportar rolagem pela coroa física (Digital Crown / Rotary Input).

---

### 2.2. Smartphones e a Ergonomia da "Thumb Zone"
Pesquisas conduzidas por Steven Hoober (*Designing for Touch*, 2013-2020) demonstraram que **49% dos usuários seguram o celular com apenas uma mão e operam a tela exclusivamente com o polegar**.

```
    ERGONOMIA DA TELA DO CELULAR (THUMB ZONE)
    +---------------------------------------+
    |           ZONA DE ESFORÇO             | <- Reduzir botões críticos aqui
    |         (Difícil alcance)             |    (ex: ações secundárias, busca)
    +---------------------------------------+
    |            ZONA NATURAL               | <- Área ideal para conteúdo
    |          (Alcance Médio)              |    e navegação principal
    +---------------------------------------+
    |            ZONA FÁCIL                 | <- Barra de Navegação Inferior
    |          (Alcance Confortável)        |    (Bottom Navigation Bar)
    +---------------------------------------+
```

* **Áreas de Toque Mínimas (Target Size):**
  * **Apple HIG:** Mínimo de `44 x 44 pt`.
  * **Google Material Design:** Mínimo de `48 x 48 dp`.
  * **WCAG 2.2 (Critério 2.5.8):** Mínimo de `24 x 24 css pixels` com margem de segurança.
* **Safe Areas e Notches:**
  * Sempre declarar meta viewport: `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`.
  * Utilizar variáveis CSS para áreas seguras:
    ```css
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    ```

---

### 2.3. Dobráveis e Dual-Screen (Galaxy Z Fold, Pixel Fold, Surface Duo)
Dispositivos dobráveis introduzem a transição dinâmica de viewport entre o estado fechado (smartphone estreito) e o estado desdobrado (mini-tablet).

* **Continuidade de Tela (*State Continuity*):** Ao desdobrar o aparelho, a interface deve adaptar a estrutura sem perder a posição de rolagem ou dados do formulário.
* **Viewport Segments API / Hinge Handling:**
  * O vinco (*hinge/seam*) não deve cortar textos nem botões.
  * Usar Media Queries de Tela Dobrável:
    ```css
    @media (horizontal-viewport-segments: 2) {
      /* Divide o layout em 2 painéis (Sidebar + Conteúdo) */
      .layout-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: env(viewport-segment-width 0 1);
      }
    }
    ```

---

### 2.4. Tablets e Dispositivos Híbridos (iPad, Surface)
Tablets são dispositivos versáteis que transitam entre retrato/paisagem e entre toque na tela, uso de caneta (stylus) e acoplamento de teclado/mouse.

* **Layout Flexível de 2 a 3 Colunas:**
  * Em **Retrato**: Exibir 1 a 2 colunas com navegação por gaveta (*Drawer*) ou barra inferior.
  * Em **Paisagem**: Exibir 2 a 3 colunas (Lista à esquerda + Detalhes à direita), semelhante a clientes de e-mail e dashboards.
* **Modo Multitarefa (Split View / Stage Manager):**
  * O site não deve presumir a largura total do tablet (`1024px`), pois o usuário pode executá-lo em uma janela dividida de `320px` ou `500px`. O layout deve responder às `@media (max-width: ...)` do *container*, não da tela física.

---

### 2.5. Laptops, Desktops e Ultrawides
Telas grandes oferecem vasta área de trabalho, mas exigem rigoroso controle do comprimento de linha e hierarquia de navegação por mouse e teclado.

* **Comprimento de Linha Tipográfico (*The Measure*):**
  * Segundo Robert Bringhurst (*The Elements of Typographic Style*), a largura ideal de um parágrafo para leitura contínua é de **45 a 75 caracteres por linha** (ideal de 66 caracteres).
  * Linhas excessivamente longas em telas ultrawide causam perda da linha ao retornar o olhar para a margem esquerda.
  * **Solução:** Limitar a largura do contêiner de texto:
    ```css
    .content-article {
      max-width: 68ch; /* 68 caracteres de largura */
      margin-left: auto;
      margin-right: auto;
    }
    ```
* **Contêineres Máximos de Tela:**
  * Manter a área de conteúdo principal com `max-width: 1200px` ou `1440px`, deixando margens fluidas nas laterais.
* **Navegação por Teclado e Estados de Hover:**
  * O cursor do mouse permite ponteiro fino. Todos os botões devem ter feedback de `:hover`.
  * Obrigatoriedade do `:focus-visible` destacado para navegação por `Tab`.

---

### 2.6. Smart TVs e Interfaces de 3 Metros (10-Foot UI)
Smart TVs (Android TV, Apple TV, LG webOS, Samsung Tizen) são consumidas a uma distância média de 3 metros, em posição relaxada (*lean-back*), sem toque e sem mouse.

```
       D-PAD (CONTROLE REMOTO) & FOCO VISUAL OBRIGATÓRIO
       +-----------------------------------------------+
       |                                               |
       |    [ Card 1 ]   [[ CARD 2 ]]   [ Card 3 ]     |
       |                   ^^ (Foco Ativo)             |
       |                   Escala + Bordas / Glow      |
       +-----------------------------------------------+
```

* **Princípio da Navegação por D-Pad (4 Direções):**
  * A navegação é estritamente via setas (Cima, Baixo, Esquerda, Direita) e botão "OK/Select".
  * Não existe evento de `mouseover` ou `click` sem foco prévio.
* **Estado de Foco Exagerado e Inconfundível:**
  * O elemento focado DEVE se destacar visualmente de forma imediata (ex.: aumentar 5% a 10% de tamanho, aplicar borda brilhante e sombra):
    ```css
    .tv-card:focus-visible, .tv-card.focused {
      transform: scale(1.08);
      outline: 4px solid #6366F1;
      box-shadow: 0 12px 30px rgba(99, 102, 241, 0.5);
      z-index: 10;
    }
    ```
* **Safe Area de Overscan:**
  * Muitas TVs cortam até 5% das bordas físicas da imagem (*overscan*).
  * Manter todo o conteúdo interativo dentro de uma margem interna de segurança de **5% a 10%** nas 4 extremidades da viewport.
* **Sem Rolagem Infinita Vertical Complexa:**
  * Utilizar carrosséis horizontais (*rows of cards*) com rolagem clara por categorias.

---

## 3. Tipografia Fluida com CSS `clamp()`

Para evitar a necessidade de dezenas de `@media queries` apenas para ajustar tamanhos de fonte, a técnica moderna recomendada é a **Tipografia Fluida** baseada em `clamp(MIN, VALOR_FLUIDO, MAX)`.

### 3.1. Sintaxe e Aplicação
```css
:root {
  /* H1 escala suavemente de 28px (1.75rem) em mobile até 48px (3rem) em desktop */
  --font-h1: clamp(1.75rem, 1rem + 2.5vw, 3rem);
  
  /* Corpo de texto escala de 16px (1rem) até 18px (1.125rem) */
  --font-body: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  
  /* Título gigante para Smart TVs ou Banners */
  --font-hero: clamp(2.5rem, 1.5rem + 5vw, 5rem);
}

h1 {
  font-size: var(--font-h1);
  line-height: 1.2;
}

p {
  font-size: var(--font-body);
  line-height: 1.6;
}
```

> [!NOTE]
> Usar sempre unidades `rem` nos limites mínimo e máximo do `clamp()` garante que o site respeite o zoom padrão configurado no navegador ou sistema operacional pelo usuário (essencial para acessibilidade).

---

## 4. Breakpoints Recomendados Baseados em Conteúdo

Evite definir breakpoints engessados a modelos de celulares específicos. A prática recomendada por W3C e Google é definir breakpoints baseados em **quando o layout do conteúdo perde a harmonia ou funcionalidade**.

No entanto, para estruturar um sistema de design consistente, utilize a seguinte escala lógica:

```css
/* 1. Smartwatches e Celulares Muito Pequenos (< 480px) */
@media (max-width: 479px) {
  /* Layout de 1 coluna, botões de largura total, padding lateral de 12px */
}

/* 2. Smartphones Padrão (480px a 767px) */
@media (min-width: 480px) and (max-width: 767px) {
  /* Layout de 1 coluna com espaçamentos ampliados */
}

/* 3. Tablets em Retrato & Foldables Aberto (768px a 1023px) */
@media (min-width: 768px) and (max-width: 1023px) {
  /* Entrada de layouts de 2 colunas, barras laterais colapsáveis */
}

/* 4. Laptops e Tablets em Paisagem (1024px a 1439px) */
@media (min-width: 1024px) and (max-width: 1439px) {
  /* Layout completo de 2 a 3 colunas, menu horizontal no topo */
}

/* 5. Desktop Widescreen (1440px a 1919px) */
@media (min-width: 1440px) and (max-width: 1919px) {
  /* Contêiner centralizado com max-width: 1320px */
}

/* 6. Ultrawides e Smart TVs (>= 1920px) */
@media (min-width: 1920px) {
  /* Aumento proporcional de tipografia e estados de foco para TV */
}
```

---

## 5. Checklist de Verificação Multi-Dispositivo

Ao testar a aplicação em diferentes telas, valide os seguintes pontos:

- [ ] **Viewport Meta Tag:** A tag `<meta name="viewport" content="width=device-width, initial-scale=1.0">` está presente no `<head>`.
- [ ] **Alvos de Toque:** Nenhum botão ou link interativo possui área clicável menor que `44x44px` em telas sensíveis ao toque.
- [ ] **Espaçamento entre Botões:** Há pelo menos `8px` a `12px` de distância entre botões adjacentes para evitar toques acidentais.
- [ ] **Comprimento de Linha:** O texto principal não excede ~75 caracteres por linha em telas grandes.
- [ ] **Sem Rolagem Horizontal Acidental:** Nenhuma imagem, tabela ou elemento excede a largura da tela (`overflow-x: hidden` no container raiz ou tratamento responsivo em tabelas).
- [ ] **Navegação por Teclado e D-Pad:** É possível navegar por toda a página usando apenas a tecla `Tab` (Desktop) ou setas direcionais (TV), com um indicador de foco claro e visível.
- [ ] **Suporte a Modos de Cor e OLED:** O site suporta tema escuro (`prefers-color-scheme: dark`) para economia de energia em telas OLED/AMOLED de celulares e relógios.
- [ ] **Imagens Responsivas:** Uso das tags `<picture>` ou atributo `srcset` para entregar imagens em resoluções adequadas a cada DPR e largura de tela.

---

## 6. Referências e Fontes Acadêmicas

1. **Hoober, S. (2013).** *"Designing for Touch."* UXmatters & O'Reilly Media.
2. **Bringhurst, R. (2004).** *"The Elements of Typographic Style."* Hartley & Marks Publishers.
3. **Apple Inc.** *"Human Interface Guidelines: Layout, watchOS & tvOS."* Apple Developer Documentation.
4. **Google LLC.** *"Material Design 3: Responsive Layout Grid & Layout Patterns."* Material.io.
5. **W3C / Web Accessibility Initiative (WAI).** *"Web Content Accessibility Guidelines (WCAG) 2.2 - Target Size (Minimum) 2.5.8."*
6. **Nielsen Norman Group (NN/g).** *"Touch Targets on Mobile Devices"* & *"Designing for Smart TVs and 10-Foot User Interfaces."*
