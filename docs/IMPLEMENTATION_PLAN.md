# Implementation Plan — FirstGear KAM Onboarding Compass

> "Learn first. Then earn access."

This plan was written before the code and kept in sync with it. It records the
build order and every design decision that the specification left open.

## 1. Guiding separation

| Concern | Owner | Where |
|---|---|---|
| **Knowledge** | RAG over approved, versioned documents | `lib/ai/rag`, `knowledge_documents`, `knowledge_chunks` |
| **Workflow** | Deterministic rule engines (pure TypeScript, unit-tested) | `lib/engine/*` |
| **State** | Supabase Postgres — the single source of truth | `supabase/migrations`, `lib/services/*` |
| **Human judgement** | Mentor / Reporting Boss / HR decisions, recorded with evidence | `mentor_reviews`, `manager_reviews`, `gate_results` |

The LLM never decides progression, scores, approvals, pricing or readiness.
It phrases answers over facts that the engines and the database already hold.

## 2. Build order

1. Scaffold (Next.js 15, TypeScript, Tailwind) and this plan.
2. Database: `001_initial_schema` → `002_seed_onboarding` → `003_assessments` → `004_rls`.
3. Engines: config validation, task orchestration, gates, Day‑15 scoring, scenario rubric, progress metrics, dependency trend, recommendations.
4. AI: intent router (DistilBERT endpoint + rule fallback + out-of-scope guard), embeddings (all‑MiniLM‑L6‑v2), hybrid retrieval, grounded Mistral generation with validated citations.
5. Services & server actions: every write goes `UI → server action → authorization → Supabase → audit → recompute → return state`.
6. UI: 21 screens, role-aware navigation.
7. Tests: engine unit tests, 30-day journey simulation, migrations + RLS executed in PGlite (real Postgres + pgvector, in-process), Playwright E2E spec.
8. Docs, seed script, deployment config.

## 3. Progression rules (deterministic)

Segments are unlocked by gates, **not** by the calendar. The calendar only
decides *due* and *overdue*.

| Days | Segment | Unlocked when |
|---|---|---|
| 1–15 | Phase 1 — learn about the company (Governance, People, Process, Product). No pricing, no customer exposure | instance active |
| 16–17 · 18–19 · 20 | Shadow reviews · own low-risk queries · lead an internal review | Gate 1 PASSED (GREEN) or REQUIRES_REVIEW (AMBER, supervised only) |
| 21 | Scenario test (gate) | Gate 1 PASSED |
| 22–25 | Guided pricing | Gate 2 PASSED **and** latest Day‑15 score ≥ green threshold **and** Reporting Boss approved pricing exposure |
| 26–29 | Own the account | Gate 2 PASSED **and** Reporting Boss approved customer ownership |
| 30 | Readiness panel sign-off | Gate 2 PASSED and Phase‑2 mandatory unlocked work complete |

Gates:

* **G1 (Day 15)** — all Phase‑1 tasks complete, the Day‑10 interim check ≥ `DAY10_PASS_THRESHOLD` (a checkpoint, retake allowed — the Day‑15 assessment waits for it), then the weighted four-pillar readiness score. GREEN → PASSED once the mentor's Customer‑360 and account-brief reviews are recorded. AMBER → REQUIRES_REVIEW, a 3–5 day targeted refresh is generated for the weakest pillar(s), pricing stays blocked until a re-check reaches the green threshold. RED → FAILED, Phase 2 paused, remediation plan generated.
* **G2 (Day 21)** — scenario test: four certification scenarios (RFQ, price challenge, delivery risk, quality escalation). Rules compute the score; a Mentor must review. The mentor cannot approve a score below `DAY21_PASS_THRESHOLD`.
* **G3 (Day 30)** — readiness panel sign-off: Mentor input + HR input are required before the Reporting Boss can record the final decision (READY / EXTENDED / NOT_READY). Thirty elapsed days never set READY.

Reporting Boss overrides: may **defer** progression (G1 → BLOCKED), defer pricing, or extend onboarding — always with a recorded comment.

## 4. Decisions taken where the spec was open

| Topic | Decision | Why |
|---|---|---|
| Day counting | Calendar days from `start_date` (setting `DAY_COUNTING` supports `BUSINESS`) | Spec says "30-day"; configurable for plants on shift calendars |
| Working ahead | KAM may complete any task in an unlocked segment early | Gates, not dates, control progression |
| Overall readiness % | Weighted composite of task completion, knowledge score, scenario score and gate progress; unassessed components count as 0 | Every number must derive from data; no optimistic extrapolation |
| Who writes scores | Server only, via service role after authorization. RLS denies KAM writes to `pillar_scores`, `gate_results`, `progress_snapshots`, `audit_logs` | A KAM must not be able to forge a score from the browser |
| Assessment answers | Correct answers never leave the server; questions are served stripped | Integrity of assessment |
| Scenario scoring | Rubric criteria are scored by deterministic keyword rules; Mistral may *upgrade* an unmet criterion to *partial* only; red-flag rules (e.g. committing to a price) are deterministic penalties | "AI-assisted, rules deterministic" |
| Dependency trend | Computed only from recorded `support_events` (mentor help, colleague help, escalation vs independent resolution) | Spec forbids invented dependency data |
| Embeddings in production | Hugging Face Inference API by default; in-process ONNX (Transformers.js) optional; Postgres full-text always available as hybrid partner | Vercel functions must not depend on a local Python process |
| DistilBERT in production | Separately deployed classifier (HF Inference Endpoint or the FastAPI service in `ml/`), called via `HF_MODEL_URL`; rule-based router as fallback | Same |
| Out-of-scope requests | IT account/access provisioning is declined and redirected; pricing authorisation requests are routed to the Reporting Boss | Inherited from the project CLAUDE.md scope + spec §39 |
| PDF export | Client-side jsPDF from the same report JSON that drives the CSV and print view | Works on Vercel with no native dependencies |
| Realtime | Supabase Realtime on `task_completions`, `gate_results`, `notifications` triggers a refresh on other open devices | "Real-time progress updates" |
