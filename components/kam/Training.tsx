"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Hourglass, Loader2, Lock, Play } from "lucide-react";
import { toggleTaskAction, startAttemptAction } from "@/app/actions/onboarding";

export interface StepActionProps {
  code: string;
  taskId: string;
  employeeId: string;
  availability: string;
  reason: string | null;
  requiresApproval: boolean;
  actionRef: string | null;
  taskType: string;
  nextHref: string;
}

/**
 * The one thing to do on a training step. Manual steps are ticked here and
 * the player moves on by itself; linked work (assessment, scenario, account
 * brief) opens in training mode, which keeps a "Continue training" bar.
 */
export function StepAction(p: StepActionProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ref = p.actionRef ?? "";
  const t = `t=${encodeURIComponent(p.code)}`;

  const next = <Link prefetch={false} href={p.nextHref} className="btn-primary w-full justify-center">Continue to next step<ArrowRight size={15} /></Link>;

  if (p.availability === "DONE") {
    return <div className="space-y-3"><p className="flex items-center gap-2 text-sm font-medium text-ok"><Check size={16} />Step completed</p>{next}</div>;
  }
  if (p.availability === "AWAITING_REVIEW") {
    return <div className="space-y-3"><p className="flex items-center gap-2 text-sm text-warn"><Hourglass size={15} />Submitted — awaiting reviewer approval. You can carry on meanwhile.</p>{next}</div>;
  }
  if (p.availability === "LOCKED" || p.availability === "BLOCKED" || p.availability === "WAITING") {
    return (
      <div className="space-y-3">
        <p className="flex items-start gap-2 text-sm text-ink-muted"><Lock size={15} className="mt-0.5 shrink-0" />{p.reason ?? "Not available yet."}</p>
        <Link prefetch={false} href={p.nextHref} className="btn-secondary w-full justify-center">Preview the next step<ArrowRight size={15} /></Link>
      </div>
    );
  }

  if (ref.startsWith("assessment:")) {
    const code = ref.split(":")[1];
    return (
      <div className="space-y-2">
        <button className="btn-primary w-full justify-center" disabled={pending} onClick={() => start(async () => {
          setError(null);
          const r = await startAttemptAction(code);
          if (r.ok) router.push(`/assessments/${r.data}?${t}`); else setError(r.error);
        })}>{pending ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}Start the assessment</button>
        <p className="text-xs text-ink-muted">When you submit, use “Continue training” to come back here and move on.</p>
        {error && <p role="alert" className="text-xs text-bad">{error}</p>}
      </div>
    );
  }
  if (ref.startsWith("scenario:")) {
    return <div className="space-y-2"><Link href={`/scenarios/${ref.split(":")[1]}?${t}`} className="btn-primary w-full justify-center"><Play size={15} />Open the scenario</Link><p className="text-xs text-ink-muted">This step completes automatically when you submit your response.</p></div>;
  }
  if (ref === "brief:SUBMIT") {
    return <div className="space-y-2"><Link href={`/account-brief?${t}`} className="btn-primary w-full justify-center">Open the account brief<ArrowRight size={15} /></Link><p className="text-xs text-ink-muted">Add your stakeholders in Customer 360, then submit the brief for mentor review — this step completes on submission.</p></div>;
  }
  if (p.actionRef) return <div className="space-y-3"><p className="text-sm text-ink-muted">This step completes automatically when its linked action is recorded.</p>{next}</div>;

  const label = p.requiresApproval ? "Submit for review & continue" : p.taskType === "SESSION" ? "Mark attended & continue" : "Mark complete & continue";
  return (
    <div className="space-y-2">
      <button className="btn-primary w-full justify-center" disabled={pending} onClick={() => start(async () => {
        setError(null);
        const r = await toggleTaskAction({ employeeId: p.employeeId, taskId: p.taskId, done: true });
        if (!r.ok) { setError(r.error); return; }
        router.push(p.nextHref);
        router.refresh();
      })}>{pending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}{label}</button>
      {p.requiresApproval && <p className="text-xs text-ink-muted">Your Mentor or Reporting Boss approves it; you move on straight away.</p>}
      {error && <p role="alert" className="text-xs text-bad">{error}</p>}
    </div>
  );
}
