# FinKaif Design Stack & Creative Engineering Master Pipeline

This document is the **authoritative single point of entry** for all UI/UX design, art direction, creative frontend engineering, motion choreography, and automated visual quality audits in FinKaif OS.

---

## 1. Trigger Directives: Протокол «дизайн »

Главный триггер запуска всего стека — ключевое слово **`дизайн `** (например: *`дизайн главной страницы`*, *`дизайн модального окна`*, *`дизайн экрана ассистента`*, *`дизайн карточки цели`*, *`дизайн графиков`*), а также любые прямые задачи на редизайн, визуал, стилизацию или анимации (*"переделай дизайн"*, *"сделай красиво"*, *"сделай круче"*, *"сделай дорогой интерфейс"*).

При получении команды по протоколу **`дизайн `**:
1. **Категорический запрет на слепой код**: НИКОГДА не писать JSX/CSS/HTML сразу.
2. **Строгое следование 16-шаговому конвейеру**: задействовать соответствующие инструменты из 17 интегрированных систем.
3. **Фиксация артефактов**: перед сдачей обязательно прогнать автоматическую проверку через `impeccable detect` и визуальный снапшот через `playwright-cli`.

Следовать **16-шаговому мастер-пайплайну** ниже:

---

## 2. The 16-Step Master Execution Pipeline

```mermaid
flowchart TD
    subgraph Phase1["Phase 1: Direction & Research"]
        S1["1. Product Intent (PRODUCT.md)"] --> S2["2. Design Memory (DESIGN.md)"]
        S2 --> S3["3. Taste Configuration (Taste Skill Dials)"]
        S3 --> S4["4. Real-World Benchmarks (Awesome DESIGN.md & Mobbin)"]
        S4 --> S5["5. Intelligence & Options (UI UX Pro Max DB)"]
        S5 --> S6["6. Creative Art Direction (MengTo Skills)"]
        S6 --> S7["7. Anti-Slop Filter (Impeccable Audit + UI/UX Kit)"]
        S7 --> S8["8. Concrete Concept Selection"]
    end

    subgraph Phase2["Phase 2: Implementation & Motion"]
        S8 --> S9["9. Semantic & Responsive Markup (Static First Frame)"]
        S9 --> S10["10. Motion Choreography (Official GSAP Skills)"]
        S9 --> S11["11. Route & State Transitions (Vercel View Transitions)"]
        S9 --> S12["12. Procedural 3D & Shaders (Three.js & img2threejs)"]
        S9 --> S13["13. Micro-Interactions (React Bits Recipes)"]
    end

    subgraph Phase3["Phase 3: Automated Audit & Polish"]
        S10 & S11 & S12 & S13 --> S14["14. Browser Inspection (Playwright CLI & Chrome DevTools)"]
        S14 --> S15["15. Deterministic Anti-Slop Audit (impeccable detect & critique)"]
        S15 --> S16["16. Quality & Accessibility Gate (Vercel Guidelines)"]
    end
```

---

### Phase 1: Direction & Research (Before Writing Code)

1. **Product Intent & Architecture ([PRODUCT.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/PRODUCT.md))**
   - Read the core product purpose, target users, platform constraints, and value proposition.
   - Financial numbers are the hero, not secondary decorative items.
   - Reference: [PRODUCT.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/PRODUCT.md) · [AGENTS.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/AGENTS.md)

2. **Master Design System Compliance ([DESIGN.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/DESIGN.md))**
   - Check FinKaif's established color variables, deep dark surfaces (Velvet Slate & Cashmere Jade), typography scales, spacing tokens, and component definitions.
   - References: [DESIGN.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/DESIGN.md) · [DESIGN_SYSTEM.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/DESIGN_SYSTEM.md)

