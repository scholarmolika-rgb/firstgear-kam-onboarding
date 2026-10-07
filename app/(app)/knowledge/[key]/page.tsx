import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, PageHeader, Badge, Notice } from "@/components/ui";
import { DocText } from "@/components/kam/DocText";

export const dynamic = "force-dynamic";

export default async function KnowledgeDoc({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { profile } = await requireSession();
  const db = await createServerSupabase();
  const { data: doc } = await db.from("knowledge_documents").select("*").eq("document_key", decodeURIComponent(key)).eq("is_current", true).maybeSingle();
  if (!doc) notFound();
  return (
    <>
      <Link href="/knowledge" className="link mb-4 inline-flex items-center gap-1 text-sm"><ArrowLeft size={14} />Knowledge</Link>
      <PageHeader eyebrow={doc.category} title={doc.name} actions={<><Badge tone={doc.approved ? "ok" : "warn"}>{doc.approved ? "Approved" : "Draft — not used by the assistant"}</Badge><Badge>Version {doc.version}</Badge></>} />
      {!doc.approved && profile.role !== "HR_ADMIN" && <Notice tone="warn">This document is not approved.</Notice>}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card><DocText text={doc.content} /></Card>
        <Card title="Document control">
          <dl className="space-y-2 text-sm">
            {[["Key", doc.document_key], ["Version", doc.version], ["Effective", doc.effective_date ?? "—"], ["Review by", doc.review_date ?? "—"], ["Owner", doc.owner ?? "—"], ["Topic", doc.topic ?? "—"], ["Indexed chunks", doc.chunk_count], ["Retrieval", doc.embedding_model ?? "—"]].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-3"><dt className="text-ink-muted">{k}</dt><dd className="text-right">{String(v)}</dd></div>
            ))}
          </dl>
          {doc.source_url && <a href={doc.source_url} className="link mt-3 block text-xs" target="_blank" rel="noreferrer">Original source</a>}
        </Card>
      </div>
    </>
  );
}
