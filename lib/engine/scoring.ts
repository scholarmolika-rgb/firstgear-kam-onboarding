/**
 * Assessment scoring engine. Deterministic: every score is computed from the
 * stored answer and the stored question definition. No LLM involvement.
 */
import { PILLARS, type Band, type Pillar, type ProgrammeConfig, type QuestionType } from "@/types/domain";

export interface ScorableQuestion {
  id: string;
  question_type: QuestionType;
  pillar: Pillar;
  weight: number;
  correct_answer: unknown;
  options?: { id: string; text: string }[];
}

export type AnswerValue = string | string[] | boolean | null | undefined;

export interface QuestionResult {
  question_id: string;
  pillar: Pillar;
  score: number;     // marks awarded (0..weight)
  max: number;       // = weight
  is_correct: boolean;
  matched?: string[];
  missing?: string[];
}

export interface RubricItem { label: string; keywords: string[] }

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

export function normalise(text: string): string {
  return ` ${text.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9₹%/'\-\s]/g, " ").replace(/\s+/g, " ").trim()} `;
}

/** True when any keyword appears in the text (word-boundary aware, case-insensitive). */
export function mentions(text: string, keywords: string[]): string[] {
  const t = normalise(text);
  return keywords.filter((k) => {
    const n = normalise(k).trim();
    if (!n) return false;
    // matches at a word start, so stems such as "communicat" match "communicate"/"communication"
    return t.includes(` ${n}`);
  });
}

export function scoreRubricText(answer: string, rubric: RubricItem[]) {
  const matched: string[] = [];
  const missing: string[] = [];
  for (const item of rubric) {
    if (mentions(answer, item.keywords).length > 0) matched.push(item.label);
    else missing.push(item.label);
  }
  const fraction = rubric.length ? matched.length / rubric.length : 0;
  return { fraction, matched, missing };
}

export function scoreQuestion(q: ScorableQuestion, answer: AnswerValue): QuestionResult {
  const max = Number(q.weight) || 1;
  const base = { question_id: q.id, pillar: q.pillar, max };
  const correct = q.correct_answer as Record<string, unknown>;
  switch (q.question_type) {
    case "MULTIPLE_CHOICE": {
      const ok = typeof answer === "string" && answer === correct.value;
      return { ...base, score: ok ? max : 0, is_correct: ok };
    }
    case "TRUE_FALSE": {
      const a = typeof answer === "boolean" ? answer : answer === "true" ? true : answer === "false" ? false : null;
      const ok = a !== null && a === correct.value;
      return { ...base, score: ok ? max : 0, is_correct: ok };
    }
    case "MULTI_SELECT": {
      const expected = new Set((correct.values as string[]) ?? []);
      const picked = new Set(Array.isArray(answer) ? answer : []);
      let hits = 0;
      let wrong = 0;
      for (const p of picked) {
        if (expected.has(p)) hits++;
        else wrong++;
      }
      const fraction = expected.size ? Math.max(0, (hits - wrong) / expected.size) : 0;
      const ok = hits === expected.size && wrong === 0;
      return { ...base, score: round(fraction * max, 3), is_correct: ok };
    }
    case "SHORT_ANSWER":
    case "SCENARIO":
    case "CASE_STUDY":
    case "ROLE_PLAY": {
      const text = typeof answer === "string" ? answer : "";
      const { fraction, matched, missing } = scoreRubricText(text, (correct.rubric as RubricItem[]) ?? []);
      return { ...base, score: round(fraction * max, 3), is_correct: fraction >= 0.999, matched, missing };
    }
    default:
      return { ...base, score: 0, is_correct: false };
  }
}

export interface PillarScore { pillar: Pillar; raw: number; weight: number; weighted: number; earned: number; available: number }
export interface AttemptScore {
  pillars: PillarScore[];
  overall: number;
  band: Band;
  weakPillars: Pillar[];
  results: QuestionResult[];
}

export function classifyBand(score: number, cfg: Pick<ProgrammeConfig, "greenThreshold" | "amberThreshold">): Band {
  if (score >= cfg.greenThreshold) return "GREEN";
  if (score >= cfg.amberThreshold) return "AMBER";
  return "RED";
}

/**
 * Overall = Σ pillarScore × pillarWeight / 100, using the configured weights.
 * A pillar with no questions scores 0 (it is never silently dropped), so a
 * misconfigured bank cannot inflate readiness.
 */
export function scoreAttempt(
  questions: ScorableQuestion[],
  answers: Record<string, AnswerValue>,
  cfg: Pick<ProgrammeConfig, "weights" | "greenThreshold" | "amberThreshold">,
): AttemptScore {
  const results = questions.map((q) => scoreQuestion(q, answers[q.id]));
  const pillars: PillarScore[] = PILLARS.map((p) => {
    const rs = results.filter((r) => r.pillar === p);
    const earned = rs.reduce((s, r) => s + r.score, 0);
    const available = rs.reduce((s, r) => s + r.max, 0);
    const raw = available ? round((earned / available) * 100) : 0;
    const weight = cfg.weights[p];
    return { pillar: p, raw, weight, weighted: round((raw * weight) / 100), earned: round(earned, 3), available };
  });
  const overall = round(pillars.reduce((s, p) => s + (p.raw * p.weight) / 100, 0));
  const band = classifyBand(overall, cfg);
  const weakPillars = pillars
    .filter((p) => p.raw < cfg.greenThreshold)
    .sort((a, b) => a.raw - b.raw)
    .map((p) => p.pillar);
  return { pillars, overall, band, weakPillars, results };
}

/** Simple percentage score (Day-10 check, practice) — unweighted by pillar. */
export function scorePercent(questions: ScorableQuestion[], answers: Record<string, AnswerValue>) {
  const results = questions.map((q) => scoreQuestion(q, answers[q.id]));
  const earned = results.reduce((s, r) => s + r.score, 0);
  const available = results.reduce((s, r) => s + r.max, 0);
  return { score: available ? round((earned / available) * 100) : 0, results };
}

/** Removes everything a candidate must not see before submitting. */
export function stripForCandidate<T extends ScorableQuestion & { explanation?: string | null }>(q: T) {
  const rest: Partial<T> = { ...q };
  delete rest.correct_answer;
  delete rest.explanation;
  return rest as Omit<T, "correct_answer" | "explanation">;
}
