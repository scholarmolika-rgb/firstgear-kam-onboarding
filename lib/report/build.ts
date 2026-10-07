/**
 * Progress report — a structured object built only from the snapshot, so the
 * on-screen view, print view, CSV and PDF all show identical numbers.
 */
import type { Snapshot } from "@/lib/services/snapshot";
import { PILLAR_LABEL, PILLARS, type Role } from "@/types/domain";

export interface ProgressReport {
  generatedAt: string;
  audience: Role;
  executiveSummary: string;
  profile: { name: string; code: string; role: string; department: string; location: string | null; manager: string; mentor: string; hr: string; joiningDate: string; joiningType: string; assignedCustomer: string | null };
  onboarding: { startDate: string; currentDay: number; duration: number; daysRemaining: number; phase: string; status: string };
  progress: { overallReadiness: number; taskCompletionPct: number; learningCompletionPct: number; overdue: number; behindSchedule: number };
  scores: { governance: number | null; people: number | null; process: number | null; product: number | null; day10: number | null; day15: number | null; day21Scenario: number | null; band: string | null; reassessments: number; confidence: number | null };
  gates: { code: string; name: string; day: number; status: string; score: number | null; decision: string | null; nextAction: string }[];
  completedGates: string[];
  pendingGates: string[];
  overdueItems: { code: string; title: string; dueDay: number }[];
  weakPillars: string[];
  recommendedActions: string[];
  assessmentHistory: { assessment: string; attempt: number; score: number | null; band: string | null; date: string | null }[];
  scenarioPerformance: { scenario: string; certification: boolean; score: number; reviewerScore: number | null; date: string }[];
  sessions: { title: string; type: string; when: string; status: string }[];
  mentorFeedback: { date: string; text: string }[];
  bossFeedback: { date: string; text: string }[];
  knowledgeUsage: { questions: number; grounded: number; insufficient: number; distinctDocuments: number };
  responseQuality: number | null;
  customerReadiness: string;
  pricingReadiness: string;
  finalDecision: string;
}

const PHASE_LABEL: Record<string, string> = {
  LEARN: "Learn", PRACTICE: "Practice", GUIDED_OWNERSHIP: "Guided ownership", READY_FOR_PANEL: "Ready for panel",
  REMEDIATION: "Remediation", SIGNED_OFF_READY: "Signed off — ready", EXTENDED: "Extended", NOT_READY: "Not ready",
};

export function phaseLabel(p: string) { return PHASE_LABEL[p] ?? p; }

