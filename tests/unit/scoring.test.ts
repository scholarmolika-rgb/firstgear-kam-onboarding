import { describe, it, expect } from "vitest";
import { classifyBand, scoreAttempt, scoreQuestion, scorePercent, stripForCandidate, type ScorableQuestion } from "@/lib/engine/scoring";
import { DEFAULT_CONFIG } from "@/lib/engine/config";
import { QUESTIONS } from "@/lib/seed-data/assessments";
import type { Pillar } from "@/types/domain";

const q = (id: string, pillar: Pillar, weight = 1): ScorableQuestion => ({ id, pillar, weight, question_type: "MULTIPLE_CHOICE", correct_answer: { value: "a" } });

describe("question scoring", () => {
  it("multiple choice: all or nothing", () => {
    expect(scoreQuestion(q("1", "PROCESS"), "a").score).toBe(1);
    expect(scoreQuestion(q("1", "PROCESS"), "b").score).toBe(0);
    expect(scoreQuestion(q("1", "PROCESS"), undefined).score).toBe(0);
  });

  it("true/false accepts booleans and strings", () => {
    const tf: ScorableQuestion = { id: "t", pillar: "PEOPLE", weight: 1, question_type: "TRUE_FALSE", correct_answer: { value: false } };
    expect(scoreQuestion(tf, false).is_correct).toBe(true);
    expect(scoreQuestion(tf, "false").is_correct).toBe(true);
    expect(scoreQuestion(tf, true).is_correct).toBe(false);
  });

  it("multi-select gives partial credit and penalises wrong picks", () => {
    const ms: ScorableQuestion = { id: "m", pillar: "PROCESS", weight: 2, question_type: "MULTI_SELECT", correct_answer: { values: ["a", "b", "d", "e"] } };
    expect(scoreQuestion(ms, ["a", "b", "d", "e"]).score).toBe(2);
    expect(scoreQuestion(ms, ["a", "b"]).score).toBe(1);
    expect(scoreQuestion(ms, ["a", "b", "c"]).score).toBe(0.5);
    expect(scoreQuestion(ms, ["c"]).score).toBe(0);
  });

  it("short answers are scored against the keyword rubric", () => {
    const sa = QUESTIONS.find((x) => x.code === "D10-PRC-04")!;
    const sq: ScorableQuestion = { id: sa.code, pillar: sa.pillar, weight: 1, question_type: sa.type, correct_answer: sa.correct };
    const full = scoreQuestion(sq, "A cross-functional feasibility review with Engineering, Plant and SCM ending in a go/no-go decision.");
    expect(full.score).toBe(1);
    const partial = scoreQuestion(sq, "We check feasibility.");
    expect(partial.score).toBeCloseTo(1 / 3, 2);
    expect(partial.missing).toContain("Go / no-go decision");
  });
});

describe("Day-15 weighted scoring", () => {
  const cfg = DEFAULT_CONFIG;
  const bank = [q("g1", "GOVERNANCE"), q("g2", "GOVERNANCE"), q("p1", "PEOPLE"), q("r1", "PROCESS"), q("r2", "PROCESS"), q("d1", "PRODUCT")];

  it("computes Governance 25% / People 20% / Process 30% / Product 25%", () => {
    // Governance 50%, People 100%, Process 100%, Product 0%
    const s = scoreAttempt(bank, { g1: "a", g2: "b", p1: "a", r1: "a", r2: "a", d1: "b" }, cfg);
    const raw = Object.fromEntries(s.pillars.map((p) => [p.pillar, p.raw]));
    expect(raw).toEqual({ GOVERNANCE: 50, PEOPLE: 100, PROCESS: 100, PRODUCT: 0 });
    expect(s.overall).toBe(50 * 0.25 + 100 * 0.2 + 100 * 0.3 + 0 * 0.25); // 62.5
    expect(s.band).toBe("AMBER");
    expect(s.weakPillars).toEqual(["PRODUCT", "GOVERNANCE"]);
  });

  it("uses HR-configured weights", () => {
    const s = scoreAttempt(bank, { g1: "a", g2: "b", p1: "a", r1: "a", r2: "a", d1: "b" }, { ...cfg, weights: { GOVERNANCE: 10, PEOPLE: 10, PROCESS: 70, PRODUCT: 10 } });
    expect(s.overall).toBe(5 + 10 + 70 + 0);
    expect(s.band).toBe("GREEN");
  });

  it("question weight scales marks inside a pillar", () => {
    const s = scoreAttempt([q("a", "PROCESS", 3), q("b", "PROCESS", 1)], { a: "a", b: "b" }, cfg);
    expect(s.pillars.find((p) => p.pillar === "PROCESS")!.raw).toBe(75);
  });

  it("a pillar with no questions scores 0 rather than being dropped", () => {
    const s = scoreAttempt([q("a", "PROCESS")], { a: "a" }, cfg);
    expect(s.overall).toBe(30);
    expect(s.band).toBe("RED");
  });

  it("classifies Green/Amber/Red at the configured boundaries", () => {
    expect(classifyBand(80, cfg)).toBe("GREEN");
    expect(classifyBand(79.99, cfg)).toBe("AMBER");
    expect(classifyBand(60, cfg)).toBe("AMBER");
    expect(classifyBand(59.99, cfg)).toBe("RED");
    expect(classifyBand(75, { greenThreshold: 75, amberThreshold: 50 })).toBe("GREEN");
  });

  it("the seeded Day-15 bank scores 100% when every answer is correct", () => {
    const bankQs = QUESTIONS.filter((x) => x.stage === "DAY15_READINESS");
    const qs: ScorableQuestion[] = bankQs.map((x) => ({ id: x.code, pillar: x.pillar, weight: x.weight ?? 1, question_type: x.type, correct_answer: x.correct }));
    const answers = Object.fromEntries(bankQs.map((x) => {
      const c = x.correct as { value?: unknown; values?: string[]; rubric?: { keywords: string[] }[] };
      if (c.rubric) return [x.code, c.rubric.map((r) => r.keywords[0]).join(". ")];
      if (c.values) return [x.code, c.values];
      return [x.code, c.value];
    }));
    const s = scoreAttempt(qs, answers as Record<string, string>, cfg);
    expect(s.overall).toBe(100);
    expect(new Set(bankQs.map((x) => x.pillar)).size).toBe(4);
  });

  it("scorePercent is an unweighted percentage", () => {
    expect(scorePercent([q("a", "PROCESS"), q("b", "PEOPLE")], { a: "a" }).score).toBe(50);
  });

  it("never sends correct answers or explanations to candidates", () => {
    const stripped = stripForCandidate({ ...q("x", "PRODUCT"), explanation: "because" });
    expect(stripped).not.toHaveProperty("correct_answer");
    expect(stripped).not.toHaveProperty("explanation");
  });
});
