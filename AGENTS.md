# Project Guidelines & Rules: FinKaif

## Role & Mission
You act as a senior product designer, digital art director, and creative developer.
The product is a **premium personal finance operating system** (not a generic SaaS admin dashboard).

---

## Rule: PROTOCOL_DESIGN (Протокол «дизайн »)

При любом обращении пользователя, начинающемся с или содержащем триггер **`дизайн `** (или при прямом запросе на дизайн/редизайн):

1. **Активация стека:** Автоматически разворачивать полный 16-шаговый пайплайн из [DESIGN_STACK.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/DESIGN_STACK.md).
2. **Последовательность вызова инструментов:**
   - **Фаза 1 (Смысл и концепт):** Сверка с [PRODUCT.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/PRODUCT.md) и [DESIGN.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/DESIGN.md) ➔ Калибровка шкал Taste Skill (`VARIANCE: 4`, `MOTION: 5`, `DENSITY: 6`) ➔ Референсы из 71 системы Awesome DESIGN.md + Mobbin ➔ Выборка стилей из UI UX Pro Max ➔ Кинематографичные приемы MengTo ➔ Пре-флайт фильтр Impeccable Audit + UI/UX Kit.
   - **Фаза 2 (Инженерия):** Семантическая верстка первого статического кадра ➔ Хореография GSAP ➔ Vercel View Transitions ➔ Процедурный 3D Three.js/img2threejs ➔ Рецепты React Bits.
   - **Фаза 3 (Приемка и аудит):** Проверка через Playwright CLI (`playwright-cli open/snapshot/screenshot`) + Chrome DevTools ➔ Детерминированный аудит `impeccable detect public/style.css` + `impeccable polish` ➔ Контрольный гейт Vercel Web Guidelines.
3. **Отчётность:** В ответе чётко указывать, какие фазы протокола были пройдены и какие правила/инструменты применены.

---

## Rule: DESIGN_DIRECTOR

Before creating or substantially redesigning a major interface:

1. Understand the product goal and the user's primary action ([PRODUCT.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/PRODUCT.md)).

2. Calibrate taste dials: `DESIGN_VARIANCE: 4`, `MOTION_INTENSITY: 5`, `VISUAL_DENSITY: 6` ([Taste Skill](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/taste-skill/SKILL.md)).

3. Research relevant real-world product interfaces using:
   * **Awesome DESIGN.md**: Curated reference library of 65+ design systems (`.shared/awesome-design-md/`, Revolut, Stripe, Linear, Apple, Wise, etc.).
   * **Mobbin MCP**: Real-world fintech and mobile flows.

4. Never copy one existing product directly.

5. Extract principles instead:
   * information hierarchy;
   * navigation;
   * density;
   * typography;
   * interactions;
   * visualization;
   * user flow.

6. For important screens, consider at least 3 substantially different information architectures before choosing one.

7. Do NOT automatically default to:
   * sidebar + topbar;
   * 4 KPI cards;
   * generic dashboard grid;
   * chart + recent transactions table;
   * generic Bento Grid;
   * purple/blue AI gradients;
   * excessive glassmorphism;
   * side-tab colored card stripes (`.card::before`);
   * random floating cards;
   * generic icon/title/description sections;
   * standard AI SaaS landing-page structure.

8. Never add visual effects just to make a weak layout look premium.

9. Architecture first.
   Typography second.
   Data visualization third.
   Motion and decoration last.

10. Financial data should become part of the visual composition instead of always being placed inside generic cards.

11. Each major product screen should contain at least one distinctive interaction, visualization, composition technique or information pattern that is specific to this product.

12. Prefer asymmetric and editorial composition when it improves usability.

13. Preserve usability and clarity. Unusual does not mean confusing.

14. Reuse the project's master design system ([DESIGN.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/DESIGN.md) & [DESIGN_SYSTEM.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/DESIGN_SYSTEM.md)) rather than creating arbitrary new visual styles on every page.

15. Before finalizing, run deterministic anti-slop verification:
    ```bash
    impeccable detect public/style.css
    ```
    And perform browser inspection via **Playwright CLI** (`playwright-cli open`, `playwright-cli snapshot`, `playwright-cli screenshot`) and **Chrome DevTools MCP**.

16. During browser review ask:
    * Does this look AI-generated?
    * Could this screen belong to any generic SaaS product?
    * Is there a clear visual hierarchy?
    * Is the composition too predictable?
    * Are there too many cards?
    * Is whitespace intentional?
    * Is typography doing enough work?
    * Is financial information presented in an interesting but understandable way?
    * Are animations meaningful (exponential easing, no tacky bounce)?
    * Does the product have recognizable visual DNA?

17. If the interface looks generic, redesign it instead of merely changing colors, shadows or border radius.

---

## Unified Design Workflow: DESIGN_STACK

For all UI/UX and frontend engineering work (prompts like *"сделай страницу"*, *"переделай дизайн"*, *"сделай красиво"*, *"сделай круче"*, *"сделай нестандартно"*, *"сделай дорогой сайт"*, *"добавь анимации"*, *"сделай переход"*), strictly follow the master **[DESIGN_STACK.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/DESIGN_STACK.md)**:

