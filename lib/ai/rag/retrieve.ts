/**
 * Hybrid retrieval: pgvector cosine similarity (MiniLM) + Postgres full-text,
 * fused with reciprocal-rank fusion and re-ranked by query-term coverage.
 * Only approved, current document versions are searchable (enforced in SQL).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmbedder, toPgVector, type Embedder } from "./embeddings";

export interface Hit {
  id: string;
  document_id: string;
  content: string;
  section: string | null;
  page: number | null;
  document_name: string;
  category: string;
  topic: string | null;
  version: string;
  owner: string | null;
  effective_date: string | null;
  source_url: string | null;
  last_updated: string | null;
  similarity?: number;
  rank?: number;
}

export interface Citation {
  tag: string;               // S1, S2 …
  chunk_id: string;
  document_id: string;
  document_name: string;
  section: string | null;
  page: number | null;
  version: string;
  effective_date: string | null;
  source_url: string | null;
  category: string;
  snippet: string;
}

export interface RetrievalResult {
  passages: (Hit & { score: number; coverage: number })[];
  citations: Citation[];
  sufficient: boolean;
  method: "hybrid" | "vector" | "text" | "none";
  bestSimilarity: number | null;
}

const STOP = new Set("a an and are as at be by can do does for from how i in is it me my of on or our should the to was we what when where which who why will with you your about tell explain please".split(" "));

export function queryTerms(q: string): string[] {
  return Array.from(new Set(q.toLowerCase().replace(/[^a-z0-9/\- ]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w))));
}

export function termCoverage(q: string, text: string): number {
  const terms = queryTerms(q);
  if (!terms.length) return 0;
  const t = text.toLowerCase();
  return terms.filter((w) => t.includes(w)).length / terms.length;
}

/** Reciprocal-rank fusion of vector and text result lists, then coverage re-ranking. Pure. */
export function fuse(query: string, vector: Hit[], text: Hit[], k = 60) {
  const map = new Map<string, Hit & { rrf: number }>();
  vector.forEach((h, i) => map.set(h.id, { ...h, rrf: 1 / (k + i + 1) }));
  text.forEach((h, i) => {
    const prev = map.get(h.id);
    if (prev) { prev.rrf += 1 / (k + i + 1); prev.rank = h.rank; }
    else map.set(h.id, { ...h, rrf: 1 / (k + i + 1) });
  });
  return Array.from(map.values())
    .map((h) => {
      const coverage = termCoverage(query, `${h.section ?? ""} ${h.content} ${h.document_name}`);
      return { ...h, coverage, score: h.rrf * (1 + coverage) };
    })
    .sort((a, b) => b.score - a.score);
}

export function toCitations(passages: Hit[]): Citation[] {
  return passages.map((p, i) => ({
    tag: `S${i + 1}`,
    chunk_id: p.id,
    document_id: p.document_id,
    document_name: p.document_name,
    section: p.section,
    page: p.page,
    version: p.version,
    effective_date: p.effective_date,
    source_url: p.source_url,
    category: p.category,
    snippet: p.content.replace(/\s+/g, " ").slice(0, 220),
  }));
}

/**
 * Decides whether retrieved evidence is strong enough to answer.
 * With vectors: best cosine similarity ≥ minSimilarity.
 * Text only: the best passage must cover at least half the query terms.
 */
export function isSufficient(passages: { similarity?: number; coverage: number }[], hasVectors: boolean, minSimilarity: number): boolean {
  if (!passages.length) return false;
  if (hasVectors) {
    const best = Math.max(...passages.map((p) => p.similarity ?? 0));
    return best >= minSimilarity || passages[0].coverage >= 0.75;
  }
  return passages[0].coverage >= 0.5;
}

export async function retrieve(
  db: SupabaseClient,
  query: string,
  opts: { topK: number; minSimilarity: number; categories?: string[] | null; embedder?: Embedder | null },
): Promise<RetrievalResult> {
  const embedder = opts.embedder === undefined ? getEmbedder() : opts.embedder;
  const filter = opts.categories?.length ? opts.categories : null;
  let vectorHits: Hit[] = [];
  let usedVectors = false;
  if (embedder) {
    try {
      const [v] = await embedder.embed([query]);
      const { data, error } = await db.rpc("match_knowledge_chunks", { query_embedding: toPgVector(v), match_count: opts.topK * 2, filter_categories: filter });
      if (!error && data) { vectorHits = data as Hit[]; usedVectors = vectorHits.length > 0; }
    } catch (e) {
      console.warn(`[rag] embedding unavailable, using text retrieval: ${(e as Error).message}`);
    }
  }
  const ftsQuery = queryTerms(query).join(" or ") || query;
  const { data: textData } = await db.rpc("search_knowledge_text", { query_text: ftsQuery, match_count: opts.topK * 2, filter_categories: filter });
  const textHits = (textData ?? []) as Hit[];

  const fused = fuse(query, vectorHits, textHits).slice(0, opts.topK);
  const sufficient = isSufficient(fused, usedVectors, opts.minSimilarity);
  return {
    passages: fused,
    citations: toCitations(fused),
    sufficient,
    method: usedVectors && textHits.length ? "hybrid" : usedVectors ? "vector" : textHits.length ? "text" : "none",
    bestSimilarity: usedVectors ? Math.max(...vectorHits.map((h) => h.similarity ?? 0)) : null,
  };
}

/**
 * Keeps only citations the answer actually references, removes any tag the
 * model invented, and renumbers nothing (tags stay stable for the UI).
 */
export function validateCitations(answer: string, citations: Citation[]): { text: string; used: Citation[]; invented: string[] } {
  const known = new Map(citations.map((c) => [c.tag, c]));
  const invented: string[] = [];
  const used = new Set<string>();
  const text = answer.replace(/\[(S\d+)\]/g, (m, tag: string) => {
    if (known.has(tag)) { used.add(tag); return m; }
    invented.push(tag);
    return "";
  }).replace(/\s+([.,;])/g, "$1");
  return { text, used: citations.filter((c) => used.has(c.tag)), invented };
}

export function formatCitation(c: Citation): string {
  return [c.document_name, c.section ? `Section ${c.section.replace(/^(\d+(\.\d+)*)\s.*$/, "$1")}` : null, c.page ? `Page ${c.page}` : null, `Version ${c.version}`, c.effective_date ? `effective ${c.effective_date}` : null]
    .filter(Boolean).join(" · ");
}
