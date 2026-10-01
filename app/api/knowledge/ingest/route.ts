import { NextResponse } from "next/server";
import { actionContext, ServiceError } from "@/lib/services/context";
import { extractText, ingestDocument } from "@/lib/services/knowledge";
import { DocumentMetaSchema, firstError } from "@/lib/security/validation";
import { IngestError } from "@/lib/ai/rag/ingest";

export const runtime = "nodejs";
const MAX_BYTES = 8 * 1024 * 1024;

/** POST multipart/form-data: file + metadata fields. HR / Admin only. */
export async function POST(req: Request) {
  try {
    const ctx = await actionContext();
    if (ctx.actor.role !== "HR_ADMIN") return NextResponse.json({ error: "HR / Admin only" }, { status: 403 });
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Attach a file" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "File exceeds 8 MB" }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { text, meta: front } = await extractText(file.name, bytes);
    const fields = Object.fromEntries(["document_key", "name", "category", "topic", "version", "owner", "effective_date", "review_date", "source_url"].map((k) => {
      const fromForm = String(form.get(k) ?? "").trim();
      const fromFile = (front as Record<string, unknown>)[k];
      return [k, fromForm || (fromFile !== undefined ? String(fromFile) : undefined)];
    }));
    const meta = DocumentMetaSchema.safeParse({ ...fields, document_key: (fields.document_key ?? "").toUpperCase(), approved: form.get("approved") === "true" });
    if (!meta.success) return NextResponse.json({ error: firstError(meta.error) }, { status: 400 });
    const out = await ingestDocument(ctx.admin, { ...meta.data, effective_date: meta.data.effective_date || undefined, review_date: meta.data.review_date || undefined, source_url: meta.data.source_url || undefined }, text, ctx.actor);
    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof ServiceError || e instanceof IngestError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[ingest]", (e as Error).message);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
