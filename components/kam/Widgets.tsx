import Link from "next/link";
import { AlertTriangle, Info, OctagonAlert, Lock, Ban, CheckCircle2, Hourglass, CircleDot, Circle } from "lucide-react";
import type { Alert } from "@/lib/engine/alerts";
import type { DayView } from "@/lib/engine/journey";
import { cn } from "@/components/ui";

export function AlertCards({ alerts, max = 5 }: { alerts: Alert[]; max?: number }) {
  const list = alerts.slice(0, max);
  if (!list.length) return <p className="text-sm text-ink-muted">Nothing needs your attention right now.</p>;
  return (
    <ul className="space-y-2">
      {list.map((a) => (
        <li key={a.dedupeKey}>
          <Link href={a.link} className={cn("flex gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-canvas", a.severity === "CRITICAL" ? "border-bad/30" : a.severity === "ATTENTION" ? "border-warn/30" : "border-line")}>
            <span className={cn("mt-0.5 shrink-0", a.severity === "CRITICAL" ? "text-bad" : a.severity === "ATTENTION" ? "text-warn" : "text-accent")}>
              {a.severity === "CRITICAL" ? <OctagonAlert size={16} /> : a.severity === "ATTENTION" ? <AlertTriangle size={16} /> : <Info size={16} />}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium leading-snug text-ink">{a.title}</span>
              {a.body && <span className="mt-0.5 block text-xs text-ink-muted">{a.body}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const DAY_STYLE: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
  COMPLETED: { cls: "border-line bg-surface text-ok", icon: <CheckCircle2 size={13} />, label: "Completed" },
  CURRENT: { cls: "border-accent bg-accent text-white", icon: <CircleDot size={13} />, label: "Current" },
  AVAILABLE: { cls: "border-accent/30 bg-surface text-accent", icon: <Circle size={13} />, label: "Available" },
  REQUIRES_REVIEW: { cls: "border-line bg-surface text-warn", icon: <Hourglass size={13} />, label: "Requires review" },
  LOCKED: { cls: "border-line bg-canvas text-ink-faint", icon: <Lock size={12} />, label: "Locked" },
  BLOCKED: { cls: "border-line bg-canvas text-bad", icon: <Ban size={12} />, label: "Blocked" },
  UPCOMING: { cls: "border-line bg-surface text-ink-muted", icon: <Circle size={12} />, label: "Upcoming" },
};

export function JourneyStrip({ days, gateDays, hrefBase = "/journey" }: { days: DayView[]; gateDays: number[]; hrefBase?: string | null }) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10 lg:grid-cols-15">
        {days.map((d) => {
          const st = DAY_STYLE[d.status] ?? DAY_STYLE.UPCOMING;
          const inner = (
            <>
              <span className="text-[10px] font-medium opacity-80">Day</span>
              <span className="text-sm font-semibold tabular-nums leading-none">{d.day}</span>
              <span className="mt-0.5" aria-hidden>{st.icon}</span>
              {gateDays.includes(d.day) && <span className="absolute -right-1 -top-1 rounded bg-ink-soft px-1 text-[8px] font-semibold tracking-wide text-white">GATE</span>}
            </>
          );
          const cls = cn("relative flex h-[66px] flex-col items-center justify-center rounded-md border", st.cls, d.isToday && d.status !== "CURRENT" && "ring-2 ring-accent ring-offset-1");
          const title = `Day ${d.day}: ${st.label}${d.total ? ` — ${d.done}/${d.total} tasks` : ""}${d.isToday ? " (today)" : ""}`;
          return hrefBase ? <Link key={d.day} href={`${hrefBase}/${d.day}`} className={cn(cls, "hover:shadow-sm")} title={title} aria-label={title}>{inner}</Link> : <div key={d.day} className={cls} title={title}>{inner}</div>;
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        {Object.entries(DAY_STYLE).map(([k, v]) => <span key={k} className="inline-flex items-center gap-1"><span className={cn("inline-flex h-4 w-4 items-center justify-center rounded border", v.cls)}>{v.icon}</span>{v.label}</span>)}
      </div>
    </div>
  );
}
