import "server-only";
import { scoreAttempt, scorePercent, stripForCandidate, type AnswerValue, type ScorableQuestion } from "@/lib/engine/scoring";
import { planRemediation } from "@/lib/engine/remediation";
import { audit } from "./audit";
import { completeSystemTasks } from "./tasks";
import { syncEmployeeState } from "./sync";
import { loadSnapshot } from "./snapshot";
import { getConfig } from "./settings";
import { notifyOne } from "@/lib/notifications/service";
import { activeInstance, ServiceError, type ActionContext } from "./context";
import type { Pillar, QuestionType } from "@/types/domain";

export interface QuestionRow extends ScorableQuestion {
  question_code: string;
  question: string;
  options: { id: string; text: string }[];
  topic: string;
  difficulty: string;
  explanation: string | null;
  source_document: string | null;
  source_reference: string | null;
  sort_order: number;
}

const QUESTION_COLS = "id, question_code, question_type, pillar, topic, difficulty, question, options, correct_answer, explanation, weight, source_document, source_reference, sort_order";

function kamEmployee(ctx: ActionContext): string {
  if (ctx.actor.role !== "KAM" || !ctx.employeeId) throw new ServiceError("Only the KAM can take their own assessments.");
  return ctx.employeeId;
}

export async function startAttempt(ctx: ActionContext, assessmentCode: string): Promise<string> {
  const employeeId = kamEmployee(ctx);
  const { data: asmt } = await ctx.admin.from("assessments").select("id, code, stage, is_active").eq("code", assessmentCode).maybeSingle();
  if (!asmt || !asmt.is_active) throw new ServiceError("Assessment not found.");
  const snap = await loadSnapshot(ctx.db, employeeId);
  if (asmt.stage === "DAY10_CHECK" && !snap.journey.day10Available.available) throw new ServiceError(snap.journey.day10Available.reason ?? "Not available yet.");
  if (asmt.stage === "DAY15_READINESS" && !snap.journey.day15Available.available) throw new ServiceError(snap.journey.day15Available.reason ?? "Not available yet.");

  const { data: open } = await ctx.admin.from("assessment_attempts").select("id").eq("instance_id", snap.instance.id).eq("assessment_id", asmt.id).eq("status", "IN_PROGRESS").maybeSingle();
  if (open) return open.id;

  const { data: qs } = await ctx.admin.from("assessment_questions").select("id").eq("assessment_stage", asmt.stage).eq("is_active", true).order("pillar").order("sort_order");
  if (!qs?.length) throw new ServiceError("No active questions are configured for this assessment. Contact HR.");
  const { count } = await ctx.admin.from("assessment_attempts").select("id", { count: "exact", head: true }).eq("instance_id", snap.instance.id).eq("assessment_id", asmt.id);
  const attemptNumber = (count ?? 0) + 1;
  const cfg = snap.config;
  const { data: created, error } = await ctx.admin.from("assessment_attempts").insert({
    employee_id: employeeId, instance_id: snap.instance.id, assessment_id: asmt.id, attempt_number: attemptNumber,
    is_recheck: attemptNumber > 1, question_ids: qs.map((q) => q.id),
    scoring_config: { weights: cfg.weights, green: cfg.greenThreshold, amber: cfg.amberThreshold, day10_pass: cfg.day10PassThreshold },
  }).select("id").single();
  if (error || !created) throw new ServiceError("Could not start the assessment.");
  await audit(ctx.admin, { employeeId, actor: ctx.actor, event: attemptNumber > 1 ? "ASSESSMENT_RETAKEN" : "ASSESSMENT_STARTED", entityType: "assessment_attempt", entityId: created.id, next: { code: asmt.code, attempt: attemptNumber } });
  return created.id;
}

