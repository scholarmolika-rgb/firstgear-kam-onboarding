import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateJourney, nextActionFor, type CertResult, type GateDecision, type JourneyState, type NextAction } from "@/lib/engine/journey";
import { computeProgress, type ProgressMetrics } from "@/lib/engine/progress";
import { computeAlerts, type Alert } from "@/lib/engine/alerts";
import { onboardingDay, dateForDay } from "@/lib/engine/calendar";
import { getConfig, todayIso } from "./settings";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  Band, GateCode, GateDef, ManagerDecisionState, MentorReviewState, Pillar, ProgrammeConfig,
  Role, SupportEvent, TaskDef, TaskState,
} from "@/types/domain";

export interface PersonRef { id: string; full_name: string; email: string; title: string | null }

export interface EmployeeRow {
  id: string; profile_id: string | null; employee_code: string; full_name: string; email: string;
  designation: string; department: string; location: string | null; joining_type: string; joining_date: string;
  assigned_customer: string | null; mentor_id: string | null; reporting_boss_id: string | null; hr_owner_id: string | null; status: string;
}

export interface InstanceRow {
  id: string; employee_id: string; template_id: string; start_date: string; status: string; extension_days: number;
  pricing_exposure: string; customer_exposure: string; final_decision: "READY" | "EXTENDED" | "NOT_READY" | null;
  final_decision_at: string | null; final_decision_by: string | null; independent_since: string | null;
}

export interface AttemptSummary {
  id: string; code: string; stage: string; attempt_number: number; is_recheck: boolean; status: string;
  overall_score: number | null; band: Band | null; confidence: number | null; submitted_at: string | null; started_at: string;
}

export interface ScenarioAttemptSummary {
  id: string; scenario_code: string; title: string; is_certification: boolean; score: number; rule_score: number;
  reviewer_score: number | null; status: string; created_at: string; attempt_number: number;
}

export interface SessionRow {
  id: string; title: string; session_type: string; scheduled_at: string; duration_minutes: number; status: string;
  meeting_link: string | null; location: string | null; owner_id: string | null; day_number: number | null; notes: string | null;
}

export interface Snapshot {
  employee: EmployeeRow;
  people: { mentor: PersonRef | null; boss: PersonRef | null; hr: PersonRef | null };
  instance: InstanceRow;
  config: ProgrammeConfig;
  todayDate: string;
  day: number;
  journey: JourneyState;
  metrics: ProgressMetrics;
  alerts: Alert[];
  nextAction: NextAction;
  day15Pillars: Record<Pillar, number> | null;
  attempts: AttemptSummary[];
  scenarioAttempts: ScenarioAttemptSummary[];
  sessions: SessionRow[];
  feedback: { id: string; author_role: Role; category: string; content: string; created_at: string; pillar: string | null; author_name?: string }[];
  mentorReviews: (MentorReviewState & { comments: string | null; reinforcement_areas: string[] })[];
  managerReviews: (ManagerDecisionState & { comments: string | null; development_actions: string[] })[];
  storedGates: { gate_id: string; status: string; comments: string | null; assessor_id: string | null; decided_at: string | null }[];
}

export class NoOnboardingError extends Error {}

/**
 * Loads everything the engines need for one employee and evaluates the journey.
 * `db` is normally the signed-in user's client (RLS-scoped reads). Aggregate
 * counters that RLS hides from staff (e.g. assistant usage) are read with the
 * admin client — counts only, never content.
 */
