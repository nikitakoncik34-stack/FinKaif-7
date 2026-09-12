# FinKaif Product, Engineering, QA & Debug Stack (PEQD)

## 1. Executive Summary & Vision
FinKaif is not just a visual interface; it is a **mission-critical personal finance operating system**. 
A single calculation error, broken invariant, or unhandled race condition destroys user trust permanently. 

The **Product + Engineering + QA + Debug Stack (PEQD)** operates in synergy with the **Design Stack**, ensuring that:
- Every feature solves a high-impact financial problem with crisp product discovery.
- Requirements are grilled adversarially before any code is written.
- Financial invariants are mathematically and structurally guaranteed at all times.
- SDET-grade test strategies, automated property tests, and Playwright multi-persona user simulations guard against regressions.
- The AI Financial Mentor delivers accurate, mathematically sound, empathetic, and actionable guidance.
- Chaotic user behaviors (rapid clicking, negative inputs, network drops, malformed data) are caught gracefully.
- Every release undergoes an adversarial post-build self-audit before deployment to Railway.

---

## 2. Master Tool & Skill Directory (124 Integrated Skills)

The project incorporates 124 specialized skills located in `.agents/skills/`:

### A. Product Discovery & Intelligence (Magnus & Agentway)
* `product-discovery` / `agentway-product-discovery`: Frames problem statements, JTBD (Jobs to be Done), persona motivations, and validation criteria.
* `magnus-product-shaping`: Carves rough feature ideas into tight, implementable shapes with clear boundaries and appetite.
* `magnus-product-methodology`: Establishes product discovery frameworks (Shape Up, Opportunity Solution Trees, Dual-track Agile).
* `magnus-product-experimentation`: Hypothesis design, metric definition, A/B test structuring, and guardrail metrics.
* `agentway-information-architecture`: Defines hierarchy, navigational taxonomy, visual grouping, and cognitive load distribution.
* `agentway-user-flow-mapping`: Maps end-to-end user journeys, decision branches, zero states, and edge states.
* `agentway-prd-traceability-matrix`: Links user needs ➔ requirements ➔ code implementation ➔ verification test cases with zero gaps.

### B. Production Engineering & Review (Cropsgg)
* `crops-requirements-grill`: Hard-hitting adversarial challenge of feature requirements, assumptions, dependencies, and hidden costs before building.
* `crops-domain-context`: Financial domain rules, ledger semantics, double-entry principles, and account relationships.
* `crops-plan-eng-review`: Strict engineering architecture audit covering data flow, state management, latency, scalability, and error boundaries.
* `crops-plan-ceo-review`: Executive review challenging business value, ROI, user delight, and strategic alignment.
* `crops-chain-of-verification`: Step-by-step logical verification of complex algorithms and multi-step data pipelines.
* `crops-self-audit`: Adversarial code review: checks for anti-patterns, leaky abstractions, memory leaks, and unhandled promises.
* `crops-regression-check`: Systematic delta audit against existing features, database tables, and UI contracts.

### C. Quality Assurance & SDET Systems (Quality Skills)
* `quality-qa-context`: Project QA anchor (referenced at `.agents/qa-context.md`) detailing stack, test fixtures, and testing commands.
* `quality-test-strategy`: High-level test architecture, pyramid allocation (unit vs integration vs e2e), and risk classification.
* `quality-test-design`: Test case design using Equivalence Partitioning, Boundary Value Analysis, State Transition, and Pairwise testing.
* `quality-playwright`: Headless browser testing with Chrome via `playwright-cli.cmd`, snapshot verification, and network interception.
* `quality-database-testing`: SQLite transaction validation, foreign key constraints, migration rollbacks, and schema integrity audits.
* `quality-api-fuzzing`: REST endpoint stress testing: malformed JSON, SQL injection vectors, unexpected types, and rate limit boundaries.
* `quality-property-based-testing`: Invariant verification over thousands of randomized inputs (amounts, dates, currencies).
* `quality-llm-evals`: Automated quality, hallucination, and tone evaluation for the AI Financial Mentor (enforcing `AI_QUALITY.md`).
* `quality-visual-regression`: Pixel-perfect snapshot diffing across screen resolutions (Mobile 375x812, Tablet 768x1024, Desktop 1440x900).
* `quality-security-testing`: OWASP Top 10 validation, XSS prevention, sensitive data exposure checks in client logs.
* `quality-chaos-engineering`: Injecting latency, partial network failures, aborted requests, and out-of-order responses.

### D. Chaos & Real User Simulation (Agentway & Playwright)
* `ux-chaos-monkey` / `agentway-ux-chaos-monkey`: Autonomous chaotic tester executing rapid clicks, double submissions, navigating back during async operations, and typing garbage input into monetary fields.
* **Real User Personas**:
  1. *The First-Time User (Newcomer)*: Zero transactions, empty categories, onboarding walkthrough, needs welcoming empty states.
  2. *The Returning Regular*: 20-50 transactions/month, checks budget remaining, quickly logs daily coffee.
  3. *The Financial Power User*: 5+ accounts, multi-currency, 100+ transactions, split categories, exports CSV, checks advanced analytics.
  4. *The Confused / Anxious User*: Afraid of making mistakes, misinterprets balance vs net worth, checks transaction history twice.
  5. *The Impatient Clicker*: Double-clicks every button, presses Enter repeatedly, switches tabs before fetch returns.
  6. *The Mobile Touch User*: 375px width, fat fingers, viewport scrolling, bottom-sheet interactions, keyboard obscuring inputs.
  7. *The Flaky Network User*: 3G / offline transitions, intermittent 500 errors, airplane mode toggle.

