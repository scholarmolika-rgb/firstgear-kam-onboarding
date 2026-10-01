import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseFrontMatter, type DocMeta } from "@/lib/ai/rag/chunker";
import { getEmbedder, toPgVector, EMBEDDING_MODEL } from "@/lib/ai/rag/embeddings";
import { audit } from "./audit";
import { ServiceError } from "./context";
import type { Role } from "@/types/domain";

/** Extracts text from an uploaded file. PDF pages are marked "[page N]" so citations can show page numbers. */
export async function extractText(fileName: string, bytes: Uint8Array): Promise<{ text: string; meta: Partial<DocMeta> }> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await pdfText(pdf, { mergePages: false });
    const pages = (Array.isArray(text) ? text : [text]).map((t, i) => `[page ${i + 1}]\n${t}`);
    return { text: pages.join("\n\n"), meta: {} };
  }
  if (lower.endsWith(".md") || lower.endsWith(".txt") || lower.endsWith(".markdown")) {
    const raw = new TextDecoder().decode(bytes);
    const { meta, body } = parseFrontMatter(raw);
    return { text: body, meta };
  }
  throw new ServiceError("Supported formats: PDF, Markdown (.md) or text (.txt).");
}

export { ingestDocument, type IngestResult } from "@/lib/ai/rag/ingest";

/** Approve / withdraw a document version. Only current versions are retrievable. */
export async function setDocumentApproval(admin: SupabaseClient, documentId: string, approved: boolean, actor: { id: string; role: Role }) {
  const { data: doc } = await admin.from("knowledge_documents").select("id, approved, is_current, name, version").eq("id", documentId).maybeSingle();
  if (!doc) throw new ServiceError("Document not found.");
  if (!doc.is_current && approved) throw new ServiceError("Only the current version can be approved; upload a new version instead.");
  await admin.from("knowledge_documents").update({ approved, status: approved ? "APPROVED" : "DRAFT" }).eq("id", documentId);
  await admin.from("knowledge_chunks").update({ approved }).eq("document_id", documentId);
  await audit(admin, { actor, event: "DOCUMENT_APPROVAL_CHANGED", entityType: "knowledge_document", entityId: documentId, previous: { approved: doc.approved }, next: { approved, name: doc.name, version: doc.version } });
}

/** Re-embeds every current chunk (after switching embedding provider). */
export async function reindexAll(admin: SupabaseClient, actor: { id: string; role: Role } | null) {
  const embedder = getEmbedder();
  if (!embedder) throw new ServiceError("No embedding provider configured (EMBEDDINGS_PROVIDER / HF_API_TOKEN).");
  const { data: chunks } = await admin.from("knowledge_chunks").select("id, content").eq("is_current", true);
  const list = chunks ?? [];
  for (let i = 0; i < list.length; i += 32) {
    const batch = list.slice(i, i + 32);
    const vecs = await embedder.embed(batch.map((c) => c.content));
    for (let j = 0; j < batch.length; j++) await admin.from("knowledge_chunks").update({ embedding: toPgVector(vecs[j]) }).eq("id", batch[j].id);
  }
  await admin.from("knowledge_documents").update({ embedding_model: EMBEDDING_MODEL, indexed_at: new Date().toISOString() }).eq("is_current", true);
  await audit(admin, { actor, event: "POLICY_UPDATED", entityType: "knowledge_index", next: { reindexed_chunks: list.length, model: EMBEDDING_MODEL } });
  return list.length;
}
