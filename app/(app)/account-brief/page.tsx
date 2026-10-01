import Link from "next/link";
import { kamSnapshot } from "@/lib/services/page";
import { actionContext } from "@/lib/services/context";
import { getBrief } from "@/lib/services/account";
import { Card, PageHeader, Notice, StatusPill, fmtDate } from "@/components/ui";
import { BriefForm } from "@/components/kam/Account";

export const metadata = { title: "Account brief" };
export const dynamic = "force-dynamic";

export default async function AccountBriefPage() {
  const { snap, error } = await kamSnapshot();
  if (!snap) return <Notice tone="warn" title="Onboarding not available">{error}</Notice>;
  const ctx = await actionContext({ rateLimit: false });
  const { brief, stakeholders } = await getBrief(ctx, snap.employee.id);
  const status = brief?.status ?? "DRAFT";
  const editable = status !== "SUBMITTED";
  return (
    <>
      <PageHeader
        title="Account brief"
        subtitle="Your structured understanding of the assigned customer. Use approved sources only. Once your mentor approves it, the assistant can answer Customer 360 questions from it."
        actions={<><StatusPill status={status} /><Link href="/customer-360" className="btn-secondary">Customer 360 & stakeholders ({stakeholders.length})</Link></>}
      />
      {status === "CHANGES_REQUESTED" && <div className="mb-4"><Notice tone="bad" title="Mentor requested changes">{brief?.review_comments}</Notice></div>}
      {status === "SUBMITTED" && <div className="mb-4"><Notice tone="warn" title="Submitted">Submitted {fmtDate(brief?.submitted_at, true)} — awaiting mentor review. Editing is paused until the review is recorded.</Notice></div>}
      {status === "APPROVED" && <div className="mb-4"><Notice tone="ok" title="Approved by mentor">Version {brief?.version} approved {fmtDate(brief?.reviewed_at, true)}. Editing a key section sends it back for review.</Notice></div>}
      <Card><BriefForm brief={brief} editable={editable} /></Card>
    </>
  );
}
