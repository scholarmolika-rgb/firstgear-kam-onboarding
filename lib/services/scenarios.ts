import "server-only";
import { evaluateRubric, type AiCriterionJudgement, type RedFlag, type RubricCriterion } from "@/lib/engine/rubric";
import { mistralChat } from "@/lib/ai/llm/mistral";
import { renderPrompt } from "@/lib/ai/prompts";
import { mayDecide } from "@/lib/auth/access";
import { audit } from "./audit";
import { completeSystemTasks } from "./tasks";
import { syncEmployeeState } from "./sync";
import { loadSnapshot } from "./snapshot";
import { activeInstance, requireEmployeeAccess, ServiceError, type ActionContext } from "./context";

export interface ScenarioTemplate {
  id: string; code: string; title: string; category: string; pillar: string; situation: string; prompt: string;
  rubric: RubricCriterion[]; red_flags: RedFlag[]; is_certification: boolean; requires_review: boolean; source_document: string | null; is_active: boolean;
}

/** Candidate view — situation and the rubric's criterion names only (no keywords, no penalties). */
export async function listScenariosForKam(ctx: ActionContext) {
  const { data } = await ctx.admin.from("scenario_templates").select("id, code, title, category, pillar, situation, prompt, rubric, is_certification, source_document").eq("is_active", true).order("sort_order");
  return (data ?? []).map((s) => ({
    ...s,
    rubric: (s.rubric as RubricCriterion[]).map((c) => ({ id: c.id, criterion: c.criterion, description: c.description, weight: c.weight })),
  }));
}

async function aiJudge(t: ScenarioTemplate, response: string, unmet: RubricCriterion[]): Promise<AiCriterionJudgement[] | null> {
  if (!unmet.length) return null;
  const prompt = renderPrompt("scenario_judge", {
    situation: t.situation, prompt: t.prompt, response: response.slice(0, 5000),
    criteria: unmet.map((c) => `${c.id}: ${c.criterion} — ${c.description}`).join("\n"),
  });
  const res = await mistralChat([{ role: "user", content: prompt }], { json: true, maxTokens: 500, temperature: 0 });
  if (!res) return null;
  try {
    const parsed = JSON.parse(res.text) as { judgements?: AiCriterionJudgement[] };
    const ids = new Set(unmet.map((c) => c.id));
    return (parsed.judgements ?? []).filter((j) => ids.has(j.id) && typeof j.met === "boolean").map((j) => ({ id: j.id, met: j.met, note: String(j.note ?? "").slice(0, 160) }));
  } catch {
    return null;
  }
}

export async function submitScenario(ctx: ActionContext, code: string, response: string) {
  if (ctx.actor.role !== "KAM" || !ctx.employeeId) throw new ServiceError("Only the KAM can attempt scenarios.");
  const employeeId = ctx.employeeId;
  const { data: t } = await ctx.admin.from("scenario_templates").select("*").eq("code", code).eq("is_active", true).maybeSingle();
  if (!t) throw new ServiceError("Scenario not found.");
  const tpl = t as ScenarioTemplate;
  const snap = await loadSnapshot(ctx.db, employeeId);

  // A certification scenario counts as certification only when Day 21 is unlocked; earlier it is practice.
  const isCert = tpl.is_certification && snap.journey.certificationAvailable.available;
  const rules = evaluateRubric(response, tpl.rubric, tpl.red_flags);
  const unmet = tpl.rubric.filter((c) => rules.criteria.find((r) => r.id === c.id)?.status !== "MET");
  const ai = await aiJudge(tpl, response, unmet);
  const evaluation = ai ? evaluateRubric(response, tpl.rubric, tpl.red_flags, ai) : rules;

  const { count } = await ctx.admin.from("scenario_attempts").select("id", { count: "exact", head: true }).eq("instance_id", snap.instance.id).eq("scenario_id", tpl.id);
  const prev = snap.scenarioAttempts.filter((s) => s.scenario_code === code).at(-1) ?? null;
  const needsReview = isCert && tpl.requires_review;
  const { data: created, error } = await ctx.admin.from("scenario_attempts").insert({
    employee_id: employeeId, instance_id: snap.instance.id, scenario_id: tpl.id, attempt_number: (count ?? 0) + 1,
    is_certification: isCert, response, rule_score: evaluation.rule_score, score: evaluation.score,
    criteria_results: evaluation.criteria, red_flags_triggered: evaluation.red_flags, missing_considerations: evaluation.missing,
    feedback: evaluation.feedback, evaluator: evaluation.evaluator, status: needsReview ? "REVIEW_REQUIRED" : "SUBMITTED",
  }).select("id").single();
  if (error || !created) throw new ServiceError("Could not save your response.");

  // Practice links (e.g. D10-02 costing practice) complete on any attempt; certification links only on certification attempts.
  if (!tpl.is_certification || isCert) await completeSystemTasks(ctx.admin, snap.instance.id, `scenario:${code}`, ctx.actor, employeeId);
  await audit(ctx.admin, { employeeId, actor: ctx.actor, event: "SCENARIO_SUBMITTED", entityType: "scenario_attempt", entityId: created.id, next: { code, score: evaluation.score, rule_score: evaluation.rule_score, certification: isCert, red_flags: evaluation.red_flags.map((f) => f.id) } });
  if (evaluation.red_flags.length) {
    await ctx.admin.from("support_events").insert({ employee_id: employeeId, instance_id: snap.instance.id, event_type: "ESCALATION", day_number: snap.day, description: `Scenario ${code}: ${evaluation.red_flags.map((f) => f.label).join("; ")}`, recorded_by: null });
  }
  await syncEmployeeState(employeeId, ctx.actor);
  return {
    attemptId: created.id, isCertification: isCert, evaluation,
    previous: prev ? { score: prev.reviewer_score ?? prev.score, at: prev.created_at } : null,
    day15Baseline: snap.metrics.assessmentScore,
  };
}

