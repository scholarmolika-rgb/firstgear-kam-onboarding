# Database

Supabase Postgres is the **single source of truth** for identity, lifecycle, current day, tasks and status, due dates, sessions and attendance, assessment attempts, pillar scores, readiness bands, scenario scores, gate results, mentor feedback, manager decisions and progress history. `localStorage` is not used for any state.

## Migrations

| File | Contents |
|---|---|
| `001_initial_schema.sql` | extensions, 34 tables, indexes, `updated_at` triggers, `match_knowledge_chunks` (vector) and `search_knowledge_text` (FTS) — both return **approved + current** chunks only |
| `002_seed_onboarding.sql` | generated from `lib/seed-data/journey.ts` |
| `003_assessments.sql` | generated from `lib/seed-data/assessments.ts` |
| `004_rls.sql` | helper functions, policies, guard triggers, append-only audit, Realtime |

Regenerate 002/003 after editing the defaults: `npx tsx scripts/generate-seed-sql.ts`. Once live, HR edits content in the UI.

## Tables

| Area | Tables |
|---|---|
| Identity | `roles`, `profiles` (1:1 with `auth.users`), `employees` (mentor_id, reporting_boss_id, hr_owner_id) |
| Programme | `app_settings`, `onboarding_templates`, `onboarding_days`, `gate_definitions`, `tasks` (template **or** instance-specific), `task_dependencies` |
| Lifecycle | `onboarding_instances` (start date, status, exposure flags, final decision), `task_completions`, `gate_results`, `progress_snapshots` |
| Sessions | `sessions`, `session_attendance` |
| Assessment | `assessments`, `assessment_questions`, `assessment_attempts`, `assessment_answers`, `pillar_scores` |
| Scenarios | `scenario_templates` (rubric, red flags), `scenario_attempts` |
| Human input | `feedback`, `mentor_reviews`, `manager_reviews`, `support_events` (dependency signal) |
| Account | `account_briefs`, `stakeholder_maps` |
| Knowledge | `knowledge_documents` (versioned by `document_key` + `version`), `knowledge_chunks` (`vector(384)`, generated `tsvector`, denormalised metadata) |
| Conversation | `conversation_sessions`, `conversation_messages` (intent, grounding, citations, actions) |
| Support chat | `chat_threads` (one per KAM), `chat_messages` (KAM ↔ Mentor ↔ HR; RLS via `is_chat_participant`; Realtime), `chat_reads` (per-user read position). Sending is open for `SUPPORT_CHAT_DAYS` (default 15) |
| Ops | `notifications`, `audit_logs` |

Every employee-specific table carries `employee_id` with a foreign key and an index.

## State model highlights

- **Task status**: `PENDING → (SUBMITTED →) COMPLETED`, `REJECTED` returns to the KAM. `completed_at`/`completed_by` recorded. Approval-required tasks can only be *submitted* by the KAM (trigger-enforced).
- **Gate status**: `NOT_STARTED · IN_PROGRESS · SUBMITTED · PASSED · FAILED · BLOCKED · REQUIRES_REVIEW · APPROVED · EXTENDED`, with score, band, required tasks, evidence, assessor, comments, decision, next action, decided_at. Derived by the engine on every change and persisted by `syncEmployeeState`.
- **Exposure**: `pricing_exposure` (`BLOCKED/GUIDED/DEFERRED`), `customer_exposure` (`BLOCKED/SHADOW/GUIDED/DEFERRED`) mirrored on the instance for reporting.
- **Final decision**: only via the Reporting Boss sign-off; sets instance status `READY / EXTENDED / NOT_READY`.
- **Versioned knowledge**: one current version per `document_key` (partial unique index); superseded versions keep their chunks with `is_current=false`.
- **Audit**: `audit_logs` rejects UPDATE/DELETE via trigger.

## Validation

`tests/db/migrations-and-rls.test.ts` runs all four migrations in PGlite (real Postgres + pgvector compiled to WASM) and asserts seed counts, weights, retrieval filtering and the RLS behaviour of every role.
