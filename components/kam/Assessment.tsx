"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { startAttemptAction, submitAttemptAction } from "@/app/actions/onboarding";
import { cn } from "@/components/ui";

export function StartAssessmentButton({ code, label }: { code: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <button className="btn-primary btn-sm" disabled={pending} onClick={() => start(async () => {
        const r = await startAttemptAction(code);
        if (r.ok) router.push(`/assessments/${r.data}`); else setErr(r.error);
      })}>{pending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}{label}</button>
      {err && <span className="text-[11px] text-bad">{err}</span>}
    </div>
  );
}

export interface CandidateQuestion { id: string; question_type: string; pillar: string; topic: string; question: string; options: { id: string; text: string }[]; weight: number; difficulty: string }

type Answer = string | string[] | boolean | null;

export function AssessmentRunner({ attemptId, questions, stage }: { attemptId: string; questions: CandidateQuestion[]; stage: string }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [confidence, setConfidence] = useState(3);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const answered = useMemo(() => questions.filter((q) => { const a = answers[q.id]; return a !== undefined && a !== null && a !== "" && !(Array.isArray(a) && !a.length); }).length, [answers, questions]);
  const set = (id: string, v: Answer) => setAnswers((a) => ({ ...a, [id]: v }));

  function submit() {
    setErr(null);
    start(async () => {
      const r = await submitAttemptAction({ attemptId, answers: answers as Record<string, string | string[] | boolean | null>, confidence });
      if (r.ok) router.refresh(); else setErr(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-20 -mx-1 flex items-center justify-between rounded-md border border-line bg-surface/95 px-4 py-2 text-sm backdrop-blur">
        <span>{answered} of {questions.length} answered</span>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-line"><div className="h-full bg-accent" style={{ width: `${(answered / questions.length) * 100}%` }} /></div>
      </div>
      {questions.map((q, i) => (
        <fieldset key={q.id} className="card card-pad">
          <legend className="sr-only">Question {i + 1}</legend>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
            <span className="font-semibold text-ink-soft">Q{i + 1}</span><span>{q.pillar.charAt(0) + q.pillar.slice(1).toLowerCase()}</span><span>· {q.topic}</span><span>· {q.question_type.replace(/_/g, " ").toLowerCase()}</span>{q.weight !== 1 && <span>· weight {q.weight}</span>}
          </div>
          <p className="text-sm font-medium leading-relaxed">{q.question}</p>
          <div className="mt-3">
            {q.question_type === "MULTIPLE_CHOICE" && (
              <div className="space-y-1.5">{q.options.map((o) => (
                <label key={o.id} className={cn("flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-sm", answers[q.id] === o.id ? "border-accent bg-accent-soft" : "border-line hover:bg-canvas")}>
                  <input type="radio" name={q.id} className="mt-0.5" checked={answers[q.id] === o.id} onChange={() => set(q.id, o.id)} />{o.text}
                </label>
              ))}</div>
            )}
            {q.question_type === "MULTI_SELECT" && (
              <div className="space-y-1.5">{q.options.map((o) => {
                const cur = (answers[q.id] as string[] | undefined) ?? [];
                const on = cur.includes(o.id);
                return (
                  <label key={o.id} className={cn("flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-sm", on ? "border-accent bg-accent-soft" : "border-line hover:bg-canvas")}>
                    <input type="checkbox" className="mt-0.5" checked={on} onChange={() => set(q.id, on ? cur.filter((x) => x !== o.id) : [...cur, o.id])} />{o.text}
                  </label>
                );
              })}<p className="text-[11px] text-ink-faint">Select all that apply. Wrong selections reduce the mark.</p></div>
            )}
            {q.question_type === "TRUE_FALSE" && (
              <div className="flex gap-2">{[true, false].map((v) => (
                <label key={String(v)} className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm", answers[q.id] === v ? "border-accent bg-accent-soft" : "border-line hover:bg-canvas")}>
                  <input type="radio" name={q.id} checked={answers[q.id] === v} onChange={() => set(q.id, v)} />{v ? "True" : "False"}
                </label>
              ))}</div>
            )}
            {["SHORT_ANSWER", "SCENARIO", "CASE_STUDY", "ROLE_PLAY"].includes(q.question_type) && (
              <textarea className="input" rows={q.question_type === "SHORT_ANSWER" ? 3 : 6} maxLength={4000} value={(answers[q.id] as string) ?? ""} onChange={(e) => set(q.id, e.target.value)} placeholder="Write your answer. Be specific about steps, owners and approvals." />
            )}
          </div>
        </fieldset>
      ))}
      {stage === "DAY15_READINESS" || stage === "DAY10_CHECK" ? (
        <div className="card card-pad">
          <div className="text-sm font-medium">How confident are you in these answers?</div>
          <div className="mt-2 flex gap-1.5">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setConfidence(n)} className={cn("h-9 w-9 rounded-md border text-sm", confidence === n ? "border-accent bg-accent text-white" : "border-line-strong bg-white")}>{n}</button>)}</div>
          <p className="mt-1 text-[11px] text-ink-faint">1 = guessing · 5 = certain. Recorded as a confidence signal; it does not change the score.</p>
        </div>
      ) : null}
      {err && <div role="alert" className="rounded-md border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-bad">{err}</div>}
      <div className="flex justify-end"><button className="btn-primary" onClick={submit} disabled={pending || answered < questions.length}>{pending ? <><Loader2 size={14} className="animate-spin" />Scoring…</> : "Submit for scoring"}</button></div>
    </div>
  );
}
