import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { parseFrontMatter, splitSections } from "@/lib/ai/rag/chunker";
import { DocumentMetaSchema } from "@/lib/security/validation";
import { QUESTIONS, SCENARIOS } from "@/lib/seed-data/assessments";
import { DAYS } from "@/lib/seed-data/journey";

const root = path.resolve(__dirname, "..", "..", "knowledge");
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = path.join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : [];
});
const docs = walk(root).map((f) => ({ file: path.relative(root, f), ...parseFrontMatter(readFileSync(f, "utf8")) }));

describe("knowledge base files", () => {
  it("every document has valid, ingestible front matter and a unique key", () => {
    for (const d of docs) expect(DocumentMetaSchema.safeParse(d.meta).success, d.file).toBe(true);
    const keys = docs.map((d) => d.meta.document_key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every journey resource points at a document in the knowledge base", () => {
    const keys = new Set(docs.map((d) => d.meta.document_key));
    for (const day of DAYS) for (const r of day.resources) expect(keys.has(r.document_key), `Day ${day.day}: ${r.document_key}`).toBe(true);
  });

  it("FAQ files put each question under its own heading so retrieval returns one Q&A per chunk", () => {
    const faqs = docs.filter((d) => d.file.startsWith("faq"));
    expect(faqs.length).toBeGreaterThanOrEqual(5);
    const questions = faqs.flatMap((d) => splitSections(d.body).filter((s) => s.heading?.startsWith("Q:")));
    expect(questions.length).toBeGreaterThanOrEqual(100);
    for (const q of questions) expect(q.text, q.heading!).toMatch(/Source: /);
  });

  it("the company profile withholds identifying names", () => {
    const text = docs.filter((d) => /^(company|products|processes|faq)/.test(d.file)).map((d) => d.body).join("\n");
    expect(text).not.toMatch(/\b(Sona|Comstar|BLW|NOVELIC|Escorts|Kubota|Mitsubishi|Thyssen|Blackstone|Neura|DENSO)\b/i);
  });
});

describe("assessment bank", () => {
  it("question and scenario codes are unique", () => {
    const q = QUESTIONS.map((x) => x.code);
    expect(new Set(q).size).toBe(q.length);
    const s = SCENARIOS.map((x) => x.code);
    expect(new Set(s).size).toBe(s.length);
  });
});
