"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  reviewBriefAction, decideCertificationAction, panelInputAction, managerDecisionAction, finalSignOffAction,
  feedbackAction, supportEventAction, reviewScenarioAction, reviewTaskAction,
} from "@/app/actions/onboarding";
import { Field, cn } from "@/components/ui";

export type DecisionKind = "BRIEF" | "C360" | "CERT" | "PANEL" | "PROGRESSION" | "PRICING_EXPOSURE" | "CUSTOMER_OWNERSHIP" | "DEV_ACTION" | "SIGNOFF";

const OPTIONS: Record<DecisionKind, { value: string; label: string; tone?: "ok" | "warn" | "bad" }[]> = {
  BRIEF: [{ value: "APPROVED", label: "Approve brief", tone: "ok" }, { value: "CHANGES_REQUESTED", label: "Request changes", tone: "bad" }],
  C360: [{ value: "APPROVED", label: "Approve Customer 360", tone: "ok" }, { value: "CHANGES_REQUESTED", label: "Request changes", tone: "bad" }],
  CERT: [{ value: "APPROVED", label: "Certify", tone: "ok" }, { value: "CHANGES_REQUESTED", label: "Extend practice", tone: "warn" }, { value: "REJECTED", label: "Do not certify", tone: "bad" }],
  PANEL: [{ value: "READY", label: "Recommend ready", tone: "ok" }, { value: "EXTEND", label: "Recommend extension", tone: "warn" }, { value: "NOT_READY", label: "Not ready", tone: "bad" }],
  PROGRESSION: [{ value: "APPROVED", label: "Approve progression", tone: "ok" }, { value: "DEFERRED", label: "Defer progression", tone: "warn" }],
  PRICING_EXPOSURE: [{ value: "APPROVED", label: "Approve guided pricing", tone: "ok" }, { value: "DEFERRED", label: "Defer pricing exposure", tone: "warn" }],
  CUSTOMER_OWNERSHIP: [{ value: "APPROVED", label: "Approve guided ownership", tone: "ok" }, { value: "DEFERRED", label: "Defer ownership", tone: "warn" }],
  DEV_ACTION: [{ value: "APPROVED", label: "Record development actions" }],
  SIGNOFF: [{ value: "READY", label: "READY — independent handling", tone: "ok" }, { value: "EXTENDED", label: "Extend onboarding", tone: "warn" }, { value: "NOT_READY", label: "Not ready", tone: "bad" }],
};

export function DecisionForm({ kind, employeeId, title, help, disabledReason }: { kind: DecisionKind; employeeId: string; title: string; help?: string; disabledReason?: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState(OPTIONS[kind][0].value);
  const [comments, setComments] = useState("");
  const [rating, setRating] = useState(4);
  const [actions, setActions] = useState("");
  const [ext, setExt] = useState(10);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const withRating = kind === "BRIEF" || kind === "C360" || kind === "PANEL";
  const withActions = kind === "SIGNOFF" || kind === "DEV_ACTION";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const dev = actions.split("\n").map((s) => s.trim()).filter(Boolean);
    start(async () => {
      let r: { ok: boolean; error?: string };
      switch (kind) {
        case "BRIEF": r = await reviewBriefAction(employeeId, "ACCOUNT_BRIEF", choice as "APPROVED", comments, rating); break;
        case "C360": r = await reviewBriefAction(employeeId, "CUSTOMER_360", choice as "APPROVED", comments, rating); break;
        case "CERT": r = await decideCertificationAction(employeeId, choice as "APPROVED", comments); break;
        case "PANEL": r = await panelInputAction(employeeId, choice as "READY", comments, rating); break;
        case "DEV_ACTION": r = await managerDecisionAction(employeeId, "DEVELOPMENT_ACTION", "APPROVED", comments, dev); break;
        case "SIGNOFF": r = await finalSignOffAction(employeeId, choice as "READY", comments, dev, choice === "EXTENDED" ? ext : 0); break;
        default: r = await managerDecisionAction(employeeId, kind, choice as "APPROVED", comments);
      }
      if (r.ok) { setMsg({ ok: true, text: "Decision recorded and audited." }); setComments(""); setActions(""); router.refresh(); }
      else setMsg({ ok: false, text: r.error ?? "Failed" });
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border border-line p-4">
      <div><div className="text-sm font-semibold">{title}</div>{help && <p className="mt-0.5 text-xs text-ink-muted">{help}</p>}</div>
      {disabledReason ? <p className="rounded bg-canvas px-3 py-2 text-xs text-ink-muted">{disabledReason}</p> : (
        <>
          <div className="flex flex-wrap gap-1.5" role="radiogroup">
            {OPTIONS[kind].map((o) => (
              <button type="button" key={o.value} role="radio" aria-checked={choice === o.value} onClick={() => setChoice(o.value)}
                className={cn("rounded-md border px-3 py-1.5 text-xs font-medium", choice === o.value ? (o.tone === "bad" ? "border-bad bg-bad-soft text-bad" : o.tone === "warn" ? "border-warn bg-warn-soft text-warn" : "border-accent bg-accent-soft text-accent") : "border-line-strong bg-white text-ink-soft")}>
                {o.label}
              </button>
            ))}
          </div>
          <Field label="Reason / evidence (required)"><textarea className="input" rows={3} required value={comments} onChange={(e) => setComments(e.target.value)} maxLength={3000} /></Field>
          {withRating && (
            <Field label="Quality rating (1–5)"><div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} onClick={() => setRating(n)} className={cn("h-8 w-8 rounded border text-xs", rating === n ? "border-accent bg-accent text-white" : "border-line-strong bg-white")}>{n}</button>)}</div></Field>
          )}
          {withActions && <Field label="Development actions (one per line)"><textarea className="input" rows={2} value={actions} onChange={(e) => setActions(e.target.value)} /></Field>}
          {kind === "SIGNOFF" && choice === "EXTENDED" && <Field label="Extension (days)"><input className="input w-28" type="number" min={1} max={60} value={ext} onChange={(e) => setExt(Number(e.target.value))} /></Field>}
          <div className="flex items-center gap-3">
            <button className="btn-primary btn-sm" disabled={pending || !comments.trim()}>{pending && <Loader2 size={13} className="animate-spin" />}Record decision</button>
            {msg && <span role="status" className={msg.ok ? "text-xs text-ok" : "text-xs text-bad"}>{msg.text}</span>}
          </div>
        </>
      )}
    </form>
  );
}

