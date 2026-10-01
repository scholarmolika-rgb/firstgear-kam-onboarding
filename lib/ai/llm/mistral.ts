/**
 * Mistral Large client (server-only). Returns null on any failure so callers
 * can fall back to deterministic, extractive answers — the assistant never
 * blocks on the LLM and never invents content when it is unavailable.
 */
import "server-only";

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }
export interface LlmResult { text: string; model: string }

export function llmConfigured(): boolean {
  return !!process.env.MISTRAL_API_KEY;
}

export async function mistralChat(
  messages: ChatMessage[],
  opts: { json?: boolean; maxTokens?: number; temperature?: number; timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<LlmResult | null> {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) return null;
  const model = process.env.MISTRAL_MODEL || "mistral-large-latest";
  const f = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 25_000);
  try {
    const res = await f("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.1,
        max_tokens: opts.maxTokens ?? 600,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.warn(`[mistral] HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; model?: string };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    return { text, model: data.model ?? model };
  } catch (e) {
    console.warn(`[mistral] request failed: ${(e as Error).name}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