export async function getAttemptView(ctx: ActionContext, attemptId: string) {
  // Access check through RLS: the user client only returns attempts they may see.
  const { data: attempt } = await ctx.db.from("assessment_attempts")
    .select("id, employee_id, status, attempt_number, is_recheck, overall_score, band, confidence, submitted_at, started_at, question_ids, evidence, feedback, scoring_config, assessments(code, title, stage, time_limit_minutes)")
    .eq("id", attemptId).maybeSingle();
  if (!attempt) throw new ServiceError("Attempt not found.");
  const { data: qs } = await ctx.admin.from("assessment_questions").select(QUESTION_COLS).in("id", attempt.question_ids);
  const order = new Map((attempt.question_ids as string[]).map((id, i) => [id, i]));
  const questions = ((qs ?? []) as QuestionRow[]).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  const asmt = Array.isArray(attempt.assessments) ? attempt.assessments[0] : attempt.assessments;
  if (attempt.status === "IN_PROGRESS") {
    return { attempt, assessment: asmt, questions: questions.map((q) => stripForCandidate(q)), answers: null as null };
  }
  const { data: answers } = await ctx.db.from("assessment_answers").select("question_id, answer, is_correct, score_awarded, max_score, feedback").eq("attempt_id", attemptId);
  return { attempt, assessment: asmt, questions, answers: answers ?? [] };
}

