/** Lightweight SVG charts — server-rendered, no chart library, accessible labels. */
import { cn } from "@/components/ui";
import { CheckCircle2, Circle, CircleDot, XCircle, Ban, Hourglass } from "lucide-react";

const PILLAR_ORDER = ["GOVERNANCE", "PEOPLE", "PROCESS", "PRODUCT"] as const;
const PILLAR_NAME: Record<string, string> = { GOVERNANCE: "Governance", PEOPLE: "People", PROCESS: "Process", PRODUCT: "Product" };

/** Pillar bars (Governance ████████░░). Shows the threshold line. */
export function PillarBars({ scores, threshold = 80, weights }: { scores: Record<string, number> | null; threshold?: number; weights?: Record<string, number> }) {
  return (
    <div className="space-y-3">
      {PILLAR_ORDER.map((p) => {
        const v = scores?.[p];
        const tone = v === undefined ? "bg-line-strong" : v >= threshold ? "bg-ok" : v >= 60 ? "bg-warn" : "bg-bad";
        return (
          <div key={p}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="font-medium text-ink-soft">{PILLAR_NAME[p]}{weights && <span className="ml-1 font-normal text-ink-faint">· weight {weights[p]}%</span>}</span>
              <span className="tabular-nums text-ink">{v === undefined ? "Not assessed" : `${v}%`}</span>
            </div>
            <div className="relative h-2.5 rounded-full bg-line" aria-label={`${PILLAR_NAME[p]} ${v ?? "not assessed"}`}>
              <div className={cn("h-full rounded-full", tone)} style={{ width: `${v ?? 0}%` }} />
              <div className="absolute top-[-3px] h-[16px] w-px bg-ink-faint" style={{ left: `${threshold}%` }} title={`Threshold ${threshold}%`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Four-axis radar for pillar scores. */
export function PillarRadar({ scores, size = 200 }: { scores: Record<string, number> | null; size?: number }) {
  const c = size / 2;
  const r = c - 28;
  const ang = (i: number) => -Math.PI / 2 + (i * Math.PI) / 2;
  const pt = (i: number, v: number) => [c + Math.cos(ang(i)) * r * (v / 100), c + Math.sin(ang(i)) * r * (v / 100)];
  const poly = PILLAR_ORDER.map((p, i) => pt(i, scores?.[p] ?? 0).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-auto w-full max-w-[220px]" role="img" aria-label="Pillar radar">
      {[25, 50, 75, 100].map((g) => (
        <polygon key={g} points={PILLAR_ORDER.map((_, i) => pt(i, g).join(",")).join(" ")} fill="none" className="stroke-line" />
      ))}
      {PILLAR_ORDER.map((_, i) => <line key={i} x1={c} y1={c} x2={pt(i, 100)[0]} y2={pt(i, 100)[1]} className="stroke-line" />)}
      <polygon points={poly} className="fill-accent/10 stroke-accent" strokeWidth={1.5} />
      {PILLAR_ORDER.map((p, i) => {
        const [x, y] = pt(i, 122);
        return <text key={p} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="10" className="fill-ink-muted">{PILLAR_NAME[p]}</text>;
      })}
    </svg>
  );
}

/** Minimal line chart for trends. Null points are gaps (no invented data). */
export function TrendLine({ points, height = 90, max = 100, label, suffix = "%" }: { points: { label: string; value: number | null }[]; height?: number; max?: number; label: string; suffix?: string }) {
  const w = 300;
  const pad = 6;
  const valid = points.filter((p) => p.value !== null);
  if (valid.length < 2) {
    return <div className="flex h-[90px] items-center justify-center rounded-md border border-dashed border-line text-xs text-ink-muted">{valid.length ? `${label}: one data point (${valid[0].value}${suffix})` : `No ${label.toLowerCase()} data recorded yet`}</div>;
  }
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
  const y = (v: number) => height - pad - (v / max) * (height - pad * 2);
  const segs: string[] = [];
  let cur = "";
  points.forEach((p, i) => {
    if (p.value === null) { if (cur) segs.push(cur); cur = ""; return; }
    cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
  });
  if (cur) segs.push(cur);
  const last = valid.at(-1)!;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${height}`} className="h-[90px] w-full" role="img" aria-label={`${label} trend`} preserveAspectRatio="none">
        <line x1={pad} x2={w - pad} y1={y(max / 2)} y2={y(max / 2)} className="stroke-line" strokeDasharray="3 3" />
        {segs.map((d, i) => <path key={i} d={d} fill="none" className="stroke-accent" strokeWidth={1.8} vectorEffect="non-scaling-stroke" />)}
        {points.map((p, i) => p.value !== null && <circle key={i} cx={x(i)} cy={y(p.value)} r={2.5} className="fill-accent" />)}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-ink-faint"><span>{points[0].label}</span><span className="text-ink-soft">Latest {last.value}{suffix}</span><span>{points.at(-1)!.label}</span></div>
    </div>
  );
}

/** Dependency bars per 5-day block: dependent vs independent recorded events. */
export function DependencyBars({ series }: { series: { label: string; dependent: number; independent: number; index: number | null }[] }) {
  const max = Math.max(1, ...series.map((s) => s.dependent + s.independent));
  return (
    <div className="flex h-[96px] items-end gap-2" role="img" aria-label="Dependency events by block">
      {series.map((s) => (
        <div key={s.label} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full max-w-[34px] flex-col-reverse overflow-hidden rounded-sm" style={{ height: 70 }}>
            <div className="bg-warn/70" style={{ height: `${(s.dependent / max) * 70}px` }} title={`${s.dependent} support/escalation events`} />
            <div className="bg-ok/70" style={{ height: `${(s.independent / max) * 70}px` }} title={`${s.independent} independent resolutions`} />
          </div>
          <span className="text-[10px] text-ink-faint">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

const GATE_ICON: Record<string, React.ReactNode> = {
  PASSED: <CheckCircle2 size={16} className="text-ok" />, APPROVED: <CheckCircle2 size={16} className="text-ok" />,
  FAILED: <XCircle size={16} className="text-bad" />, BLOCKED: <Ban size={16} className="text-bad" />,
  SUBMITTED: <Hourglass size={16} className="text-warn" />, REQUIRES_REVIEW: <Hourglass size={16} className="text-warn" />, EXTENDED: <Hourglass size={16} className="text-warn" />,
  IN_PROGRESS: <CircleDot size={16} className="text-accent" />, NOT_STARTED: <Circle size={16} className="text-ink-faint" />,
};

/** Gate timeline: Day 15 ● Day 21 ○ Day 30 ○ */
export function GateTimeline({ gates, compact }: { gates: { code: string; name: string; day: number; status: string; score: number | null; nextAction?: string }[]; compact?: boolean }) {
  return (
    <ol className={cn("relative", compact ? "flex items-start justify-between gap-1" : "space-y-4")}>
      {compact && <div className="absolute left-4 right-4 top-[11px] h-px bg-line-strong" aria-hidden />}
      {gates.map((g) => (
        <li key={g.code} className={cn("relative", compact ? "z-10 flex flex-1 flex-col items-center text-center" : "flex gap-3")}>
          <div className={cn("flex items-center justify-center rounded-full bg-surface", compact ? "h-6 w-6" : "mt-0.5 h-6 w-6 shrink-0")}>{GATE_ICON[g.status] ?? <Circle size={16} />}</div>
          {compact ? (
            <div className="mt-1">
              <div className="text-[11px] font-semibold text-ink-soft">Day {g.day}</div>
              <div className="text-[10px] text-ink-muted">{g.status.replace(/_/g, " ").toLowerCase()}</div>
            </div>
          ) : (
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink">Day {g.day} · {g.name}{g.score !== null && <span className="ml-2 tabular-nums text-ink-muted">{g.score}%</span>}</div>
              <div className="text-xs text-ink-muted">{g.status.replace(/_/g, " ").toLowerCase()}{g.nextAction ? ` — ${g.nextAction}` : ""}</div>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Ring for a single percentage. */
export function Ring({ value, size = 92, label }: { value: number; size?: number; label: string }) {
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} ${v}%`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} className="stroke-line" strokeWidth={6} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} className="stroke-accent" strokeWidth={6} fill="none" strokeDasharray={`${(v / 100) * c} ${c}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size / 4.6} fontWeight={600} className="fill-ink">{Math.round(v)}%</text>
    </svg>
  );
}
