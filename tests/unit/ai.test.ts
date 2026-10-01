import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { guard, ruleClassify } from "@/lib/ai/intent/rules";
import { routeIntent, classifyWithDistilBert } from "@/lib/ai/intent/router";
import { INTENTS } from "@/lib/ai/intent/intents";
import { chunkDocument, parseFrontMatter, cleanText } from "@/lib/ai/rag/chunker";
import { fuse, isSufficient, toCitations, validateCitations, formatCitation, termCoverage, type Hit } from "@/lib/ai/rag/retrieve";
import { l2normalise } from "@/lib/ai/rag/embeddings";
import { mistralChat } from "@/lib/ai/llm/mistral";
import { fillPrompt } from "@/lib/ai/prompts";

const kb = (rel: string) => readFileSync(path.resolve(__dirname, "../../knowledge", rel), "utf8");

describe("intent router", () => {
  it("covers the 17 required intents", () => {
    expect(INTENTS).toHaveLength(17);
    for (const i of ["FAQ", "TASK_STATUS", "TASK_COMPLETE", "SCHEDULE", "RESCHEDULE", "PROGRESS", "ASSESSMENT", "SCENARIO", "KNOWLEDGE_SEARCH", "CUSTOMER_360", "ACCOUNT_BRIEF", "MENTOR_REQUEST", "MANAGER_REQUEST", "GATE_STATUS", "READINESS", "FEEDBACK", "GENERAL_HELP"]) expect(INTENTS).toContain(i);
  });

  it.each([
    ["What should I do next?", "TASK_STATUS"],
    ["What is the RFQ process?", "FAQ"],
    ["I have finished the plant walk", "TASK_COMPLETE"],
    ["Can you reschedule my mentor check-in to Friday?", "RESCHEDULE"],
    ["When is my next session?", "SCHEDULE"],
    ["How am I doing overall?", "PROGRESS"],
    ["When can I take the Day-15 assessment?", "ASSESSMENT"],
    ["Why is Day 16 locked?", "GATE_STATUS"],
    ["Am I ready for pricing exposure?", "READINESS"],
    ["What are Northwind's programmes and volumes?", "CUSTOMER_360"],
    ["I need to talk to my mentor", "MENTOR_REQUEST"],
    ["What feedback did my mentor give?", "FEEDBACK"],
    ["Where can I find the escalation playbook?", "KNOWLEDGE_SEARCH"],
    ["Is my account brief approved?", "ACCOUNT_BRIEF"],
    ["I want to practise a price challenge scenario", "SCENARIO"],
  ])("rule fallback: %s → %s", (text, intent) => {
    expect(ruleClassify(text).intent).toBe(intent);
  });

  it("declines IT access provisioning regardless of the model", async () => {
    expect(guard("Please create my SAP account and grant VPN access")).toBe("OUT_OF_SCOPE_IT");
    const r = await routeIntent("Can you reset my password and give me CRM access?");
    expect(r).toMatchObject({ source: "guard", guard: "OUT_OF_SCOPE_IT" });
  });

  it("routes pricing-authorisation requests to the Reporting Boss", async () => {
    expect(guard("Can I offer a 3% discount to Northwind?")).toBe("PRICING_AUTHORITY");
    expect(guard("Approve this quotation price for me")).toBe("PRICING_AUTHORITY");
    expect(guard("What is the margin floor?")).toBeNull();
    expect((await routeIntent("Can I agree to a 4% price reduction?")).intent).toBe("MANAGER_REQUEST");
  });

  it("uses DistilBERT when configured and confident, otherwise falls back to rules", async () => {
    process.env.HF_MODEL_URL = "https://intent.example/classify";
    const confident = vi.fn(async () => new Response(JSON.stringify([[{ label: "PROGRESS", score: 0.93 }, { label: "FAQ", score: 0.04 }]]), { status: 200 }));
    expect(await routeIntent("how far along am i", confident as unknown as typeof fetch)).toMatchObject({ intent: "PROGRESS", source: "distilbert" });
    const unsure = vi.fn(async () => new Response(JSON.stringify([{ label: "FAQ", score: 0.31 }]), { status: 200 }));
    expect(await routeIntent("What should I do next?", unsure as unknown as typeof fetch)).toMatchObject({ intent: "TASK_STATUS", source: "rules" });
    const down = vi.fn(async () => new Response("err", { status: 503 }));
    expect(await classifyWithDistilBert("x", down as unknown as typeof fetch)).toBeNull();
    const unknownLabel = vi.fn(async () => new Response(JSON.stringify([{ label: "LABEL_3", score: 0.99 }]), { status: 200 }));
    expect(await classifyWithDistilBert("x", unknownLabel as unknown as typeof fetch)).toBeNull();
    delete process.env.HF_MODEL_URL;
  });
});

