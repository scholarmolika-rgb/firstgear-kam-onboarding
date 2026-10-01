import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Prompt templates live as plain-text files in lib/ai/prompts/ so they can be
 * iterated without touching code. `{{name}}` placeholders are filled here.
 */
const cache = new Map<string, string>();

export type PromptName = "system" | "grounded_answer" | "state_answer" | "scenario_judge";

export function loadPrompt(name: PromptName): string {
  const hit = cache.get(name);
  if (hit) return hit;
  const file = path.join(process.cwd(), "lib", "ai", "prompts", `${name}.txt`);
  const text = readFileSync(file, "utf8");
  cache.set(name, text);
  return text;
}

export function fillPrompt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{{${k}}}`));
}

export function renderPrompt(name: PromptName, vars: Record<string, string | number> = {}): string {
  return fillPrompt(loadPrompt(name), vars);
}
