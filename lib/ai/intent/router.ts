/**
 * Intent router: policy guard → DistilBERT (remote inference) → rule fallback.
 *
 * DistilBERT is deployed separately (Hugging Face Inference Endpoint, or the
 * FastAPI service in ml/intent-router/inference) and reached via HF_MODEL_URL.
 * Both return the standard text-classification shape:
 *   [{ "label": "FAQ", "score": 0.97 }, ...]   (optionally nested one level)
 * The model can be replaced at any time without touching the app.
 */
import { isIntent, type Intent } from "./intents";
import { guard, ruleClassify, isPolicyQuestion, type Guard } from "./rules";

export interface RoutedIntent {
  intent: Intent;
  confidence: number;
  source: "distilbert" | "rules" | "guard";
  guard: Guard;
}

type Label = { label: string; score: number };

export async function classifyWithDistilBert(text: string, fetchImpl: typeof fetch = fetch): Promise<{ intent: Intent; confidence: number } | null> {
  const url = process.env.HF_MODEL_URL;
  if (!url) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6_000);
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.HF_API_TOKEN ? { Authorization: `Bearer ${process.env.HF_API_TOKEN}` } : {}),
      },
      body: JSON.stringify({ inputs: text, parameters: { top_k: 3 } }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as Label[] | Label[][];
    const labels: Label[] = Array.isArray(raw[0]) ? (raw as Label[][])[0] : (raw as Label[]);
    const best = labels.slice().sort((a, b) => b.score - a.score)[0];
    if (!best) return null;
    const label = best.label.toUpperCase();
    return isIntent(label) ? { intent: label, confidence: best.score } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function routeIntent(text: string, fetchImpl?: typeof fetch): Promise<RoutedIntent> {
  const g = guard(text);
  if (g) return { intent: g === "PRICING_AUTHORITY" ? "MANAGER_REQUEST" : "GENERAL_HELP", confidence: 1, source: "guard", guard: g };
  if (isPolicyQuestion(text)) return { intent: "KNOWLEDGE_SEARCH", confidence: 0.9, source: "rules", guard: null };
  const min = Number(process.env.INTENT_MIN_CONFIDENCE ?? 0.55);
  const model = await classifyWithDistilBert(text, fetchImpl);
  if (model && model.confidence >= min) return { ...model, source: "distilbert", guard: null };
  const rules = ruleClassify(text);
  return { ...rules, source: "rules", guard: null };
}
