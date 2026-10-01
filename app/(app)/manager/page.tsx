import { requireRole } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadCohort, pendingFor } from "@/lib/services/cohort";
import { Card, PageHeader, Stat } from "@/components/ui";
import { CohortTable } from "@/components/staff/CohortTable";

export const metadata = { title: "Readiness dashboard" };
export const dynamic = "force-dynamic";

export default async function ManagerDashboard() {
  const s = await requireRole(["REPORTING_BOSS"]);
  const cohort = await loadCohort(await createServerSupabase());
  const decisions = cohort.flatMap((c) => pendingFor(c, "REPORTING_BOSS").map((p) => ({ ...p, kam: c.employee.full_name, id: c.employee.id })));
  const bands = { GREEN: 0, AMBER: 0, RED: 0 } as Record<string, number>;
  for (const c of cohort) if (c.metrics.band) bands[c.metrics.band]++;
  return (
    <>
      <PageHeader eyebrow={`Welcome, ${s.profile.full_name.split(" ")[0]}`} title="Readiness dashboard" subtitle="You are the final decision-maker for progression, guided pricing exposure, guided customer ownership and the Day-30 readiness sign-off. Every decision is recorded with your reasons." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="KAMs" value={cohort.length} />
        <Stat label="Decisions waiting" value={decisions.length} tone={decisions.length ? "warn" : undefined} />
        <Stat label="Green" value={bands.GREEN} tone="ok" />
        <Stat label="Amber" value={bands.AMBER} tone={bands.AMBER ? "warn" : undefined} />
        <Stat label="Red" value={bands.RED} tone={bands.RED ? "bad" : undefined} />
      </div>
      <Card title="Decisions waiting on you">{decisions.length ? <ul className="divide-y divide-line">{decisions.map((p, i) => <li key={i} className="flex items-center justify-between py-2 text-sm"><span><span className="font-medium">{p.kam}</span> — {p.label}</span><a href={`/people/${p.id}#decisions`} className="btn-primary btn-sm">Review evidence</a></li>)}</ul> : <p className="text-sm text-ink-muted">No decisions pending.</p>}</Card>
      <div className="mt-6"><Card title="Assigned KAMs — readiness"><CohortTable rows={cohort} pending={(c) => pendingFor(c, "REPORTING_BOSS")} showExposure /></Card></div>
    </>
  );
}
