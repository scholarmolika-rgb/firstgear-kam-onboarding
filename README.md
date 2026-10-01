# FirstGear — KAM Onboarding Compass

> **Learn first. Then earn access.**

An AI-enabled, evidence-based 30-day onboarding and readiness platform for new or reassigned **Key Account Managers** in an automotive-components manufacturer. It turns mentor-dependent onboarding into a guided, measurable journey across four pillars — **Governance, People, Process, Product** — where readiness gates (not the calendar) control customer and pricing exposure, and humans make every readiness decision.

| | |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| Backend | Next.js server actions & route handlers |
| State store | Supabase Postgres + Row Level Security + Realtime |
| Retrieval | pgvector + Postgres full-text (hybrid), **all-MiniLM-L6-v2** embeddings |
| Intent routing | **DistilBERT** (separately deployed) + deterministic fallback |
| Generation | **Mistral Large** API, grounded with validated citations |
| Auth | Supabase Auth (email/password), 4 roles |
| Deploy | Vercel + Supabase |

## What's in the box

- **KAM**: dashboard (Day X of 30, overall readiness, phase, 6 KPI cards, alerts, gates, pillars, dependency trend), 30-day journey with Completed / Current / Locked / Blocked / Requires-review states, day detail (objectives, tasks, resources, assessment, sessions, evidence), persistent task checkboxes, Ask FirstGear assistant with sources and action buttons, sessions, assessments, scenario practice, Customer 360, account brief, knowledge library, progress report (screen / print / PDF / CSV).
- **Mentor**: assigned KAMs, review queue, weak pillars, account-brief and Customer-360 reviews, pre-send reviews, scenario reviews, Day-21 certification decision, coaching notes, support-event logging, panel input.
- **Reporting Boss**: readiness dashboard, progression / pricing-exposure / customer-ownership decisions, development actions, the final Day-30 sign-off.
- **HR / Admin**: cohort dashboard, employee management (create, assign mentor & boss, reset/reassign), programme configuration (weights, thresholds, tasks, dependencies, session types, categories…), assessment management (question bank + scenario rubrics), knowledge management (upload, version, approve, re-index), append-only audit log.
- **Engines** (pure TypeScript, unit-tested): task orchestration, five gates, Day-15 weighted scoring and Green/Amber/Red bands, Amber refresh / Red remediation planning, scenario rubric evaluation, 15 progress metrics, dependency trend, proactive alerts.

## Quick start (Windows PowerShell)

```powershell
git clone https://github.com/<you>/firstgear-kam-onboarding.git
cd firstgear-kam-onboarding
npm install
Copy-Item .env.example .env.local      # then fill in Supabase URL / keys (see docs/SUPABASE_SETUP.md)
# run supabase/migrations/001…004 in the Supabase SQL editor (or `npx supabase db push`)
npx tsx scripts/seed.ts                # 4 demo users, Riya Sharma's journey, knowledge base
npm run dev                            # http://localhost:3000
```

Demo accounts (synthetic): `riya.sharma@firstgear.example` (KAM), `arjun.rao@…` (Mentor), `meera.iyer@…` (Reporting Boss), `kavya.nair@…` (HR) — password = `DEMO_PASSWORD` (default `FirstGear!2026`).

## Tests

```powershell
npm test            # 102 tests: engines, 30-day journey simulation, AI/RAG, security, migrations + RLS in PGlite
npm run typecheck
npm run build
npm run test:e2e    # Playwright, against a running app + seeded Supabase
```

The database tests run the **real migrations** inside PGlite (Postgres + pgvector compiled to WASM) and check RLS as each role — no Docker needed.

## Documentation

| Doc | Contents |
|---|---|
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Build order and every design decision |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layers, request flows, folder map |
| [SETUP.md](SETUP.md) | GitHub → local → Supabase → test → deploy, step by step (PowerShell) |
| [DATABASE.md](DATABASE.md) | Schema, state model, migrations |
| [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md) | Intent router, grounding rules, agentic loop |
| [RAG.md](RAG.md) | Ingestion, versioning, retrieval, citations |
| [ASSESSMENTS.md](ASSESSMENTS.md) | Scoring, bands, gates, scenarios |
| [SECURITY.md](SECURITY.md) | Auth, RBAC, RLS, secrets, audit |
| [DEPLOYMENT.md](DEPLOYMENT.md) · [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md) | Vercel deployment + production checklist |
| [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) | Supabase project, migrations, auth, RLS checks |
| [ml/intent-router/README.md](ml/intent-router/README.md) | DistilBERT dataset, training, deployment |

## Scope guardrails

Information delivery, task/session tracking, assessment and readiness only. The app **never** creates accounts in, grants access to, or changes other IT systems; the assistant declines such requests. It never approves prices, commitments or readiness — those are recorded human decisions.

All people, companies and documents in this repository are synthetic.
