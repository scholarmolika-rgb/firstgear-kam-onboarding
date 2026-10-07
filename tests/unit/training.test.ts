import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { evaluateJourney } from "@/lib/engine/journey";
import { trainingPath, resumeStep, blockOf, relevantSections } from "@/lib/engine/training";
import { parseFrontMatter } from "@/lib/ai/rag/chunker";
import { DAYS, TASKS } from "@/lib/seed-data/journey";
import { freshContext, complete } from "../fixtures";

const days = DAYS.map((d) => ({ day_number: d.day, phase: d.phase, segment: d.segment }));
const doc = (rel: string, key: string, name: string) => ({ document_key: key, name, version: "1", content: parseFrontMatter(readFileSync(path.resolve(__dirname, "..", "..", "knowledge", rel), "utf8")).body });

describe("Phase-1 learning path", () => {
  it("runs Governance → People → Product → Process → Day-15 gate", () => {
    const p1 = DAYS.filter((d) => d.phase === 1);
    const order = p1.map((d) => d.segment).filter((s, i, a) => a.indexOf(s) === i);
    expect(order).toEqual(["Governance", "People", "Product", "Process", "Day-15 gate"]);
    const block = (pillar: string) => TASKS.filter((t) => t.day <= 12 && t.pillar === pillar && !t.dependsOn?.length).map((t) => t.day);
    expect(Math.max(...block("GOVERNANCE"))).toBeLessThanOrEqual(4);
    expect(Math.min(...block("PEOPLE"))).toBeGreaterThanOrEqual(5);
    expect(Math.max(...block("PEOPLE"))).toBeLessThanOrEqual(7);
    expect(TASKS.filter((t) => t.pillar === "PRODUCT" && t.day <= 15).every((t) => t.day === 8 || t.day === 9)).toBe(true);
    expect(TASKS.find((t) => t.ref === "assessment:DAY10-CHECK")!.day).toBe(13);
  });

  it("no task depends on a task scheduled after it", () => {
    const day = Object.fromEntries(TASKS.map((t) => [t.code, t.day]));
    for (const t of TASKS) for (const d of t.dependsOn ?? []) expect(day[d], `${t.code} <- ${d}`).toBeLessThanOrEqual(t.day);
  });
});

describe("training player path", () => {
  it("steps are the KAM's own mandatory tasks, grouped into tabs in journey order", () => {
    const path = trainingPath(evaluateJourney(freshContext()), days);
    expect(path.steps.every((s) => s.owner_role === "KAM" && s.is_mandatory)).toBe(true);
    expect(path.blocks.slice(0, 5).map((b) => b.label)).toEqual(["Governance", "People", "Product", "Process", "Day-15 gate"]);
    expect(path.blocks[0]).toMatchObject({ from: 1, to: 4, firstCode: "D01-01" });
    expect(path.blocks.reduce((n, b) => n + b.total, 0)).toBe(path.steps.length);
  });

  it("resumes at the first open step and moves on as steps are completed", () => {
    const ctx = freshContext();
    expect(resumeStep(trainingPath(evaluateJourney(ctx), days))!.code).toBe("D01-01");
    complete(ctx, (t) => t.day_number <= 4);
    const path = trainingPath(evaluateJourney(ctx), days);
    const step = resumeStep(path)!;
    expect(blockOf(path, step)!.label).toBe("People");
    expect(path.blocks[0].done).toBe(path.blocks[0].total);
  });

  it("locked Phase-2 steps stay locked in the player — it never unlocks anything", () => {
    const path = trainingPath(evaluateJourney(freshContext()), days);
    expect(path.steps.find((s) => s.code === "D16-01")!.availability).toBe("LOCKED");
  });
});

describe("learning material", () => {
  it("picks the document sections that match the step", () => {
    const docs = [doc("governance/approval-authority-matrix.md", "APPROVAL-MATRIX", "Approval Authority Matrix"), doc("governance/kam-charter.md", "KAM-CHARTER", "KAM Charter")];
    expect(relevantSections(docs, { title: "Payment-term mechanics", description: "Understand payment terms", knowledge_topic: "payment terms" })[0].heading).toMatch(/Payment terms/);
    expect(relevantSections(docs, { title: "KAM KPIs", description: "Learn the KAM KPIs and how they are measured.", knowledge_topic: "KPIs" })[0].heading).toMatch(/KPIs/);
  });

  it("returns nothing rather than a random section when nothing matches", () => {
    const docs = [doc("governance/kam-charter.md", "KAM-CHARTER", "KAM Charter")];
    expect(relevantSections(docs, { title: "Zzzz", description: null, knowledge_topic: null })).toEqual([]);
  });
});
