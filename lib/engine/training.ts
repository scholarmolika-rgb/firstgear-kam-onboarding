/**
 * Guided training path — turns the journey into an ordered sequence of the
 * KAM's own steps so the Training player can move Back / Next / Complete &
 * continue without the side bar.
 *
 * Steps are the KAM's mandatory tasks in journey order (day, then sort
 * order). Blocks are consecutive days that share a segment — Governance,
 * People, Product, Process, the Day-15 gate, then the Phase-2 segments —
 * and are shown as tabs. Availability and locks still come from the
 * journey engine: the player never unlocks anything by itself.
 */
import type { JourneyState, TaskView } from "./journey";
import { splitSections } from "@/lib/ai/rag/chunker";

export interface TrainingDay { day_number: number; phase: number; segment: string }

export interface TrainingBlock {
  key: string;
  label: string;
  phase: number;
  from: number;
  to: number;
  firstCode: string | null;
  total: number;
  done: number;
}

export interface TrainingPath { steps: TaskView[]; blocks: TrainingBlock[] }

const finished = (t: TaskView) => t.availability === "DONE" || t.availability === "AWAITING_REVIEW";

export function trainingPath(journey: JourneyState, days: TrainingDay[]): TrainingPath {
  const steps = trainingSteps(journey);
  const blocks: TrainingBlock[] = [];
  for (const d of [...days].sort((a, b) => a.day_number - b.day_number)) {
    const last = blocks.at(-1);
    if (last && last.label === d.segment && last.phase === d.phase && last.to === d.day_number - 1) last.to = d.day_number;
    else blocks.push({ key: `${d.phase}-${d.day_number}`, label: d.segment, phase: d.phase, from: d.day_number, to: d.day_number, firstCode: null, total: 0, done: 0 });
  }
  for (const b of blocks) {
    const inBlock = steps.filter((s) => s.day_number >= b.from && s.day_number <= b.to);
    b.firstCode = inBlock[0]?.code ?? null;
    b.total = inBlock.length;
    b.done = inBlock.filter(finished).length;
  }
  return { steps, blocks: blocks.filter((b) => b.total > 0) };
}

/** The KAM steps in journey order (no day metadata needed). */
export function trainingSteps(journey: JourneyState): TaskView[] {
  return journey.tasks.filter((t) => t.owner_role === "KAM" && t.is_mandatory);
}

/** Where "Continue training" should land: the first open step, else the first unfinished one, else the last. */
export function resumeStep(path: Pick<TrainingPath, "steps">): TaskView | null {
  return path.steps.find((s) => s.availability === "AVAILABLE")
    ?? path.steps.find((s) => !finished(s))
    ?? path.steps.at(-1)
    ?? null;
}

export function blockOf(path: TrainingPath, step: TaskView): TrainingBlock | undefined {
  return path.blocks.find((b) => step.day_number >= b.from && step.day_number <= b.to);
}

/* ── Learning material for a step ─────────────────────────────────── */

export interface MaterialSection { documentKey: string; documentName: string; version: string; heading: string | null; text: string; score: number }

const STOP = new Set("the and for with from that this your their into what when where which about after before have will must only each more than also into over under then them they does done take".split(" "));
const terms = (s: string) => Array.from(new Set(
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/).filter((w) => w.length >= 3 && !STOP.has(w)).map((w) => w.replace(/(ies|es|s)$/, "")),
));

/**
 * Picks the sections of the day's resource documents that best match the
 * step (title weighs most, then topic, then description). Deterministic
 * keyword overlap — the same approach as text retrieval, scoped to the
 * documents the programme already assigns to that day.
 */
export function relevantSections(
  docs: { document_key: string; name: string; version: string; content: string }[],
  step: { title: string; description?: string | null; knowledge_topic?: string | null },
  limit = 2,
): MaterialSection[] {
  const title = terms(step.title);
  const topic = terms(step.knowledge_topic ?? "");
  const desc = terms(step.description ?? "");
  const out: MaterialSection[] = [];
  for (const d of docs) {
    for (const s of splitSections(d.content)) {
      const head = terms(s.heading ?? "");
      const body = new Set(terms(s.text));
      const hit = (w: string) => head.includes(w) || body.has(w);
      const score = title.filter(hit).length * 3 + topic.filter(hit).length * 2 + desc.filter(hit).length
        + title.filter((w) => head.includes(w)).length * 2;
      if (score > 0) out.push({ documentKey: d.document_key, documentName: d.name, version: d.version, heading: s.heading, text: s.text, score });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