export function FeedbackForm({ employeeId, isMentor }: { employeeId: string; isMentor: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ content: "", category: "COACHING" as "COACHING" | "STRENGTH" | "DEVELOPMENT" | "GENERAL", pillar: "", visibleToKam: true, rating: 4, reinforcement: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => {
      const r = await feedbackAction(employeeId, { content: f.content, category: f.category, pillar: f.pillar || null, visibleToKam: f.visibleToKam, rating: isMentor ? f.rating : null, reinforcement: f.reinforcement.split(",").map((s) => s.trim()).filter(Boolean) });
      setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error }); if (r.ok) { setF({ ...f, content: "", reinforcement: "" }); router.refresh(); }
    }); }}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Type"><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as typeof f.category })}><option value="COACHING">Coaching note</option><option value="STRENGTH">Strength</option><option value="DEVELOPMENT">Development area</option><option value="GENERAL">General</option></select></Field>
        <Field label="Pillar (optional)"><select className="input" value={f.pillar} onChange={(e) => setF({ ...f, pillar: e.target.value })}><option value="">—</option><option value="GOVERNANCE">Governance</option><option value="PEOPLE">People</option><option value="PROCESS">Process</option><option value="PRODUCT">Product</option></select></Field>
      </div>
      <Field label="Feedback"><textarea className="input" rows={3} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} /></Field>
      {isMentor && <Field label="Areas requiring reinforcement (comma-separated)"><input className="input" value={f.reinforcement} onChange={(e) => setF({ ...f, reinforcement: e.target.value })} placeholder="e.g. approval chain, 8D timelines" /></Field>}
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.visibleToKam} onChange={(e) => setF({ ...f, visibleToKam: e.target.checked })} />Visible to the KAM</label>
      <div className="flex items-center gap-3"><button className="btn-secondary btn-sm" disabled={pending || f.content.trim().length < 5}>Save feedback</button>{msg && <span className={msg.ok ? "text-xs text-ok" : "text-xs text-bad"}>{msg.text}</span>}</div>
    </form>
  );
}

export function SupportEventForm({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [type, setType] = useState<"MENTOR_HELP" | "COLLEAGUE_HELP" | "ESCALATION" | "INDEPENDENT_RESOLUTION">("MENTOR_HELP");
  const [desc, setDesc] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await supportEventAction(employeeId, type, desc); setMsg(r.ok ? "Recorded." : r.error); if (r.ok) { setDesc(""); router.refresh(); } }); }}>
      <Field label="Event"><select className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="MENTOR_HELP">Needed mentor help</option><option value="COLLEAGUE_HELP">Needed colleague help</option><option value="ESCALATION">Escalated</option><option value="INDEPENDENT_RESOLUTION">Resolved independently</option></select></Field>
      <div className="min-w-[200px] flex-1"><Field label="What happened"><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field></div>
      <button className="btn-secondary btn-sm" disabled={pending}>Record</button>
      {msg && <span className="text-xs text-ink-muted">{msg}</span>}
    </form>
  );
}

export function ScenarioReviewForm({ attemptId, score }: { attemptId: string; score: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [val, setVal] = useState(score);
  const [comments, setComments] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await reviewScenarioAction({ attemptId, reviewerScore: val, comments }); setMsg(r.ok ? "Reviewed." : r.error); if (r.ok) router.refresh(); }); }}>
      <Field label="Reviewer score"><input className="input w-24" type="number" min={0} max={100} value={val} onChange={(e) => setVal(Number(e.target.value))} /></Field>
      <div className="min-w-[200px] flex-1"><Field label="Comments (required if adjusting >15)"><input className="input" value={comments} onChange={(e) => setComments(e.target.value)} /></Field></div>
      <button className="btn-secondary btn-sm" disabled={pending}>Save review</button>
      {msg && <span className="text-xs text-ink-muted">{msg}</span>}
    </form>
  );
}

export function TaskReviewButtons({ employeeId, taskId }: { employeeId: string; taskId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [comments, setComments] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const go = (decision: "APPROVE" | "REJECT") => start(async () => { const r = await reviewTaskAction({ employeeId, taskId, decision, comments }); setMsg(r.ok ? (decision === "APPROVE" ? "Approved." : "Changes requested.") : r.error); if (r.ok) router.refresh(); });
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input className="input max-w-xs py-1.5 text-xs" placeholder="Review comment" value={comments} onChange={(e) => setComments(e.target.value)} />
      <button className="btn-secondary btn-sm" disabled={pending} onClick={() => go("APPROVE")}>Approve</button>
      <button className="btn-danger btn-sm" disabled={pending || !comments.trim()} onClick={() => go("REJECT")}>Request changes</button>
      {msg && <span className="text-xs text-ink-muted">{msg}</span>}
    </div>
  );
}