3. **Taste Configuration & Dial Calibration ([Taste Skill](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/taste-skill/SKILL.md))**
   - Calibrate the 3 core frontend taste dials:
     * `DESIGN_VARIANCE: 4` (Disciplined, asymmetric elegance; avoids identical monotonous cards)
     * `MOTION_INTENSITY: 5` (Fluid, physics-grounded micro-motion; zero tacky bounce)
     * `VISUAL_DENSITY: 6` (Modern financial terminal density; high information-to-pixel ratio)
   - Utilize sub-skills: `gpt-tasteskill`, `redesign-skill`, `image-to-code-skill`, `minimalist-skill`, `brandkit`.
   - Reference: [.agents/skills/taste-skill/](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/taste-skill/)

4. **Curated World-Class Benchmarks ([Awesome DESIGN.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.shared/awesome-design-md/README.md) & Mobbin)**
   - Query curated design specifications from 65+ top products:
     * Fintech: Revolut, Stripe, Wise, Coinbase, Binance
     * Modern SaaS: Linear, Apple, Figma, Framer, Cursor, Claude, ElevenLabs
   - Search real-world screens via Mobbin MCP (`mobbin_search_screens`, `mobbin_search_apps`).
   - Location: `.shared/awesome-design-md/upstream/voltagent-awesome-design-md/design-md/`
   - Skill: [.agents/skills/awesome-design-md/SKILL.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/awesome-design-md/SKILL.md)

5. **Design Intelligence & Options ([UI UX Pro Max](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/ui-ux-pro-max/SKILL.md))**
   - Query styles, color contrast pairings, typography pairings, and chart types.
   - Run: `node .shared/ui-ux-pro-max/scripts/search.cjs "<keyword>" --domain <product|style|typography|color|chart|ux>`
   - Rule: Do NOT default to the first output. Use as a multi-dimensional matrix of options.
   - Reference: [UI UX Pro Max Skill](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/ui-ux-pro-max/SKILL.md)

6. **Creative Direction & Awwwards Patterns ([MengTo Creative](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/mengto-creative/SKILL.md))**
   - Elevate the screen above standard SaaS patterns with distinctive visual art direction.
   - Selected Skills:
     * [Build Awwwards-Quality Sites](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/mengto-creative/build-awwwards-quality-sites/SKILL.md)
     * [Cinematic Scroll Storytelling](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/mengto-creative/cinematic-scroll-storytelling/SKILL.md)
     * [Cinematic GSAP + Lenis Motion](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/mengto-creative/cinematic-gsap-lenis-motion-system/SKILL.md)
     * [Masked Reveal](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/mengto-creative/masked-reveal/SKILL.md)
     * [Progressive Blur](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/mengto-creative/progressive-blur/SKILL.md)
     * [Liquid Metal Border](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/mengto-creative/liquid-metal-border/SKILL.md)

7. **Anti-Slop Filter & Pre-Flight Review ([Impeccable](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/impeccable/SKILL.md) + [UI/UX Kit](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/ui-ux-kit/SKILL.md))**
   - Strict sanity check to eliminate cliché AI tropes.
   - Run: `impeccable audit` or review against 61 deterministic rules.
   - Anti-Pattern Checklist:
     - ❌ No generic "sidebar + topbar + 4 KPI cards" layout.
     - ❌ No repetitive Bento Grid for everything.
     - ❌ No purple/blue AI gradient blobs.
     - ❌ No ungrounded glassmorphism everywhere.
     - ❌ No side-tab colored card stripes (`.card::before` border trick).
     - ❌ No generic icon + heading + paragraph 3-column rows.
     - ❌ No decorative 3D spheres without financial purpose.
   - References:
     * [Impeccable Skill](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/impeccable/SKILL.md)
     * [UI/UX Kit Quality Floor](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/ui-ux-kit/SKILL.md)
     * [Anthropic Frontend Design](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/frontend-design/SKILL.md)

8. **Concrete Concept & Signature Selection**
   - Formulate a clear, intentional thesis: 1 strong focal asset, 1-2 distinct interaction techniques, and disciplined typography.

---

### Phase 2: Implementation & Motion (Engineering Phase)

9. **Semantic & Responsive Markup (Static First Frame)**
   - Static first frame: page must look complete, polished, and readable before JavaScript, WebGL, or animations load.
   - Strict touch and responsive mobile adaptations.

