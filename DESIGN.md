# FinKaif Master DESIGN.md: Source of Truth

> The authoritative project-level visual contract and design memory for **FinKaif OS**.
> All visual decisions, redesigns, new views, animations, and reviews must conform to this document.

<!-- impeccable:design-schema 1 -->

---

## 1. Design Direction & Taste Configuration (Taste Skill Integration)

Before writing any frontend code, infer the brief and configure the three core Taste dials:

* **`DESIGN_VARIANCE: 4`** — Disciplined, asymmetric elegance (retains mathematical finance structure while avoiding boring identical cards).
* **`MOTION_INTENSITY: 5`** — Fluid, physics-grounded micro-motion (GSAP scrubbed timelines + CSS hardware-accelerated transitions; zero elastic bounce).
* **`VISUAL_DENSITY: 6`** — Modern financial terminal (high information throughput without cramped typography; comfortable padding and generous line-height).

### Anti-Default & Anti-Slop Discipline:
* ❌ **No AI-purple gradients or generic cyan blobs.**
* ❌ **No standard 3-equal-cards or mindless Bento grid everywhere.**
* ❌ **No thick colored border on one side of a card (e.g. `border-left: 4px solid ...`).**
* ❌ **No ungrounded, blurry glassmorphism on non-floating elements.**
* ❌ **No animating `width`, `height`, `padding`, or `margin` (GPU `transform` & `opacity` strictly).**
* ❌ **No generic Lucide icons mechanically placed next to every heading.**

---

﻿# FinKaif Design System: Source of Truth

> The official living design system and visual contract for **FinKaif**.
> Every future page, modal, component, and interaction must adhere to these tokens, principles, and rules.

---

## 1. Product & Architectural Identity

* **Product Name:** FinKaif
* **Product Classification:** Premium Personal Finance Operating System (not an admin dashboard or generic SaaS template).
* **Core Functionality:**
  - Automatic transaction ingestion & categorization;
  - Expenses & income intelligence;
  - Predictive cash-flow & period comparison;
  - Real-time financial anomaly detection;
  - Goals & wealth trajectories;
  - **Contextual AI Financial Agent** (embedded in data, NOT an isolated chat widget).
* **Target Audience:** Modern professionals, creators, and individuals demanding clarity, discretion, and high-agency control over their capital.
* **Core Design Thesis:**
  *"Financial data should feel like an organic, living landscape of capital — not a spreadsheet forced into arbitrary card boxes."*

---

## 2. Anti-Slop Gate & Adversarial Principles

Before accepting any design decision, run the **Adversarial Gate Test**:
> *"If we hide the FinKaif logo and product name, could this screen belong to dozens of other SaaS products?"*
> If **YES** → **REJECT IMMEDIATELY**. Redesign the composition structurally.

### Strictly Banned Clichés:
1. Standard "Sidebar + Topbar + 4 KPI Cards" layout;
2. Endless nested rounded cards (`border-radius: 24px`);
3. Generic purple/cyan AI gradients;
4. Decorative, unreadable glassmorphism;
5. Floating ambient glow orbs;
6. Generic Lucide icons mechanically placed next to every heading;
7. Small eyebrow + giant marketing title + subtitle + CTA button layout in product screens;
8. AI confined to a generic right-side chat drawer.

---

## 3. Color System (60-30-10 Rule)

Tonal OKLCH depth grounded in deep obsidian and midnight emerald:

| Role | Token | Hex Equivalent | Usage |
| :--- | :--- | :--- | :--- |
| **60% Dominant** | `--surface-base` | `#080D0B` | Canvas base, viewport background, deep negative space |
| **30% Secondary** | `--surface-raised` | `#111A16` | Structural functional panels, elevated data planes |
| **30% Elevated** | `--surface-float` | `#17231E` | Dropdowns, dialogs, active interactive surfaces |
| **10% Accent (Brand)** | `--accent-emerald` | `#10B981` | Positive financial delta, growth indicators, active controls |
| **10% Accent (Bright)**| `--accent-mint` | `#34D399` | Primary focus states, high-contrast highlights |
| **Semantic Alert** | `--status-warn` | `#F59E0B` | Budget thresholds, unusual spending warnings |
| **Semantic Danger** | `--status-loss` | `#F43F5E` | Expense spikes, negative cash flow, anomalies |
| **Text Primary** | `--text-primary` | `#F3F4F6` | High-contrast data figures, primary labels (≥ 7:1 contrast) |
| **Text Secondary** | `--text-secondary` | `#9CA3AF` | Supporting descriptions, metadata, axis labels |
| **Text Muted** | `--text-muted` | `#6B7280` | Timestamps, micro-captions |

