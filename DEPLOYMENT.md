# Deployment

Production runs on **Vercel** (Next.js) + **Supabase** (Postgres, Auth, pgvector, Realtime), with optional external AI services:

```
Browser ──► Vercel (Next.js server actions / API routes, Node runtime)
               ├──► Supabase (anon key + user JWT → RLS;  service role → system writes)
               ├──► Mistral API (generation)            MISTRAL_API_KEY
               ├──► Hugging Face Inference (MiniLM)     HF_API_TOKEN
               └──► DistilBERT endpoint (intents)       HF_MODEL_URL
```

No component depends on a developer laptop or a local Python process. Every external AI dependency has a deterministic fallback (rule router, full-text retrieval, extractive cited answers), so the app keeps working — more conservatively — if one is down.

Step-by-step: **[docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md)** and **[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)**.

`vercel.json` sets the framework, region (`bom1`), and longer timeouts for the assistant and document-ingest routes. `next.config.ts` ships the plain-text prompt templates with the serverless bundle and sets security headers.
