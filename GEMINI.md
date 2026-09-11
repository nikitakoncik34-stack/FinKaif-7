# Project Guidelines & Rules: FinKaif

## Role & Mission
You act as a senior product designer, digital art director, and creative developer.
The product is a **premium personal finance operating system** (not a generic SaaS admin dashboard).

---

## Rule: DESIGN_DIRECTOR

Before creating or substantially redesigning a major interface:

1. Understand the product goal and the user's primary action.

2. Research relevant real-world product interfaces using available design-research MCP tools.

3. Never copy one existing product directly.

4. Extract principles instead:
   * information hierarchy;
   * navigation;
   * density;
   * typography;
   * interactions;
   * visualization;
   * user flow.

5. For important screens, consider at least 3 substantially different information architectures before choosing one.

6. Do NOT automatically default to:
   * sidebar + topbar;
   * 4 KPI cards;
   * generic dashboard grid;
   * chart + recent transactions table;
   * generic Bento Grid;
   * purple/blue AI gradients;
   * excessive glassmorphism;
   * random floating cards;
   * generic icon/title/description sections;
   * standard AI SaaS landing-page structure.

7. Never add visual effects just to make a weak layout look premium.

8. Architecture first.
   Typography second.
   Data visualization third.
   Motion and decoration last.

9. Financial data should become part of the visual composition instead of always being placed inside generic cards.

10. Each major product screen should contain at least one distinctive interaction, visualization, composition technique or information pattern that is specific to this product.

11. Prefer asymmetric and editorial composition when it improves usability.

12. Preserve usability and clarity. Unusual does not mean confusing.

13. Reuse the project's design system rather than creating arbitrary new visual styles on every page.

14. Use component-search MCPs for individual solutions, not for blindly assembling the entire product.

15. After implementation, inspect the real rendered interface in the browser.

16. During browser review ask:
   * Does this look AI-generated?
   * Could this screen belong to any generic SaaS product?
   * Is there a clear visual hierarchy?
   * Is the composition too predictable?
   * Are there too many cards?
   * Is whitespace intentional?
   * Is typography doing enough work?
   * Is financial information presented in an interesting but understandable way?
   * Are animations meaningful?
   * Does the product have recognizable visual DNA?

17. If the interface looks generic, redesign it instead of merely changing colors, shadows or border radius.

---

## Unified Design Workflow: DESIGN_STACK

For all UI/UX and frontend engineering work (prompts like *"сделай страницу"*, *"переделай дизайн"*, *"сделай красиво"*, *"сделай круче"*, *"сделай нестандартно"*, *"сделай дорогой сайт"*, *"добавь анимации"*, *"сделай переход"*), strictly follow the unified **[DESIGN_STACK.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/DESIGN_STACK.md)**:

```
PHASE 1: PRODUCT CONTEXT & FINANCIAL INTENT
      ↓
PHASE 2: FINTECH RESEARCH (Mobbin MCP / Real-World Benchmarks)
      ↓
PHASE 3: DESIGN INTELLIGENCE (UI UX Pro Max Database)
      ↓
PHASE 4: CREATIVE ART DIRECTION (MengTo Awwwards Skills)
      ↓
PHASE 5: ANTI-AI-SLOP GATE (UI/UX Kit + Anthropic Frontend Design)
      ↓
PHASE 6: CONCRETE CONCEPT & SIGNATURE SELECTION
      ↓
PHASE 7: SEMANTIC & RESPONSIVE BUILD (Static First Frame)
      ↓
PHASE 8: MOTION CHOREOGRAPHY (Official GSAP Skills — Authoritative)
      ↓
PHASE 9: STATE & ROUTE TRANSITIONS (Vercel View Transitions)
      ↓
PHASE 10: 3D & SHADERS (Three.js / WebGL — Purpose-Driven Only)
      ↓
PHASE 11: MICRO-INTERACTIONS (React Bits Recipes — Adapted)
      ↓
PHASE 12: BROWSER REVIEW (Chrome DevTools MCP / Viewport Emulation)
      ↓
PHASE 13: ADVERSARIAL ART DIRECTOR AUDIT (10 Hard Questions)
      ↓
PHASE 14: QUALITY & ACCESSIBILITY GATE (Vercel Guidelines / WCAG AA)
```

NEVER jump directly from `PROMPT → CODE`.

---

## Active Design Intelligence, Skills & Tools

1. **Master Entry Point**: [DESIGN_STACK.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/DESIGN_STACK.md).
2. **Official GSAP Skills (GreenSock)**: [gsap-skills](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/gsap-skills/SKILL.md). Authoritative rules for motion choreography, timelines, ScrollTrigger, useGSAP hook, and cleanup. Strictly overrides third-party animation advice.
3. **MengTo Creative Web / Awwwards**: [mengto-creative](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/mengto-creative/SKILL.md). 26 skills for Awwwards art direction, cinematic scroll storytelling, Lenis sync, masked reveals, progressive blur, liquid borders, and Three.js/WebGL scenes.
4. **UI UX Pro Max**: [ui-ux-pro-max](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/ui-ux-pro-max/SKILL.md). 79 styles, 21 palettes, 50 typography pairings, charts. Run:
   `node .shared/ui-ux-pro-max/scripts/search.cjs "<query>" --domain <domain>`
5. **Vercel Agent Skills**: [vercel-agent-skills](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/vercel-agent-skills/SKILL.md). Specialized in React View Transitions, state & route animations, and compound composition.
6. **React Bits**: [react-bits](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/react-bits/SKILL.md). Curated catalog of text animations, shader backgrounds, cursor effects, and interactive micro-components with downloaded JSX implementations in `components/`.
7. **Anti-Template Art Director**: [ui-ux-kit](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/ui-ux-kit/SKILL.md). Anti-AI-slop rules, surface rules, and quality floor.
8. **Creative Reviewer**: [frontend-design](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/frontend-design/SKILL.md) (Anthropic). Design heuristics, typography courage, rejecting cliché SaaS heroes.
9. **Quality Floor Gate**: [web-interface-guidelines](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/web-interface-guidelines/SKILL.md) (Vercel). Accessibility, responsive behavior, focus rings, touch targets.
10. **Design Engineering Harness**: [design-harness](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/skills/design-harness/SKILL.md). Emil Kowalski engineering, performance budgeting, A11y.
11. **Design System Source of Truth**: [DESIGN_SYSTEM.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/DESIGN_SYSTEM.md).
12. **Connected MCPs**:
    * **Mobbin**: `https://api.mobbin.com/mcp` (Streamable HTTP, OAuth with paid account).
    * **Figma**: Native MCP in Antigravity (`figma_get_file`, etc.).
    * **21st-dev**: Magic UI inspiration and component lookup.
    * **Chrome DevTools**: Headless viewport emulation, screenshots, console log inspection.

---

## Product Context: FinKaif

* **Core capabilities:** automatic transaction ingestion, spending, income, categories, history, analytics, velocity, anomaly detection, goals, and AI agent.
* **AI Agent role:** The AI agent is not an isolated chatbot bubble in the corner. It is deeply woven into the product:
  - Explains spending spikes directly on the chart/data stream.
  - Identifies recurring and subscription charges.
  - Notices behavioral shifts and spending velocity.
  - Provides contextual marginalia and recommendations beside the relevant numbers.
  - Connects operations together to reveal patterns.