*Surface Separation Rule:* Separate layers using subtle luminance differences and soft hue-tinted shadows — **avoid harsh 1px solid gray borders**.

---

## 4. Typography System

* **Heading & Display Family:** Editorial / Technical Grotesque (e.g., *Cabinet Grotesk*, *Mona Sans*, or *Space Grotesk*)
* **Body & UI Family:** *Inter* / *Geist Sans* with strict tabular numbers (`font-variant-numeric: tabular-nums`) for currency and metrics.
* **Type Hierarchy Scale:**
  - **Display / Hero Balance:** `3rem` (`48px`) — `font-weight: 700`, `letter-spacing: -0.03em`
  - **Metric Large:** `2rem` (`32px`) — `font-weight: 600`, tabular nums
  - **Section Heading:** `1.25rem` (`20px`) — `font-weight: 600`, `letter-spacing: -0.015em`
  - **Body / Label:** `0.9375rem` (`15px`) — `font-weight: 400`, `line-height: 1.5`
  - **Caption / Meta:** `0.8125rem` (`13px`) — `font-weight: 500`, `letter-spacing: 0.01em`

---

## 5. Contextual AI Integration

The AI Agent is a continuous analytical layer woven into the interface:
1. **In-Graph Annotations:** Contextual chips attached directly to inflection points on spending charts (e.g., *"Food +38%: 6 delivery orders between Sep 3-7"*).
2. **Contextual Action Suggestions:** Inline micro-recommendations (e.g., *"Set subscription cap"* or *"Mark recurring tax deduction"*).
3. **Conversational Data Drill-down:** Clicking any data cluster allows direct inquiry regarding that specific slice of capital without leaving the screen.

---

## 6. Motion & Microinteractions (Emil Kowalski Standard)

* **Physics Grounding:** Use subtle spring physics (`damping: 28, stiffness: 300`) for modals, overlays, and drawer expansions.
* **GPU Only:** Animate strictly `transform` and `opacity`. Never animate `width`, `height`, `top`, or `margin`.
* **State Feedback:** Every interactive control has an immediate, tactile response (< 100ms):
  - Subtle brightness shift (+5% on hover);
  - Micro-scale press (`transform: scale(0.98)`);
  - High-visibility focus ring for keyboard navigation (`2px solid var(--accent-mint)` with `offset: 2px`).
* **Accessibility:** Respect `prefers-reduced-motion: reduce` by replacing spatial transitions with instant opacity fades.

---

## 7. Data Visualization Principles

* **Line & Area Charts:** Smooth cubic curves, subtle gradient fills with max 15% opacity, interactive hover vertical crosshair with tabular tooltip.
* **Category Breakdown:** Proportional density streams or donut charts with central net-spend figure; maximum 6 distinct colored categories before grouping into "Other".
* **Time Comparison:** Solid line for current period; dashed or low-opacity line for previous period with confidence band shading.

---

## 8. Quality & Compliance Floor (Vercel Guidelines)

* **Touch Targets:** Minimum `44x44px` clickable area for all mobile controls.
* **Semantic HTML:** `<button>` for actions, `<a>` for links, `<main>`, `<nav>`, `<aside>`, `<section>`.
* **ARIA & A11y:**
  - All icon-only buttons require descriptive `aria-label`;
  - Asynchronous balance updates wrapped in `aria-live="polite"`;
  - Focus trapped inside modal dialogues until dismissed;
  - Text contrast verified against WCAG AA standards (≥ 4.5:1 for body, ≥ 3:1 for large display).


---

## 8. Multi-Layer Design Stack Execution Loop

When designing, polishing, or reviewing UI:
```
TASTE SKILL (Direction & Anti-Slop)
   ↓
UI UX PRO MAX (Intelligence & Data Matrix)
   ↓
AWESOME DESIGN.MD (Curated System References: Revolut, Stripe, Linear)
   ↓
MOBBIN (Real-World Top Fintech UX)
   ↓
MENGTO CREATIVE SKILLS (Art Direction & Cinematic Techniques)
   ↓
DESIGN CONCEPT (Approved Direction)
   ↓
IMPECCABLE (Pre-Flight Craft & Shape)
   ↓
IMPLEMENTATION (Semantic Markup & CSS Tokens)
   ↓
GSAP / VIEW TRANSITIONS / THREE.JS (Motion Choreography)
   ↓
IMG2THREEJS (Procedural 3D When Reference Image Exists)
   ↓
PLAYWRIGHT CLI (Visual Loop: Desktop & Mobile Viewports)
   ↓
CHROME DEVTOOLS (Console, Network, Performance Inspection)
   ↓
IMPECCABLE (Audit, Critique & Polish)
   ↓
VERCEL GUIDELINES (Accessibility & Production Quality Gate)
```
