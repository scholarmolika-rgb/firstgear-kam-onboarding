import Link from "next/link";
import { kamSnapshot } from "@/lib/services/page";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, PageHeader, Notice, StatusPill, fmtDate } from "@/components/ui";
import { PillarBars, TrendLine } from "@/components/charts";
import { StartAssessmentButton } from "@/components/kam/Assessment";

export const metadata = { title: "Assessments" };
export const dynamic = "force-dynamic";

export default async function AssessmentsPage() {
  const { snap, error } = await kamSnapshot();
  if (!snap) return <Notice tone="warn" title="Onboarding not available">{error}</Notice>;
  const db = await createServerSupabase();
  const { data: list } = await db.from("assessments").select("id, code, title, description, stage, time_limit_minutes").eq("is_active", true).order("available_from_day");
  const j = snap.journey;
  const cfg = snap.config;
  const avail = (stage: string) => stage === "DAY10_CHECK" ? j.day10Available : stage === "DAY15_READINESS" ? j.day15Available : { available: true, reason: null };
  const day15 = snap.attempts.filter((a) => a.stage === "DAY15_READINESS" && a.overall_score !== null);
  return (
    <>
      <PageHeader title="Assessments" subtitle={`Day-15 weighting: Governance ${cfg.weights.GOVERNANCE}% · People ${cfg.weights.PEOPLE}% · Process ${cfg.weights.PROCESS}% · Product ${cfg.weights.PRODUCT}%. Green ≥ ${cfg.greenThreshold}%, Amber ${cfg.amberThreshold}–${cfg.greenThreshold - 1}%, Red < ${cfg.amberThreshold}%.`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {(list ?? []).map((a) => {
            const av = avail(a.stage) as { available: boolean; reason: string | null; isRecheck?: boolean };
            const attempts = snap.attempts.filter((x) => x.code === a.code);
            const open = attempts.find((x) => x.status === "IN_PROGRESS");
            return (
              <Card key={a.code} title={a.title} subtitle={a.description} action={open ? <StatusPill status="IN_PROGRESS" /> : attempts.at(-1)?.band ? <StatusPill status={attempts.at(-1)!.band!} /> : null}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-ink-muted">
                    {a.time_limit_minutes ? `Suggested time ${a.time_limit_minutes} min · ` : ""}
                    {attempts.filter((x) => x.status !== "IN_PROGRESS").length} attempt(s)
                    {av.available ? "" : <> · <span className="text-ink-soft">{av.reason}</span></>}
                  </div>
                  {open ? <Link href={`/assessments/${open.id}`} className="btn-primary btn-sm">Resume</Link>
                    : av.available ? <StartAssessmentButton code={a.code} label={av.isRecheck ? "Start re-check" : a.stage === "PRACTICE" ? "Practise" : "Start"} />
                    : <button className="btn-secondary btn-sm" disabled>Locked</button>}
                </div>
                {attempts.filter((x) => x.status !== "IN_PROGRESS").length > 0 && (
                  <table className="table mt-4">
                    <thead><tr><th>Attempt</th><th>Submitted</th><th>Score</th><th>Band</th><th /></tr></thead>
                    <tbody>{attempts.filter((x) => x.status !== "IN_PROGRESS").map((x) => (
                      <tr key={x.id}><td>#{x.attempt_number}{x.is_recheck ? " (re-check)" : ""}</td><td>{fmtDate(x.submitted_at, true)}</td><td className="tabular-nums">{x.overall_score}%</td><td>{x.band ? <StatusPill status={x.band} /> : "—"}</td><td><Link href={`/assessments/${x.id}`} className="link text-xs">Review</Link></td></tr>
                    ))}</tbody>
                  </table>
                )}
              </Card>
            );
          })}
        </div>
        <div className="space-y-6">
          <Card title="Latest pillar scores"><PillarBars scores={snap.day15Pillars} threshold={cfg.greenThreshold} weights={cfg.weights} /></Card>
          <Card title="Assessment trend"><TrendLine label="Day-15 score" points={day15.map((a) => ({ label: `#${a.attempt_number}`, value: a.overall_score }))} /></Card>
        </div>
      </div>
    </>
  );
}
