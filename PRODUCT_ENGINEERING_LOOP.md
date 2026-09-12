# FinKaif Master Product Engineering Loop (16-Step Cycle)

## Overview
The **16-Step Product Engineering Loop** is the standard operating lifecycle for building, verifying, and shipping features in FinKaif. 
It ensures that product ideas are thoroughly vetted, mathematically verified, resilient to user chaos, visually refined, and regression-free before deployment.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    THE 16-STEP PRODUCT ENGINEERING LOOP                     │
│                                                                             │
│  [01] Idea & Goal Formulation       ───►  [02] Product Discovery & Shaping  │
│  [03] Adversarial Requirements Grill───►  [04] Financial Invariants Audit   │
│  [05] Architecture & Eng Review     ───►  [06] Executive Strategy Review    │
│  [07] Information Arch & UX Flow    ───►  [08] Design Stack Integration     │
│  [09] Test Strategy & PRD Matrix    ───►  [10] Code & Chain-of-Verification │
│  [11] API & Database State Audit    ───►  [12] Playwright Real User Personas│
│  [13] UX Chaos Monkey & Stress      ───►  [14] Adversarial Self-Audit       │
│  [15] AI Quality & Mentor Gate      ───►  [16] Observability & Railway Push │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## The 16 Steps in Detail

### Step 1: Idea & Goal Formulation
- State the problem clearly: What financial pain does the user experience?
- Document the target user persona and success metrics.
- Reference: `PRODUCT.md`.

### Step 2: Product Discovery & Shaping
- **Active Skills**: `product-discovery`, `magnus-product-shaping`.
- Frame the problem using Jobs To Be Done (JTBD).
- Define the "appetite" (time/complexity box) and set sharp "no-goes" (what we intentionally do NOT build).

### Step 3: Adversarial Requirements Grill
- **Active Skill**: `crops-requirements-grill`.
- Probe for hidden assumptions: What happens when network fails? What if the user has no accounts? What if balance is negative?
- Identify edge cases and failure modes before writing any specification.

### Step 4: Financial Invariants Audit
- **Active Skill**: `crops-domain-context`, Contract: `FINANCIAL_INVARIANTS.md`.
- Verify the 7 golden rules:
  1. Total Balance consistency.
  2. Transaction type signs (income > 0, expense < 0, transfer net 0).
  3. Category aggregation matching totals.
  4. Transfer atomic integrity across accounts.
  5. Pending vs Posted balance separation.
  6. Integer-cents rounding arithmetic (zero float drift).
  7. Timezone date stability.

### Step 5: Engineering Architecture & Plan Review
- **Active Skill**: `crops-plan-eng-review`.
- Review data model changes, API routes, state synchronization between backend and vanilla frontend.
- Ensure SQLite constraints (`CHECK`, `FOREIGN KEY`, `NOT NULL`) and indexing strategies are preserved.

### Step 6: Executive & Product Strategy Review
- **Active Skill**: `crops-plan-ceo-review`.
- Verify alignment with FinKaif's core brand promise: Premium, empowering, calming, high-taste fintech.
- Prevent feature creep and generic SaaS bloat.

### Step 7: Information Architecture & UX Flow
- **Active Skills**: `agentway-information-architecture`, `agentway-user-flow-mapping`.
- Map the complete user journey:
  - Entry state ➔ Happy path ➔ Alternative paths ➔ Empty state ➔ Error state ➔ Success feedback.
- Minimize cognitive load; keep financial metrics prominent and uncluttered.

### Step 8: Design Stack Integration
- **Active Stack**: Master `DESIGN_STACK.md`.
- Apply Taste Skill dials (`VARIANCE: 4`, `MOTION: 5`, `DENSITY: 6`).
- Motion choreography via **Official GSAP Skills**.
- Micro-interactions via **React Bits**.
- Accessibility & quality floor via **Vercel Web Interface Guidelines**.

### Step 9: Test Strategy & PRD Traceability Matrix
- **Active Skills**: `quality-test-strategy`, `agentway-prd-traceability-matrix`.
- Create a 1-to-1 mapping: Requirement ➔ Implementation File ➔ Test Assertion.
- Allocate test coverage across unit tests, API tests, and Playwright UI tests.

### Step 10: Implementation & Chain-of-Verification
- **Active Skills**: `crops-chain-of-verification`, `quality-property-based-testing`.
- Build iteratively with strict verification at each step.
- Ensure all business logic passes automated invariant checks.

### Step 11: API & Database State Audit
- **Active Skills**: `quality-api-fuzzing`, `quality-database-testing`.
- Test API contracts: Status codes, content types, input sanitization.
- Verify database state directly via SQLite CLI or queries to guarantee zero orphaned rows.

### Step 12: Playwright Real User Personas Testing
- **Active Skill**: `quality-playwright` (using `playwright-cli.cmd`).
- Execute tests simulating real personas:
  - *New User*: Verifies onboarding and empty states.
  - *Returning User*: Verifies quick logging and updated balances.
  - *Power User*: Verifies multi-account transfers and category breakdowns.
  - *Mobile User*: Viewport 375x812 touch navigation and responsiveness.

### Step 13: UX Chaos Monkey & Boundary Testing
- **Active Skill**: `ux-chaos-monkey` / `agentway-ux-chaos-monkey`.
- Submit extreme values: negative amounts, 0, 999999999.99, strings with emoji/HTML, unicode.
- Rapid double clicks on submission buttons (test for duplicate transactions).
- Simulate network interruptions mid-request.

### Step 14: Adversarial Post-Build Self-Audit & Regression Prevention
- **Active Skills**: `crops-self-audit`, `crops-regression-check`.
- Review the complete git diff line-by-line.
- Check for unintended side effects on untouched pages.
- Run deterministic anti-slop audit: `impeccable detect public/style.css`.

### Step 15: AI Quality & Financial Mentor Gate
- **Active Skill**: `quality-llm-evals`, Contract: `AI_QUALITY.md`.
- If the feature touches the AI Assistant or Financial Mentor:
  - Run the 7 AI Quality Checks (accuracy, numbers match DB, non-judgmental tone, actionable advice).
  - Verify loading states, thinking indicator, and complete response streaming/rendering.

### Step 16: Observability, Deployment & Git Sync
- Commit verified changes to git with clean semantic messages.
- Synchronize to GitHub `main` branch.
- Verify Railway auto-deployment trigger and confirm healthy production status.
- Ensure Sentry and PostHog integration hooks remain clean and consent-compliant.
