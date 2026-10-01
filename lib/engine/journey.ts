/**
 * Journey engine — the deterministic heart of the Compass.
 *
 * Given the employee's recorded evidence (task states, assessment results,
 * scenario results, human decisions) it derives:
 *   • the status of each of the five gates
 *   • which segments of the journey are unlocked, locked or blocked
 *   • every task's availability (available / locked / blocked / waiting / awaiting review / done)
 *   • each day's status, the journey phase and the exposure flags
 *
 * Calendar time only decides due/overdue. Progression is decided by gates.
 * Readiness is never set by elapsed time; only the Reporting Boss's
 * Day-30 sign-off can produce READY.
 */
import type {
  Band, GateCode, GateDef, GateStatus, ManagerDecisionState, MentorReviewState,
  ProgrammeConfig, Role, TaskDef, TaskState,
} from "@/types/domain";

/* ── Inputs ─────────────────────────────────────────────────────────── */

export interface Day15Result { overall: number; band: Band; at: string; attempt_number: number; weakPillars?: string[] }
export interface CertResult { scenario_code: string; score: number; reviewer_score: number | null; at: string }
export interface GateDecision { code: GateCode; decision: "APPROVED" | "REJECTED" | "EXTENDED"; at: string; by?: string | null; comments?: string | null }

export interface JourneyContext {
  config: ProgrammeConfig;
  today: number;                    // onboarding day number (calendar)
  instanceStatus: string;
  finalDecision: "READY" | "EXTENDED" | "NOT_READY" | null;
  tasks: TaskDef[];
  states: Record<string, TaskState | undefined>;
  dependencies: { task_id: string; depends_on_task_id: string }[];
  gates: GateDef[];
  day10Best: number | null;
  day15Latest: Day15Result | null;
  certification: CertResult[];      // latest attempt per certification scenario
  certificationCodes: string[];     // which scenarios make up the Day-21 certification
  gateDecisions: GateDecision[];    // mentor decisions on G4 (and overrides)
  managerReviews: ManagerDecisionState[];
  mentorReviews: MentorReviewState[];
}

/* ── Outputs ────────────────────────────────────────────────────────── */

export type TaskAvailability = "DONE" | "AVAILABLE" | "WAITING" | "AWAITING_REVIEW" | "LOCKED" | "BLOCKED";

export interface TaskView extends TaskDef {
  state: TaskState | undefined;
  availability: TaskAvailability;
  reason: string | null;
  overdue: boolean;
  behindSchedule: boolean;
  systemDriven: boolean;
  canTick: Role[];   // roles that may tick it by hand (empty for system-driven)
}

export interface GateView {
  code: GateCode;
  id: string;
  name: string;
  day: number;
  status: GateStatus;
  score: number | null;
  band: Band | null;
  requiredTasks: { code: string; title: string; done: boolean }[];
  evidence: Record<string, unknown>;
  decision: string | null;
  nextAction: string;
  approverRole: Role | null;
}

export type DayStatus = "COMPLETED" | "CURRENT" | "AVAILABLE" | "LOCKED" | "BLOCKED" | "REQUIRES_REVIEW" | "UPCOMING";

export interface DayView { day: number; status: DayStatus; isToday: boolean; total: number; done: number; segmentKey: SegmentKey }

export type SegmentKey = "S1" | "S2" | "S3" | "P2A" | "CERT" | "PRICING" | "CUSTOMER" | "PANEL";
export interface SegmentState { key: SegmentKey; from: number; to: number; open: boolean; blocked: boolean; reason: string | null }

export type JourneyPhase = "LEARN" | "PRACTICE" | "GUIDED_OWNERSHIP" | "READY_FOR_PANEL" | "REMEDIATION" | "SIGNED_OFF_READY" | "EXTENDED" | "NOT_READY";

export interface JourneyState {
  gates: GateView[];
  tasks: TaskView[];
  days: DayView[];
  segments: SegmentState[];
  phase: JourneyPhase;
  currentGate: GateView | null;
  exposure: { pricing: "BLOCKED" | "GUIDED" | "DEFERRED"; customer: "BLOCKED" | "SHADOW" | "GUIDED" | "DEFERRED" };
  day15Available: { available: boolean; reason: string | null; isRecheck: boolean };
  day10Available: { available: boolean; reason: string | null };
  certificationAvailable: { available: boolean; reason: string | null };
}

