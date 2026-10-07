import Link from "next/link";
import { kamSnapshot } from "@/lib/services/page";
import { actionContext } from "@/lib/services/context";
import { listScenariosForKam } from "@/lib/services/scenarios";
import { Card, PageHeader, Notice, Badge, StatusPill } from "@/components/ui";
import { TrendLine } from "@/components/charts";

export const metadata = { title: "Scenario practice" };
export const dynamic = "force-dynamic";

export default async function ScenariosPage() {
  const { snap, error } = await kamSnapshot();
  if (!snap) return <Notice tone="warn" title="Onboarding not available">{error}</Notice>;
  const ctx = await actionContext({ rateLimit: false });
  const scenarios = await listScenariosForKam(ctx);
  const certGate = snap.journey.gates.find((g) => g.code === "G2")!;
  const latest = (code: string) => snap.scenarioAttempts.filter((a) => a.scenario_code === code).at(-1);
  return (
    <>
      <PageHeader title="Scenario practice" subtitle="Practise real KAM situations. Responses are scored against a configured rubric by deterministic rules; AI may assist on wording but never decides authorisation. Day-21 certification uses four of these scenarios." />
      <div className="mb-6 grid gap-4 md:grid-cols-[1fr_320px]">
        <Notice tone={snap.journey.certificationAvailable.available ? "accent" : "neutral"} title={`Day-21 certification: ${certGate.status.replace(/_/g, " ").toLowerCase()}`}>
          {snap.journey.certificationAvailable.available ? certGate.nextAction : snap.journey.certificationAvailable.reason}
          {certGate.score !== null && <> · Average {certGate.score}%{snap.metrics.assessmentScore !== null ? ` vs Day-15 baseline ${snap.metrics.assessmentScore}%` : ""}</>}
        </Notice>
        <Card><TrendLine label="Scenario score" points={snap.scenarioAttempts.map((a, i) => ({ label: `#${i + 1}`, value: a.reviewer_score ?? a.score }))} /></Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {scenarios.map((s) => {
          const l = latest(s.code);
          return (
            <Link key={s.code} href={`/scenarios/${s.code}`} className="card card-pad block hover:shadow-md">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{s.title}</span>
                {s.is_certification && <Badge tone="accent">Day-21 certification</Badge>}
                <Badge tone="muted">{s.pillar.charAt(0) + s.pillar.slice(1).toLowerCase()}</Badge>
              </div>
              <p className="mt-2 line-clamp-3 text-xs text-ink-muted">{s.situation}</p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-ink-faint">{s.rubric.length} rubric criteria</span>
                {l ? <span className="flex items-center gap-2"><span className="tabular-nums font-medium">{l.reviewer_score ?? l.score}%</span><StatusPill status={l.status} /></span> : <span className="text-ink-faint">Not attempted</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
