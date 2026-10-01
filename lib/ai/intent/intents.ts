/**
 * Intent taxonomy. Adding an intent: add it here, add training examples in
 * ml/intent-router/data, retrain DistilBERT, and (optionally) add fallback
 * patterns in rules.ts. Handlers in lib/ai/assistant.ts fall back to
 * GENERAL_HELP for intents they don't special-case, so the UI never breaks.
 */
export const INTENTS = [
  "FAQ", "TASK_STATUS", "TASK_COMPLETE", "SCHEDULE", "RESCHEDULE", "PROGRESS", "ASSESSMENT",
  "SCENARIO", "KNOWLEDGE_SEARCH", "CUSTOMER_360", "ACCOUNT_BRIEF", "MENTOR_REQUEST",
  "MANAGER_REQUEST", "GATE_STATUS", "READINESS", "FEEDBACK", "GENERAL_HELP",
] as const;

export type Intent = (typeof INTENTS)[number];

/** Where the answer's facts must come from. */
export const INTENT_GROUNDING: Record<Intent, "KNOWLEDGE" | "STATE" | "ACCOUNT" | "ACTION"> = {
  FAQ: "KNOWLEDGE",
  KNOWLEDGE_SEARCH: "KNOWLEDGE",
  CUSTOMER_360: "ACCOUNT",
  TASK_STATUS: "STATE",
  TASK_COMPLETE: "ACTION",
  SCHEDULE: "ACTION",
  RESCHEDULE: "ACTION",
  PROGRESS: "STATE",
  ASSESSMENT: "STATE",
  SCENARIO: "STATE",
  ACCOUNT_BRIEF: "STATE",
  MENTOR_REQUEST: "ACTION",
  MANAGER_REQUEST: "ACTION",
  GATE_STATUS: "STATE",
  READINESS: "STATE",
  FEEDBACK: "STATE",
  GENERAL_HELP: "STATE",
};

export function isIntent(x: string): x is Intent {
  return (INTENTS as readonly string[]).includes(x);
}