export async function loadSnapshot(db: SupabaseClient, employeeId: string, opts: { today?: string } = {}): Promise<Snapshot> {
  const admin = createAdminClient();
  const { data: employee, error: eErr } = await db.from("employees").select("*").eq("id", employeeId).maybeSingle();
  if (eErr) throw new Error(eErr.message);
  if (!employee) throw new NoOnboardingError("Employee not found or not accessible.");

  const { data: instance } = await db.from("onboarding_instances").select("*").eq("employee_id", employeeId).neq("status", "ARCHIVED").maybeSingle();
  if (!instance) throw new NoOnboardingError("No active onboarding instance. HR must assign the KAM onboarding template.");

  const config = await getConfig(db);
  const todayDate = opts.today ?? todayIso();
  const day = onboardingDay(instance.start_date, todayDate, config.dayCounting);

  const peopleIds = [employee.mentor_id, employee.reporting_boss_id, employee.hr_owner_id].filter(Boolean) as string[];
  const [
    tasksRes, completionsRes, depsRes, gatesRes, storedGatesRes, attemptsRes, scenRes, mrRes, mgrRes, supportRes, fbRes, sessRes, peopleRes, usageRes,
  ] = await Promise.all([
    db.from("tasks").select("*").or(`template_id.eq.${instance.template_id},instance_id.eq.${instance.id}`),
    db.from("task_completions").select("task_id, status, completed_at, completed_by").eq("instance_id", instance.id),
    db.from("task_dependencies").select("task_id, depends_on_task_id"),
    db.from("gate_definitions").select("id, code, day_number, name, gate_type, approver_role").eq("template_id", instance.template_id).order("sort_order"),
    db.from("gate_results").select("gate_id, status, comments, assessor_id, decided_at").eq("instance_id", instance.id),
    db.from("assessment_attempts").select("id, attempt_number, is_recheck, status, overall_score, band, confidence, submitted_at, started_at, assessments(code, stage)").eq("instance_id", instance.id).order("started_at"),
    db.from("scenario_attempts").select("id, score, rule_score, reviewer_score, status, created_at, attempt_number, is_certification, scenario_id").eq("instance_id", instance.id).order("created_at"),
    db.from("mentor_reviews").select("review_type, decision, rating, comments, reinforcement_areas, created_at, entity_id").eq("employee_id", employeeId).order("created_at"),
    db.from("manager_reviews").select("review_type, decision, comments, development_actions, created_at").eq("employee_id", employeeId).order("created_at"),
    db.from("support_events").select("event_type, day_number").eq("instance_id", instance.id),
    db.from("feedback").select("id, author_role, category, content, created_at, pillar, author_id").eq("employee_id", employeeId).order("created_at", { ascending: false }),
    db.from("sessions").select("id, title, session_type, scheduled_at, duration_minutes, status, meeting_link, location, owner_id, day_number, notes").eq("employee_id", employeeId).order("scheduled_at"),
    peopleIds.length ? db.from("profiles").select("id, full_name, email, title").in("id", peopleIds) : Promise.resolve({ data: [] as PersonRef[] }),
    admin.from("conversation_messages").select("grounding, citations").eq("employee_id", employeeId).eq("role", "assistant"),
  ]);

  // Scenario codes (rubrics hidden from KAMs by RLS → resolve titles/codes via admin, metadata only)
  const { data: scenarioMeta } = await admin.from("scenario_templates").select("id, code, title, is_certification");
  const scenById = new Map((scenarioMeta ?? []).map((s) => [s.id, s]));
  const certificationCodes = (scenarioMeta ?? []).filter((s) => s.is_certification).map((s) => s.code).sort();

  const tasks: TaskDef[] = (tasksRes.data ?? []).map((t) => ({ ...t, due_day: t.due_day ?? t.day_number }));
  const states: Record<string, TaskState> = {};
  for (const c of completionsRes.data ?? []) states[c.task_id] = c as TaskState;
  const taskIds = new Set(tasks.map((t) => t.id));
  const dependencies = (depsRes.data ?? []).filter((d) => taskIds.has(d.task_id));
  const gates = (gatesRes.data ?? []) as GateDef[];

  type AttemptRow = Omit<AttemptSummary, "code" | "stage"> & { assessments: { code: string; stage: string } | { code: string; stage: string }[] | null };
  const attempts: AttemptSummary[] = ((attemptsRes.data ?? []) as unknown as AttemptRow[]).map((a) => {
    const asmt = Array.isArray(a.assessments) ? a.assessments[0] : a.assessments;
    return { ...a, code: asmt?.code ?? "", stage: asmt?.stage ?? "", overall_score: a.overall_score === null ? null : Number(a.overall_score) };
  });
  const scored = attempts.filter((a) => a.status !== "IN_PROGRESS" && a.overall_score !== null);
  const day10 = scored.filter((a) => a.stage === "DAY10_CHECK");
  const day10Best = day10.length ? Math.max(...day10.map((a) => a.overall_score!)) : null;
  const day15 = scored.filter((a) => a.stage === "DAY15_READINESS");
  const d15Latest = day15.at(-1) ?? null;

  let day15Pillars: Record<Pillar, number> | null = null;
  if (d15Latest) {
    const { data: ps } = await db.from("pillar_scores").select("pillar, raw_score").eq("attempt_id", d15Latest.id);
    day15Pillars = Object.fromEntries((ps ?? []).map((p) => [p.pillar, Number(p.raw_score)])) as Record<Pillar, number>;
  }

  const scenarioAttempts: ScenarioAttemptSummary[] = (scenRes.data ?? []).map((s) => ({
    id: s.id, scenario_code: scenById.get(s.scenario_id)?.code ?? "?", title: scenById.get(s.scenario_id)?.title ?? "Scenario",
    is_certification: s.is_certification, score: Number(s.score), rule_score: Number(s.rule_score),
    reviewer_score: s.reviewer_score === null ? null : Number(s.reviewer_score), status: s.status, created_at: s.created_at, attempt_number: s.attempt_number,
  }));
  const certification: CertResult[] = certificationCodes.map((code) => {
    const latestCert = scenarioAttempts.filter((s) => s.scenario_code === code && s.is_certification).at(-1);
    return latestCert ? { scenario_code: code, score: latestCert.score, reviewer_score: latestCert.reviewer_score, at: latestCert.created_at } : null;
  }).filter((x): x is CertResult => !!x);

  const mentorReviews = (mrRes.data ?? []) as (MentorReviewState & { comments: string | null; reinforcement_areas: string[]; entity_id: string | null })[];
  const managerReviews = (mgrRes.data ?? []) as (ManagerDecisionState & { comments: string | null; development_actions: string[] })[];
  const gateCodeById = new Map(gates.map((g) => [g.id, g.code]));
  const gateDecisions: GateDecision[] = mentorReviews
    .filter((r) => r.review_type === "GATE" && r.entity_id && gateCodeById.get(r.entity_id))
    .map((r) => ({
      code: gateCodeById.get(r.entity_id!)! as GateCode,
      decision: r.decision === "APPROVED" ? "APPROVED" : r.decision === "REJECTED" ? "REJECTED" : "EXTENDED",
      at: r.created_at, comments: r.comments,
    }));

  const journey = evaluateJourney({
    config, today: day, instanceStatus: instance.status, finalDecision: instance.final_decision,
    tasks, states, dependencies, gates,
    day10Best,
    day15Latest: d15Latest ? {
      overall: d15Latest.overall_score!, band: d15Latest.band!, at: d15Latest.submitted_at ?? d15Latest.started_at,
      attempt_number: day15.length,
      weakPillars: day15Pillars ? (Object.entries(day15Pillars).filter(([, v]) => v < config.greenThreshold).sort((a, b) => a[1] - b[1]).map(([p]) => p)) : [],
    } : null,
    certification, certificationCodes, gateDecisions,
    managerReviews, mentorReviews,
  });

  const usage = usageRes.data ?? [];
  const docs = new Set<string>();
  for (const m of usage) for (const c of (m.citations as { document_id?: string }[] | null) ?? []) if (c.document_id) docs.add(c.document_id);
  const ratingTypes = new Set(["DRAFT_RESPONSE", "INTERNAL_REVIEW", "SCENARIO", "COACHING", "PANEL"]);
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100 : null);
  const practiceScores = scenarioAttempts.filter((s) => !s.is_certification).map((s) => s.reviewer_score ?? s.score);

  const metrics = computeProgress({
    config, journey, today: day, day10Best,
    day15Latest: d15Latest ? { overall: d15Latest.overall_score!, band: d15Latest.band!, pillars: day15Pillars ?? {}, confidence: d15Latest.confidence } : null,
    day15Attempts: day15.length,
    scenarioAverages: { certification: (journey.gates.find((g) => g.code === "G2")?.score ?? null), practice: avg(practiceScores) },
    supportEvents: (supportRes.data ?? []) as SupportEvent[],
    mentorRatings: mentorReviews.filter((r) => r.rating && ratingTypes.has(r.review_type)).map((r) => r.rating!),
    knowledgeUsage: {
      questions: usage.length,
      grounded: usage.filter((m) => m.grounding === "COMPANY_KNOWLEDGE").length,
      insufficient: usage.filter((m) => m.grounding === "INSUFFICIENT").length,
      distinctDocuments: docs.size,
    },
    mentorFeedbackCount: (fbRes.data ?? []).filter((f) => f.author_role === "MENTOR").length + mentorReviews.length,
    managerSignOff: instance.final_decision,
    startDate: instance.start_date,
    independentSince: instance.independent_since,
  });

  const sessions = (sessRes.data ?? []) as SessionRow[];
  const upcoming = sessions
    .filter((s) => s.status !== "CANCELLED" && s.status !== "COMPLETED")
    .map((s) => {
      const d = s.scheduled_at.slice(0, 10);
      const offset = Math.round((Date.parse(d) - Date.parse(todayDate)) / 86_400_000);
      return { id: s.id, title: s.title, dayOffset: offset, when: new Date(s.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.APP_TIMEZONE || "Asia/Kolkata" }) };
    });
  const alerts = computeAlerts(journey, metrics, day, config, upcoming);

  const people = (peopleRes.data ?? []) as PersonRef[];
  const person = (id: string | null) => people.find((p) => p.id === id) ?? null;
  const nameById = new Map(people.map((p) => [p.id, p.full_name]));

  return {
    employee: employee as EmployeeRow,
    people: { mentor: person(employee.mentor_id), boss: person(employee.reporting_boss_id), hr: person(employee.hr_owner_id) },
    instance: instance as InstanceRow,
    config, todayDate, day, journey, metrics, alerts,
    nextAction: nextActionFor(journey),
    day15Pillars, attempts, scenarioAttempts, sessions,
    feedback: (fbRes.data ?? []).map((f) => ({ ...f, author_name: nameById.get(f.author_id) })),
    mentorReviews, managerReviews,
    storedGates: storedGatesRes.data ?? [],
  };
}

export { dateForDay };