export async function submitAttempt(ctx: ActionContext, attemptId: string, answers: Record<string, AnswerValue>, confidence: number) {
  const employeeId = kamEmployee(ctx);
  const { data: attempt } = await ctx.admin.from("assessment_attempts")
    .select("id, employee_id, instance_id, status, attempt_number, question_ids, scoring_config, assessments(code, stage)")
    .eq("id", attemptId).maybeSingle();
  if (!attempt || attempt.employee_id !== employeeId) throw new ServiceError("Attempt not found.");
  if (attempt.status !== "IN_PROGRESS") throw new ServiceError("This attempt has already been submitted.");
  const asmt = (Array.isArray(attempt.assessments) ? attempt.assessments[0] : attempt.assessments) as { code: string; stage: string };

  const { data: qs } = await ctx.admin.from("assessment_questions").select(QUESTION_COLS).in("id", attempt.question_ids);
  const questions = (qs ?? []) as QuestionRow[];
  const unanswered = questions.filter((q) => answers[q.id] === undefined || answers[q.id] === null || answers[q.id] === "" || (Array.isArray(answers[q.id]) && !(answers[q.id] as string[]).length));
  if (unanswered.length) throw new ServiceError(`Please answer all questions (${unanswered.length} unanswered).`);

  const cfg = await getConfig(ctx.admin);
  const snapCfg = attempt.scoring_config as { weights?: Record<Pillar, number>; green?: number; amber?: number };
  const scoringCfg = { weights: snapCfg.weights ?? cfg.weights, greenThreshold: snapCfg.green ?? cfg.greenThreshold, amberThreshold: snapCfg.amber ?? cfg.amberThreshold };

  const isDay15 = asmt.stage === "DAY15_READINESS";
  const weighted = scoreAttempt(questions, answers, scoringCfg);
  const pct = scorePercent(questions, answers);
  const overall = isDay15 ? weighted.overall : pct.score;
  const band = isDay15 ? weighted.band : null;
  const results = isDay15 ? weighted.results : pct.results;

  const answerRows = results.map((r) => ({
    attempt_id: attemptId, employee_id: employeeId, question_id: r.question_id,
    answer: answers[r.question_id] ?? null, is_correct: r.is_correct, score_awarded: r.score, max_score: r.max,
    feedback: r.missing?.length ? `Missing: ${r.missing.join(", ")}` : null,
  }));
  const { error: aErr } = await ctx.admin.from("assessment_answers").insert(answerRows);
  if (aErr) throw new ServiceError("Could not save answers.");

  // Knowledge-source usage signal at the time of the assessment (counts only).
  const { data: usage } = await ctx.admin.from("conversation_messages").select("grounding, citations").eq("employee_id", employeeId).eq("role", "assistant");
  const docs = new Set<string>();
  for (const m of usage ?? []) for (const c of (m.citations as { document_name?: string }[]) ?? []) if (c.document_name) docs.add(c.document_name);
  const sourceAttribution = { assistant_answers: usage?.length ?? 0, grounded_answers: (usage ?? []).filter((m) => m.grounding === "COMPANY_KNOWLEDGE").length, documents_consulted: Array.from(docs) };

  const feedback = isDay15
    ? `${band} — overall ${overall}%. ${weighted.pillars.map((p) => `${p.pillar[0] + p.pillar.slice(1).toLowerCase()} ${p.raw}%`).join(", ")}.${weighted.weakPillars.length ? ` Weakest: ${weighted.weakPillars.map((p) => p.toLowerCase()).join(", ")}.` : ""}`
    : `Score ${overall}%.`;

  await ctx.admin.from("assessment_attempts").update({
    status: "SCORED", submitted_at: new Date().toISOString(), overall_score: asmt.stage === "PRACTICE" ? overall : overall, band, confidence,
    evidence: isDay15 ? { pillars: weighted.pillars, weak_pillars: weighted.weakPillars } : { score: overall },
    source_attribution: sourceAttribution, feedback,
  }).eq("id", attemptId);

  if (asmt.stage !== "PRACTICE") {
    const pillarRows = (isDay15 ? weighted.pillars : weighted.pillars.filter((p) => p.available > 0)).map((p) => ({
      employee_id: employeeId, instance_id: attempt.instance_id, attempt_id: attemptId,
      source: asmt.stage, pillar: p.pillar, raw_score: p.raw, weight: p.weight, weighted_score: p.weighted,
    }));
    await ctx.admin.from("pillar_scores").insert(pillarRows);
    await completeSystemTasks(ctx.admin, attempt.instance_id, `assessment:${asmt.code}`, ctx.actor, employeeId);
  }

  await audit(ctx.admin, { employeeId, actor: ctx.actor, event: "ASSESSMENT_SUBMITTED", entityType: "assessment_attempt", entityId: attemptId, next: { code: asmt.code, attempt: attempt.attempt_number, overall, band } });

  let plan = null;
  if (isDay15 && band !== "GREEN") {
    const snap = await loadSnapshot(ctx.admin, employeeId);
    plan = planRemediation(band!, weighted.weakPillars, snap.day, attempt.attempt_number, cfg);
    if (plan) {
      const inst = await activeInstance(ctx.admin, employeeId);
      for (const t of plan.tasks) {
        const { data: created } = await ctx.admin.from("tasks").insert({
          instance_id: inst.id, code: t.code, day_number: t.day_number, due_day: t.due_day, title: t.title, description: t.description,
          pillar: t.pillar, task_type: t.task_type, owner_role: t.owner_role, gate_code: "G3", is_mandatory: true, sort_order: 900,
        }).select("id").single();
        if (created) await ctx.admin.from("task_completions").upsert({ instance_id: inst.id, employee_id: employeeId, task_id: created.id }, { onConflict: "instance_id,task_id", ignoreDuplicates: true });
      }
      await audit(ctx.admin, { employeeId, actor: null, event: "REMEDIATION_PLANNED", entityType: "onboarding_instance", entityId: inst.id, next: { band, summary: plan.summary, tasks: plan.tasks.map((t) => t.code), proposed_extension_days: plan.extensionDays } });
      const { data: emp } = await ctx.admin.from("employees").select("mentor_id, reporting_boss_id, full_name").eq("id", employeeId).single();
      for (const rid of [emp?.mentor_id, emp?.reporting_boss_id].filter(Boolean) as string[]) {
        await notifyOne(ctx.admin, { recipientId: rid, employeeId, type: band === "RED" ? "REMEDIATION" : "REFRESH", severity: band === "RED" ? "CRITICAL" : "ATTENTION", title: `${emp?.full_name}: Day-15 ${band} (${overall}%)`, body: plan.summary, link: `/people/${employeeId}`, dedupeKey: `${employeeId}:d15-${attemptId}` });
      }
    }
  }

  await syncEmployeeState(employeeId, ctx.actor);
  return { overall, band, pillars: isDay15 ? weighted.pillars : null, plan };
}

/* ── HR: question management ────────────────────────────────────── */

export function normaliseCorrectAnswer(type: QuestionType, raw: unknown): unknown {
  const r = (raw ?? {}) as Record<string, unknown>;
  switch (type) {
    case "MULTIPLE_CHOICE": if (typeof r.value !== "string" || !r.value) throw new ServiceError("Choose the correct option."); return { value: r.value };
    case "TRUE_FALSE": if (typeof r.value !== "boolean") throw new ServiceError("Choose true or false."); return { value: r.value };
    case "MULTI_SELECT": if (!Array.isArray(r.values) || !r.values.length) throw new ServiceError("Select at least one correct option."); return { values: r.values.map(String) };
    default: {
      const rubric = (r.rubric as { label: string; keywords: string[] }[]) ?? [];
      if (!rubric.length || rubric.some((x) => !x.label || !x.keywords?.length)) throw new ServiceError("Add at least one rubric point with keywords.");
      return { rubric };
    }
  }
}
