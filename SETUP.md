# Setup guide — GitHub to running app (Windows PowerShell)

Commands are for **Windows PowerShell**. macOS/Linux equivalents are the same except `Copy-Item` → `cp` and `$env:VAR="x"` → `export VAR=x`.

Prerequisites: Node.js 20+ (`node -v`), Git (`git --version`), a free GitHub, Supabase and Vercel account.

## 1. Create a GitHub account
Sign up at https://github.com if you don't have one.

## 2–4. Create and initialise the repository
On GitHub: **New repository** → name **`firstgear-kam-onboarding`** → Private → *do not* add a README (this project has one) → Create.

From the folder containing this project:
```powershell
cd firstgear-kam-onboarding
git init
git add .
git commit -m "FirstGear KAM Onboarding Compass"
git branch -M main
git remote add origin https://github.com/<your-user>/firstgear-kam-onboarding.git
git push -u origin main
```

## 5. Clone (on any other machine)
```powershell
git clone https://github.com/<your-user>/firstgear-kam-onboarding.git
cd firstgear-kam-onboarding
```

## 6. Install dependencies
```powershell
npm install
```

## 7. Configure `.env.local`
```powershell
Copy-Item .env.example .env.local
notepad .env.local
```
Fill in at least `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Optional: `MISTRAL_API_KEY`, `HF_API_TOKEN` (embeddings), `HF_MODEL_URL` (DistilBERT). `.env.local` is git-ignored — never commit it.

## 8–10. Connect Supabase, run migrations, seed
Follow **[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)**. In short:
```powershell
# Option A — Supabase CLI
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push            # applies supabase/migrations/001…004
# Option B — paste each file 001 → 004 into Dashboard → SQL Editor → Run

npx tsx scripts/seed.ts         # demo users + Riya Sharma + sessions + knowledge base
npx tsx scripts/seed.ts --cohort   # optional: adds a second synthetic KAM for cohort views
```

## 11. Run locally
```powershell
npm run dev
```
Open http://localhost:3000.

## 12. Test authentication
Sign in as `riya.sharma@firstgear.example` with your `DEMO_PASSWORD`. You land on **/dashboard**. Sign out (top right) and sign in as `meera.iyer@firstgear.example` — you land on **/manager**. A wrong password shows an error; visiting `/hr` as the KAM redirects you to your own dashboard.

## 13. Test the KAM dashboard
As Riya: header shows **Day 1 of 30**, status **LEARN**, overall readiness, six cards, today's tasks, gates, pillar card ("shown after Day-15") and the 30-day strip with Day 6+ **Locked**.

## 14. Test checkbox persistence
1. Tick **HR orientation** → it turns green and shows "Progress x% · readiness y%".
2. Press F5 → still ticked. Close the browser, sign in again (or on your phone) → still ticked.
3. Untick it → reverts and progress recalculates.
4. As HR, open **Audit log** → `TASK_COMPLETED` and `TASK_REOPENED` entries with actor and timestamps.

## 15. Test an assessment
Assessments → **Practice quiz** → answer → Submit → results with explanations and sources. The Day-10 check unlocks after Days 1–9; the Day-15 assessment after Days 1–14 and a passed Day-10 check (you can tick ahead within an unlocked segment to try the flow).

## 16. Test RAG
Ask FirstGear → "What is the RFQ process?" → answer with **Source: RFQ to Quotation SOP · Section 3.2 · Version 4.1**. Ask "What is the canteen menu?" → "couldn't find enough evidence…" with an **Ask Mentor** button. Ask "Create my SAP account" → politely declined.

Without `HF_API_TOKEN` retrieval runs on Postgres full-text search; with it, MiniLM vectors are used too (re-index from Knowledge management after adding the token).

## 17. Test Mistral
Set `MISTRAL_API_KEY`, restart `npm run dev`, ask a knowledge question. The message footer shows grounding + intent; Settings → *AI services* shows "Mistral Large". Without a key the assistant returns extractive, cited passages instead — it never answers unsourced.

## 18. Deploy to Vercel
Follow **[docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md)**.

## Running the tests
```powershell
npm test               # unit + journey simulation + migrations/RLS (PGlite)
npm run typecheck
npm run build
$env:E2E_BASE_URL="http://localhost:3000"; npx playwright install chromium; npm run test:e2e
```
