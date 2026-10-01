/**
 * Scenario rubric evaluation.
 *
 * Business rules stay deterministic:
 *  1. Each rubric criterion is MET when the response mentions at least
 *     `min_matches` (default 1) of its keywords.
 *  2. An optional AI judgement may upgrade an unmet criterion to PARTIAL
 *     (half credit) — it can never mark a criterion fully met, and it can
 *     never remove a red flag.
 *  3. Red flags (e.g. committing to a price without approval) are matched by
 *     pattern and subtract a fixed penalty.
 *  4. score = clamp(Σ criterion credit − Σ penalties, 0, 100).
 */
import { mentions } from "./scoring";

export interface RubricCriterion {
  id: string;
  criterion: string;
  description: string;
  weight: number;
  keywords: string[];
  min_matches?: number;
}

export interface RedFlag { id: string; label: string; patterns: string[]; penalty: number }

export type CriterionStatus = "MET" | "PARTIAL" | "NOT_MET";

export interface CriterionResult {
  id: string;
  criterion: string;
  status: CriterionStatus;
  credit: number;
  weight: number;
  evidence: string[];
  source: "RULES" | "AI";
  ai_note?: string;
}

export interface AiCriterionJudgement { id: string; met: boolean; note?: string }

export interface RubricEvaluation {
  criteria: CriterionResult[];
  red_flags: { id: string; label: string; penalty: number; matched: string[] }[];
  rule_score: number;
  score: number;
  missing: string[];
  feedback: string;
  evaluator: "RULES" | "RULES+AI";
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n * 100) / 100));

export function evaluateRubric(
  response: string,
  rubric: RubricCriterion[],
  redFlags: RedFlag[],
  ai?: AiCriterionJudgement[] | null,
): RubricEvaluation {
  const totalWeight = rubric.reduce((s, c) => s + c.weight, 0) || 1;
  const scale = 100 / totalWeight;
  const aiById = new Map((ai ?? []).map((j) => [j.id, j]));

  const criteria: CriterionResult[] = rubric.map((c) => {
    const evidence = mentions(response, c.keywords);
    const met = evidence.length >= (c.min_matches ?? 1);
    const base = { id: c.id, criterion: c.criterion, weight: c.weight, evidence };
    if (met) return { ...base, status: "MET", credit: c.weight * scale, source: "RULES" };
    const j = aiById.get(c.id);
    if (j?.met) return { ...base, status: "PARTIAL", credit: (c.weight * scale) / 2, source: "AI", ai_note: j.note };
    return { ...base, status: "NOT_MET", credit: 0, source: "RULES", ai_note: j?.note };
  });

  const flags = redFlags
    .map((f) => ({ id: f.id, label: f.label, penalty: f.penalty, matched: mentions(response, f.patterns) }))
    .filter((f) => f.matched.length > 0);

  const ruleCredit = criteria.filter((c) => c.status === "MET").reduce((s, c) => s + c.credit, 0);
  const allCredit = criteria.reduce((s, c) => s + c.credit, 0);
  const penalty = flags.reduce((s, f) => s + f.penalty, 0);

  const missing = criteria.filter((c) => c.status !== "MET").map((c) => {
    const def = rubric.find((r) => r.id === c.id)!;
    return `${def.criterion}: ${def.description}`;
  });

  const score = clamp(allCredit - penalty);
  const strengths = criteria.filter((c) => c.status === "MET").map((c) => c.criterion.toLowerCase());
  const parts: string[] = [];
  if (strengths.length) parts.push(`You covered: ${strengths.join(", ")}.`);
  if (missing.length) parts.push(`Missing or incomplete: ${criteria.filter((c) => c.status !== "MET").map((c) => c.criterion.toLowerCase()).join(", ")}.`);
  if (flags.length) parts.push(`Governance concern: ${flags.map((f) => f.label.toLowerCase()).join("; ")}. This would need Reporting Boss review in a live situation.`);
  if (!parts.length) parts.push("No rubric criteria were addressed.");

  return {
    criteria,
    red_flags: flags,
    rule_score: clamp(ruleCredit - penalty),
    score,
    missing,
    feedback: parts.join(" "),
    evaluator: ai && ai.length ? "RULES+AI" : "RULES",
  };
}
