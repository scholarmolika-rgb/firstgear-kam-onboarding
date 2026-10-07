# Architecture

## Separation of concerns

```
            ┌──────────────── Conversation / UI (Next.js, role-aware) ────────────────┐
            │  KAM · Mentor · Reporting Boss · HR screens   ·   Ask FirstGear chat    │
            └───────────────┬──────────────────────────────────────┬──────────────────┘
                server actions / route handlers (zod validation, rate limiting)
                            │                                      │
        ┌───────────────────▼────────────┐        ┌────────────────▼───────────────────┐
        │ Services (lib/services)        │        │ AI layer (lib/ai)                   │
        │  authorise → write → audit →   │        │  guard → DistilBERT/rules intent →  │
        │  recompute (sync) → return     │        │  RAG (MiniLM + FTS) or state facts  │
        └───────┬───────────────┬────────┘        │  → Mistral Large → validated cites  │
                │               │                 └───────────────┬────────────────────┘
   ┌────────────▼───┐   ┌───────▼──────────────────────┐          │
   │ Rules engines  │   │ Supabase Postgres (+RLS)     │◄─────────┘
   │ lib/engine     │   │ single source of truth;      │
   │ pure, tested   │   │ pgvector; Realtime; Auth      │
   └────────────────┘   └──────────────────────────────┘
```

**Knowledge** (RAG over approved documents) · **Workflow** (deterministic engines) · **State** (Supabase) · **Human judgement** (mentor / boss / HR decisions) are separate modules. The LLM phrases answers over facts; it never computes scores, opens gates or approves anything.

## Layers (as specified)

| # | Layer | Implementation |
|---|---|---|
| 1 | Conversation / UI | `app/(app)/*`, `components/*`, `components/assistant/AssistantChat.tsx` |
| 2 | Intent router | `lib/ai/intent/` — policy guard → DistilBERT endpoint → rule fallback |
| 3 | Knowledge retrieval | `lib/ai/rag/` — chunker, MiniLM embeddings, hybrid retrieval, citations |
| 4 | Task orchestration | `lib/engine/journey.ts` — availability, blocked, due, overdue, next, approvals, gates |
| 5 | Response generation | `lib/ai/llm/mistral.ts` + `lib/ai/prompts/*.txt` + `lib/ai/assistant.ts` |

## Key flows

### Checkbox (state change)
`TaskRow` (optimistic) → `toggleTaskAction` → `toggleTask` service:
1. load snapshot via the **user's** client (RLS) and verify availability/ownership with the engine;
2. update `task_completions` **as the user** (RLS + DB trigger enforce owner and approval rules);
3. `audit_logs` row (`TASK_COMPLETED` / `TASK_REOPENED` / `TASK_SUBMITTED`);
4. `syncEmployeeState` re-evaluates gates, persists `gate_results`, exposure flags, today's `progress_snapshots`, dispatches notifications;
5. returns updated progress; page revalidates; Realtime pushes the change to other devices.

### Assessment
`startAttempt` (availability from the engine) → stripped questions to the browser → `submitAttempt` scores server-side from stored answers with the config snapshot → `assessment_answers`, `pillar_scores`, attempt band → system task completion → Amber/Red plan creates instance-specific tasks → sync.

### Assistant
`/api/assistant` → rate limit → session → intent → (knowledge | account | state | action) → Mistral with grounded prompt or deterministic/extractive fallback → citations validated against retrieved passages → message stored with intent, grounding, citations, actions.

## Folder map

```
app/            routes: (app)/… screens, api/…, actions/ (server actions), login
components/     ui primitives, charts (SVG), kam/, staff/, admin/, assistant/, layout/
lib/engine/     config, calendar, scoring, rubric, journey (gates+orchestration), progress, remediation, alerts
lib/services/   snapshot loader, sync, tasks, assessments, scenarios, reviews, sessions, account, knowledge, admin, audit
lib/ai/         intent/, rag/, llm/, prompts/ (plain-text templates), assistant.ts
lib/seed-data/  default programme content → generated SQL migrations
supabase/       migrations/001–004
knowledge/      synthetic approved documents (Markdown + front matter)
ml/             DistilBERT dataset, training, ONNX export, inference service
scripts/        seed, ingest, generate-seed-sql, generate-intent-dataset
tests/          unit/, integration/ (30-day simulation), db/ (PGlite migrations+RLS), e2e/ (Playwright)
```

## Design choices worth knowing

- **Gates, not dates.** Segments unlock when gates clear; the calendar only drives due/overdue. A KAM may work ahead inside an unlocked segment.
- **Server-only scoring.** Scores, gate results, snapshots and audit are written with the service role *after* authorisation; RLS denies those writes to users.
- **Template + instance tasks.** Refresh/remediation tasks are instance-specific rows linked to Gate 1 (Day 15), so the gate naturally waits for them.
- **System-driven tasks** (`action_ref`) — assessments, scenarios, reviews and panel steps tick themselves when the linked action happens; they can't be ticked by hand.
- **Extensibility.** New intents, document categories, session types, tasks, questions and rubrics are data, not code. Calendar and notification channels are provider interfaces.
