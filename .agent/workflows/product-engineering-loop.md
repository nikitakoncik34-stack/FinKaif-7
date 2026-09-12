---
description: FinKaif Product + Engineering + QA + Debug Loop executing 16-step continuous verification across discovery, invariants, test strategy, Playwright personas, chaos, and self-audit.
auto_execution_mode: 3
---

# Product + Engineering + QA + Debug Loop (PEQD)

A disciplined 16-step engineering and quality lifecycle for **FinKaif (Premium Personal Finance Operating System)**.

Full specification: [PRODUCT_ENGINEERING_LOOP.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/PRODUCT_ENGINEERING_LOOP.md)  
Stack directory: [PRODUCT_ENGINEERING_STACK.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/PRODUCT_ENGINEERING_STACK.md)  
Financial Invariants Contract: [FINANCIAL_INVARIANTS.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/FINANCIAL_INVARIANTS.md)  
AI Mentor Quality Contract: [AI_QUALITY.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/AI_QUALITY.md)  
QA Architecture: [.agents/qa-context.md](file:///C:/Users/DNS/.gemini/antigravity/scratch/FinKaif-7/.agents/qa-context.md)

---

## Quick Protocol Reference

1. **Classify Change**: Determine Verification Level (Level 1 Small, Level 2 Feature, Level 3 Critical).
2. **Pre-Build Gate**:
   - For Level 2 & 3: Run `crops-requirements-grill` and check `FINANCIAL_INVARIANTS.md`.
3. **Execution**:
   - Write backend/frontend code following architecture guidelines.
   - If modifying UI, invoke **Design Stack** (GSAP, Vercel guidelines, anti-slop).
4. **Verification**:
   - Run API/DB tests.
   - Run Playwright persona journey via `playwright-cli.cmd`.
   - Run `ux-chaos-monkey` boundary checks.
   - If AI touched, verify against `AI_QUALITY.md`.
5. **Post-Build Gate**:
   - Run `crops-self-audit` and `crops-regression-check`.
6. **Ship & Deploy**:
   - Push to GitHub `main` for Railway auto-deployment.
