/**
 * Ingests knowledge documents from a folder (default ./knowledge) through the
 * same pipeline the Knowledge Management screen uses.
 *
 *   npx tsx scripts/ingest-knowledge.ts [folder]
 *
 * Markdown files need front matter (document_key, name, category, version, …).
 * A new version of an existing document_key supersedes the current one.
 */
import { config } from "dotenv";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseFrontMatter, type DocMeta } from "../lib/ai/rag/chunker";
import { ingestDocument } from "../lib/ai/rag/ingest";

config({ path: ".env.local" });
config();

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const root = path.resolve(process.argv[2] ?? "knowledge");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(md|txt)$/.test(p) ? [p] : [];
  });
}

(async () => {
  for (const f of walk(root)) {
    const { meta, body } = parseFrontMatter(readFileSync(f, "utf8"));
    if (!meta.document_key || !meta.name || !meta.category || !meta.version) { console.warn(`skip ${f}: missing front matter`); continue; }
    try {
      const r = await ingestDocument(db, { ...(meta as DocMeta), approved: meta.approved !== false }, body, null);
      console.log(`+ ${meta.name} v${meta.version}: ${r.chunks} chunks${r.supersededId ? " (superseded previous version)" : ""}${r.embedded ? "" : " [full-text only]"}`);
    } catch (e) {
      console.log(`= ${meta.name} v${meta.version}: ${(e as Error).message}`);
    }
  }
})();
