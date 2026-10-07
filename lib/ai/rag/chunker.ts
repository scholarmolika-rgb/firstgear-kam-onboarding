/**
 * Document → clean text → sections → chunks (~200–400 tokens) with metadata.
 * Pure functions; used by the ingest pipeline and unit tests.
 */

export interface DocMeta {
  document_key: string;
  name: string;
  category: string;
  topic?: string;
  version: string;
  owner?: string;
  effective_date?: string;
  review_date?: string;
  source_url?: string;
  approved?: boolean;
}

export interface Chunk {
  chunk_index: number;
  section: string | null;
  page: number | null;
  content: string;
  token_count: number;
}

/** Parses a simple YAML front-matter block (key: value) at the top of a markdown file. */
export function parseFrontMatter(raw: string): { meta: Partial<DocMeta>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, unknown> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!kv) continue;
    let v: unknown = kv[2].trim().replace(/^["']|["']$/g, "");
    if (v === "true") v = true;
    else if (v === "false") v = false;
    meta[kv[1]] = v;
  }
  return { meta: meta as Partial<DocMeta>, body: raw.slice(m[0].length) };
}

/** Normalises whitespace and removes characters that hurt retrieval. */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/ /g, " ")
    .replace(/[​-‍﻿]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const estimateTokens = (s: string) => Math.ceil(s.split(/\s+/).filter(Boolean).length * 1.33);

interface Section { heading: string | null; text: string; page: number | null }

/** Splits on markdown headings (## …) and on form-feed / "[page N]" markers from PDF extraction. */
export function splitSections(body: string): Section[] {
  const out: Section[] = [];
  let page: number | null = null;
  let heading: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    const text = buf.join("\n").trim();
    if (text) out.push({ heading, text, page });
    buf = [];
  };
  for (const line of body.split(/\r?\n/)) {
    const marker = line.match(/^\s*\[page (\d+)\]\s*$/i);
    const nextPage: number | null = marker ? Number(marker[1]) : line.includes("\f") ? (page ?? 1) + 1 : null;
    if (nextPage !== null) { flush(); page = nextPage; continue; }
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) {
      flush();
      if (line.startsWith("# ") && out.length === 0 && !buf.length) { heading = null; continue; } // document title
      heading = h[1].trim();
      continue;
    }
    buf.push(line);
  }
  flush();
  return out;
}

/**
 * Packs sections into chunks of at most `maxTokens`. Small sections are kept
 * whole (one section per chunk so citations stay precise); long sections are
 * split on paragraph/sentence boundaries with a small overlap.
 */
export function chunkDocument(body: string, maxTokens = 380, overlapTokens = 40): Chunk[] {
  const chunks: Chunk[] = [];
  for (const s of splitSections(cleanText(body))) {
    const prefix = s.heading ? `${s.heading}\n` : "";
    if (estimateTokens(s.text) <= maxTokens) {
      chunks.push({ chunk_index: chunks.length, section: s.heading, page: s.page, content: `${prefix}${s.text}`, token_count: estimateTokens(prefix + s.text) });
      continue;
    }
    const sentences = s.text.split(/(?<=[.!?])\s+|\n{2,}/).filter((x) => x.trim());
    let cur: string[] = [];
    let tokens = 0;
    const emit = () => {
      if (!cur.length) return;
      const text = cur.join(" ");
      chunks.push({ chunk_index: chunks.length, section: s.heading, page: s.page, content: `${prefix}${text}`, token_count: estimateTokens(prefix + text) });
    };
    for (const sent of sentences) {
      const t = estimateTokens(sent);
      if (tokens + t > maxTokens && cur.length) {
        emit();
        // overlap: carry the tail sentences forward
        const tail: string[] = [];
        let tt = 0;
        for (let i = cur.length - 1; i >= 0 && tt < overlapTokens; i--) { tail.unshift(cur[i]); tt += estimateTokens(cur[i]); }
        cur = tail;
        tokens = tt;
      }
      cur.push(sent);
      tokens += t;
    }
    emit();
  }
  return chunks;
}
