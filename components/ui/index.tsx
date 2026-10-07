import clsx from "clsx";
import { CheckCircle2, Circle, CircleDot, Lock, Ban, Clock, AlertTriangle, XCircle, Hourglass } from "lucide-react";
import type { ReactNode } from "react";

export function cn(...a: Parameters<typeof clsx>) { return clsx(...a); }

export function Card({ children, className, title, action, subtitle }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <section className={cn("card", className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="h2">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="card-pad">{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="label mb-1.5">{eyebrow}</div>}
        <h1 className="h1">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ok" | "warn" | "bad" | "accent" }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-1.5 text-xs text-ink-muted">{tone && <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", { "bg-ok": tone === "ok", "bg-warn": tone === "warn", "bg-bad": tone === "bad", "bg-accent": tone === "accent" })} />}{label}</div>
      <div className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-muted">{sub}</div>}
    </div>
  );
}

export function ProgressBar({ value, tone = "accent", label, className }: { value: number; tone?: "accent" | "ok" | "warn" | "bad"; label?: string; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("w-full", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div className={cn("h-full rounded-full transition-[width] duration-500", { "bg-accent": tone === "accent", "bg-ok": tone === "ok", "bg-warn": tone === "warn", "bg-bad": tone === "bad" })} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

type Tone = "neutral" | "ok" | "warn" | "bad" | "accent" | "muted";
/** Notices keep a soft tint; badges stay neutral and colour only their icon. */
const toneCls: Record<Tone, string> = {
  neutral: "bg-canvas text-ink-soft border-line",
  ok: "bg-ok-soft text-ok border-ok/15",
  warn: "bg-warn-soft text-warn border-warn/15",
  bad: "bg-bad-soft text-bad border-bad/15",
  accent: "bg-accent-soft text-accent border-accent/15",
  muted: "bg-surface text-ink-muted border-line",
};
const iconCls: Record<Tone, string> = { neutral: "text-ink-faint", ok: "text-ok", warn: "text-warn", bad: "text-bad", accent: "text-accent", muted: "text-ink-faint" };

export function Badge({ children, tone = "neutral", icon, className }: { children: ReactNode; tone?: Tone; icon?: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-soft", className)}>{icon && <span className={cn("inline-flex", iconCls[tone])}>{icon}</span>}{children}</span>;
}

/** Status pill with icon + text, so status never relies on colour alone. */
export function StatusPill({ status }: { status: string }) {
  const s = status.toUpperCase();
  const map: Record<string, { tone: Tone; icon: ReactNode; text: string }> = {
    PASSED: { tone: "ok", icon: <CheckCircle2 size={12} />, text: "Passed" },
    APPROVED: { tone: "ok", icon: <CheckCircle2 size={12} />, text: "Approved" },
    COMPLETED: { tone: "ok", icon: <CheckCircle2 size={12} />, text: "Completed" },
    DONE: { tone: "ok", icon: <CheckCircle2 size={12} />, text: "Done" },
    GREEN: { tone: "ok", icon: <CheckCircle2 size={12} />, text: "Green" },
    READY: { tone: "ok", icon: <CheckCircle2 size={12} />, text: "Ready" },
    GUIDED: { tone: "accent", icon: <CircleDot size={12} />, text: "Guided" },
    SHADOW: { tone: "accent", icon: <CircleDot size={12} />, text: "Shadow only" },
    CURRENT: { tone: "accent", icon: <CircleDot size={12} />, text: "Current" },
    IN_PROGRESS: { tone: "accent", icon: <CircleDot size={12} />, text: "In progress" },
    AVAILABLE: { tone: "accent", icon: <Circle size={12} />, text: "Available" },
    SUBMITTED: { tone: "warn", icon: <Hourglass size={12} />, text: "Submitted" },
    AWAITING_REVIEW: { tone: "warn", icon: <Hourglass size={12} />, text: "Awaiting review" },
    REQUIRES_REVIEW: { tone: "warn", icon: <Hourglass size={12} />, text: "Requires review" },
    REVIEW_REQUIRED: { tone: "warn", icon: <Hourglass size={12} />, text: "Review required" },
    AMBER: { tone: "warn", icon: <AlertTriangle size={12} />, text: "Amber" },
    EXTENDED: { tone: "warn", icon: <Clock size={12} />, text: "Extended" },
    DEFERRED: { tone: "warn", icon: <Clock size={12} />, text: "Deferred" },
    WAITING: { tone: "muted", icon: <Clock size={12} />, text: "Waiting" },
    RESCHEDULED: { tone: "warn", icon: <Clock size={12} />, text: "Rescheduled" },
    SCHEDULED: { tone: "neutral", icon: <Clock size={12} />, text: "Scheduled" },
    CONFIRMED: { tone: "accent", icon: <CheckCircle2 size={12} />, text: "Confirmed" },
    FAILED: { tone: "bad", icon: <XCircle size={12} />, text: "Not passed" },
    RED: { tone: "bad", icon: <XCircle size={12} />, text: "Red" },
    BLOCKED: { tone: "bad", icon: <Ban size={12} />, text: "Blocked" },
    NOT_READY: { tone: "bad", icon: <XCircle size={12} />, text: "Not ready" },
    REJECTED: { tone: "bad", icon: <XCircle size={12} />, text: "Changes requested" },
    CHANGES_REQUESTED: { tone: "bad", icon: <XCircle size={12} />, text: "Changes requested" },
    CANCELLED: { tone: "muted", icon: <XCircle size={12} />, text: "Cancelled" },
    LOCKED: { tone: "muted", icon: <Lock size={12} />, text: "Locked" },
    NOT_STARTED: { tone: "muted", icon: <Circle size={12} />, text: "Not started" },
    UPCOMING: { tone: "muted", icon: <Circle size={12} />, text: "Upcoming" },
    PENDING: { tone: "muted", icon: <Circle size={12} />, text: "Pending" },
    DRAFT: { tone: "muted", icon: <Circle size={12} />, text: "Draft" },
    SUPERSEDED: { tone: "muted", icon: <Clock size={12} />, text: "Superseded" },
  };
  const m = map[s] ?? { tone: "neutral" as Tone, icon: null, text: s.replace(/_/g, " ").toLowerCase() };
  return <Badge tone={m.tone} icon={m.icon}>{m.text}</Badge>;
}

export function bandTone(band: string | null | undefined): "ok" | "warn" | "bad" | undefined {
  return band === "GREEN" ? "ok" : band === "AMBER" ? "warn" : band === "RED" ? "bad" : undefined;
}

export function scoreTone(score: number | null | undefined, green = 80, amber = 60): "ok" | "warn" | "bad" | "accent" {
  if (score === null || score === undefined) return "accent";
  return score >= green ? "ok" : score >= amber ? "warn" : "bad";
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="mb-2 text-ink-faint">{icon}</div>}
      <div className="text-sm font-medium text-ink-soft">{title}</div>
      {children && <div className="mt-1 max-w-md text-xs text-ink-muted">{children}</div>}
    </div>
  );
}

export function Field({ label, hint, children, error }: { label: string; hint?: string; children: ReactNode; error?: string | null }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-ink-faint">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] text-bad">{error}</span>}
    </label>
  );
}

export function Notice({ tone = "neutral", title, children, icon }: { tone?: Tone; title?: ReactNode; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", toneCls[tone])}>
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div className="min-w-0">
        {title && <div className="font-medium">{title}</div>}
        {children && <div className={cn(title && "mt-0.5", "text-[13px] opacity-90")}>{children}</div>}
      </div>
    </div>
  );
}

export function fmtPct(v: number | null | undefined, dp = 0) {
  return v === null || v === undefined ? "—" : `${Number(v).toFixed(dp)}%`;
}

export function fmtDate(d: string | null | undefined, withTime = false) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", withTime ? { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" } : { dateStyle: "medium", timeZone: "Asia/Kolkata" });
}