/** Mentor / Reporting Boss review of a scenario attempt — may adjust the score with a comment. */
export async function reviewScenario(ctx: ActionContext, attemptId: string, reviewerScore: number, comments?: string) {
  const { data: a } = await ctx.admin.from("scenario_attempts").select("id, employee_id, instance_id, score, status").eq("id", attemptId).maybeSingle();
  if (!a) throw new ServiceError("Attempt not found.");
  const emp = await requireEmployeeAccess(ctx, a.employee_id);
  if (!mayDecide("SCENARIO_REVIEW", ctx.actor, emp)) throw new ServiceError("Only the assigned Mentor or Reporting Boss can review scenarios.");
  if (Math.abs(reviewerScore - Number(a.score)) > 15 && !comments?.trim()) throw new ServiceError("Explain any adjustment of more than 15 points.");
  await ctx.admin.from("scenario_attempts").update({ reviewer_id: ctx.actor.id, reviewer_score: reviewerScore, reviewer_comments: comments ?? null, reviewed_at: new Date().toISOString(), status: "REVIEWED" }).eq("id", attemptId);
  await ctx.admin.from("mentor_reviews").insert({ employee_id: a.employee_id, instance_id: a.instance_id, mentor_id: ctx.actor.id, review_type: "SCENARIO", entity_id: attemptId, decision: "NOTED", rating: Math.max(1, Math.min(5, Math.round(reviewerScore / 20))), comments: comments ?? null });
  await audit(ctx.admin, { employeeId: a.employee_id, actor: ctx.actor, event: "SCENARIO_REVIEWED", entityType: "scenario_attempt", entityId: attemptId, previous: { score: a.score }, next: { reviewer_score: reviewerScore, comments } });
  return syncEmployeeState(a.employee_id, ctx.actor);
}

/** Mentor certification decision on Gate 4. Rules still apply: below threshold cannot be approved. */
export async function decideCertification(ctx: ActionContext, employeeId: string, decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED", comments: string) {
  const emp = await requireEmployeeAccess(ctx, employeeId);
  if (!mayDecide("G4_CERTIFICATION", ctx.actor, emp)) throw new ServiceError("Only the assigned Mentor can certify Day-21 scenarios.");
  const snap = await loadSnapshot(ctx.admin, employeeId);
  const g4 = snap.journey.gates.find((g) => g.code === "G4")!;
  if (!["SUBMITTED", "FAILED"].includes(g4.status) || (g4.status === "FAILED" && decision === "APPROVED")) {
    if (decision === "APPROVED") throw new ServiceError(g4.status === "FAILED" ? `Cannot certify: ${g4.decision ?? "score below threshold"}.` : "All four certification scenarios must be submitted first.");
  }
  if (!comments.trim()) throw new ServiceError("Add a comment explaining the decision.");
  const inst = await activeInstance(ctx.admin, employeeId);
  await ctx.admin.from("mentor_reviews").insert({ employee_id: employeeId, instance_id: inst.id, mentor_id: ctx.actor.id, review_type: "GATE", entity_id: g4.id, decision, comments });
  await ctx.admin.from("gate_results").update({ assessor_id: ctx.actor.id, comments }).eq("instance_id", inst.id).eq("gate_id", g4.id);
  if (decision === "APPROVED") await completeSystemTasks(ctx.admin, inst.id, "gate:G4", ctx.actor, employeeId);
  await audit(ctx.admin, { employeeId, actor: ctx.actor, event: "MENTOR_REVIEWED", entityType: "gate", entityId: g4.id, next: { gate: "G4", decision, comments, score: g4.score } });
  return syncEmployeeState(employeeId, ctx.actor);
}
