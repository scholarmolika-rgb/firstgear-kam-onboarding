import { describe, it, expect, beforeAll } from "vitest";
import { routeIntent } from "@/lib/ai/intent/router";
import { isPolicyQuestion } from "@/lib/ai/intent/rules";

beforeAll(() => { delete process.env.HF_MODEL_URL; });

describe("policy questions go to the knowledge base", () => {
  const policy = [
    "How many casual leaves do I get?",
    "Can I take leave to appear in exams?",
    "What is the daily allowance in Pune for G2?",
    "What is the hotel limit in a Class A city?",
    "How much do I get per km for my own car?",
    "Can I claim overdue expenses from last quarter?",
    "What is the reimbursement for travel to the next customer meeting?",
    "When is salary paid?",
    "What is the notice period for G3?",
    "Who handles customer quality complaints in which department?",
    "How is OTIF measured in my KPI scorecard?",
    "Can I accept a gift from a supplier?",
    "Am I a designated person under the insider trading code?",
    "What PPE do I need for a plant visit?",
    "Can I paste customer prices into public AI tools?",
    "What is the SOP for a credit note?",
  ];
  it.each(policy)("%s", async (q) => {
    expect(isPolicyQuestion(q)).toBe(true);
    expect((await routeIntent(q)).intent).toBe("KNOWLEDGE_SEARCH");
  });
});

describe("onboarding questions keep their own routes", () => {
  it.each([
    ["What should I do next?", "TASK_STATUS"],
    ["Why is Day 16 locked?", "GATE_STATUS"],
    ["How am I progressing?", "PROGRESS"],
    ["What are Northwind's open commitments?", "CUSTOMER_360"],
  ])("%s → %s", async (q, intent) => {
    expect((await routeIntent(q)).intent).toBe(intent);
  });

  it("safety guards still run first", async () => {
    expect((await routeIntent("Please reset my VPN password")).guard).toBe("OUT_OF_SCOPE_IT");
    expect((await routeIntent("Can I offer a 3% discount on this quotation?")).guard).toBe("PRICING_AUTHORITY");
  });
});

describe("extractive answers quote the part of a passage that answers the question", () => {
  it("picks the daily-allowance line out of a long 'at a glance' summary", async () => {
    const { focusedExcerpt } = await import("@/lib/ai/rag/retrieve");
    const { readFileSync } = await import("node:fs");
    const { parseFrontMatter } = await import("@/lib/ai/rag/chunker");
    const body = parseFrontMatter(readFileSync("knowledge/policy-faq/travel-policy-faq.md", "utf8")).body;
    const intro = body.slice(body.indexOf("Model policy"), body.indexOf("### Q:"));
    const ex = focusedExcerpt(`Policy FAQ — Travel\n${intro}`, "What is the daily allowance for G2 on travel?");
    expect(ex).toMatch(/Daily allowance/);
    expect(ex).toMatch(/G2 ₹1,000/);
    expect(ex.length).toBeLessThanOrEqual(640);
  });

  it("returns short passages whole", async () => {
    const { focusedExcerpt } = await import("@/lib/ai/rag/retrieve");
    expect(focusedExcerpt("Title\n8 days a year, credited on 1 January.", "How many casual leaves?")).toBe("8 days a year, credited on 1 January.");
  });
});