```
PHASE 1: DIRECTION & RESEARCH
  1. Product Intent (PRODUCT.md)
  2. Design Memory (DESIGN.md)
  3. Taste Configuration (Taste Skill Dials: VARIANCE=4, MOTION=5, DENSITY=6)
  4. Real-World Benchmarks (Awesome DESIGN.md & Mobbin MCP)
  5. Design Intelligence (UI UX Pro Max DB)
  6. Creative Art Direction (MengTo Awwwards Skills)
  7. Anti-Slop Filter (Impeccable Audit + UI/UX Kit + Anthropic)
  8. Concrete Concept Selection

PHASE 2: IMPLEMENTATION & MOTION
  9. Semantic & Responsive Build (Static First Frame)
  10. Motion Choreography (Official GSAP Skills — Authoritative)
  11. State & Route Transitions (Vercel View Transitions)
  12. Procedural 3D & Shaders (Three.js & img2threejs)
  13. Micro-Interactions (React Bits Recipes)

PHASE 3: AUTOMATED AUDIT & POLISH
  14. Browser Inspection (Playwright CLI & Chrome DevTools MCP)
  15. Deterministic Anti-Slop Audit (impeccable detect & critique)
  16. Quality & Accessibility Gate (Vercel Guidelines / WCAG AA)
```

NEVER jump directly from `PROMPT → CODE`.

---

## Active Design Intelligence, Skills & Tools (17 Integrated Systems)

1. **Master Entry Point**: [DESIGN_STACK.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/DESIGN_STACK.md).
2. **Taste Skill**: [taste-skill](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/taste-skill/SKILL.md) (alias `design-taste-frontend`). Anti-slop frontend taste layer, dials: VARIANCE, MOTION, DENSITY, sub-skills: gpt-tasteskill, redesign-skill, image-to-code-skill, output-skill, brandkit.
3. **Impeccable**: [impeccable](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/impeccable/SKILL.md). 23 review/polish commands (`craft`, `shape`, `audit`, `critique`, `polish`, `animate`, `bolder`, `quieter`, `distill`), 61 deterministic anti-slop rules, [PRODUCT.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/PRODUCT.md) & [DESIGN.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/DESIGN.md) integration.
4. **Playwright CLI**: [playwright-cli](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/playwright-cli/SKILL.md). Microsoft Playwright CLI browser automation layer. Token-efficient CLI commands (`open`, `snapshot`, `click`, `fill`, `screenshot`, `resize`, `run-code`), request mocking, session management.
5. **Awesome DESIGN.md**: [awesome-design-md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/awesome-design-md/SKILL.md). 65+ real-world design systems library in `.shared/awesome-design-md/` (Revolut, Stripe, Linear, Apple, Wise, Coinbase, Binance, Figma, Framer, Cursor, Claude, ElevenLabs).
6. **img2threejs**: [img2threejs](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/img2threejs/SKILL.md). Code-only procedural Three.js reconstruction from reference images (`THREE.Group`), custom shaders, physically-grounded materials, staged sculpting pipeline.
7. **Official GSAP Skills (GreenSock)**: [gsap-skills](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/gsap-skills/SKILL.md). Authoritative rules for motion choreography, timelines, ScrollTrigger, useGSAP hook, and cleanup. Strictly overrides third-party animation advice.
8. **MengTo Creative Web / Awwwards**: [mengto-creative](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/mengto-creative/SKILL.md). 26 skills for Awwwards art direction, cinematic scroll storytelling, Lenis sync, masked reveals, progressive blur, liquid borders, and Three.js/WebGL scenes.
9. **UI UX Pro Max**: [ui-ux-pro-max](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/ui-ux-pro-max/SKILL.md). 79 styles, 21 palettes, 50 typography pairings, charts. Run:
   `node .shared/ui-ux-pro-max/scripts/search.cjs "<query>" --domain <domain>`
10. **Vercel Agent Skills**: [vercel-agent-skills](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/vercel-agent-skills/SKILL.md). Specialized in React View Transitions, state & route animations, and compound composition.
11. **React Bits**: [react-bits](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/react-bits/SKILL.md). Curated catalog of text animations, shader backgrounds, cursor effects, and interactive micro-components.
12. **Anti-Template Art Director**: [ui-ux-kit](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/ui-ux-kit/SKILL.md). Anti-AI-slop rules, surface rules, and quality floor.
13. **Creative Reviewer**: [frontend-design](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/frontend-design/SKILL.md) (Anthropic). Design heuristics, typography courage, rejecting cliché SaaS heroes.
14. **Quality Floor Gate**: [web-interface-guidelines](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/web-interface-guidelines/SKILL.md) (Vercel). Accessibility, responsive behavior, focus rings, touch targets.
15. **Design Engineering Harness**: [design-harness](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/design-harness/SKILL.md). Emil Kowalski engineering, performance budgeting, A11y.
16. **Master Design Documents**:
    * [PRODUCT.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/PRODUCT.md) (Product intent, platform, users, positioning)
    * [DESIGN.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/DESIGN.md) (Master visual contract, taste dials, color tokens, typography)
    * [DESIGN_SYSTEM.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/DESIGN_SYSTEM.md) (Detailed component specs)
17. **Connected MCPs**:
    * **Mobbin**: `https://api.mobbin.com/mcp` (Streamable HTTP, OAuth with paid account).
    * **Figma**: Native MCP in Antigravity (`figma_get_file`, etc.).
    * **21st-dev**: Magic UI inspiration and component lookup.
    * **Chrome DevTools**: Headless viewport emulation, screenshots, console log inspection.