export function buildReport(s: Snapshot, audience: Role): ProgressReport {
  const m = s.metrics;
  const pillars = s.day15Pillars;
  const g = s.journey.gates;
  const cleared = g.filter((x) => ["PASSED", "APPROVED"].includes(x.status));
  const pending = g.filter((x) => !["PASSED", "APPROVED"].includes(x.status));
  const weak = pillars ? PILLARS.filter((p) => (pillars[p] ?? 0) < s.config.greenThreshold).map((p) => `${PILLAR_LABEL[p]} (${pillars[p]}%)`) : [];
  const overdue = s.journey.tasks.filter((t) => t.overdue && t.owner_role === "KAM");

  const actions: string[] = [];
  if (s.nextAction.kind !== "DONE") actions.push(`${s.nextAction.title}: ${s.nextAction.detail}`);
  if (overdue.length) actions.push(`Close ${overdue.length} overdue task${overdue.length === 1 ? "" : "s"} (oldest: ${overdue[0].title}, due Day ${overdue[0].due_day}).`);
  for (const x of weak) actions.push(`Reinforce ${x} with mentor coaching before the re-check.`);
  if (s.journey.currentGate && s.journey.currentGate.approverRole && s.journey.currentGate.status === "SUBMITTED") actions.push(`${s.journey.currentGate.approverRole === "MENTOR" ? "Mentor" : "Reporting Boss"} decision pending on ${s.journey.currentGate.name}.`);

  const cust = s.journey.exposure.customer;
  const price = s.journey.exposure.pricing;
  const customerReadiness = cust === "GUIDED" ? "Guided customer ownership approved by Reporting Boss" : cust === "SHADOW" ? "Shadowing / supervised low-risk actions only" : cust === "DEFERRED" ? "Deferred by Reporting Boss" : "No customer exposure — gates not yet cleared";
  const pricingReadiness = price === "GUIDED" ? "Guided pricing exposure (joint with Reporting Boss; no autonomous pricing)" : price === "DEFERRED" ? "Deferred by Reporting Boss" : "Blocked — knowledge only";
  const finalDecision = s.instance.final_decision ? `${s.instance.final_decision} — recorded ${s.instance.final_decision_at?.slice(0, 10)} by Reporting Boss` : "Pending — readiness is a human decision made at the Day-30 panel";

  const execSummary = [
    `${s.employee.full_name} is on Day ${s.day} of ${s.config.duration} (${phaseLabel(s.journey.phase)}).`,
    `Overall readiness ${m.overallReadiness}% with ${m.taskCompletionPct}% of mandatory tasks complete and ${cleared.length} of ${g.length} gates cleared.`,
    m.band ? `Latest Day-15 result: ${m.band} (${m.assessmentScore}%).` : "Day-15 assessment not yet taken.",
    m.scenarioScore !== null ? `Day-21 certification score ${m.scenarioScore}%.` : "",
    s.journey.currentGate ? `Current gate: ${s.journey.currentGate.name} — ${s.journey.currentGate.nextAction}.` : "All gates cleared.",
  ].filter(Boolean).join(" ");

  const at = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return {
    generatedAt: new Date().toISOString(),
    audience,
    executiveSummary: execSummary,
    profile: {
      name: s.employee.full_name, code: s.employee.employee_code, role: s.employee.designation, department: s.employee.department, location: s.employee.location,
      manager: s.people.boss?.full_name ?? "—", mentor: s.people.mentor?.full_name ?? "—", hr: s.people.hr?.full_name ?? "—",
      joiningDate: s.employee.joining_date, joiningType: s.employee.joining_type === "REASSIGNED" ? "Reassigned" : "New joiner", assignedCustomer: s.employee.assigned_customer,
    },
    onboarding: { startDate: s.instance.start_date, currentDay: s.day, duration: s.config.duration, daysRemaining: Math.max(0, s.config.duration + s.instance.extension_days - s.day), phase: phaseLabel(s.journey.phase), status: s.instance.status },
    progress: { overallReadiness: m.overallReadiness, taskCompletionPct: m.taskCompletionPct, learningCompletionPct: m.learningCompletionPct, overdue: m.overdueCount, behindSchedule: m.behindScheduleCount },
    scores: {
      governance: pillars?.GOVERNANCE ?? null, people: pillars?.PEOPLE ?? null, process: pillars?.PROCESS ?? null, product: pillars?.PRODUCT ?? null,
      day10: s.attempts.filter((a) => a.stage === "DAY10_CHECK" && a.overall_score !== null).reduce<number | null>((b, a) => Math.max(b ?? 0, a.overall_score!), null),
      day15: m.assessmentScore, day21Scenario: m.scenarioScore, band: m.band, reassessments: m.reassessmentCount, confidence: m.confidence,
    },
    gates: g.map((x) => ({ code: x.code, name: x.name, day: x.day, status: x.status, score: x.score, decision: x.decision, nextAction: x.nextAction })),
    completedGates: cleared.map((x) => `${x.code} ${x.name}`),
    pendingGates: pending.map((x) => `${x.code} ${x.name} (${x.status.replace(/_/g, " ").toLowerCase()})`),
    overdueItems: overdue.map((t) => ({ code: t.code, title: t.title, dueDay: t.due_day })),
    weakPillars: weak,
    recommendedActions: actions.length ? actions : ["Continue at standard cadence."],
    assessmentHistory: s.attempts.filter((a) => a.status !== "IN_PROGRESS").map((a) => ({ assessment: a.code, attempt: a.attempt_number, score: a.overall_score, band: a.band, date: a.submitted_at ? at(a.submitted_at) : null })),
    scenarioPerformance: s.scenarioAttempts.map((x) => ({ scenario: x.title, certification: x.is_certification, score: x.score, reviewerScore: x.reviewer_score, date: at(x.created_at) })),
    sessions: s.sessions.map((x) => ({ title: x.title, type: x.session_type, when: new Date(x.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.APP_TIMEZONE || "Asia/Kolkata" }), status: x.status })),
    mentorFeedback: [
      ...s.feedback.filter((f) => f.author_role === "MENTOR").map((f) => ({ date: at(f.created_at), text: f.content })),
      ...s.mentorReviews.filter((r) => r.comments && r.review_type !== "COACHING").map((r) => ({ date: at(r.created_at), text: `${r.review_type.replace(/_/g, " ")}: ${r.decision} — ${r.comments}` })),
    ],
    bossFeedback: [
      ...s.feedback.filter((f) => f.author_role === "REPORTING_BOSS").map((f) => ({ date: at(f.created_at), text: f.content })),
      ...s.managerReviews.filter((r) => r.review_type !== "HR_PANEL_INPUT").map((r) => ({ date: at(r.created_at), text: `${r.review_type.replace(/_/g, " ")}: ${r.decision}${r.comments ? ` — ${r.comments}` : ""}` })),
    ],
    knowledgeUsage: m.knowledgeUsage,
    responseQuality: m.responseQuality,
    customerReadiness, pricingReadiness, finalDecision,
  };
}

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Flat section,field,value CSV — opens cleanly in Excel. */
export function reportToCsv(r: ProgressReport): string {
  const rows: [string, string, unknown][] = [
    ["Report", "Generated", r.generatedAt], ["Report", "Audience", r.audience], ["Report", "Executive summary", r.executiveSummary],
    ...Object.entries(r.profile).map(([k, v]) => ["Profile", k, v] as [string, string, unknown]),
    ...Object.entries(r.onboarding).map(([k, v]) => ["Onboarding", k, v] as [string, string, unknown]),
    ...Object.entries(r.progress).map(([k, v]) => ["Progress", k, v] as [string, string, unknown]),
    ...Object.entries(r.scores).map(([k, v]) => ["Scores", k, v] as [string, string, unknown]),
    ...r.gates.map((g) => ["Gates", `${g.code} ${g.name} (Day ${g.day})`, `${g.status}${g.score !== null ? ` · ${g.score}%` : ""} · ${g.nextAction}`] as [string, string, unknown]),
    ...r.overdueItems.map((o) => ["Overdue", o.code, `${o.title} (due Day ${o.dueDay})`] as [string, string, unknown]),
    ...r.weakPillars.map((w) => ["Weak pillars", "pillar", w] as [string, string, unknown]),
    ...r.recommendedActions.map((a, i) => ["Recommended actions", String(i + 1), a] as [string, string, unknown]),
    ...r.assessmentHistory.map((a) => ["Assessment history", `${a.assessment} #${a.attempt}`, `${a.score ?? ""}% ${a.band ?? ""} ${a.date ?? ""}`] as [string, string, unknown]),
    ...r.scenarioPerformance.map((s) => ["Scenario performance", s.scenario, `${s.score}%${s.reviewerScore !== null ? ` (reviewed ${s.reviewerScore}%)` : ""}${s.certification ? " certification" : " practice"} ${s.date}`] as [string, string, unknown]),
    ...r.sessions.map((s) => ["Sessions", s.title, `${s.type} · ${s.when} · ${s.status}`] as [string, string, unknown]),
    ...r.mentorFeedback.map((f) => ["Mentor feedback", f.date, f.text] as [string, string, unknown]),
    ...r.bossFeedback.map((f) => ["Reporting Boss feedback", f.date, f.text] as [string, string, unknown]),
    ...Object.entries(r.knowledgeUsage).map(([k, v]) => ["Knowledge source usage", k, v] as [string, string, unknown]),
    ["Readiness", "response quality", r.responseQuality], ["Readiness", "customer", r.customerReadiness], ["Readiness", "pricing", r.pricingReadiness], ["Readiness", "final Day-30 decision", r.finalDecision],
  ];
  return ["section,field,value", ...rows.map((x) => x.map(esc).join(","))].join("\n");
}
