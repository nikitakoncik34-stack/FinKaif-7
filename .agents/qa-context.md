# QA Context: FinKaif OS

> Source of truth for Quality Engineering, SDET practices, and automated testing across FinKaif OS. Every quality skill reads this document first.

---

## 1. Product & System Under Test
- **Product Name**: FinKaif — Premium Personal Finance Operating System (Current Version: v8.18)
- **Primary Value Proposition**: High-fidelity personal wealth management, intelligent cashflow analytics, FIRE (Financial Independence, Retire Early) forecasting, leak detection, and AI financial mentorship.
- **Architecture**:
  - **Frontend**: Vanilla Modern JavaScript Single Page Application (SPA), CSS custom properties with *Velvet Slate & Cashmere Jade* palette, SVG vector graphics, HTML5 Canvas, and Chrome DevTools MCP integration.
  - **Backend**: Node.js 20+ runtime, Express 4.21 REST API server (`server.js`), session/JWT authentication (`bcryptjs`, `jsonwebtoken`, `cookie-parser`), Google Gemini 2.0 / OpenAI API integration.
  - **Database Layer**: SQLite (`db/finkaif.db`) initialized via `db/schema.sql` and `db/migrate.js`, with PostgreSQL driver support (`pg`).
  - **Hosting / CI**: GitHub repository `nikitakoncik34-stack/FinKaif-7` (branch `main`), automated zero-downtime Railway Nixpacks builds (`railway.json`), local development on `http://127.0.0.1:3015`.

---

## 2. Languages & Test Automation Stack
- **Test Runner & Orchestrator**: Node.js test scripts, Playwright CLI (`playwright-cli.cmd` with native Google Chrome engine), Chrome DevTools MCP.
- **API Testing**: Node.js native `fetch` integration tests, Express route assertions, schema contract validation.
- **Unit & Property-Based Testing**: Deterministic financial invariant verification (`FINANCIAL_INVARIANTS.md`), numerical boundary fuzzing, floating-point precision checks.
- **UI & Regression Testing**: Headless Chrome viewport emulation (Desktop 1440x900, Mobile 390x844 iPhone), screenshot diffing, live console message audits.

---

## 3. Frontend Targets & Constraints
- **Primary Desktop Resolution**: 1440 × 900 px (100% DPI).
- **Primary Mobile Resolution**: 390 × 844 px (iPhone 14/15/16 form factor).
- **Target Browsers**: Google Chrome (Evergreen), Chromium, WebKit / Safari mobile viewport, Microsoft Edge.
- **Accessibility Standard**: WCAG 2.2 AA (Color contrast ≥ 4.5:1 for body, ≥ 3.0:1 for large display, interactive targets ≥ 44×44px, keyboard navigation).
- **Localization**: Russian primary (RUB currency `₽`), extensible to USD `$`, EUR `€`, GBP `£`.

---

## 4. API & Database Surface
- **Authentication**: JWT stored in HTTP cookies / headers (`/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/me`).
- **Core Endpoints**:
  - `GET /api/profile`, `PUT /api/profile` (user preferences, avatar selection, currency).
  - `GET /api/transactions`, `POST /api/transactions`, `DELETE /api/transactions/:id`.
  - `GET /api/budgets`, `POST /api/budgets`, `PUT /api/budgets/:id`.
  - `GET /api/goals`, `POST /api/goals`, `PUT /api/goals/:id`, `POST /api/goals/:id/deposit`.
  - `GET /api/chat`, `POST /api/chat`, `POST /api/assistant` (AI mentor intelligence).
  - `GET /health` (Railway uptime probe).
- **Database Tables**:
  - `users`: id, email, password_hash, created_at.
  - `user_profiles`: user_id, display_name, avatar, currency, monthly_income, updated_at.
  - `transactions`: id, user_id, amount, type, category, description, date, created_at.
  - `budgets`: id, user_id, category, limit_amount, period.
  - `goals`: id, user_id, title, target_amount, saved_amount, target_date.
  - `chat_history`: id, user_id, role, content, created_at.

---

## 5. Critical Invariants & Zero-Tolerance Failure Modes
1. **Financial Invariant Preservation**:
   - Total Cashflow = sum(Income) - sum(Expenses) across identical filters.
   - All monetary calculations must use integer cents or explicit rounding (`Math.round(val * 100) / 100`) to prevent floating-point anomalies.
   - Transfers and reversals must not double-count income or expenses.
2. **AI Grounding & Anti-Hallucination**:
   - AI mentor calculations must be 100% grounded in real user data.
   - Deterministic calculations (FIRE target, Runway months, 50/30/20 breakdown) must be verified by backend code, never left to LLM arithmetic.
3. **No Slop & No Layout Thrashing**:
   - Zero anti-patterns detected via `impeccable detect`.
   - Zero layout thrashing (`transition: width` prohibited, GPU `transform` and `opacity` mandated).
   - Zero console errors in Chrome DevTools runtime.

---

## 6. Observability & Monitoring Setup
- **Playwright E2E**: Local suite for interactive user journeys, multi-persona validation, and UX Chaos Monkey.
- **Sentry Integration**: Architecture planned for production exception logging and performance tracing (pending confirmation).
- **PostHog Integration**: Architecture planned for product analytics, funnel tracking, and retention metrics (pending confirmation).
- **Healthchecks**: Verified `/health` endpoint returning `{ status: 'ok', version: '8.18', timestamp: ... }`.
