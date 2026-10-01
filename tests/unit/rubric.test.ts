import { describe, it, expect } from "vitest";
import { evaluateRubric } from "@/lib/engine/rubric";
import { SCENARIOS } from "@/lib/seed-data/assessments";

const price = SCENARIOS.find((s) => s.code === "SCN-PRICE")!;
const delivery = SCENARIOS.find((s) => s.code === "SCN-DELIVERY")!;

describe("scenario rubric engine", () => {
  it("scores a strong price-challenge response highly with no red flags", () => {
    const r = evaluateRubric(
      "I would listen and capture the ask in writing, but not concede in the meeting. I'd take it back and analyse the cost breakdown and steel index with Finance, then build a position with give-gets such as volume on Project Aster. Anything beyond ±2% needs CFO approval per the approval matrix, so I'd agree a response date.",
      price.rubric, price.red_flags);
    expect(r.score).toBe(100);
    expect(r.red_flags).toHaveLength(0);
    expect(r.missing).toHaveLength(0);
    expect(r.evaluator).toBe("RULES");
  });

  it("penalises committing to a price without approval (deterministic red flag)", () => {
    const r = evaluateRubric("To keep the business I agree to the discount of 4% right away.", price.rubric, price.red_flags);
    expect(r.red_flags.map((f) => f.id)).toContain("unapproved-price");
    expect(r.score).toBe(0);
    expect(r.feedback).toMatch(/Governance concern/);
  });

  it("lists missing considerations", () => {
    const r = evaluateRubric("I will inform the customer early.", delivery.rubric, delivery.red_flags);
    expect(r.criteria.find((c) => c.id === "early")!.status).toBe("MET");
    expect(r.missing.some((m) => m.startsWith("Recovery plan"))).toBe(true);
    expect(r.score).toBe(25);
  });

  it("AI can only upgrade an unmet criterion to partial credit — never full credit, never remove a flag", () => {
    const resp = "I promise delivery next week and will tell the customer.";
    const rules = evaluateRubric(resp, delivery.rubric, delivery.red_flags);
    const ai = evaluateRubric(resp, delivery.rubric, delivery.red_flags, [
      { id: "recovery", met: true, note: "Implies a plan" },
      { id: "facts", met: true },
    ]);
    expect(ai.criteria.find((c) => c.id === "recovery")!.status).toBe("PARTIAL");
    expect(ai.score - rules.score).toBeCloseTo((25 + 20) / 2, 5);
    expect(ai.rule_score).toBe(rules.rule_score);
    expect(ai.red_flags.map((f) => f.id)).toEqual(["unconfirmed-date"]);
    expect(ai.evaluator).toBe("RULES+AI");
  });

  it("every seeded scenario has a rubric that totals 100 points", () => {
    expect(SCENARIOS).toHaveLength(10);
    for (const s of SCENARIOS) expect(s.rubric.reduce((a, c) => a + c.weight, 0)).toBe(100);
    expect(SCENARIOS.filter((s) => s.certification).map((s) => s.code).sort()).toEqual(["SCN-DELIVERY", "SCN-PRICE", "SCN-QUALITY", "SCN-RFQ"]);
  });
});
