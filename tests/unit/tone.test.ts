import { describe, it, expect } from "vitest";
import { warmText, opener, closer, sourceLead, relatedQuestions, stateSuggestions, firstNameOf } from "@/lib/ai/tone";

describe("assistant tone — warm and suggestive, facts untouched", () => {
  const body = "8 days a year, credited in full on 1 January. Source: Leave Policy FAQ §3 Casual Leave. [S1]";

  it("keeps the grounded body, every number and every citation exactly", () => {
    const t = warmText(body, { kind: "KNOWLEDGE", intent: "KNOWLEDGE_SEARCH", firstName: "Riya", seed: "How many casual leaves?", hasSuggestions: true });
    expect(t).toContain(body);
    expect(t.match(/\[S1\]/g)).toHaveLength(1);
  });

  it("greets by first name and ends with a suggestion", () => {
    const t = warmText(body, { kind: "KNOWLEDGE", intent: "KNOWLEDGE_SEARCH", firstName: "Riya", seed: "q", hasSuggestions: true });
    expect(t.split("\n\n")[0]).toMatch(/Riya/);
    expect(t.trim().split("\n\n").at(-1)).toMatch(/\?|below/);
  });

  it("is deterministic for the same question and reads naturally without a name", () => {
    expect(opener("STATE", "Riya", "same")).toBe(opener("STATE", "Riya", "same"));
    for (const seed of ["a", "b", "c", "d"]) expect(opener("KNOWLEDGE", "", seed)).not.toMatch(/\{name\}|, —|,\s*!/);
  });

  it("has encouraging, intent-specific closers", () => {
    expect(closer("STATE", "PROGRESS", "x")).toMatch(/keep going|momentum/i);
    expect(closer("INSUFFICIENT", "FAQ", "x")).toMatch(/Mentor/);
    expect(closer("STATE", "AT_RISK", "x")).toMatch(/plan/);
  });

  it("introduces quoted passages by document name", () => {
    expect(sourceLead("Policy FAQ — Leave Policy")).toBe("Here's what the Leave Policy says:");
    expect(sourceLead(null)).toMatch(/approved documents/);
  });

  it("suggests related FAQ questions, never repeating the one asked", () => {
    const qs = relatedQuestions(["Q: How much Sick Leave do I get?", "1 Intro", "Q: How many casual leaves do I get?", "Q: How much Earned Leave do I get?", "Q: How much Sick Leave do I get?"], "How many casual leaves do I get?");
    expect(qs).toEqual(["How much Sick Leave do I get?", "How much Earned Leave do I get?"]);
  });

  it("offers next questions after state answers", () => {
    expect(stateSuggestions("PROGRESS")).toContain("What should I do next?");
    expect(stateSuggestions("UNKNOWN").length).toBeGreaterThan(0);
    expect(firstNameOf("Riya Sharma")).toBe("Riya");
  });
});

describe("encouragement matches reality", () => {
  it("a KAM who is behind gets support, not praise", () => {
    for (const seed of ["a", "b", "c"]) {
      const c = closer("STATE", "PROGRESS_BEHIND", seed);
      expect(c).not.toMatch(/momentum|solid foundation/i);
      expect(c).toMatch(/catch up/i);
    }
  });
});