10. **Motion Choreography ([Official GSAP Skills](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/gsap-skills/SKILL.md))**
    - **Precedence Rule**: Official GSAP guidelines strictly override any conflicting third-party recommendations.
    - Rules:
      * Wrap in `gsap.context()` or `useGSAP()` with automatic cleanup.
      * Animate only composite properties (`xPercent`, `yPercent`, `x`, `y`, `scale`, `opacity`, `rotation`). NEVER animate `width`, `height`, `top`, `left`, `margin`, `padding`.
      * Refresh `ScrollTrigger` when fonts, images, or DOM measurements change.
    - References:
      * [Official GSAP Master](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/gsap-skills/SKILL.md)
      * [GSAP Core](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/gsap-skills/skills/gsap-core/SKILL.md)
      * [GSAP ScrollTrigger](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/gsap-skills/skills/gsap-scrolltrigger/SKILL.md)
      * [GSAP Performance](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/gsap-skills/skills/gsap-performance/SKILL.md)

11. **Page & Route Transitions ([Vercel View Transitions](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/vercel-agent-skills/SKILL.md))**
    - Separate concerns:
      * **View Transitions** handle route/page changes and card-to-detail expansion (`document.startViewTransition`).
      * **GSAP** handles internal choreography and scrubbed timelines.
      * NEVER animate the same element simultaneously with both systems.
    - References: [Vercel View Transitions Guide](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/vercel-agent-skills/skills/react-view-transitions/SKILL.md)

12. **Procedural 3D Models & Shaders ([Three.js](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/mengto-creative/threejs/SKILL.md) & [img2threejs](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/img2threejs/SKILL.md))**
    - Use procedural Three.js reconstruction from reference images (`img2threejs`) to build code-only models (`THREE.Group`) with custom shaders, physically-grounded materials, and zero heavy asset bloat.
    - Safeguards: cap DPR at 1.5, pause rendering when offscreen or blurred, dispose geometries, materials, and textures on unmount.
    - References:
      * [img2threejs Skill](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/img2threejs/SKILL.md)
      * [Three.js Guide](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/mengto-creative/threejs/SKILL.md)

13. **Micro-Interactions & Component Recipes ([React Bits](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/react-bits/SKILL.md))**
    - Pick individual recipes from the local catalog without bloating the bundle.
    - Adapt all colors, typography, borders, and radiuses to FinKaif's Velvet Slate & Cashmere Jade palette.
    - Component Library: Text animations, Background shaders (Aurora, Beams), Spotlight cards, and interactive docks.
    - Reference: [React Bits Master Skill](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/react-bits/SKILL.md)

---

### Phase 3: Automated Audit & Polish (Before Handoff)

