import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { actionContext } from "@/lib/services/context";
import { getAttemptView, type QuestionRow } from "@/lib/services/assessments";
import { getConfig } from "@/lib/services/settings";
import { Card, PageHeader, Notice, StatusPill } from "@/components/ui";
import { PillarBars } from "@/components/charts";
import { AssessmentRunner, type CandidateQuestion } from "@/components/kam/Assessment";
import type { PillarScore } from "@/lib/engine/scoring";

export const dynamic = "force-dynamic";

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(["KAM", "MENTOR", "REPORTING_BOSS", "HR_ADMIN"]);
  const ctx = await actionContext({ rateLimit: false });
  let view: Awaited<ReturnType<typeof getAttemptView>>;
  try { view = await getAttemptView(ctx, id); } catch (e) { return <Notice tone="warn" title="Not available">{(e as Error).message}</Notice>; }
  const cfg = await getConfig(ctx.db);
  const a = view.attempt;
  const asmt = view.assessment as { code: string; title: string; stage: string } | null;

  if (!view.answers) {
    if (ctx.actor.role !== "KAM") return <Notice title="In progress">This attempt has not been submitted yet.</Notice>;
    return (
      <>
        <Link href="/assessments" className="link mb-4 inline-flex items-center gap-1 text-sm no-print"><ArrowLeft size={14} />Assessments</Link>
        <PageHeader title={asmt?.title ?? "Assessment"} subtitle={`Attempt ${a.attempt_number}${a.is_recheck ? " (re-check)" : ""}. Answer every question. Scoring is deterministic and uses the configured pillar weights.`} />
        <AssessmentRunner attemptId={a.id} questions={view.questions as unknown as CandidateQuestion[]} stage={asmt?.stage ?? ""} />
      </>
    );
  }

  const answers = new Map(view.answers.map((x) => [x.question_id, x]));
  const evidence = a.evidence as { pillars?: PillarScore[]; weak_pillars?: string[] };
  const pillarMap = evidence.pillars ? Object.fromEntries(evidence.pillars.map((p) => [p.pillar, p.raw])) : null;
  const fmtAns = (q: QuestionRow, v: unknown) => {
    if (v === null || v === undefined) return "—";
    if (Array.isArray(v)) return v.map((id) => q.options.find((o) => o.id === id)?.text ?? id).join("; ");
    if (typeof v === "boolean") return v ? "True" : "False";
    return q.options.find((o) => o.id === v)?.text ?? String(v);
  };
  const correctText = (q: QuestionRow) => {
    const c = q.correct_answer as { value?: unknown; values?: string[]; rubric?: { label: string }[] };
    if (c.rubric) return `Should cover: ${c.rubric.map((r) => r.label).join("; ")}`;
    return fmtAns(q, c.values ?? c.value);
  };
  return (
    <>
      <Link href="/assessments" className="link mb-4 inline-flex items-center gap-1 text-sm no-print"><ArrowLeft size={14} />Assessments</Link>
      <PageHeader title={`${asmt?.title} — results`} subtitle={a.feedback} actions={a.band ? <StatusPill status={a.band} /> : undefined} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {(view.questions as QuestionRow[]).map((q, i) => {
            const ans = answers.get(q.id);
            const full = ans && Number(ans.score_awarded) >= Number(ans.max_score);
            const zero = !ans || Number(ans.score_awarded) === 0;
            return (
              <div key={q.id} className="card card-pad">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5">{full ? <CheckCircle2 size={18} className="text-ok" /> : zero ? <XCircle size={18} className="text-bad" /> : <MinusCircle size={18} className="text-warn" />}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-ink-muted">Q{i + 1} · {q.pillar.charAt(0) + q.pillar.slice(1).toLowerCase()} · {q.topic} · {Number(ans?.score_awarded ?? 0)}/{Number(ans?.max_score ?? q.weight)}</div>
                    <p className="mt-1 text-sm font-medium">{q.question}</p>
                    <p className="mt-2 text-xs"><span className="text-ink-muted">Your answer:</span> {fmtAns(q, ans?.answer)}</p>
                    {!full && <p className="mt-1 text-xs"><span className="text-ink-muted">Expected:</span> {correctText(q)}</p>}
                    {ans?.feedback && <p className="mt-1 text-xs text-warn">{ans.feedback}</p>}
                    {q.explanation && <p className="mt-2 text-xs text-ink-soft">{q.explanation}</p>}
                    {q.source_document && <p className="mt-1 text-[11px] text-ink-faint">Source: {q.source_document}{q.source_reference ? ` · ${q.source_reference}` : ""}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="space-y-6">
          <Card title="Score">
            <div className="text-3xl font-semibold tabular-nums">{a.overall_score}%</div>
            <div className="mt-1 text-xs text-ink-muted">Confidence self-rating: {a.confidence ?? "—"}/5</div>
            {a.band === "AMBER" && <div className="mt-3"><Notice tone="warn" title="Amber — targeted refresh">A refresh plan has been added to your tasks for the weakest pillar(s). Pricing exposure stays blocked until a re-check reaches {cfg.greenThreshold}%.</Notice></div>}
            {a.band === "RED" && <div className="mt-3"><Notice tone="bad" title="Red — Phase 2 paused">A remediation plan has been created with your mentor. Customer and pricing exposure remain locked.</Notice></div>}
            {a.band === "GREEN" && <div className="mt-3"><Notice tone="ok" title="Green — on track">Phase 2 opens once your mentor completes the Customer 360 and account-brief reviews.</Notice></div>}
          </Card>
          {pillarMap && <Card title="Pillar scores"><PillarBars scores={pillarMap} threshold={cfg.greenThreshold} weights={(a.scoring_config as { weights?: typeof cfg.weights }).weights ?? cfg.weights} /></Card>}
        </div>
      </div>
    </>
  );
}
