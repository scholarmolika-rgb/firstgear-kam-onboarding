"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, MinusCircle, XCircle, ShieldAlert } from "lucide-react";
import { submitScenarioAction } from "@/app/actions/onboarding";
import { cn } from "@/components/ui";

type Result = Extract<Awaited<ReturnType<typeof submitScenarioAction>>, { ok: true }>["data"];

export function ScenarioRunner({ code, isCertificationWindow, isCertificationScenario }: { code: string; isCertificationWindow: boolean; isCertificationScenario: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  function submit() {
    setErr(null);
    start(async () => {
      const r = await submitScenarioAction({ code, response: text });
      if (r.ok) { setResult(r.data); router.refresh(); } else setErr(r.error);
    });
  }

  if (result) {
    const e = result.evaluation;
    return (
      <div className="space-y-4">
        <div className="card card-pad">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <div className="label">{result.isCertification ? "Certification attempt" : "Practice attempt"}</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">{e.score}%</div>
              <div className="text-xs text-ink-muted">Rules score {e.rule_score}% · evaluator {e.evaluator === "RULES+AI" ? "rules + AI-assisted" : "rules"}</div>
            </div>
            <div className="text-right text-xs text-ink-muted">
              {result.previous ? <>Previous attempt {result.previous.score}% ({e.score - result.previous.score >= 0 ? "+" : ""}{Math.round((e.score - result.previous.score) * 100) / 100})</> : "First attempt"}
              {result.day15Baseline !== null && <div>Day-15 baseline {result.day15Baseline}%</div>}
            </div>
          </div>
          <p className="mt-3 text-sm text-ink-soft">{e.feedback}</p>
          {result.isCertification && <p className="mt-2 text-xs text-warn">Certification attempts are reviewed by your Mentor before Gate 2 (scenario test) can pass.</p>}
        </div>
        {e.red_flags.length > 0 && (
          <div className="flex gap-3 rounded-md border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
            <ShieldAlert size={18} className="shrink-0" /><div><div className="font-medium">Governance flags (deterministic penalty)</div>{e.red_flags.map((f) => <div key={f.id} className="text-[13px]">{f.label} (−{f.penalty})</div>)}</div>
          </div>
        )}
        <div className="card">
          <div className="border-b border-line px-5 py-3 text-sm font-semibold">Rubric</div>
          <ul className="divide-y divide-line">
            {e.criteria.map((c) => (
              <li key={c.id} className="flex gap-3 px-5 py-3">
                {c.status === "MET" ? <CheckCircle2 size={17} className="mt-0.5 text-ok" /> : c.status === "PARTIAL" ? <MinusCircle size={17} className="mt-0.5 text-warn" /> : <XCircle size={17} className="mt-0.5 text-bad" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{c.criterion} <span className="text-xs font-normal text-ink-muted">· {c.status.replace("_", " ").toLowerCase()} · {Math.round(c.credit)}/{Math.round(c.weight)}</span></div>
                  {c.evidence.length > 0 && <div className="text-xs text-ink-muted">Matched: {c.evidence.join(", ")}</div>}
                  {c.ai_note && <div className="text-xs text-ink-faint">AI note: {c.ai_note}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
        {e.missing.length > 0 && (
          <div className="card card-pad"><div className="text-sm font-semibold">Missing considerations</div><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">{e.missing.map((m) => <li key={m}>{m}</li>)}</ul></div>
        )}
        <button className="btn-secondary" onClick={() => { setResult(null); setText(""); }}>Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isCertificationScenario && !isCertificationWindow && <p className="rounded-md border border-line bg-canvas px-3 py-2 text-xs text-ink-muted">Day-21 certification is not unlocked yet — this attempt is saved as practice.</p>}
      <label htmlFor="resp" className="text-sm font-medium">Your response</label>
      <textarea id="resp" className="input min-h-[220px]" value={text} onChange={(e) => setText(e.target.value)} maxLength={6000} placeholder="Describe what you would do, in order: who you involve, what you say to the customer, what you will not commit to, and which approvals you need." />
      <div className="flex items-center justify-between text-xs text-ink-faint"><span>{words} words</span><span className={cn(words > 0 && words < 40 && "text-warn")}>Aim for 80–250 words</span></div>
      {err && <div role="alert" className="text-sm text-bad">{err}</div>}
      <button className="btn-primary" disabled={pending || text.trim().length < 40} onClick={submit}>{pending ? <><Loader2 size={14} className="animate-spin" />Evaluating…</> : "Submit response"}</button>
    </div>
  );
}