14. **Token-Efficient Browser Automation ([Playwright CLI](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/playwright-cli/SKILL.md) & [Chrome DevTools MCP](file:///C:/Users/DNS/.gemini/antigravity/mcp/chrome-devtools/instructions.md))**
    - Run headless visual inspections via Playwright CLI:
      * `playwright-cli open <url>`
      * `playwright-cli snapshot` (compact element tree with refs)
      * `playwright-cli screenshot [target]`
      * `playwright-cli resize <w> <h>` (test mobile 390x844 and desktop 1440x900)
    - Check console messages, performance traces, and network requests via Chrome DevTools MCP.
    - Reference: [.agents/skills/playwright-cli/](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/playwright-cli/)

15. **Deterministic Anti-Slop & Polish Commands ([Impeccable](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/impeccable/SKILL.md))**
    - Run deterministic code detection:
      ```bash
      impeccable detect public/style.css
      ```
    - Apply specialized Impeccable review and polish commands:
      * `impeccable audit` — Comprehensive design health and token audit against PRODUCT.md and DESIGN.md
      * `impeccable critique` — Adversarial design critique identifying generic AI tropes
      * `impeccable polish` — Surgical typographic, spacing, and micro-contrast polish
      * `impeccable animate` — Physics-grounded easing and motion refinement
      * `impeccable bolder` / `impeccable quieter` — Hierarchy and contrast calibration
      * `impeccable distill` — Remove redundant decoration and clarify cognitive focus
    - Reference: [.agents/skills/impeccable/SKILL.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/impeccable/SKILL.md)

16. **Final Quality & Accessibility Gate ([Vercel Web Interface Guidelines](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/web-interface-guidelines/SKILL.md))**
    - Rigorous checklist for production quality:
      * Keyboard navigation and visible focus rings.
      * Contrast ratios (minimum 4.5:1 for body copy).
      * Touch targets (minimum 44x44px on mobile).
      * Form inputs with proper autocomplete, inputmode, and error states.
      * Respect `prefers-reduced-motion: reduce`.
    - Reference: [Web Interface Guidelines](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/web-interface-guidelines/SKILL.md)

---

## 3. Complete Design Stack Tool Registry

| # | Tool / Resource | Category | Location / Command | Primary Purpose |
|---|---|---|---|---|
| 1 | **Taste Skill** | Workspace Skill | `.agents/skills/taste-skill/` (alias `design-taste-frontend`) | Anti-slop frontend taste layer, dials: VARIANCE, MOTION, DENSITY |
| 2 | **Impeccable** | CLI & Skill Engine | `.agents/skills/impeccable/` (`impeccable`) | 23 review/polish commands, 61 anti-slop rules, PRODUCT/DESIGN.md integration |
| 3 | **Playwright CLI** | CLI & Skill Suite | `.agents/skills/playwright-cli/` (`playwright-cli`) | Token-efficient browser automation, snapshots, screenshots, testing |
| 4 | **Awesome DESIGN.md** | Reference Library | `.shared/awesome-design-md/` + `.agents/skills/awesome-design-md/` | 65+ real-world design systems (Revolut, Stripe, Linear, Wise, Apple) |
| 5 | **img2threejs** | Workspace Skill & Forge | `.agents/skills/img2threejs/` | Image-to-procedural Three.js code reconstruction, materials, shaders |
| 6 | **MengTo Creative Web** | Workspace Skill | `.agents/skills/mengto-creative/` | Awwwards art direction, cinematic motion, Lenis, WebGL |
| 7 | **Official GSAP Skills** | Workspace Skill | `.agents/skills/gsap-skills/` | Authoritative animation rules, timeline choreography, ScrollTrigger |
| 8 | **UI UX Pro Max** | Workspace Skill + DB | `.agents/skills/ui-ux-pro-max/` + `.shared/` | 79 styles, 21 palettes, 50 typography pairings, charts, CLI search |
| 9 | **UI/UX Kit** | Workspace Skill | `.agents/skills/ui-ux-kit/` | Anti-AI-slop rules, surface rules, quality floor |
| 10 | **Anthropic Frontend Design** | Workspace Skill | `.agents/skills/frontend-design/` | Quality verification, design heuristics, typography courage |
| 11 | **Vercel Agent Skills** | Workspace Skill | `.agents/skills/vercel-agent-skills/` | React View Transitions, state & route transitions, composition |
| 12 | **React Bits** | Workspace Skill + Recipes | `.agents/skills/react-bits/` | Curated micro-interactions, text effects, shaders, interactive cards |
| 13 | **Vercel Web Guidelines** | Workspace Skill | `.agents/skills/web-interface-guidelines/` | Accessibility, responsive behavior, interaction polish |
| 14 | **Mobbin MCP** | MCP Server | Configured (`https://api.mobbin.com/mcp`) | 600k+ real-world UI screens research |
| 15 | **Figma MCP** | MCP Server | Registered in Antigravity | Inspect design files, tokens, styles |
| 16 | **21st-dev MCP** | MCP Server | Registered in Antigravity | Inspiration, component catalog search |
| 17 | **Chrome DevTools MCP**| MCP Server | Registered in Antigravity | Visual screenshot inspection, console check, mobile emulation |