### E. AI Quality & Mentor Intelligence System
* Governed by `AI_QUALITY.md`.
* Evaluates AI Assistant prompts, advice safety, tone (empathetic, non-judgmental, grounded in real numbers), context grounding, and multi-turn conversational consistency.

### F. Observability & Telemetry (Sentry & PostHog Protocols)
* **Sentry**: Crash reporting, unhandled client exceptions, slow SQLite query traces.
* **PostHog**: Product analytics, funnel drop-offs, user session paths.
* *Data Safety Policy*: Strict privacy compliance. Zero external network telemetry is activated without user opt-in and consent.

---

## 3. Tool Selection & Synergy Matrix

To maximize effectiveness, tools are used in complementary combinations:

| Phase / Scenario | Primary Skill | Synergistic Companion Skills | Output / Artifact |
|---|---|---|---|
| **Feature Conception** | `product-discovery` | `magnus-product-shaping`, `crops-requirements-grill` | Problem Statement & Boundary Shape |
| **Domain & Math Audit** | `crops-domain-context` | `FINANCIAL_INVARIANTS.md`, `quality-property-based-testing` | Mathematical Proof & Test Vectors |
| **Architecture Design** | `crops-plan-eng-review` | `agentway-information-architecture`, `crops-plan-ceo-review` | Architectural RFC & Schema Diff |
| **UX & Visual Design** | *Design Stack* | `agentway-user-flow-mapping`, `Taste Skill` | High-Fidelity Views & GSAP Motion |
| **Test Planning** | `quality-test-strategy` | `agentway-prd-traceability-matrix`, `quality-test-design` | Traceability Matrix & Test Suites |
| **Implementation** | `crops-chain-of-verification` | `quality-database-testing`, `quality-api-fuzzing` | Clean Code with Pre-conditions Checked |
| **End-to-End Simulation** | `quality-playwright` | `ux-chaos-monkey`, Multi-Persona Engine | Automated Playwright Pass & Screenshots |
| **AI Feature Testing** | `quality-llm-evals` | `AI_QUALITY.md` Verification Checklist | Eval Scorecard (Safety, Math, Tone) |
| **Release Gate** | `crops-self-audit` | `crops-regression-check`, `impeccable detect` | Zero-defect Audit Log & Git Commit |

---

## 4. Verification Levels & Protocols

Every code change must be categorized into one of three Verification Levels:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        VERIFICATION LEVELS                             │
│                                                                        │
│  LEVEL 1: SMALL FIXES & UI POLISH                                      │
│  ↳ Self-Audit + Regression Check + Static Lint + Playwright Snapshot   │
│                                                                        │
│  LEVEL 2: NEW FEATURES, API ENDPOINTS & USER FLOWS                     │
│  ↳ Product Discovery + Eng Plan Review + Unit/API Tests + Playwright   │
│    Multi-Persona Journey + UX Chaos Monkey Check                       │
│                                                                        │
│  LEVEL 3: CRITICAL SYSTEMS, FINANCIAL LOGIC, MIGRATIONS & AI CORE      │
│  ↳ Full 16-Step PEQD Loop + Requirements Grill + Financial Invariants  │
│    Formal Verification + Property Testing + Database Integrity Audit  │
└────────────────────────────────────────────────────────────────────────┘
```

### Level 1: Small (UI tweaks, copy adjustments, minor bug fixes)
* **Scope**: Modifying existing styles, fixing button alignments, correcting typos, minor client event handler adjustments.
* **Protocol**:
  1. `crops-self-audit` on modified lines (check for side effects).
  2. Verify no visual breakage via `playwright-cli.cmd snapshot`.
  3. Verify console has 0 errors via Chrome DevTools or test script.
  4. Quick git commit with descriptive message.

### Level 2: Feature (New screens, new REST endpoints, interactive widgets)
* **Scope**: Adding a new budget category view, new transaction filtering UI, CSV export endpoint, AI prompt enhancement.
* **Protocol**:
  1. Define user flow (`agentway-user-flow-mapping`) and trace requirements (`agentway-prd-traceability-matrix`).
  2. Architecture check (`crops-plan-eng-review`).
  3. UI execution following the Design Stack (GSAP, Vercel guidelines, anti-slop).
  4. Backend validation: verify status codes, payloads, error responses.
  5. Playwright journey: run through with *New User* and *Returning User* personas.
  6. Chaos check: double click trigger buttons, test empty inputs.
  7. Regression check (`crops-regression-check`).

### Level 3: Critical (Financial math, DB migrations, balance calculations, AI engine)
* **Scope**: Changes to `FINANCIAL_INVARIANTS.md` logic, table schemas in `db/schema.sql`, `db/migrate.js`, balance rollup queries, split transactions, AI system prompt / advice logic.
* **Protocol**:
  1. **Strict Halt & Plan**: Create detailed implementation plan.
  2. **Adversarial Requirements Grill** (`crops-requirements-grill`).
  3. **Financial Invariants Verification**: Check all 7 invariant rules in `FINANCIAL_INVARIANTS.md`.
  4. **Database Rollback Check**: Test migration forward and backward. Foreign keys enabled.
  5. **Property-Based Testing**: Run automated fuzz tests with 100+ random amounts, decimals, and negative bounds.
  6. **Multi-Persona + Chaos Simulation**: Test *Power User* + *Impatient Clicker* + *Flaky Network*.
  7. **AI Quality Verification**: If AI changed, run evaluation matrix against `AI_QUALITY.md`.
  8. **Adversarial Self-Audit**: Full diff line-by-line review.
  9. **Deploy & Smoke Test on Railway**: Post-deployment production verification.
