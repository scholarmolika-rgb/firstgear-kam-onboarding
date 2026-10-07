/**
 * Programme configuration: parsing from app_settings rows and validation of
 * HR edits. Pure functions — no database access.
 */
import type { Pillar, ProgrammeConfig } from "@/types/domain";

export interface SettingRow { key: string; value: unknown }

export const DEFAULT_CONFIG: ProgrammeConfig = {
  programmeName: "FirstGear KAM Onboarding Compass",
  duration: 30,
  startOffsetDays: 0,
  dayCounting: "CALENDAR",
  weights: { GOVERNANCE: 25, PEOPLE: 20, PROCESS: 30, PRODUCT: 25 },
  greenThreshold: 80,
  amberThreshold: 60,
  day10PassThreshold: 70,
  day21PassThreshold: 75,
  day21Required: true,
  pricingGateRequired: true,
  customerOwnershipGateRequired: true,
  amberRefreshDays: 4,
  redExtensionDays: 10,
  readinessWeights: { tasks: 30, knowledge: 30, scenario: 25, gates: 15 },
  reminderLeadDays: 1,
  sessionTypes: [],
  knowledgeCategories: [],
  ragTopK: 6,
  ragMinSimilarity: 0.35,
};

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)) ? Number(v) : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : d);
const str = (v: unknown, d: string) => (typeof v === "string" && v ? v : d);
const list = (v: unknown, d: string[]) => (Array.isArray(v) ? v.map(String) : d);

export function parseConfig(rows: SettingRow[]): ProgrammeConfig {
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const d = DEFAULT_CONFIG;
  const rw = (m.get("READINESS_WEIGHTS") ?? {}) as Partial<ProgrammeConfig["readinessWeights"]>;
  return {
    programmeName: str(m.get("PROGRAMME_NAME"), d.programmeName),
    duration: num(m.get("PROGRAMME_DURATION"), d.duration),
    startOffsetDays: num(m.get("ONBOARDING_START_OFFSET_DAYS"), d.startOffsetDays),
    dayCounting: m.get("DAY_COUNTING") === "BUSINESS" ? "BUSINESS" : "CALENDAR",
    weights: {
      GOVERNANCE: num(m.get("GOVERNANCE_WEIGHT"), d.weights.GOVERNANCE),
      PEOPLE: num(m.get("PEOPLE_WEIGHT"), d.weights.PEOPLE),
      PROCESS: num(m.get("PROCESS_WEIGHT"), d.weights.PROCESS),
      PRODUCT: num(m.get("PRODUCT_WEIGHT"), d.weights.PRODUCT),
    },
    greenThreshold: num(m.get("DAY15_GREEN_THRESHOLD"), d.greenThreshold),
    amberThreshold: num(m.get("DAY15_AMBER_THRESHOLD"), d.amberThreshold),
    day10PassThreshold: num(m.get("DAY10_PASS_THRESHOLD"), d.day10PassThreshold),
    day21PassThreshold: num(m.get("DAY21_PASS_THRESHOLD"), d.day21PassThreshold),
    day21Required: bool(m.get("DAY21_REQUIRED"), d.day21Required),
    pricingGateRequired: bool(m.get("PRICING_GATE_REQUIRED"), d.pricingGateRequired),
    customerOwnershipGateRequired: bool(m.get("CUSTOMER_OWNERSHIP_GATE_REQUIRED"), d.customerOwnershipGateRequired),
    amberRefreshDays: num(m.get("AMBER_REFRESH_DAYS"), d.amberRefreshDays),
    redExtensionDays: num(m.get("RED_EXTENSION_DAYS"), d.redExtensionDays),
    readinessWeights: {
      tasks: num(rw.tasks, d.readinessWeights.tasks),
      knowledge: num(rw.knowledge, d.readinessWeights.knowledge),
      scenario: num(rw.scenario, d.readinessWeights.scenario),
      gates: num(rw.gates, d.readinessWeights.gates),
    },
    reminderLeadDays: num(m.get("REMINDER_LEAD_DAYS"), d.reminderLeadDays),
    sessionTypes: list(m.get("SESSION_TYPES"), d.sessionTypes),
    knowledgeCategories: list(m.get("KNOWLEDGE_CATEGORIES"), d.knowledgeCategories),
    ragTopK: num(m.get("RAG_TOP_K"), d.ragTopK),
    ragMinSimilarity: num(m.get("RAG_MIN_SIMILARITY"), d.ragMinSimilarity),
  };
}

