"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Lock, Ban, Hourglass, Loader2, ArrowRight } from "lucide-react";
import { toggleTaskAction } from "@/app/actions/onboarding";
import { cn } from "@/components/ui";

export interface TaskRowData {
  id: string;
  code: string;
  title: string;
  description: string | null;
  day_number: number;
  due_day: number;
  pillar: string;
  task_type: string;
  owner_role: string;
  availability: string;
  reason: string | null;
  overdue: boolean;
  systemDriven: boolean;
  requires_approval: boolean;
  action_ref: string | null;
  exposure: string;
  is_mandatory: boolean;
}

function actionLink(ref: string | null): { href: string; label: string } | null {
  if (!ref) return null;
  if (ref.startsWith("assessment:")) return { href: "/assessments", label: "Open assessment" };
  if (ref.startsWith("scenario:")) return { href: `/scenarios/${ref.split(":")[1]}`, label: "Open scenario" };
  if (ref === "brief:SUBMIT") return { href: "/account-brief", label: "Open account brief" };
  return null;
}

const OWNER: Record<string, string> = { KAM: "You", MENTOR: "Mentor", REPORTING_BOSS: "Reporting Boss", HR_ADMIN: "HR" };

/**
 * A real checkbox: click → server action → Supabase → audit → recompute →
 * updated state. Optimistic, with rollback and a visible error if the server
 * rejects the change. Survives refresh because the database is the state.
 */
export function TaskRow({ task, employeeId, canTick, viewer = "KAM", learnHref }: { task: TaskRowData; employeeId: string; canTick: boolean; viewer?: string; learnHref?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const availability = optimistic ?? task.availability;
  const done = availability === "DONE";
  const submitted = availability === "AWAITING_REVIEW";
  const locked = availability === "LOCKED" || availability === "BLOCKED";
  const interactive = canTick && !task.systemDriven && !locked && (availability !== "WAITING" || done);

  function toggle() {
    if (!interactive || pending) return;
    const wantDone = !(done || submitted);
    setError(null);
    setNote(null);
    setOptimistic(wantDone ? (task.requires_approval && viewer === "KAM" ? "AWAITING_REVIEW" : "DONE") : "AVAILABLE");
    start(async () => {
      const r = await toggleTaskAction({ employeeId, taskId: task.id, done: wantDone });
      if (!r.ok) {
        setOptimistic(null);
        setError(r.error);
        return;
      }
      setNote(r.data.status === "SUBMITTED" ? "Submitted for review" : `Progress ${r.data.progress.taskCompletionPct}% · readiness ${r.data.progress.overallReadiness}%`);
      router.refresh();
      setTimeout(() => setOptimistic(null), 1500);
    });
  }

  const link = actionLink(task.action_ref);
  return (
    <li className={cn("group flex gap-3 px-4 py-3", locked && "bg-canvas/60")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done ? true : submitted ? "mixed" : false}
        aria-label={`${task.title}${done ? " — completed" : ""}`}
        disabled={!interactive || pending}
        onClick={toggle}
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
          done ? "border-ok bg-ok text-white" : submitted ? "border-warn bg-warn-soft text-warn" : "border-line-strong bg-white",
          interactive && !done && "hover:border-accent",
          !interactive && !done && !submitted && "cursor-not-allowed opacity-60",
        )}
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : done ? <Check size={13} strokeWidth={3} /> : submitted ? <Hourglass size={11} /> : locked ? (availability === "BLOCKED" ? <Ban size={11} className="text-bad" /> : <Lock size={11} className="text-ink-faint" />) : null}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {learnHref
            ? <Link prefetch={false} href={learnHref} className={cn("text-sm font-medium hover:underline", done ? "text-ink-muted line-through decoration-ink-faint" : "text-ink")}>{task.title}</Link>
            : <span className={cn("text-sm font-medium", done ? "text-ink-muted line-through decoration-ink-faint" : "text-ink")}>{task.title}</span>}
          {!task.is_mandatory && <span className="text-[10px] uppercase tracking-wide text-ink-faint">optional</span>}
          {task.overdue && !done && <span className="rounded bg-bad-soft px-1.5 py-0.5 text-[10px] font-semibold text-bad">Overdue · due Day {task.due_day}</span>}
          {task.exposure !== "NONE" && <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">{task.exposure === "PRICING" ? "Pricing — guided" : "Customer exposure"}</span>}
          {task.requires_approval && <span className="text-[10px] text-ink-faint">needs reviewer approval</span>}
        </div>
        {task.description && <p className="mt-0.5 text-xs text-ink-muted">{task.description}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-faint">
          <span>Day {task.day_number}</span>
          <span>{task.pillar.charAt(0) + task.pillar.slice(1).toLowerCase()}</span>
          <span>Owner: {OWNER[task.owner_role] ?? task.owner_role}</span>
          {task.systemDriven && <span>Completes automatically</span>}
          {task.reason && !done && <span className={cn(availability === "BLOCKED" ? "text-bad" : "text-ink-muted")}>{task.reason}</span>}
        </div>
        {error && <div role="alert" className="mt-1.5 text-xs text-bad">{error}</div>}
        {note && <div className="mt-1.5 text-xs text-ok">{note}</div>}
      </div>
      {link && !done && !locked && viewer === "KAM" && (
        <Link href={link.href} className="btn-secondary btn-sm self-start whitespace-nowrap">{link.label}<ArrowRight size={12} /></Link>
      )}
    </li>
  );
}