describe("RAG pipeline", () => {
  it("parses front matter metadata", () => {
    const { meta, body } = parseFrontMatter(kb("processes/rfq-to-quotation-sop.md"));
    expect(meta).toMatchObject({ document_key: "RFQ-SOP", name: "RFQ to Quotation SOP", category: "Processes", version: "4.1", approved: true });
    expect(body.startsWith("\n# RFQ") || body.startsWith("# RFQ")).toBe(true);
  });

  it("chunks by section, within the 200–400 token budget, keeping section headings for citation", () => {
    const { body } = parseFrontMatter(kb("processes/rfq-to-quotation-sop.md"));
    const chunks = chunkDocument(body);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every((c) => c.token_count <= 420)).toBe(true);
    const feas = chunks.find((c) => c.section === "3.2 Feasibility assessment")!;
    expect(feas.content).toMatch(/go \/ no-go/);
  });

  it("splits long sections with overlap and tracks PDF page markers", () => {
    const long = Array.from({ length: 120 }, (_, i) => `Sentence number ${i} about the feasibility review and approval chain.`).join(" ");
    const chunks = chunkDocument(`[page 1]\n## 2 Long section\n${long}\n[page 2]\n## 3 Short\nShort text here.`);
    const s2 = chunks.filter((c) => c.section === "2 Long section");
    expect(s2.length).toBeGreaterThan(1);
    expect(s2.every((c) => c.page === 1)).toBe(true);
    expect(chunks.at(-1)).toMatchObject({ section: "3 Short", page: 2 });
  });

  it("cleans whitespace and zero-width characters", () => {
    expect(cleanText("a​  b\n\n\n\nc")).toBe("a b\n\nc");
  });

  const hit = (id: string, content: string, extra: Partial<Hit> = {}): Hit => ({ id, document_id: `d-${id}`, content, section: "3.2 Feasibility assessment", page: null, document_name: "RFQ to Quotation SOP", category: "Processes", topic: "RFQ", version: "4.1", owner: null, effective_date: "2026-01-15", source_url: null, last_updated: null, ...extra });

  it("fuses vector and text results and re-ranks by term coverage", () => {
    const fused = fuse("RFQ feasibility review", [hit("a", "Unrelated content about logistics"), hit("b", "The RFQ feasibility review ends in a go/no-go")], [hit("b", "The RFQ feasibility review ends in a go/no-go")]);
    expect(fused[0].id).toBe("b");
    expect(fused[0].coverage).toBe(1);
  });

  it("judges evidence sufficiency conservatively", () => {
    expect(isSufficient([], true, 0.35)).toBe(false);
    expect(isSufficient([{ similarity: 0.2, coverage: 0.2 }], true, 0.35)).toBe(false);
    expect(isSufficient([{ similarity: 0.6, coverage: 0.2 }], true, 0.35)).toBe(true);
    expect(isSufficient([{ coverage: 0.3 }], false, 0.35)).toBe(false);
    expect(isSufficient([{ coverage: 0.67 }], false, 0.35)).toBe(true);
    expect(termCoverage("What is the payment term?", "Standard payment terms are 60 days")).toBeGreaterThan(0.5);
  });

  it("formats citations as document · section · version · effective date", () => {
    const [c] = toCitations([hit("a", "x")]);
    expect(c.tag).toBe("S1");
    expect(formatCitation(c)).toBe("RFQ to Quotation SOP · Section 3.2 · Version 4.1 · effective 2026-01-15");
  });

  it("strips citation tags the model invented and keeps only those used", () => {
    const cits = toCitations([hit("a", "x"), hit("b", "y")]);
    const v = validateCitations("Run feasibility first [S1]. Then quote [S7].", cits);
    expect(v.text).toBe("Run feasibility first [S1]. Then quote.");
    expect(v.used.map((c) => c.tag)).toEqual(["S1"]);
    expect(v.invented).toEqual(["S7"]);
  });

  it("normalises embeddings to unit length", () => {
    const n = l2normalise([3, 4]);
    expect(n[0]).toBeCloseTo(0.6);
    expect(Math.hypot(...n)).toBeCloseTo(1);
  });
});

describe("Mistral response handling", () => {
  afterEach(() => { delete process.env.MISTRAL_API_KEY; });

  it("returns null without an API key (callers fall back to extractive answers)", async () => {
    expect(await mistralChat([{ role: "user", content: "hi" }])).toBeNull();
  });

  it("parses a successful completion", async () => {
    process.env.MISTRAL_API_KEY = "test";
    const f = vi.fn(async (_u: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.model).toBe("mistral-large-latest");
      expect(body.temperature).toBe(0.1);
      return new Response(JSON.stringify({ model: "mistral-large-2411", choices: [{ message: { content: "  Feasibility first [S1]. " } }] }), { status: 200 });
    });
    expect(await mistralChat([{ role: "user", content: "q" }], { fetchImpl: f as unknown as typeof fetch })).toEqual({ text: "Feasibility first [S1].", model: "mistral-large-2411" });
  });

  it("returns null on HTTP errors, empty content and network failures", async () => {
    process.env.MISTRAL_API_KEY = "test";
    const http = vi.fn(async () => new Response("rate limited", { status: 429 }));
    const empty = vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    const boom = vi.fn(async () => { throw new TypeError("network"); });
    for (const f of [http, empty, boom]) expect(await mistralChat([{ role: "user", content: "q" }], { fetchImpl: f as unknown as typeof fetch })).toBeNull();
  });

  it("prompt templates are plain-text files with placeholders", () => {
    const tpl = readFileSync(path.resolve(__dirname, "../../lib/ai/prompts/grounded_answer.txt"), "utf8");
    expect(tpl).toContain("{{passages}}");
    expect(fillPrompt("Day {{day}} of {{duration}} {{missing}}", { day: 3, duration: 30 })).toBe("Day 3 of 30 {{missing}}");
    const system = readFileSync(path.resolve(__dirname, "../../lib/ai/prompts/system.txt"), "utf8");
    expect(system).toMatch(/Never invent a tag/);
    expect(system).toMatch(/do not create IT accounts/i);
  });
});
