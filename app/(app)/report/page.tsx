import { requireSession } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadSnapshot, NoOnboardingError } from "@/lib/services/snapshot";
import { buildReport } from "@/lib/report/build";
import { Card, PageHeader, Notice, StatusPill, Stat, fmtPct } from "@/components/ui";
import { PillarBars, GateTimeline, TrendLine, DependencyBars } from "@/components/charts";
import { ReportExport } from "@/components/staff/ReportExport";

export const metadata = { title: "Progress report" };
export const dynamic = "force-dynamic";

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ employee?: string }> }) {
  const { employee } = await searchParams;
  const s = await requireSession();
  const employeeId = employee ?? s.employeeId;
  if (!employeeId) return <Notice title="Choose a KAM">Open a KAM from your dashboard to generate their progress report.</Notice>;
  const db = await createServerSupabase();
  let snap;
  try { snap = await loadSnapshot(db, employeeId); } catch (e) {
    return <Notice tone="warn" title="Report unavailable">{e instanceof NoOnboardingError ? e.message : "You do not have access to this report."}</Notice>;
  }
  const r = buildReport(snap, s.profile.role);
  const { data: hist } = await db.from("progress_snapshots").select("snapshot_date, day_number, task_completion_pct, overall_readiness").eq("instance_id", snap.instance.id).order("snapshot_date").limit(60);
  const Section = ({ title, items }: { title: string; items: { date: string; text: string }[] }) => (
    <Card title={title}>{items.length ? <ul className="space-y-2 text-sm">{items.map((f, i) => <li key={i}><span className="text-xs text-ink-faint">{f.date}</span><div className="text-ink-soft">{f.text}</div></li>)}</ul> : <p className="text-sm text-ink-muted">None recorded.</p>}</Card>
  );
  return (
    <>
      <PageHeader eyebrow="Progress report" title={r.profile.name} subtitle={`${r.profile.role} · ${r.profile.code} · Reporting Boss ${r.profile.manager} · Mentor ${r.profile.mentor} · joined ${r.profile.joiningDate} (${r.profile.joiningType})`} actions={<ReportExport report={r} employeeId={employeeId} />} />
      <Card title="Executive summary"><p className="text-sm leading-relaxed text-ink-soft">{r.executiveSummary}</p></Card>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Onboarding day" value={`${r.onboarding.currentDay} / ${r.onboarding.duration}`} sub={`${r.onboarding.daysRemaining} days remaining · ${r.onboarding.phase}`} />
        <Stat label="Overall progress" value={fmtPct(r.progress.overallReadiness, 1)} sub={`Tasks ${fmtPct(r.progress.taskCompletionPct)} · learning ${fmtPct(r.progress.learningCompletionPct)}`} />
        <Stat label="Day-15 score" value={fmtPct(r.scores.day15, 1)} sub={r.scores.band ? <StatusPill status={r.scores.band} /> : "Not assessed"} />
        <Stat label="Day-21 scenario score" value={fmtPct(r.scores.day21Scenario, 1)} sub={`${r.scores.reassessments} reassessment(s)`} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Pillar scores"><PillarBars scores={snap.day15Pillars} threshold={snap.config.greenThreshold} weights={snap.config.weights} /></Card>
        <Card title="Gates"><GateTimeline gates={snap.journey.gates} /></Card>
        <Card title="Task completion trend"><TrendLine label="Task completion" points={(hist ?? []).map((h) => ({ label: `D${h.day_number}`, value: Number(h.task_completion_pct) }))} /></Card>
        <Card title="Readiness trend"><TrendLine label="Overall readiness" points={(hist ?? []).map((h) => ({ label: `D${h.day_number}`, value: Number(h.overall_readiness) }))} /></Card>
        <Card title="Dependency trend" subtitle={`${r.dependency.direction.replace("_", " ").toLowerCase()} · ${r.dependency.events} recorded events`}><DependencyBars series={snap.metrics.dependency.series} /></Card>
        <Card title="Knowledge source usage">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="label">Questions asked</dt><dd className="text-xl font-semibold">{r.knowledgeUsage.questions}</dd></div>
            <div><dt className="label">Grounded answers</dt><dd className="text-xl font-semibold">{r.knowledgeUsage.grounded}</dd></div>
            <div><dt className="label">Documents cited</dt><dd className="text-xl font-semibold">{r.knowledgeUsage.distinctDocuments}</dd></div>
            <div><dt className="label">Insufficient evidence</dt><dd className="text-xl font-semibold">{r.knowledgeUsage.insufficient}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-ink-muted">Response quality (mentor ratings): {fmtPct(r.responseQuality)}</p>
        </Card>
        <Card title="Completed & pending gates">
          <div className="label mb-1">Completed</div>
          <ul className="mb-3 text-sm">{r.completedGates.length ? r.completedGates.map((g) => <li key={g}>✓ {g}</li>) : <li className="text-ink-muted">None yet</li>}</ul>
          <div className="label mb-1">Pending</div>
          <ul className="text-sm">{r.pendingGates.map((g) => <li key={g}>○ {g}</li>)}</ul>
        </Card>
        <Card title="Weak pillars, overdue items & recommended actions">
          {r.weakPillars.length > 0 && <p className="mb-2 text-sm"><span className="text-ink-muted">Weak pillars:</span> {r.weakPillars.join(", ")}</p>}
          {r.overdueItems.length > 0 && <ul className="mb-3 space-y-0.5 text-sm text-bad">{r.overdueItems.map((o) => <li key={o.code}>{o.title} — due Day {o.dueDay}</li>)}</ul>}
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft">{r.recommendedActions.map((a) => <li key={a}>{a}</li>)}</ol>
        </Card>
        <Card title="Assessment history">
          {r.assessmentHistory.length ? <table className="table"><thead><tr><th>Assessment</th><th>#</th><th>Score</th><th>Band</th><th>Date</th></tr></thead><tbody>{r.assessmentHistory.map((a, i) => <tr key={i}><td>{a.assessment}</td><td>{a.attempt}</td><td>{fmtPct(a.score)}</td><td>{a.band ? <StatusPill status={a.band} /> : "—"}</td><td>{a.date}</td></tr>)}</tbody></table> : <p className="text-sm text-ink-muted">No attempts yet.</p>}
        </Card>
        <Card title="Scenario performance">
          {r.scenarioPerformance.length ? <table className="table"><thead><tr><th>Scenario</th><th>Type</th><th>Score</th><th>Reviewed</th></tr></thead><tbody>{r.scenarioPerformance.map((x, i) => <tr key={i}><td>{x.scenario}</td><td>{x.certification ? "Certification" : "Practice"}</td><td>{x.score}%</td><td>{x.reviewerScore === null ? "—" : `${x.reviewerScore}%`}</td></tr>)}</tbody></table> : <p className="text-sm text-ink-muted">No attempts yet.</p>}
        </Card>
        <Section title="Mentor feedback" items={r.mentorFeedback} />
        <Section title="Reporting Boss feedback & decisions" items={r.bossFeedback} />
        <Card title="Sessions">{r.sessions.length ? <ul className="space-y-1 text-sm">{r.sessions.map((x, i) => <li key={i} className="flex justify-between gap-2"><span>{x.title} <span className="text-xs text-ink-faint">{x.when}</span></span><StatusPill status={x.status} /></li>)}</ul> : <p className="text-sm text-ink-muted">None.</p>}</Card>
        <Card title="Readiness status">
          <dl className="space-y-2 text-sm">
            <div><dt className="label">Customer readiness</dt><dd>{r.customerReadiness}</dd></div>
            <div><dt className="label">Pricing readiness</dt><dd>{r.pricingReadiness}</dd></div>
            <div><dt className="label">Final Day-30 decision</dt><dd className="font-medium">{r.finalDecision}</dd></div>
          </dl>
        </Card>
      </div>
    </>
  );
}
