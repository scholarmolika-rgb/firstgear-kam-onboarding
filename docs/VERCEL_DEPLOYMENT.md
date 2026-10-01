# Vercel deployment

## 1. Push to GitHub
See [SETUP.md](../SETUP.md) steps 2–4. Confirm `.env.local` is **not** in the repo (`git ls-files | Select-String env` shows only `.env.example`).

## 2–4. Create the project
https://vercel.com → **Add New → Project** → import `firstgear-kam-onboarding`. Framework preset **Next.js** (auto-detected from `vercel.json`); build `npm run build`; install `npm ci`; output default. Region `bom1` (Mumbai) is set in `vercel.json` — keep it close to your Supabase region.

## 5. Environment variables
**Settings → Environment Variables** (Production + Preview):

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | Mark **Sensitive** |
| `NEXT_PUBLIC_APP_URL` | ✓ | `https://<project>.vercel.app` |
| `MISTRAL_API_KEY` | recommended | Sensitive. Without it: extractive cited answers |
| `MISTRAL_MODEL` | | default `mistral-large-latest` |
| `HF_API_TOKEN` | recommended | MiniLM embeddings via HF Inference API |
| `EMBEDDINGS_PROVIDER` | | `hf-api` (default) · `none` |
| `HF_EMBEDDING_URL` | | override the feature-extraction URL |
| `HF_MODEL_URL` | optional | DistilBERT endpoint (see `ml/intent-router/README.md`) |
| `INTENT_MIN_CONFIDENCE` | | default `0.55` |
| `APP_TIMEZONE` | | default `Asia/Kolkata` |

## 6. Deploy
Click **Deploy**. Then in Supabase **Authentication → URL Configuration** add the Vercel URL as Site URL / redirect URL.

## 7–14. Verify in production
| # | Check | How |
|---|---|---|
| 7 | Production URL | Opens the sign-in page |
| 8 | Supabase connection | `GET /api/health` → `"supabase": true, "serviceRole": true` |
| 9 | Mistral API | `/api/health` → `"mistral": true`; ask a knowledge question → footer shows company-knowledge grounding |
| 10 | Authentication | Sign in as each demo role; each lands on its own dashboard |
| 11 | Database writes | Tick a task; check `task_completions` and `audit_logs` in Supabase |
| 12 | Checkbox persistence | Refresh, sign in on another device — same state |
| 13 | Assessment | Take the practice quiz; result stored in `assessment_attempts` |
| 14 | AI assistant | "What should I do next?" and "What is the RFQ process?" (with source) |

## Production checklist
- [ ] Service-role key only in Vercel env (Sensitive), never `NEXT_PUBLIC_*`
- [ ] Migrations 001–004 applied in order; `select count(*) from tasks` = 100
- [ ] Supabase Auth site URL / redirect URLs include the Vercel domain
- [ ] Demo accounts removed or passwords changed before real use; real users created by HR
- [ ] Synthetic knowledge documents replaced by approved company documents (Knowledge management)
- [ ] `HF_API_TOKEN` set and **Re-index embeddings** run once
- [ ] Mistral key set, usage limits configured in the Mistral console
- [ ] DistilBERT endpoint deployed and `HF_MODEL_URL` set (or accept rule fallback)
- [ ] Supabase **Database → Backups** enabled (paid plans) or scheduled `pg_dump`
- [ ] Supabase advisors (Security / Performance) reviewed
- [ ] Replace in-memory rate limiter with a shared store if running many instances (`lib/security/rate-limit.ts`)
- [ ] Notification email channel wired if needed (`lib/notifications/service.ts`)
