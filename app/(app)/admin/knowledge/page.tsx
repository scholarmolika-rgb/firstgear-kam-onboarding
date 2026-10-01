import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, PageHeader, StatusPill, fmtDate } from "@/components/ui";
import { UploadForm, ApprovalToggle, ReindexButton } from "@/components/admin/Knowledge";

export const metadata = { title: "Knowledge management" };
export const dynamic = "force-dynamic";

export default async function KnowledgeAdmin() {
  await requireRole(["HR_ADMIN"]);
  const db = await createServerSupabase();
  const { data: docs } = await db.from("knowledge_documents").select("id, document_key, name, category, version, owner, effective_date, review_date, approved, is_current, status, chunk_count, embedding_model, indexed_at, updated_at").order("document_key").order("created_at", { ascending: false });
  const today = new Date().toISOString().slice(0, 10);
  const keys = Array.from(new Set((docs ?? []).map((d) => d.document_key)));
  return (
    <>
      <PageHeader title="Knowledge management" subtitle="Upload → extract → clean → chunk → metadata → MiniLM embedding → pgvector. Only approved, current versions are retrievable. A new version supersedes the old one, which is kept for history — policies are never silently replaced." actions={<ReindexButton />} />
      <div className="grid gap-6 xl:grid-cols-[1fr_440px]">
        <Card title="Documents & versions">
          <div className="-mx-5 -my-5 overflow-x-auto">
            <table className="table min-w-[820px]">
              <thead><tr><th>Document</th><th>Version</th><th>Status</th><th>Effective · review</th><th>Index</th><th /></tr></thead>
              <tbody>{(docs ?? []).map((d) => (
                <tr key={d.id} className={d.is_current ? "" : "opacity-60"}>
                  <td><Link href={`/knowledge/${d.document_key}`} className="font-medium text-accent hover:underline">{d.name}</Link><div className="text-[11px] text-ink-muted">{d.document_key} · {d.category}{d.owner ? ` · ${d.owner}` : ""}</div></td>
                  <td className="text-xs">v{d.version}</td>
                  <td><StatusPill status={d.is_current ? (d.approved ? "APPROVED" : "DRAFT") : "SUPERSEDED"} /></td>
                  <td className="text-xs">{d.effective_date ?? "—"}<div className={d.review_date && d.review_date < today && d.is_current ? "font-medium text-bad" : "text-ink-faint"}>{d.review_date ? `review ${d.review_date}${d.review_date < today ? " — overdue" : ""}` : ""}</div></td>
                  <td className="text-[11px] text-ink-muted">{d.chunk_count} chunks<div>{d.embedding_model ?? "—"}</div><div>{fmtDate(d.indexed_at)}</div></td>
                  <td><ApprovalToggle id={d.id} approved={d.approved} current={d.is_current} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
        <Card title="Upload a document or new version"><UploadForm existingKeys={keys} /></Card>
      </div>
    </>
  );
}