/** Converts a config back to setting rows (used when HR saves the configuration form). */
export function configToSettings(c: ProgrammeConfig): SettingRow[] {
  return [
    { key: "PROGRAMME_NAME", value: c.programmeName },
    { key: "PROGRAMME_DURATION", value: c.duration },
    { key: "ONBOARDING_START_OFFSET_DAYS", value: c.startOffsetDays },
    { key: "DAY_COUNTING", value: c.dayCounting },
    { key: "GOVERNANCE_WEIGHT", value: c.weights.GOVERNANCE },
    { key: "PEOPLE_WEIGHT", value: c.weights.PEOPLE },
    { key: "PROCESS_WEIGHT", value: c.weights.PROCESS },
    { key: "PRODUCT_WEIGHT", value: c.weights.PRODUCT },
    { key: "DAY15_GREEN_THRESHOLD", value: c.greenThreshold },
    { key: "DAY15_AMBER_THRESHOLD", value: c.amberThreshold },
    { key: "DAY10_PASS_THRESHOLD", value: c.day10PassThreshold },
    { key: "DAY21_PASS_THRESHOLD", value: c.day21PassThreshold },
    { key: "DAY21_REQUIRED", value: c.day21Required },
    { key: "PRICING_GATE_REQUIRED", value: c.pricingGateRequired },
    { key: "CUSTOMER_OWNERSHIP_GATE_REQUIRED", value: c.customerOwnershipGateRequired },
    { key: "AMBER_REFRESH_DAYS", value: c.amberRefreshDays },
    { key: "RED_EXTENSION_DAYS", value: c.redExtensionDays },
    { key: "READINESS_WEIGHTS", value: c.readinessWeights },
    { key: "REMINDER_LEAD_DAYS", value: c.reminderLeadDays },
    { key: "SESSION_TYPES", value: c.sessionTypes },
    { key: "KNOWLEDGE_CATEGORIES", value: c.knowledgeCategories },
    { key: "RAG_TOP_K", value: c.ragTopK },
    { key: "RAG_MIN_SIMILARITY", value: c.ragMinSimilarity },
  ];
}

const pct = (v: number) => Number.isFinite(v) && v >= 0 && v <= 100;

/** Returns human-readable validation errors; an empty list means the config is valid. */
export function validateConfig(c: ProgrammeConfig): string[] {
  const e: string[] = [];
  const pillars = Object.entries(c.weights) as [Pillar, number][];
  for (const [p, w] of pillars) if (!pct(w)) e.push(`${p} weight must be between 0 and 100.`);
  const total = pillars.reduce((s, [, w]) => s + w, 0);
  if (Math.abs(total - 100) > 0.001) e.push(`Pillar weights must total 100% (currently ${total}%).`);
  if (!pct(c.greenThreshold) || !pct(c.amberThreshold)) e.push("Day-15 thresholds must be between 0 and 100.");
  if (c.amberThreshold >= c.greenThreshold) e.push("Amber threshold must be lower than the Green threshold.");
  if (c.amberThreshold <= 0) e.push("Amber threshold must be above 0, otherwise no score could be Red.");
  if (!pct(c.day10PassThreshold) || c.day10PassThreshold === 0) e.push("Interim knowledge check pass threshold must be between 1 and 100.");
  if (!pct(c.day21PassThreshold) || c.day21PassThreshold === 0) e.push("Day-21 pass threshold must be between 1 and 100.");
  if (!Number.isInteger(c.duration) || c.duration < 15 || c.duration > 120) e.push("Programme duration must be a whole number of days between 15 and 120.");
  if (!Number.isInteger(c.startOffsetDays) || c.startOffsetDays < 0 || c.startOffsetDays > 60) e.push("Onboarding start offset must be 0–60 days.");
  if (!Number.isInteger(c.amberRefreshDays) || c.amberRefreshDays < 3 || c.amberRefreshDays > 5) e.push("Amber refresh must be 3–5 days.");
  if (!Number.isInteger(c.redExtensionDays) || c.redExtensionDays < 0 || c.redExtensionDays > 60) e.push("Red extension must be 0–60 days.");
  const rw = c.readinessWeights;
  const rwTotal = rw.tasks + rw.knowledge + rw.scenario + rw.gates;
  if ([rw.tasks, rw.knowledge, rw.scenario, rw.gates].some((v) => !pct(v))) e.push("Readiness composition weights must be between 0 and 100.");
  if (Math.abs(rwTotal - 100) > 0.001) e.push(`Overall readiness composition must total 100% (currently ${rwTotal}%).`);
  if (!Number.isInteger(c.reminderLeadDays) || c.reminderLeadDays < 0 || c.reminderLeadDays > 14) e.push("Reminder lead time must be 0–14 days.");
  if (c.ragTopK < 1 || c.ragTopK > 20) e.push("Retrieved passages must be 1–20.");
  if (c.ragMinSimilarity < 0 || c.ragMinSimilarity > 1) e.push("Minimum retrieval similarity must be between 0 and 1.");
  if (!c.programmeName.trim()) e.push("Programme name is required.");
  return e;
}
