import Link from "next/link";
import { BookOpen } from "lucide-react";
import { kamSnapshot } from "@/lib/services/page";
import { actionContext } from "@/lib/services/context";
import { getBrief } from "@/lib/services/account";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, PageHeader, Notice, StatusPill } from "@/components/ui";
import { StakeholderMap } from "@/components/kam/Account";
import { AssistantChat } from "@/components/assistant/AssistantChat";

export const metadata = { title: "Customer 360" };
export const dynamic = "force-dynamic";

export default async function Customer360Page() {
  const { snap, error } = await kamSnapshot();
  if (!snap) return <Notice tone="warn" title="Onboarding not available">{error}</Notice>;
  const ctx = await actionContext({ rateLimit: false });
  const { brief, stakeholders } = await getBrief(ctx, snap.employee.id);
  const db = await createServerSupabase();
  const { data: docs } = await db.from("knowledge_documents").select("document_key, name, version, effective_date, owner, topic").in("category", ["Account", "Customers"]).eq("is_current", true).eq("approved", true);
  const c360Review = snap.journey.tasks.find((t) => t.action_ref === "review:CUSTOMER_360");
  return (
    <>
      <PageHeader
        eyebrow={snap.employee.assigned_customer ?? "Assigned customer"}
        title="Customer 360"
        subtitle="Approved account data, your stakeholder map and your account brief. Customer 360 answers come only from approved account documents and your mentor-approved brief."
        actions={<><span className="flex items-center gap-1.5 text-xs text-ink-muted">Mentor review <StatusPill status={c360Review?.availability === "DONE" ? "APPROVED" : "PENDING"} /></span><Link href="/account-brief" className="btn-primary">Account brief</Link></>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Stakeholder map" subtitle="Purchasing, engineering, quality, SCM/plant contacts and internal owners">
            <StakeholderMap employeeId={snap.employee.id} items={stakeholders} editable />
          </Card>
          <Card title="Approved account sources" subtitle="Published by HR / Key Accounts in Knowledge Management">
            {docs?.length ? <ul className="space-y-2">{docs.map((d) => <li key={d.document_key}><Link href={`/knowledge/${d.document_key}`} className="flex gap-2.5 rounded-md border border-line px-3 py-2 hover:bg-canvas"><BookOpen size={15} className="mt-0.5 text-ink-faint" /><span><span className="block text-sm">{d.name}</span><span className="text-[11px] text-ink-muted">Version {d.version}{d.effective_date ? ` · effective ${d.effective_date}` : ""}{d.owner ? ` · owner ${d.owner}` : ""}</span></span></Link></li>)}</ul> : <p className="text-sm text-ink-muted">No approved account documents yet.</p>}
          </Card>
          <Card title="Brief summary" action={<StatusPill status={brief?.status ?? "DRAFT"} />}>
            {brief ? (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {[["Strategic context", brief.strategic_context], ["Supplied parts", brief.supplied_parts], ["Programmes", brief.programmes], ["Pipeline", brief.pipeline], ["Open commitments", brief.open_commitments], ["Lessons learned", brief.lessons_learned]].map(([k, v]) => (
                  <div key={k as string}><dt className="label">{k}</dt><dd className="mt-0.5 whitespace-pre-wrap text-ink-soft">{(v as string) || "—"}</dd></div>
                ))}
              </dl>
            ) : <p className="text-sm text-ink-muted">Start your account brief to build your Customer 360.</p>}
          </Card>
        </div>
        <Card title="Ask about this customer" subtitle="Answers cite approved account sources only">
          <AssistantChat initial={[]} sessionId={null} employeeId={snap.employee.id} compact />
        </Card>
      </div>
    </>
  );
}
