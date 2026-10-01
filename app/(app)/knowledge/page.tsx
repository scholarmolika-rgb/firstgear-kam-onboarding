import Link from "next/link";
import { BookOpen } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, PageHeader, Badge, cn } from "@/components/ui";

export const metadata = { title: "Knowledge" };
export const dynamic = "force-dynamic";

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ category?: string; day?: string }> }) {
  const { category, day } = await searchParams;
  await requireSession();
  const db = await createServerSupabase();
  let keys: string[] | null = null;
  if (day) {
    const { data: d } = await db.from("onboarding_days").select("resources").eq("day_number", Number(day)).limit(1).maybeSingle();
    keys = ((d?.resources ?? []) as { document_key: string }[]).map((r) => r.document_key);
  }
  let q = db.from("knowledge_documents").select("document_key, name, category, topic, version, owner, effective_date, review_date, chunk_count").eq("is_current", true).eq("approved", true).order("category").order("name");
  if (category) q = q.eq("category", category);
  if (keys) q = q.in("document_key", keys.length ? keys : ["__none__"]);
  const { data: docs } = await q;
  const { data: cats } = await db.from("app_settings").select("value").eq("key", "KNOWLEDGE_CATEGORIES").maybeSingle();
  const categories = (cats?.value as string[] | undefined) ?? [];
  return (
    <>
      <PageHeader title="Knowledge" subtitle={day ? `Resources for Day ${day}` : "Approved, current versions of FirstGear SOPs, policies, guides and account data. The assistant answers only from these."} />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/knowledge" className={cn("rounded-full border px-3 py-1 text-xs", !category && !day ? "border-accent bg-accent text-white" : "border-line-strong bg-white")}>All</Link>
        {categories.map((c) => <Link key={c} href={`/knowledge?category=${encodeURIComponent(c)}`} className={cn("rounded-full border px-3 py-1 text-xs", category === c ? "border-accent bg-accent text-white" : "border-line-strong bg-white")}>{c}</Link>)}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(docs ?? []).map((d) => (
          <Link key={d.document_key} href={`/knowledge/${d.document_key}`} className="card card-pad flex gap-3 hover:shadow-md">
            <BookOpen size={18} className="mt-0.5 shrink-0 text-ink-faint" />
            <div className="min-w-0">
              <div className="text-sm font-semibold">{d.name}</div>
              <div className="mt-1 flex flex-wrap gap-1.5"><Badge tone="muted">{d.category}</Badge><Badge tone="muted">v{d.version}</Badge></div>
              <div className="mt-1.5 text-[11px] text-ink-muted">{d.effective_date ? `Effective ${d.effective_date}` : ""}{d.owner ? ` · ${d.owner}` : ""}</div>
            </div>
          </Link>
        ))}
        {!docs?.length && <Card><p className="text-sm text-ink-muted">No approved documents in this view.</p></Card>}
      </div>
    </>
  );
}
