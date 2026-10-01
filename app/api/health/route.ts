import { NextResponse } from "next/server";

/** Liveness + configuration check (no secrets returned). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    mistral: !!process.env.MISTRAL_API_KEY,
    intentModel: process.env.HF_MODEL_URL ? "distilbert" : "rules-fallback",
    embeddings: process.env.EMBEDDINGS_PROVIDER ?? "hf-api",
    time: new Date().toISOString(),
  });
}
