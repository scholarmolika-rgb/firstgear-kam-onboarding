# Security

| Control | Implementation |
|---|---|
| Authentication | Supabase Auth (email + password). `middleware.ts` refreshes the session cookie and redirects anonymous users to `/login`. |
| Role-based authorisation | `profiles.role` ∈ KAM / MENTOR / REPORTING_BOSS / HR_ADMIN. Pages call `requireRole`; services call `requireEmployeeAccess`, `canTickTask`, `mayDecide` (`lib/auth/access.ts`) before any write. |
| Row Level Security | Enabled on **every** public table (`004_rls.sql`). KAM → own records; Mentor / Reporting Boss → assigned KAMs; HR → programme and cohort. Correct answers and scenario rubrics are invisible to KAMs. |
| Defence in depth | User-initiated writes (ticks, briefs, decisions, sessions) use the **user's** client so RLS applies even if app code were bypassed. DB triggers stop a KAM approving their own brief or self-completing an approval-required task. |
| System-computed state | Scores, gate results, snapshots, notifications and audit are written with the service role **only after** authorisation in code. RLS denies these writes to every user, so nobody can forge a score from the browser. |
| Secrets | Service-role, Mistral and HF keys are server-only env vars (`import "server-only"` guards the modules). Only `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` reach the browser. `.env*` files are git-ignored; `.env.example` holds placeholders. |
| Input / API validation | zod schemas for every server action and route (`lib/security/validation.ts`); UUID checks; length limits; file type & 8 MB size limit on uploads. |
| Rate limiting | `RateLimiter` interface with an in-memory token bucket (assistant: burst 20, then 1/3 s; mutations: burst 60). Swap for a shared store in multi-instance production. |
| Audit | Append-only `audit_logs` (trigger blocks UPDATE/DELETE): who, role, event, entity, previous and new value, time — for task changes, assessments, gates, reviews, decisions, documents, configuration, sessions, AI escalations, report exports. |
| Logging hygiene | Server logs record error *types*, never prompts, answers or employee details; client code doesn't log employee data. |
| Error handling | Services throw `ServiceError` with user-safe messages; unexpected errors return a generic message; route-level error boundary. |
| Headers | `X-Frame-Options: DENY`, `nosniff`, strict referrer, restrictive permissions policy; `poweredByHeader` off. |
| Open redirects | Post-login `next` parameter must be a same-site path. |
| AI safety | Guards for IT-access and pricing-authority requests; grounded answers with validated citations; no answer without evidence; humans hold every judgement decision. |
| Scope | The app never creates, modifies or grants access in other IT systems. HR's "create employee" only creates a Compass sign-in. |

Verified by `tests/db/migrations-and-rls.test.ts` (RLS per role, append-only audit, anonymous access) and `tests/unit/security.test.ts` (access helpers, validation, rate limiting).

Report vulnerabilities to the programme owner; do not open public issues containing employee data.