/* ── Helpers ───────────────────────────────────────────────────────── */

const SEGMENT_DEFS: { key: SegmentKey; from: number; to: number }[] = [
  { key: "S1", from: 1, to: 5 },
  { key: "S2", from: 6, to: 10 },
  { key: "S3", from: 11, to: 15 },
  { key: "P2A", from: 16, to: 20 },
  { key: "CERT", from: 21, to: 21 },
  { key: "PRICING", from: 22, to: 25 },
  { key: "CUSTOMER", from: 26, to: 29 },
  { key: "PANEL", from: 30, to: 999 },
];

export function segmentOf(day: number): SegmentKey {
  return SEGMENT_DEFS.find((s) => day >= s.from && day <= s.to)?.key ?? "PANEL";
}

const CLEARED: GateStatus[] = ["PASSED", "APPROVED"];
export const isCleared = (s: GateStatus | undefined) => !!s && CLEARED.includes(s);

function latest<T extends { created_at: string }>(xs: T[], pred: (x: T) => boolean): T | undefined {
  return xs.filter(pred).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

/* ── Engine ────────────────────────────────────────────────────────── */

export function evaluateJourney(ctx: JourneyContext): JourneyState {
  const { config: cfg } = ctx;
  const active = ctx.tasks.filter((t) => t.is_active);
  const done = (t: TaskDef) => ctx.states[t.id]?.status === "COMPLETED";
  const mandatoryFor = (gate: GateCode) => active.filter((t) => t.gate_code === gate && t.is_mandatory);
  const gateDef = (code: GateCode) => ctx.gates.find((g) => g.code === code);
  const reqList = (ts: TaskDef[]) => ts.map((t) => ({ code: t.code, title: t.title, done: done(t) }));

  const mgr = (type: string) => latest(ctx.managerReviews, (r) => r.review_type === type);
  const mentorReview = (type: string) => latest(ctx.mentorReviews, (r) => r.review_type === type);
  const gates: Partial<Record<GateCode, GateView>> = {};
  const mk = (code: GateCode, v: Omit<GateView, "code" | "id" | "name" | "day" | "approverRole">): GateView => {
    const d = gateDef(code);
    return { code, id: d?.id ?? code, name: d?.name ?? code, day: d?.day_number ?? 0, approverRole: d?.approver_role ?? null, ...v };
  };
  const remaining = (ts: TaskDef[]) => ts.filter((t) => !done(t));

  // G1 — tasks
  {
    const req = mandatoryFor("G1");
    const left = remaining(req);
    const status: GateStatus = left.length === 0 ? "PASSED" : req.some(done) ? "IN_PROGRESS" : "NOT_STARTED";
    gates.G1 = mk("G1", {
      status, score: null, band: null, requiredTasks: reqList(req),
      evidence: { completed: req.length - left.length, required: req.length },
      decision: status === "PASSED" ? "All Day 1–5 requirements complete" : null,
      nextAction: status === "PASSED" ? "Proceed to Days 6–10" : `Complete ${left.length} remaining Day 1–5 task${left.length === 1 ? "" : "s"}`,
    });
  }

  // G2 — tasks + Day-10 interim check
  {
    const req = mandatoryFor("G2");
    const left = remaining(req);
    const open = isCleared(gates.G1!.status);
    let status: GateStatus;
    let next: string;
    const score = ctx.day10Best;
    if (!open) { status = "NOT_STARTED"; next = "Unlocks when Gate 1 passes"; }
    else if (score === null) { status = req.some(done) ? "IN_PROGRESS" : "NOT_STARTED"; next = left.length > 1 ? `Complete ${left.length} remaining Day 6–10 items, including the interim knowledge check` : "Take the Day-10 interim knowledge check"; }
    else if (score < cfg.day10PassThreshold) { status = "FAILED"; next = `Interim check ${score}% is below ${cfg.day10PassThreshold}%. Review the weak topics with your mentor and retake.`; }
    else if (left.length > 0) { status = "IN_PROGRESS"; next = `Check passed (${score}%). Complete ${left.length} remaining Day 6–10 task${left.length === 1 ? "" : "s"}`; }
    else { status = "PASSED"; next = "Proceed to Customer 360 (Days 11–15)"; }
    gates.G2 = mk("G2", {
      status, score, band: null, requiredTasks: reqList(req),
      evidence: { day10_best: score, pass_threshold: cfg.day10PassThreshold, completed: req.length - left.length, required: req.length },
      decision: status === "PASSED" ? `Interim check ${score}% ≥ ${cfg.day10PassThreshold}%` : null,
      nextAction: next,
    });
  }

  // G3 — Day-15 four-pillar readiness
  {
    const req = mandatoryFor("G3");
    const left = remaining(req);
    const open = isCleared(gates.G2!.status);
    const r = ctx.day15Latest;
    const progression = mgr("PROGRESSION");
    let status: GateStatus;
    let next: string;
    let decision: string | null = null;
    if (!open) { status = "NOT_STARTED"; next = "Unlocks when Gate 2 passes"; }
    else if (!r) { status = req.some(done) ? "IN_PROGRESS" : "NOT_STARTED"; next = "Complete Customer 360 and the account brief, then take the Day-15 assessment"; }
    else if (r.band === "RED") { status = "FAILED"; decision = `RED (${r.overall}%) — Phase 2 paused`; next = "Complete the remediation plan, then re-assess"; }
    else if (r.band === "AMBER") {
      status = "REQUIRES_REVIEW";
      decision = `AMBER (${r.overall}%) — supervised Phase-2 shadowing only; pricing blocked`;
      next = `Complete the targeted refresh and reach ${cfg.greenThreshold}% on the re-check`;
    } else if (left.length > 0) {
      status = "SUBMITTED";
      decision = `GREEN (${r.overall}%)`;
      const reviews = left.filter((t) => t.owner_role !== "KAM");
      next = reviews.length ? `Awaiting ${reviews.map((t) => t.title.toLowerCase()).join(" and ")} by the Mentor` : `Complete ${left.length} remaining Day 11–15 task${left.length === 1 ? "" : "s"}`;
    } else { status = "PASSED"; decision = `GREEN (${r.overall}%) — proceed to Phase 2`; next = "Begin Phase 2: shadow & prepare"; }
    if (open && r && progression?.decision === "DEFERRED" && (!r.at || progression.created_at >= r.at)) {
      status = "BLOCKED";
      decision = "Progression deferred by Reporting Boss";
      next = "Reporting Boss has deferred progression — see manager comments";
    }
    gates.G3 = mk("G3", {
      status, score: r?.overall ?? null, band: r?.band ?? null, requiredTasks: reqList(req),
      evidence: { attempt: r?.attempt_number ?? 0, weak_pillars: r?.weakPillars ?? [], green: cfg.greenThreshold, amber: cfg.amberThreshold },
      decision, nextAction: next,
    });
  }

  // G4 — scenario certification
  {
    const g3 = gates.G3!.status;
    const open = isCleared(g3);
    const req = mandatoryFor("G4");
    const certs = ctx.certificationCodes.map((code) => ctx.certification.find((c) => c.scenario_code === code));
    const attempted = certs.filter(Boolean) as CertResult[];
    const eff = (c: CertResult) => c.reviewer_score ?? c.score;
    const score = attempted.length ? Math.round((attempted.reduce((s, c) => s + eff(c), 0) / ctx.certificationCodes.length) * 100) / 100 : null;
    const lastAt = attempted.map((c) => c.at).sort().at(-1) ?? "";
    const dec = ctx.gateDecisions.filter((d) => d.code === "G4" && d.at >= lastAt).sort((a, b) => b.at.localeCompare(a.at))[0];
    const nonCertLeft = remaining(req.filter((t) => t.task_type !== "SCENARIO" && t.action_ref !== "gate:G4"));
    let status: GateStatus;
    let next: string;
    let decision: string | null = null;
    if (!cfg.day21Required) { status = "PASSED"; decision = "Not required by programme configuration"; next = "—"; }
    else if (!open) {
      status = g3 === "FAILED" || g3 === "BLOCKED" ? "BLOCKED" : "NOT_STARTED";
      next = "Blocked until the Day-15 gate is cleared";
    } else if (attempted.length < ctx.certificationCodes.length) {
      status = attempted.length || req.some(done) ? "IN_PROGRESS" : "NOT_STARTED";
      next = `Complete ${ctx.certificationCodes.length - attempted.length} remaining certification scenario${ctx.certificationCodes.length - attempted.length === 1 ? "" : "s"}`;
    } else if (dec?.decision === "REJECTED") { status = "FAILED"; decision = "Mentor did not certify"; next = "Retake the scenarios the mentor flagged"; }
    else if (dec?.decision === "EXTENDED") { status = "EXTENDED"; decision = "Certification extended by Mentor"; next = "Additional practice agreed with your mentor"; }
    else if ((score ?? 0) < cfg.day21PassThreshold) { status = "FAILED"; decision = `Average ${score}% below ${cfg.day21PassThreshold}%`; next = "Retake the lowest-scoring scenarios"; }
    else if (dec?.decision === "APPROVED") {
      if (nonCertLeft.length) { status = "SUBMITTED"; next = `Complete ${nonCertLeft.length} remaining Days 16–21 task${nonCertLeft.length === 1 ? "" : "s"}`; decision = "Certified by Mentor"; }
      else { status = "PASSED"; decision = `Certified by Mentor (${score}%)`; next = "Eligible for guided pricing and customer ownership — subject to Reporting Boss approval"; }
    } else { status = "SUBMITTED"; decision = `Rules score ${score}%`; next = "Awaiting Mentor certification review"; }
    gates.G4 = mk("G4", {
      status, score, band: null, requiredTasks: reqList(req),
      evidence: {
        scenarios: ctx.certificationCodes.map((code) => {
          const c = ctx.certification.find((x) => x.scenario_code === code);
          return { code, score: c ? eff(c) : null };
        }),
        day15_baseline: ctx.day15Latest?.overall ?? null,
        delta_vs_day15: score !== null && ctx.day15Latest ? Math.round((score - ctx.day15Latest.overall) * 100) / 100 : null,
        pass_threshold: cfg.day21PassThreshold,
      },
      decision, nextAction: next,
    });
  }

  // Exposure eligibility (needed for G5 prerequisites and segment locks)
  const g4Cleared = isCleared(gates.G4!.status);
  const pricingDecision = mgr("PRICING_EXPOSURE");
  const customerDecision = mgr("CUSTOMER_OWNERSHIP");
  const day15Green = ctx.day15Latest?.band === "GREEN";
  const pricingOpen = g4Cleared && (!cfg.pricingGateRequired || (day15Green && pricingDecision?.decision === "APPROVED"));
  const customerOpen = g4Cleared && (!cfg.customerOwnershipGateRequired || customerDecision?.decision === "APPROVED");

  // G5 — readiness panel
  {
    const req = mandatoryFor("G5");
    const panelTasks = req.filter((t) => t.action_ref?.startsWith("panel:"));
    const workTasks = req.filter((t) => !t.action_ref?.startsWith("panel:")).filter((t) => {
      if (t.exposure === "PRICING") return pricingOpen;
      if (segmentOf(t.day_number) === "CUSTOMER") return customerOpen;
      return true;
    });
    const workLeft = remaining(workTasks);
    const mentorInput = mentorReview("PANEL");
    const hrInput = mgr("HR_PANEL_INPUT");
    let status: GateStatus;
    let next: string;
    let decision: string | null = null;
    if (!g4Cleared) { status = "NOT_STARTED"; next = "Unlocks after scenario certification (Gate 4)"; }
    else if (ctx.finalDecision === "READY") { status = "APPROVED"; decision = "READY — signed off by Reporting Boss"; next = "Independent account handling within approved authority"; }
    else if (ctx.finalDecision === "EXTENDED") { status = "EXTENDED"; decision = "Onboarding extended by Reporting Boss"; next = "Follow the agreed development actions"; }
    else if (ctx.finalDecision === "NOT_READY") { status = "FAILED"; decision = "Not ready — Reporting Boss decision"; next = "Follow the agreed development plan"; }
    else if (workLeft.length) { status = "IN_PROGRESS"; next = `Complete ${workLeft.length} remaining Phase-2 task${workLeft.length === 1 ? "" : "s"} before the panel`; }
    else if (!mentorInput || !hrInput) { status = "IN_PROGRESS"; next = `Awaiting panel input from ${[!mentorInput && "Mentor", !hrInput && "HR"].filter(Boolean).join(" and ")}`; }
    else { status = "SUBMITTED"; next = "Awaiting Reporting Boss final decision"; }
    gates.G5 = mk("G5", {
      status, score: null, band: null, requiredTasks: reqList([...workTasks, ...panelTasks]),
      evidence: { mentor_input: !!mentorInput, hr_input: !!hrInput, pricing_exposure: pricingOpen, customer_ownership: customerOpen },
      decision, nextAction: next,
    });
  }

  const gateList = (["G1", "G2", "G3", "G4", "G5"] as GateCode[]).map((c) => gates[c]!);

  /* ── Segments ── */
  const g3s = gates.G3!.status;
  const seg = (key: SegmentKey, open: boolean, blocked: boolean, reason: string | null): SegmentState => {
    const d = SEGMENT_DEFS.find((s) => s.key === key)!;
    return { key, from: d.from, to: d.to, open, blocked, reason: open ? null : reason };
  };
  const phase2Blocked = g3s === "FAILED" || g3s === "BLOCKED";
  const segments: SegmentState[] = [
    seg("S1", true, false, null),
    seg("S2", isCleared(gates.G1!.status), false, "Unlocks when Gate 1 (Day 5) passes"),
    seg("S3", isCleared(gates.G2!.status), gates.G2!.status === "FAILED", gates.G2!.status === "FAILED" ? "Blocked: Day-10 check below threshold — retake to unlock" : "Unlocks when Gate 2 (Day 10) passes"),
    seg("P2A", isCleared(g3s) || g3s === "REQUIRES_REVIEW", phase2Blocked,
      g3s === "FAILED" ? "Phase 2 paused: Day-15 band RED — remediation plan in progress" : g3s === "BLOCKED" ? "Phase 2 deferred by Reporting Boss" : "Unlocks when the Day-15 gate is cleared"),
    seg("CERT", isCleared(g3s) || !cfg.day21Required, phase2Blocked,
      g3s === "REQUIRES_REVIEW" ? "Blocked until the Day-15 re-check reaches Green" : phase2Blocked ? "Blocked until the Day-15 gate is cleared" : "Unlocks when the Day-15 gate is cleared"),
    seg("PRICING", pricingOpen, pricingDecision?.decision === "DEFERRED" || phase2Blocked,
      !g4Cleared ? "Requires scenario certification (Gate 4)" :
      !day15Green ? `Pricing stays blocked until the Day-15 re-check reaches ${cfg.greenThreshold}%` :
      pricingDecision?.decision === "DEFERRED" ? "Pricing exposure deferred by Reporting Boss" : "Requires Reporting Boss approval for guided pricing exposure"),
    seg("CUSTOMER", customerOpen, customerDecision?.decision === "DEFERRED" || phase2Blocked,
      !g4Cleared ? "Requires scenario certification (Gate 4)" :
      customerDecision?.decision === "DEFERRED" ? "Customer ownership deferred by Reporting Boss" : "Requires Reporting Boss approval for guided customer ownership"),
    seg("PANEL", g4Cleared, phase2Blocked, "Unlocks after scenario certification (Gate 4)"),
  ];
  const segState = (day: number) => segments.find((s) => s.key === segmentOf(day))!;

  /* ── Tasks ── */
  const depsOf = new Map<string, string[]>();
  for (const d of ctx.dependencies) depsOf.set(d.task_id, [...(depsOf.get(d.task_id) ?? []), d.depends_on_task_id]);
  const byId = new Map(active.map((t) => [t.id, t]));

  const assessmentReady = (t: TaskDef) => {
    // An assessment opens once the learning before it in its segment is done.
    const prior = active.filter((x) => x.gate_code === t.gate_code && x.is_mandatory && x.owner_role === "KAM" && x.day_number < t.day_number && x.task_type !== "ASSESSMENT");
    const left = prior.filter((x) => !done(x));
    return left.length ? `Complete ${left.length} earlier task${left.length === 1 ? "" : "s"} in this segment first` : null;
  };

  const tasks: TaskView[] = active
    .slice()
    .sort((a, b) => a.day_number - b.day_number || (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((t) => {
      const state = ctx.states[t.id];
      const s = segState(t.day_number);
      const systemDriven = !!t.action_ref;
      const canTick: Role[] = systemDriven ? [] : [t.owner_role, "HR_ADMIN"].filter((v, i, a) => a.indexOf(v) === i) as Role[];
      let availability: TaskAvailability;
      let reason: string | null = null;
      if (state?.status === "COMPLETED") availability = "DONE";
      else if (state?.status === "SUBMITTED") { availability = "AWAITING_REVIEW"; reason = "Submitted — awaiting reviewer approval"; }
      else if (!s.open) { availability = s.blocked ? "BLOCKED" : "LOCKED"; reason = s.reason; }
      else {
        const unmet = (depsOf.get(t.id) ?? []).map((id) => byId.get(id)).filter((d): d is TaskDef => !!d && !done(d));
        if (unmet.length) { availability = "WAITING"; reason = `Waiting for: ${unmet.map((d) => d.title).join(", ")}`; }
        else if (t.task_type === "ASSESSMENT" && t.owner_role === "KAM" && assessmentReady(t)) { availability = "WAITING"; reason = assessmentReady(t); }
        else { availability = "AVAILABLE"; if (state?.status === "REJECTED") reason = "Changes requested by reviewer — update and resubmit"; }
      }
      const late = t.due_day < ctx.today && availability !== "DONE";
      return {
        ...t, state, availability, reason, systemDriven, canTick,
        overdue: late && (availability === "AVAILABLE" || availability === "WAITING" || availability === "AWAITING_REVIEW"),
        behindSchedule: late,
      };
    });

  /* ── Days ── */
  const maxDay = Math.max(cfg.duration, ...active.map((t) => t.day_number));
  const days: DayView[] = [];
  for (let d = 1; d <= maxDay; d++) {
    const ts = tasks.filter((t) => t.day_number === d && t.is_mandatory);
    const s = segState(d);
    const doneN = ts.filter((t) => t.availability === "DONE").length;
    const gateHere = gateList.find((g) => g.day === d);
    let status: DayStatus;
    if (ts.length && doneN === ts.length && (!gateHere || isCleared(gateHere.status))) status = "COMPLETED";
    else if (!s.open && s.blocked) status = "BLOCKED";
    else if (!s.open) status = "LOCKED";
    else if (ts.some((t) => t.availability === "AWAITING_REVIEW") || (gateHere && ["SUBMITTED", "REQUIRES_REVIEW"].includes(gateHere.status))) status = "REQUIRES_REVIEW";
    else if (d === ctx.today) status = "CURRENT";
    else if (d < ctx.today || ts.some((t) => t.availability === "AVAILABLE" || t.availability === "DONE")) status = "AVAILABLE";
    else status = "UPCOMING";
    if (gateHere && gateHere.status === "FAILED" && status !== "COMPLETED") status = "BLOCKED";
    days.push({ day: d, status, isToday: d === ctx.today, total: ts.length, done: doneN, segmentKey: segmentOf(d) });
  }

  /* ── Phase, exposure, current gate ── */
  let phase: JourneyPhase;
  if (ctx.finalDecision === "READY") phase = "SIGNED_OFF_READY";
  else if (ctx.finalDecision === "EXTENDED") phase = "EXTENDED";
  else if (ctx.finalDecision === "NOT_READY") phase = "NOT_READY";
  else if (g3s === "FAILED" || gates.G4!.status === "FAILED") phase = "REMEDIATION";
  else if (["SUBMITTED", "IN_PROGRESS"].includes(gates.G5!.status) && g4Cleared && gates.G5!.nextAction.startsWith("Awaiting")) phase = "READY_FOR_PANEL";
  else if (g4Cleared) phase = "GUIDED_OWNERSHIP";
  else if (isCleared(g3s) || g3s === "REQUIRES_REVIEW") phase = "PRACTICE";
  else phase = "LEARN";

  const exposure: JourneyState["exposure"] = {
    pricing: pricingOpen ? "GUIDED" : pricingDecision?.decision === "DEFERRED" ? "DEFERRED" : "BLOCKED",
    customer: customerOpen ? "GUIDED" : customerDecision?.decision === "DEFERRED" ? "DEFERRED" : (isCleared(g3s) || g3s === "REQUIRES_REVIEW") ? "SHADOW" : "BLOCKED",
  };

  const currentGate = gateList.find((g) => !isCleared(g.status)) ?? null;

  const day10Task = active.find((t) => t.action_ref === "assessment:DAY10-CHECK");
  const day15Task = active.find((t) => t.action_ref === "assessment:DAY15-READINESS");
  const tv = (t?: TaskDef) => tasks.find((x) => x.id === t?.id);
  const d10 = tv(day10Task);
  const d15 = tv(day15Task);

  // Re-check after AMBER/RED: refresh/remediation tasks for G3 must be done first.
  const latestBand = ctx.day15Latest?.band ?? null;
  const refreshLeft = active.filter((t) => t.gate_code === "G3" && (t.task_type === "REFRESH" || t.task_type === "REMEDIATION") && t.owner_role === "KAM" && !done(t));
  let day15Available: JourneyState["day15Available"];
  if (!isCleared(gates.G2!.status)) day15Available = { available: false, reason: "Unlocks when Gate 2 passes", isRecheck: false };
  else if (latestBand === "GREEN") day15Available = { available: false, reason: "Already Green — no re-assessment needed", isRecheck: false };
  else if (latestBand && refreshLeft.length) day15Available = { available: false, reason: `Complete ${refreshLeft.length} refresh/remediation task${refreshLeft.length === 1 ? "" : "s"} before the re-check`, isRecheck: true };
  else if (latestBand) day15Available = { available: true, reason: null, isRecheck: true };
  else if (d15 && d15.availability === "WAITING") day15Available = { available: false, reason: d15.reason, isRecheck: false };
  else day15Available = { available: true, reason: null, isRecheck: false };
  if (gates.G3!.status === "BLOCKED") day15Available = { available: false, reason: "Progression deferred by Reporting Boss", isRecheck: !!latestBand };

  const day10Available = !isCleared(gates.G1!.status)
    ? { available: false, reason: "Unlocks when Gate 1 passes" }
    : d10 && d10.availability === "WAITING" ? { available: false, reason: d10.reason }
    : isCleared(gates.G2!.status) ? { available: false, reason: "Gate 2 already passed" }
    : { available: true, reason: null };

  const certSeg = segments.find((s) => s.key === "CERT")!;
  const certificationAvailable = certSeg.open ? { available: true, reason: null } : { available: false, reason: certSeg.reason };

  return { gates: gateList, tasks, days, segments, phase, currentGate, exposure, day15Available, day10Available, certificationAvailable };
}

/** Next recommended action for the KAM — deterministic. */
export interface NextAction { kind: "TASK" | "ASSESSMENT" | "SCENARIO" | "WAIT" | "DONE"; title: string; detail: string; taskId?: string; link: string }

export function nextActionFor(state: JourneyState): NextAction {
  const kamTasks = state.tasks.filter((t) => t.owner_role === "KAM" && t.is_mandatory);
  const overdue = kamTasks.find((t) => t.availability === "AVAILABLE" && t.overdue);
  const avail = overdue ?? kamTasks.find((t) => t.availability === "AVAILABLE");
  if (avail) {
    const link = avail.action_ref?.startsWith("assessment:") ? "/assessments"
      : avail.action_ref?.startsWith("scenario:") ? `/scenarios/${avail.action_ref.split(":")[1]}`
      : avail.action_ref === "brief:SUBMIT" ? "/account-brief"
      : `/journey/${avail.day_number}`;
    const kind = avail.action_ref?.startsWith("assessment:") ? "ASSESSMENT" : avail.action_ref?.startsWith("scenario:") ? "SCENARIO" : "TASK";
    return { kind, title: avail.title, detail: `Day ${avail.day_number}${avail.overdue ? " · overdue" : ""} · ${avail.description ?? ""}`.trim(), taskId: avail.id, link };
  }
  if (state.day15Available.available && state.day15Available.isRecheck) {
    return { kind: "ASSESSMENT", title: "Day-15 re-check", detail: "Your refresh is complete — take the re-check.", link: "/assessments" };
  }
  const waiting = kamTasks.find((t) => t.availability === "AWAITING_REVIEW");
  const g = state.currentGate;
  if (g) return { kind: "WAIT", title: g.name, detail: g.nextAction, link: "/journey" };
  if (waiting) return { kind: "WAIT", title: waiting.title, detail: "Awaiting reviewer approval", link: `/journey/${waiting.day_number}` };
  return { kind: "DONE", title: "All gates cleared", detail: "Your readiness decision has been recorded.", link: "/report" };
}
