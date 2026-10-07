# Supabase setup

## 1. Create a project
https://supabase.com/dashboard → **New project** → name `firstgear-compass`, a strong DB password, region **Mumbai (ap-south-1)** (or nearest) → Free plan is enough.

## 2–3. Project URL and keys
**Project Settings → API**:
- *Project URL* → `NEXT_PUBLIC_SUPABASE_URL`
- *anon / publishable* key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- *service_role / secret* key → `SUPABASE_SERVICE_ROLE_KEY` (**server only** — never in client code, never prefixed `NEXT_PUBLIC_`)

## 4. Environment variables
```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

## 5. Run the migrations (in order)
| File | What it does |
|---|---|
| `001_initial_schema.sql` | pgvector, all tables, indexes, triggers, retrieval functions |
| `002_seed_onboarding.sql` | roles, settings, KAM-30 template, 30 days, 3 gates, 100 tasks, dependencies |
| `003_assessments.sql` | 3 assessments, 37 questions, 10 scenarios with rubrics |
| `004_rls.sql` | Row Level Security, guard triggers, append-only audit, Realtime publication |
| `005_three_gates.sql` | Upgrades an existing project from five gates to three (Day 15 · Day 21 · Day 30). No-op on a fresh install |
| `006_real_company_profile.sql` | Upgrades an existing project to the real-company content: Day 1–2 tasks, FAQ links on journey days, realigned quiz questions and scenarios. No-op on a fresh install. Then run `npx tsx scripts/ingest-knowledge.ts` |
| `007_pillar_ordered_phase1.sql` | Re-orders Phase 1 by pillar — Governance (Days 1–4) → People (5–7) → Product (8–9) → Process (10–14) → Day-15 gate; interim check on Day 13. Tasks keep their ids, so progress is preserved. |
| `008_support_chat.sql` | KAM support chat: `chat_threads`, `chat_messages`, `chat_reads`, RLS for KAM/Mentor/HR, Realtime, `SUPPORT_CHAT_DAYS` setting. Schema change — apply with `npm run db:migrate supabase/migrations/008_support_chat.sql` (needs `SUPABASE_DB_URL`) or paste in the SQL Editor |

CLI: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
From this repo: add `SUPABASE_DB_URL` (Project Settings → Database → Connection string → URI, with the database password) to `.env.local` — never commit it — then `npm run db:migrate <file.sql>`. Each file runs in one transaction and is recorded in `public.app_migrations`.
Dashboard: **SQL Editor → New query** → paste each file → **Run**, in order.

## 6. pgvector
`001` runs `create extension if not exists vector;`. If it fails, enable **Database → Extensions → vector** and re-run.

## 7. Authentication
**Authentication → Providers → Email**: enabled. For the demo, turn **Confirm email** off (the seed script confirms its users anyway). **Authentication → URL Configuration**: Site URL = `http://localhost:3000` (add your Vercel URL later).

## 8. Roles
Roles are rows in `public.roles` (`KAM`, `MENTOR`, `REPORTING_BOSS`, `HR_ADMIN`) and each user's role is on `public.profiles`. The seed creates one of each; HR creates further KAMs in **Employee management**. To add a mentor or boss manually: create the user under **Authentication → Users**, then
```sql
insert into public.profiles (id, full_name, email, role, title)
values ('<auth-user-uuid>', 'Name', 'name@company.com', 'MENTOR', 'Senior KAM');
```

## 9. Test RLS
In the SQL editor (runs as postgres, so impersonate):
```sql
-- as Riya (KAM): sees only her own employee row
select set_config('request.jwt.claim.sub', (select id::text from profiles where email='riya.sharma@firstgear.example'), true);
set local role authenticated;
select full_name from employees;           -- 1 row: Riya
select count(*) from assessment_questions; -- 0: answers are hidden from KAMs
insert into gate_results (employee_id, instance_id, gate_id, status)
  select employee_id, instance_id, gate_id, 'PASSED' from gate_results limit 1;  -- ERROR: violates RLS
reset role;
```
The same checks run automatically in `tests/db/migrations-and-rls.test.ts` (17 tests).

## 10. Seed the sample KAM
```powershell
npx tsx scripts/seed.ts
```
Creates the four synthetic users, **Riya Sharma** (KAM, starts today = Day 1), her 100 task rows and 3 gate rows, six sessions, and ingests `knowledge/**/*.md` (19 approved documents).

## 11. Verify task persistence
1. Sign in as Riya, tick **Business overview**.
2. In **Table editor → task_completions** filter by status = `COMPLETED` → one row with `completed_at` and `completed_by`.
3. **audit_logs** → `TASK_COMPLETED`. **progress_snapshots** → today's row updated.
4. Refresh the browser → still ticked.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Login page says Supabase not configured | `.env.local` missing values; restart `npm run dev` |
| "No active onboarding instance" | Run the seed, or HR → Employee management → Assign onboarding |
| Assistant says evidence insufficient for everything | Knowledge not ingested — run the seed or upload in Knowledge management |
| `type "vector" does not exist` | Enable the `vector` extension (step 6) |
