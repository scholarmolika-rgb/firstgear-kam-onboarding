/**
 * Progress engine: the 15 readiness signals and the composite "overall readiness".
 * Every number is derived from recorded data. Missing evidence counts as 0 in
 * the composite and is reported as null in the individual metric — the engine
 * never extrapolates.
 */
import type { Band, ProgrammeConfig, SupportEvent } from "@/types/domain";
import { isCleared, type JourneyState } from "./journey";

export interface DependencyTrend {
  direction: "IMPROVING" | "STABLE" | "WORSENING" | "INSUFFICIENT_DATA";
  series: { label: string; fromDay: number; toDay: number; dependent: number; independent: number; index: number | null }[];
  totalEvents: number;
  latestIndex: number | null;
}

const DEPENDENT = new Set(["MENTOR_HELP", "COLLEAGUE_HELP", "ESCALATION", "AI_ESCALATION"]);

/**
 * Dependency index per 5-day block = dependent events / all support events.
 * Lower is better (more independent). The trend compares the two most recent
 * blocks with at least 3 recorded events; otherwise data is insufficient.
 */
export function dependencyTrend(events: SupportEvent[], uptoDay: number, blockSize = 5): DependencyTrend {
  const last = Math.max(uptoDay, ...events.map((e) => e.day_number), 1);
  const series: DependencyTrend["series"] = [];
  for (let from = 1; from <= last; from += blockSize) {
    const to = from + blockSize - 1;
    const es = events.filter((e) => e.day_number >= from && e.day_number <= to);
    const dependent = es.filter((e) => DEPENDENT.has(e.event_type)).length;
    const independent = es.length - dependent;
    series.push({ label: `D${from}–${to}`, fromDay: from, toDay: to, dependent, independent, index: es.length ? Math.round((dependent / es.length) * 100) / 100 : null });
  }
  const informative = series.filter((s) => s.dependent + s.independent >= 3);
  let direction: DependencyTrend["direction"] = "INSUFFICIENT_DATA";
  if (informative.length >= 2) {
    const [prev, cur] = informative.slice(-2);
    const diff = (cur.index ?? 0) - (prev.index ?? 0);
    direction = diff <= -0.1 ? "IMPROVING" : diff >= 0.1 ? "WORSENING" : "STABLE";
  }
  const withData = series.filter((s) => s.index !== null);
  return { direction, series, totalEvents: events.length, latestIndex: withData.at(-1)?.index ?? null };
}

export interface ProgressInputs {
  config: ProgrammeConfig;
  journey: JourneyState;
  today: number;
  day10Best: number | null;
  day15Latest: { overall: number; band: Band; pillars: Record<string, number>; confidence: number | null } | null;
  day15Attempts: number;
  scenarioAverages: { certification: number | null; practice: number | null };
  supportEvents: SupportEvent[];
  mentorRatings: number[];        // 1..5 ratings on customer-facing outputs and reviews
  knowledgeUsage: { questions: number; grounded: number; insufficient: number; distinctDocuments: number };
  mentorFeedbackCount: number;
  managerSignOff: string | null;  // final decision if any
  startDate: string;
  independentSince: string | null;
}

export interface ProgressMetrics {
  taskCompletionPct: number;
  learningCompletionPct: number;
  assessmentScore: number | null;
  knowledgeScore: number | null;
  knowledgeScoreSource: "DAY15" | "DAY10" | null;
  pillarScores: Record<string, number> | null;
  scenarioScore: number | null;
  practiceScenarioScore: number | null;
  dependency: DependencyTrend;
  responseQuality: number | null;
  confidence: number | null;
  knowledgeUsage: ProgressInputs["knowledgeUsage"];
  gatesCleared: number;
  gatesTotal: number;
  mentorFeedbackCount: number;
  managerSignOff: string | null;
  daysToIndependentHandling: number | null;
  overdueCount: number;
  behindScheduleCount: number;
  reassessmentCount: number;
  band: Band | null;
  overallReadiness: number;
  components: { tasks: number; knowledge: number; scenario: number; gates: number };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeProgress(i: ProgressInputs): ProgressMetrics {
  const mandatory = i.journey.tasks.filter((t) => t.is_mandatory);
  const doneN = mandatory.filter((t) => t.availability === "DONE").length;
  const learning = mandatory.filter((t) => t.task_type === "LEARNING");
  const learningDone = learning.filter((t) => t.availability === "DONE").length;
  const taskCompletionPct = mandatory.length ? r2((doneN / mandatory.length) * 100) : 0;
  const learningCompletionPct = learning.length ? r2((learningDone / learning.length) * 100) : 0;

  const knowledgeScore = i.day15Latest?.overall ?? i.day10Best ?? null;
  const knowledgeScoreSource = i.day15Latest ? "DAY15" : i.day10Best !== null ? "DAY10" : null;
  const gatesCleared = i.journey.gates.filter((g) => isCleared(g.status)).length;
  const gatesTotal = i.journey.gates.length;

  const w = i.config.readinessWeights;
  const components = {
    tasks: taskCompletionPct,
    knowledge: knowledgeScore ?? 0,
    scenario: i.scenarioAverages.certification ?? 0,
    gates: gatesTotal ? r2((gatesCleared / gatesTotal) * 100) : 0,
  };
  const overallReadiness = r2((components.tasks * w.tasks + components.knowledge * w.knowledge + components.scenario * w.scenario + components.gates * w.gates) / 100);

  const responseQuality = i.mentorRatings.length ? r2((i.mentorRatings.reduce((s, r) => s + r, 0) / i.mentorRatings.length) * 20) : null;
  const daysToIndependentHandling = i.independentSince
    ? Math.round((Date.parse(i.independentSince) - Date.parse(i.startDate)) / 86_400_000) + 1
    : null;

  return {
    taskCompletionPct,
    learningCompletionPct,
    assessmentScore: i.day15Latest?.overall ?? null,
    knowledgeScore,
    knowledgeScoreSource,
    pillarScores: i.day15Latest?.pillars ?? null,
    scenarioScore: i.scenarioAverages.certification,
    practiceScenarioScore: i.scenarioAverages.practice,
    dependency: dependencyTrend(i.supportEvents, i.today),
    responseQuality,
    confidence: i.day15Latest?.confidence ?? null,
    knowledgeUsage: i.knowledgeUsage,
    gatesCleared,
    gatesTotal,
    mentorFeedbackCount: i.mentorFeedbackCount,
    managerSignOff: i.managerSignOff,
    daysToIndependentHandling,
    overdueCount: i.journey.tasks.filter((t) => t.overdue && t.owner_role === "KAM").length,
    behindScheduleCount: i.journey.tasks.filter((t) => t.behindSchedule).length,
    reassessmentCount: Math.max(0, i.day15Attempts - 1),
    band: i.day15Latest?.band ?? null,
    overallReadiness,
    components,
  };
}
