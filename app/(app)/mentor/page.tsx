import { requireRole } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadCohort, pendingFor } from "@/lib/services/cohort";
import { Card, PageHeader, Stat } from "@/components/ui";
import { CohortTable } from "@/components/staff/CohortTable";
import { StaffAssistant } from "@/components/assistant/StaffAssistant";
import { helpText } from "@/lib/ai/staff/guide";
import { staffSuggestions } from "@/lib/ai/staff/suggestions";
import { PILLAR_LABEL, type Pillar } from "@/types/domain";

export const metadata = { title: "Mentor dashboard" };
export const dynamic = "force-dynamic";

export default async function MentorDashboard() {
  const s = await requireRole(["MENTOR"]);
  const cohort = await loadCohort(await createServerSupabase());
  const pending = cohort.flatMap((c) => pendingFor(c, "MENTOR").map((p) => ({ ...p, kam: c.employee.full_name, id: c.employee.id })));
  const weak = cohort.flatMap((c) => Object.entries(c.day15Pillars ?? {}).filter(([, v]) => v < c.config.greenThreshold).map(([p, v]) => ({ kam: c.employee.full_name, id: c.employee.id, pillar: PILLAR_LABEL[p as Pillar], v })));
  return (
    <>
      <PageHeader eyebrow={`Welcome, ${s.profile.full_name.split(" ")[0]}`} title="Mentor dashboard" subtitle="Your assigned KAMs, their weak pillars and everything waiting on your review. Judgement calls reserved for you are never made by the AI." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Assigned KAMs" value={cohort.length} />
        <Stat label="Waiting on you" value={pending.length} tone={pending.length ? "warn" : undefined} />
        <Stat label="Weak pillars" value={weak.length} tone={weak.length ? "warn" : undefined} />
        <Stat label="Overdue (all KAMs)" value={cohort.reduce((a, c) => a + c.metrics.overdueCount, 0)} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card title="Assigned KAMs"><CohortTable rows={cohort} pending={(c) => pendingFor(c, "MENTOR")} /></Card>
        <Card title="Ask Compass" subtitle="How to support your KAMs — in one question"><StaffAssistant compact suggestions={await staffSuggestions("MENTOR")} intro={helpText("MENTOR")} /></Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Review queue">{pending.length ? <ul className="divide-y divide-line">{pending.map((p, i) => <li key={i} className="flex items-center justify-between py-2 text-sm"><span><span className="font-medium">{p.kam}</span> — {p.label}</span><a href={`/people/${p.id}`} className="btn-secondary btn-sm">Open</a></li>)}</ul> : <p className="text-sm text-ink-muted">Nothing waiting on you.</p>}</Card>
        <Card title="Areas needing reinforcement">{weak.length ? <ul className="divide-y divide-line">{weak.map((w, i) => <li key={i} className="flex justify-between py-2 text-sm"><span>{w.kam} — {w.pillar}</span><span className="tabular-nums text-warn">{w.v}%</span></li>)}</ul> : <p className="text-sm text-ink-muted">No pillar below threshold.</p>}</Card>
      </div>
    </>
  );
}
