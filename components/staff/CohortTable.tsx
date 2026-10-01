import Link from "next/link";
import type { Snapshot } from "@/lib/services/snapshot";
import { StatusPill, ProgressBar, fmtPct, Empty } from "@/components/ui";
import { phaseLabel } from "@/lib/report/build";

/** Cohort table used by the Mentor, Reporting Boss and HR dashboards. */
export function CohortTable({ rows, pending, showExposure = false }: { rows: Snapshot[]; pending?: (s: Snapshot) => { label: string }[]; showExposure?: boolean }) {
  if (!rows.length) return <Empty title="No KAMs assigned">KAMs appear here once HR assigns them to you.</Empty>;
  return (
    <div className="-mx-5 -my-5 overflow-x-auto">
      <table className="table min-w-[820px]">
        <thead><tr><th>KAM</th><th>Day</th><th>Overall readiness</th><th>Current gate</th><th>Day-15</th><th>Day-21</th><th>Overdue</th>{showExposure && <th>Exposure</th>}<th>Dependency</th>{pending && <th>Waiting on you</th>}</tr></thead>
        <tbody>
          {rows.map((s) => {
            const p = pending?.(s) ?? [];
            const g = s.journey.currentGate;
            return (
              <tr key={s.employee.id}>
                <td><Link href={`/people/${s.employee.id}`} className="font-medium text-accent hover:underline">{s.employee.full_name}</Link><div className="text-[11px] text-ink-muted">{s.employee.employee_code} · {phaseLabel(s.journey.phase)}</div></td>
                <td className="tabular-nums">{s.day}/{s.config.duration}</td>
                <td className="w-40"><div className="mb-1 text-xs tabular-nums">{fmtPct(s.metrics.overallReadiness, 1)}</div><ProgressBar value={s.metrics.overallReadiness} /></td>
                <td>{g ? <><div className="text-xs">Day {g.day} · {g.name}</div><StatusPill status={g.status} /></> : <StatusPill status="APPROVED" />}</td>
                <td>{s.metrics.assessmentScore !== null ? <><div className="text-xs tabular-nums">{s.metrics.assessmentScore}%</div><StatusPill status={s.metrics.band ?? ""} /></> : <span className="text-xs text-ink-faint">—</span>}</td>
                <td className="text-xs tabular-nums">{fmtPct(s.metrics.scenarioScore)}</td>
                <td className={s.metrics.overdueCount ? "font-medium text-bad" : "text-ink-faint"}>{s.metrics.overdueCount}</td>
                {showExposure && <td className="space-y-1"><div className="text-[11px] text-ink-muted">Customer <StatusPill status={s.journey.exposure.customer} /></div><div className="text-[11px] text-ink-muted">Pricing <StatusPill status={s.journey.exposure.pricing} /></div></td>}
                <td className="text-xs">{s.metrics.dependency.direction === "INSUFFICIENT_DATA" ? <span className="text-ink-faint">insufficient data</span> : s.metrics.dependency.direction.toLowerCase()}</td>
                {pending && <td className="text-xs">{p.length ? <ul className="space-y-0.5">{p.slice(0, 3).map((x) => <li key={x.label} className="text-warn">• {x.label}</li>)}{p.length > 3 && <li className="text-ink-faint">+{p.length - 3} more</li>}</ul> : <span className="text-ink-faint">Nothing</span>}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
