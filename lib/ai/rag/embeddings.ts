/**
 * Embedding providers for all-MiniLM-L6-v2 (384-dim, mean-pooled, L2-normalised).
 *
 *   hf-api       Hugging Face Inference API — default; works on Vercel serverless.
 *   transformers In-process ONNX via @huggingface/transformers (self-hosted Node).
 *   none         No embeddings; retrieval falls back to Postgres full-text search.
 *
 * Queries and documents MUST use the same provider/model; the model name is
 * stored on each document (`embedding_model`) so mismatches are detectable.
 */
export const EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
export const EMBEDDING_DIM = 384;

export interface Embedder {
  readonly name: string;
  embed(texts: string[]): Promise<number[][]>;
}

export function l2normalise(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

/** Mean-pools token embeddings if the API returns [tokens][dim] rather than [dim]. */
function pool(v: number[] | number[][]): number[] {
  if (!Array.isArray(v[0])) return v as number[];
  const rows = v as number[][];
  const out = new Array(rows[0].length).fill(0);
  for (const r of rows) r.forEach((x, i) => (out[i] += x / rows.length));
  return out;
}

class HfApiEmbedder implements Embedder {
  readonly name = `hf-api:${EMBEDDING_MODEL}`;
  constructor(private url: string, private token?: string, private fetchImpl: typeof fetch = fetch) {}
  async embed(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 16) {
      const batch = texts.slice(i, i + 16);
      const res = await this.fetchImpl(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
        body: JSON.stringify({ inputs: batch, options: { wait_for_model: true } }),
      });
      if (!res.ok) throw new Error(`Embedding API HTTP ${res.status}`);
      const data = (await res.json()) as (number[] | number[][])[];
      for (const v of data) {
        const pooled = l2normalise(pool(v));
        if (pooled.length !== EMBEDDING_DIM) throw new Error(`Expected ${EMBEDDING_DIM}-dim embeddings, got ${pooled.length}`);
        out.push(pooled);
      }
    }
    return out;
  }
}

class TransformersEmbedder implements Embedder {
  readonly name = `transformers:${EMBEDDING_MODEL}`;
  private pipe: Promise<(t: string[], o: object) => Promise<{ tolist(): number[][] }>> | null = null;
  async embed(texts: string[]): Promise<number[][]> {
    if (!this.pipe) {
      this.pipe = (async () => {
        const mod = "@huggingface/transformers";
        const { pipeline, env } = (await import(/* webpackIgnore: true */ mod)) as {
          pipeline: (task: string, model: string) => Promise<(t: string[], o: object) => Promise<{ tolist(): number[][] }>>;
          env: { cacheDir: string };
        };
        env.cacheDir = "/tmp/transformers-cache";
        return pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
      })();
    }
    const p = await this.pipe;
    const t = await p(texts, { pooling: "mean", normalize: true });
    return t.tolist();
  }
}

export function getEmbedder(fetchImpl?: typeof fetch): Embedder | null {
  const provider = (process.env.EMBEDDINGS_PROVIDER ?? "hf-api").toLowerCase();
  if (provider === "none") return null;
  if (provider === "transformers") return new TransformersEmbedder();
  const url = process.env.HF_EMBEDDING_URL || `https://router.huggingface.co/hf-inference/models/${EMBEDDING_MODEL}/pipeline/feature-extraction`;
  if (!process.env.HF_API_TOKEN && !process.env.HF_EMBEDDING_URL) return null; // public HF API requires a token
  return new HfApiEmbedder(url, process.env.HF_API_TOKEN, fetchImpl);
}

export const toPgVector = (v: number[]) => `[${v.map((x) => Number(x.toFixed(7))).join(",")}]`;
