/**
 * Ingest pipeline core (no Next.js dependencies, so the seed/ingest scripts
 * can use it too): clean → chunk → metadata → MiniLM embed → store, with
 * version supersession.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkDocument, cleanText, type DocMeta } from "./chunker";
import { getEmbedder, toPgVector, EMBEDDING_MODEL } from "./embeddings";

export class IngestError extends Error {}

type Actor = { id: string; role: string } | null;

export interface IngestResult { documentId: string; chunks: number; embedded: boolean; supersededId: string | null; version: string }

/**
 * Upload → clean → chunk → metadata → MiniLM embed → store.
 * Versioning: a new version of an existing document_key supersedes the current
 * one (kept for history, removed from retrieval). Re-uploading the same
 * version is rejected — policies are never silently replaced.
 */
export async function ingestDocument(admin: SupabaseClient, meta: DocMeta, rawText: string, actor: Actor): Promise<IngestResult> {
  const content = cleanText(rawText);
  if (content.length < 50) throw new IngestError("The document has too little text to index.");
  const { data: same } = await admin.from("knowledge_documents").select("id").eq("document_key", meta.document_key).eq("version", meta.version).maybeSingle();
  if (same) throw new IngestError(`Version ${meta.version} of ${meta.document_key} already exists. Upload with a new version number.`);
  const { data: current } = await admin.from("knowledge_documents").select("id, version").eq("document_key", meta.document_key).eq("is_current", true).maybeSingle();

  if (current) {
    await admin.from("knowledge_documents").update({ is_current: false, status: "SUPERSEDED" }).eq("id", current.id);
    await admin.from("knowledge_chunks").update({ is_current: false }).eq("document_id", current.id);
  }
  const approved = meta.approved === true;
  const { data: doc, error } = await admin.from("knowledge_documents").insert({
    document_key: meta.document_key, name: meta.name, category: meta.category, topic: meta.topic ?? null, version: meta.version,
    owner: meta.owner ?? null, effective_date: meta.effective_date || null, review_date: meta.review_date || null, source_url: meta.source_url || null,
    approved, is_current: true, status: approved ? "APPROVED" : "DRAFT", supersedes_id: current?.id ?? null, content,
    uploaded_by: actor?.id ?? null,
  }).select("id, updated_at").single();
  if (error || !doc) {
    if (current) await admin.from("knowledge_documents").update({ is_current: true, status: "APPROVED" }).eq("id", current.id);
    throw new IngestError(`Could not store the document: ${error?.message ?? "unknown error"}`);
  }

  const chunks = chunkDocument(content);
  const embedder = getEmbedder();
  let vectors: number[][] | null = null;
  if (embedder) {
    try { vectors = await embedder.embed(chunks.map((c) => c.content)); }
    catch (e) { console.warn(`[ingest] embeddings unavailable (${(e as Error).message}); stored for full-text retrieval only.`); }
  }
  const rows = chunks.map((c, i) => ({
    document_id: doc.id, chunk_index: c.chunk_index, content: c.content, section: c.section, page: c.page, token_count: c.token_count,
    document_name: meta.name, category: meta.category, topic: meta.topic ?? null, version: meta.version, owner: meta.owner ?? null,
    effective_date: meta.effective_date || null, source_url: meta.source_url || null, approved, is_current: true,
    last_updated: doc.updated_at, embedding: vectors ? toPgVector(vectors[i]) : null,
  }));
  for (let i = 0; i < rows.length; i += 100) {
    const { error: cErr } = await admin.from("knowledge_chunks").insert(rows.slice(i, i + 100));
    if (cErr) throw new IngestError(`Could not index chunks: ${cErr.message}`);
  }
  await admin.from("knowledge_documents").update({ chunk_count: rows.length, indexed_at: new Date().toISOString(), embedding_model: vectors ? EMBEDDING_MODEL : "fts-only" }).eq("id", doc.id);
  await admin.from("audit_logs").insert({
    actor_id: actor?.id ?? null, actor_role: actor?.role ?? "SYSTEM", event_type: current ? "POLICY_UPDATED" : "DOCUMENT_UPLOADED",
    entity_type: "knowledge_document", entity_id: doc.id,
    previous_value: current ? { id: current.id, version: current.version } : null,
    new_value: { key: meta.document_key, name: meta.name, version: meta.version, approved, chunks: rows.length, embedded: !!vectors },
  });
  return { documentId: doc.id, chunks: rows.length, embedded: !!vectors, supersededId: current?.id ?? null, version: meta.version };
}

