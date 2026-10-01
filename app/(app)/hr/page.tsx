import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadCohort, pendingFor } from "@/lib/services/cohort";
import { Card, PageHeader, Stat, fmtPct } from "@/components/ui";
import { CohortTable } from "@/components/staff/CohortTable";
import { PILLARS, PILLAR_LABEL } from "@/types/domain";

export const metadata = { title: "HR dashboard" };
export const dynamic = "force-dynamic";

export default async function HrDashboard() {
  await requireRole(["HR_ADMIN"]);
  const db = await createServerSupabase();
  const cohort = await loadCohort(db);
  const bands = { GREEN: 0, AMBER: 0, RED: 0 } as Record<string, number>;
  for (const c of cohort) if (c.metrics.band) bands[c.metrics.band]++;
  const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x !== null); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };
  const pillarAvg = Object.fromEntries(PILLARS.map((p) => [p, avg(cohort.map((c) => c.day15Pillars?.[p] ?? null))]));
  const gateCounts = ["G1", "G2", "G3", "G4", "G5"].map((code) => ({ code, cleared: cohort.filter((c) => ["PASSED", "APPROVED"].includes(c.journey.gates.find((g) => g.code === code)?.status ?? "")).length }));
  const depTrend = cohort.reduce((acc, c) => { acc[c.metrics.dependency.direction] = (acc[c.metrics.dependency.direction] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const { count: docCount } = await db.from("knowledge_documents").select("id", { count: "exact", head: true }).eq("is_current", true).eq("approved", true);
  return (
    <>
      <PageHeader title="HR dashboard" subtitle="Cohort progress, readiness bands, overdue work and dependency trends. Configure the programme, content and people from the Programme section." actions={<><Link href="/admin/employees" className="btn-secondary">Employees</Link><Link href="/admin/config" className="btn-primary">Programme configuration</Link></>} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Active KAMs" value={cohort.length} />
        <Stat label="Avg readiness" value={fmtPct(avg(cohort.map((c) => c.metrics.overallReadiness)), 1)} />
        <Stat label="Green / Amber / Red" value={<span><span className="text-ok">{bands.GREEN}</span> / <span className="text-warn">{bands.AMBER}</span> / <span className="text-bad">{bands.RED}</span></span>} />
        <Stat label="Overdue tasks" value={cohort.reduce((a, c) => a + c.metrics.overdueCount, 0)} tone="bad" />
        <Stat label="Reassessments" value={cohort.reduce((a, c) => a + c.metrics.reassessmentCount, 0)} />
        <Stat label="Approved documents" value={docCount ?? 0} />
      </div>
      <Card title="Cohort"><CohortTable rows={cohort} pending={(c) => pendingFor(c, "HR_ADMIN")} showExposure /></Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Average Day-15 pillar scores">
          <ul className="space-y-2 text-sm">{PILLARS.map((p) => <li key={p} className="flex justify-between"><span>{PILLAR_LABEL[p]}</span><span className="tabular-nums">{fmtPct(pillarAvg[p], 1)}</span></li>)}</ul>
        </Card>
        <Card title="Gates cleared"><ul className="space-y-2 text-sm">{gateCounts.map((g) => <li key={g.code} className="flex justify-between"><span>{g.code}</span><span className="tabular-nums">{g.cleared} / {cohort.length}</span></li>)}</ul></Card>
        <Card title="Dependency trends"><ul className="space-y-2 text-sm">{Object.entries(depTrend).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k.replace("_", " ").toLowerCase()}</span><span className="tabular-nums">{v}</span></li>)}</ul><p className="mt-3 text-[11px] text-ink-faint">Calculated only from recorded support and escalation events.</p></Card>
      </div>
    </>
  );
}
