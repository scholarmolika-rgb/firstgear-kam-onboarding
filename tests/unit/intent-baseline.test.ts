import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ruleClassify } from "@/lib/ai/intent/rules";

/** Reports the rule-based fallback's accuracy on the held-out DistilBERT test split (baseline for the model). */
describe("intent fallback baseline", () => {
  it("reports accuracy on the held-out test split", () => {
    const rows = readFileSync(path.resolve(__dirname, "../../ml/intent-router/data/test.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as { text: string; label: string });
    const correct = rows.filter((r) => ruleClassify(r.text).intent === r.label).length;
    const acc = correct / rows.length;
    console.log(`[baseline] rule router accuracy on held-out test split: ${(acc * 100).toFixed(1)}% (${correct}/${rows.length})`);
    expect(rows.length).toBeGreaterThan(30);
    expect(acc).toBeGreaterThan(0.6);
  });
});
