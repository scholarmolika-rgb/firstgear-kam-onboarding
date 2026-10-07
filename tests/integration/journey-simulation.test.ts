import { describe, it, expect } from "vitest";
import { evaluateJourney, nextActionFor, type JourneyContext } from "@/lib/engine/journey";
import { computeProgress, dependencyTrend } from "@/lib/engine/progress";
import { planRemediation } from "@/lib/engine/remediation";
import { computeAlerts } from "@/lib/engine/alerts";
import { DEFAULT_CONFIG } from "@/lib/engine/config";
import { freshContext, complete, CERT_CODES } from "../fixtures";
import type { TaskDef } from "@/types/domain";

const byCode = (ctx: JourneyContext, code: string) => ctx.tasks.find((t) => t.code === code)!;
const view = (ctx: JourneyContext, code: string) => evaluateJourney(ctx).tasks.find((t) => t.code === code)!;
const gate = (ctx: JourneyContext, code: string) => evaluateJourney(ctx).gates.find((g) => g.code === code)!;
const kamManual = (from: number, to: number) => (t: TaskDef) => t.day_number >= from && t.day_number <= to && t.owner_role === "KAM" && !t.action_ref;

function progressFor(ctx: JourneyContext) {
  const j = evaluateJourney(ctx);
  return computeProgress({
    config: ctx.config, journey: j, today: ctx.today, day10Best: ctx.day10Best,
    day15Latest: ctx.day15Latest ? { ...ctx.day15Latest, pillars: {}, confidence: 4 } : null,
    day15Attempts: ctx.day15Latest?.attempt_number ?? 0,
    scenarioAverages: { certification: null, practice: null }, supportEvents: [], mentorRatings: [],
    knowledgeUsage: { questions: 0, grounded: 0, insufficient: 0, distinctDocuments: 0 },
    mentorFeedbackCount: 0, managerSignOff: null, startDate: "2026-10-01", independentSince: null,
  });
}

describe("Day 1 for a new KAM", () => {
  it("shows Day 1, LEARN phase, Day-1 tasks available and Phase 2 locked", () => {
    const ctx = freshContext();
    const j = evaluateJourney(ctx);
    expect(j.phase).toBe("LEARN");
    expect(j.days[0]).toMatchObject({ day: 1, status: "CURRENT", isToday: true });
    expect(j.tasks.filter((t) => t.day_number === 1).every((t) => t.availability === "AVAILABLE")).toBe(true);
    expect(view(ctx, "D06-01").availability).toBe("AVAILABLE");
    expect(view(ctx, "D16-01").availability).toBe("LOCKED");
    expect(view(ctx, "D22-01").reason).toMatch(/scenario test/);
    expect(j.exposure).toEqual({ pricing: "BLOCKED", customer: "BLOCKED" });
    expect(j.currentGate?.code).toBe("G1");
  });

  it("ticking a task increases task completion and overall readiness", () => {
    const ctx = freshContext();
    const before = progressFor(ctx);
    complete(ctx, (t) => t.code === "D01-04");
    const after = progressFor(ctx);
    expect(after.taskCompletionPct).toBeGreaterThan(before.taskCompletionPct);
    expect(after.overallReadiness).toBeGreaterThan(before.overallReadiness);
  });

  it("recommends the first available task as next action", () => {
    const n = nextActionFor(evaluateJourney(freshContext()));
    expect(n).toMatchObject({ kind: "TASK", title: "Company profile" });
  });
});

describe("gates follow evidence, not the calendar", () => {
  it("Phase 2 stays locked on Day 20 if the Day-15 gate is not passed", () => {
    const ctx = freshContext({ today: 20 });
    complete(ctx, (t) => t.day_number <= 4);
    expect(gate(ctx, "G1").status).toBe("IN_PROGRESS");
    expect(view(ctx, "D16-01").availability).toBe("LOCKED");
    expect(view(ctx, "D05-01").overdue).toBe(true);
  });

  it("there are exactly three gates: Day 15, Day 21 and Day 30", () => {
    expect(evaluateJourney(freshContext()).gates.map((g) => [g.code, g.day])).toEqual([["G1", 15], ["G2", 21], ["G3", 30]]);
  });

  it("a KAM may work ahead inside an unlocked segment", () => {
    const ctx = freshContext({ today: 1 });
    expect(view(ctx, "D05-08").availability).toBe("AVAILABLE");
  });

  it("dependencies hold a task in WAITING", () => {
    const ctx = freshContext();
    expect(view(ctx, "D05-07").availability).toBe("WAITING");
    complete(ctx, (t) => ["D05-01", "D05-03", "D05-06"].includes(t.code));
    expect(view(ctx, "D05-07").availability).toBe("AVAILABLE");
  });

  it("an interim check below threshold is a checkpoint: retake before the Day-15 assessment", () => {
    const ctx = freshContext({ today: 15 });
    complete(ctx, (t) => t.day_number <= 14);
    ctx.day10Best = 60;
    let j = evaluateJourney(ctx);
    expect(j.tasks.find((t) => t.code === "D11-01")!.availability).toBe("DONE");
    expect(j.day10Available.available).toBe(true);
    expect(j.day15Available).toMatchObject({ available: false });
    expect(j.day15Available.reason).toMatch(/interim/i);
    expect(nextActionFor(j).title).toMatch(/interim/i);
    ctx.day10Best = 80;
    j = evaluateJourney(ctx);
    expect(j.day10Available.available).toBe(false);
    expect(j.day15Available.available).toBe(true);
  });
});

/** Walk a context to the point where the Day-15 assessment has been taken. */
function toDay15(band: "GREEN" | "AMBER" | "RED", overall: number): JourneyContext {
  const ctx = freshContext({ today: 15, day10Best: 85 });
  complete(ctx, (t) => t.day_number <= 14);
  complete(ctx, (t) => t.code === "D15-01");
  ctx.day15Latest = { overall, band, at: "2026-10-15T10:00:00Z", attempt_number: 1, weakPillars: ["PROCESS"] };
  return ctx;
}

describe("Day-15 readiness bands", () => {
  it("the Day-15 assessment unlocks only after Days 1–14 are complete", () => {
    const ctx = freshContext({ today: 15, day10Best: 85 });
    complete(ctx, (t) => t.day_number <= 10);
    expect(evaluateJourney(ctx).day15Available.available).toBe(false);
    complete(ctx, (t) => t.day_number >= 11 && t.day_number <= 14);
    expect(evaluateJourney(ctx).day15Available.available).toBe(true);
  });

  it("GREEN waits for mentor reviews, then passes and enables Phase 2", () => {
    const ctx = toDay15("GREEN", 86);
    expect(gate(ctx, "G1").status).toBe("SUBMITTED");
    expect(gate(ctx, "G1").nextAction).toMatch(/Mentor/);
    complete(ctx, (t) => t.code === "D15-02" || t.code === "D15-03");
    const j = evaluateJourney(ctx);
    expect(j.gates[0].status).toBe("PASSED");
    expect(j.tasks.find((t) => t.code === "D16-01")!.availability).toBe("AVAILABLE");
    expect(j.certificationAvailable.available).toBe(true);
    expect(j.phase).toBe("PRACTICE");
    expect(j.exposure.customer).toBe("SHADOW");
    expect(j.exposure.pricing).toBe("BLOCKED");
  });

  it("AMBER allows supervised shadowing but blocks certification and pricing until a Green re-check", () => {
    const ctx = toDay15("AMBER", 72);
    complete(ctx, (t) => t.code === "D15-02" || t.code === "D15-03");
    const j = evaluateJourney(ctx);
    expect(j.gates[0].status).toBe("REQUIRES_REVIEW");
    expect(j.tasks.find((t) => t.code === "D16-01")!.availability).toBe("AVAILABLE");
    expect(j.tasks.find((t) => t.code === "D21-01")!.availability).toBe("LOCKED");
    expect(j.tasks.find((t) => t.code === "D22-01")!.availability).not.toBe("AVAILABLE");
    expect(j.day15Available).toMatchObject({ available: true, isRecheck: true });
  });

  it("AMBER plan: 3–5 day targeted refresh on weakest pillars, re-check gated on refresh tasks", () => {
    const plan = planRemediation("AMBER", ["PROCESS", "PRODUCT"], 15, 1, DEFAULT_CONFIG)!;
    expect(plan.tasks.filter((t) => t.owner_role === "KAM").map((t) => t.pillar)).toEqual(["PROCESS", "PRODUCT"]);
    expect(Math.max(...plan.tasks.map((t) => t.due_day)) - 15 + 1).toBeLessThanOrEqual(5);
    expect(plan.summary).toMatch(/pricing exposure stays blocked/);

    const ctx = toDay15("AMBER", 72);
    complete(ctx, (t) => t.code === "D15-02" || t.code === "D15-03");
    plan.tasks.forEach((p, i) => ctx.tasks.push({ id: `i-${i}`, code: p.code, day_number: p.day_number, due_day: p.due_day, title: p.title, pillar: p.pillar, task_type: p.task_type, owner_role: p.owner_role, is_mandatory: true, requires_approval: false, exposure: "NONE", gate_code: "G1", action_ref: null, is_active: true, instance_id: "inst" }));
    expect(evaluateJourney(ctx).day15Available.available).toBe(false);
    complete(ctx, (t) => t.code.startsWith("RF-"));
    expect(evaluateJourney(ctx).day15Available.available).toBe(true);
    // Re-check reaches Green → gate passes
    ctx.day15Latest = { overall: 84, band: "GREEN", at: "2026-10-19T10:00:00Z", attempt_number: 2 };
    expect(gate(ctx, "G1").status).toBe("PASSED");
  });

  it("RED pauses Phase 2 entirely and proposes remediation with an extension", () => {
    const ctx = toDay15("RED", 48);
    const j = evaluateJourney(ctx);
    expect(j.gates[0].status).toBe("FAILED");
    expect(j.phase).toBe("REMEDIATION");
    expect(j.tasks.filter((t) => t.day_number >= 16).every((t) => t.availability === "BLOCKED")).toBe(true);
    const plan = planRemediation("RED", ["GOVERNANCE", "PROCESS"], 15, 1, DEFAULT_CONFIG)!;
    expect(plan.extensionDays).toBe(10);
    expect(plan.tasks.some((t) => t.title.startsWith("1:1 coaching"))).toBe(true);
    expect(plan.tasks.some((t) => t.title.includes("mentor pairing"))).toBe(true);
  });

  it("the Reporting Boss can defer progression even on GREEN", () => {
    const ctx = toDay15("GREEN", 90);
    complete(ctx, (t) => t.code === "D15-02" || t.code === "D15-03");
    ctx.managerReviews.push({ review_type: "PROGRESSION", decision: "DEFERRED", created_at: "2026-10-16T09:00:00Z" });
    const j = evaluateJourney(ctx);
    expect(j.gates[0].status).toBe("BLOCKED");
    expect(j.tasks.find((t) => t.code === "D16-01")!.availability).toBe("BLOCKED");
  });
});

describe("Day-21 scenario test, exposure and the Day-30 panel", () => {
  function phase2(): JourneyContext {
    const ctx = toDay15("GREEN", 86);
    ctx.today = 21;
    complete(ctx, (t) => t.code === "D15-02" || t.code === "D15-03");
    complete(ctx, (t) => t.day_number >= 16 && t.day_number <= 20);
    return ctx;
  }
  const certify = (ctx: JourneyContext, score: number) => {
    ctx.certification = CERT_CODES.map((c) => ({ scenario_code: c, score, reviewer_score: null, at: "2026-10-21T10:00:00Z" }));
    complete(ctx, (t) => CERT_CODES.some((c) => t.action_ref === `scenario:${c}`));
  };

  it("certification is scored against the Day-15 baseline and needs a mentor decision", () => {
    const ctx = phase2();
    certify(ctx, 82);
    const g = gate(ctx, "G2");
    expect(g.status).toBe("SUBMITTED");
    expect(g.score).toBe(82);
    expect(g.evidence.delta_vs_day15).toBe(-4);
  });

  it("below the Day-21 threshold the gate fails, whatever the mentor says", () => {
    const ctx = phase2();
    certify(ctx, 60);
    ctx.gateDecisions.push({ code: "G2", decision: "APPROVED", at: "2026-10-21T12:00:00Z" });
    expect(gate(ctx, "G2").status).toBe("FAILED");
  });

  it("pricing exposure needs Gate 2 + Green Day-15 + Reporting Boss approval; it is never automatic", () => {
    const ctx = phase2();
    certify(ctx, 82);
    ctx.gateDecisions.push({ code: "G2", decision: "APPROVED", at: "2026-10-21T12:00:00Z" });
    complete(ctx, (t) => t.action_ref === "gate:G2");
    expect(gate(ctx, "G2").status).toBe("PASSED");
    let j = evaluateJourney(ctx);
    expect(j.exposure.pricing).toBe("BLOCKED");
    expect(j.tasks.find((t) => t.code === "D22-01")!.reason).toMatch(/Reporting Boss approval/);
    ctx.managerReviews.push({ review_type: "PRICING_EXPOSURE", decision: "APPROVED", created_at: "2026-10-21T13:00:00Z" });
    ctx.managerReviews.push({ review_type: "CUSTOMER_OWNERSHIP", decision: "APPROVED", created_at: "2026-10-21T13:00:00Z" });
    j = evaluateJourney(ctx);
    expect(j.exposure).toEqual({ pricing: "GUIDED", customer: "GUIDED" });
    expect(j.phase).toBe("GUIDED_OWNERSHIP");
  });

  it("thirty elapsed days never make a KAM ready — only the Reporting Boss sign-off does", () => {
    const ctx = phase2();
    certify(ctx, 85);
    ctx.gateDecisions.push({ code: "G2", decision: "APPROVED", at: "2026-10-21T12:00:00Z" });
    complete(ctx, (t) => t.action_ref === "gate:G2");
    ctx.managerReviews.push({ review_type: "PRICING_EXPOSURE", decision: "APPROVED", created_at: "2026-10-21T13:00:00Z" });
    ctx.managerReviews.push({ review_type: "CUSTOMER_OWNERSHIP", decision: "APPROVED", created_at: "2026-10-21T13:00:00Z" });
    complete(ctx, (t) => t.day_number >= 22 && t.day_number <= 29);
    ctx.today = 45;
    expect(gate(ctx, "G3").status).toBe("IN_PROGRESS");
    expect(gate(ctx, "G3").nextAction).toMatch(/Mentor and HR/);
    ctx.mentorReviews.push({ review_type: "PANEL", decision: "APPROVED", rating: 4, created_at: "2026-10-30T10:00:00Z" });
    ctx.managerReviews.push({ review_type: "HR_PANEL_INPUT", decision: "NOTED", created_at: "2026-10-30T10:00:00Z" });
    expect(gate(ctx, "G3").status).toBe("SUBMITTED");
    expect(evaluateJourney(ctx).phase).not.toBe("SIGNED_OFF_READY");
    ctx.finalDecision = "READY";
    const j = evaluateJourney(ctx);
    expect(j.gates[2].status).toBe("APPROVED");
    expect(j.phase).toBe("SIGNED_OFF_READY");
  });

  it("deferred pricing does not prevent the panel; pricing tasks are excluded from its prerequisites", () => {
    const ctx = phase2();
    certify(ctx, 85);
    ctx.gateDecisions.push({ code: "G2", decision: "APPROVED", at: "2026-10-21T12:00:00Z" });
    complete(ctx, (t) => t.action_ref === "gate:G2");
    ctx.managerReviews.push({ review_type: "PRICING_EXPOSURE", decision: "DEFERRED", created_at: "2026-10-21T13:00:00Z" });
    ctx.managerReviews.push({ review_type: "CUSTOMER_OWNERSHIP", decision: "APPROVED", created_at: "2026-10-21T13:00:00Z" });
    complete(ctx, (t) => t.day_number >= 26 && t.day_number <= 29);
    const j = evaluateJourney(ctx);
    expect(j.exposure.pricing).toBe("DEFERRED");
    expect(j.tasks.find((t) => t.code === "D22-01")!.availability).toBe("BLOCKED");
    expect(j.gates[2].nextAction).toMatch(/panel input/);
  });
});

describe("full 30-day journey simulation with edge cases", () => {
  it("walks Riya from Day 1 to sign-off: missed task, Amber then Green, certification, panel", () => {
    const ctx = freshContext();
    const log: string[] = [];

    // Governance block (Days 1–4), but miss complaint handling on Day 3 (edge case: missed task)
    ctx.today = 4;
    complete(ctx, (t) => t.day_number <= 4 && t.code !== "D04-04");
    expect(gate(ctx, "G1").status).toBe("IN_PROGRESS");
    expect(view(ctx, "D04-04").overdue).toBe(true);
    expect(computeAlerts(evaluateJourney(ctx), progressFor(ctx), 4, ctx.config, []).some((a) => a.type === "OVERDUE")).toBe(true);
    complete(ctx, (t) => t.code === "D04-04");

    // People (5–7), Product (8–9) and Process (10–12) blocks, then the Day-13 interim check (no gate — Phase 1 stays open)
    ctx.today = 13;
    complete(ctx, kamManual(5, 13));
    complete(ctx, (t) => t.code === "D10-02" || t.code === "D10-04" || t.code === "D10-05");
    ctx.day10Best = 78;
    expect(gate(ctx, "G1").status).toBe("IN_PROGRESS");

    // Day 14 (commercial history and account brief) + Day-15 assessment → AMBER
    ctx.today = 15;
    complete(ctx, (t) => t.day_number <= 14);
    expect(evaluateJourney(ctx).day15Available.available).toBe(true);
    complete(ctx, (t) => t.code === "D15-01");
    ctx.day15Latest = { overall: 74, band: "AMBER", at: "2026-10-15T10:00:00Z", attempt_number: 1, weakPillars: ["PROCESS"] };
    complete(ctx, (t) => t.code === "D15-02" || t.code === "D15-03");
    expect(gate(ctx, "G1").status).toBe("REQUIRES_REVIEW");
    const plan = planRemediation("AMBER", ["PROCESS"], 15, 1, ctx.config)!;
    plan.tasks.forEach((p, i) => ctx.tasks.push({ id: `rf-${i}`, code: p.code, day_number: 15, due_day: p.due_day, title: p.title, pillar: p.pillar, task_type: p.task_type, owner_role: p.owner_role, is_mandatory: true, requires_approval: false, exposure: "NONE", gate_code: "G1", action_ref: null, is_active: true, instance_id: "inst" }));
    complete(ctx, (t) => t.code.startsWith("RF-"));
    ctx.today = 18;
    ctx.day15Latest = { overall: 83.5, band: "GREEN", at: "2026-10-18T10:00:00Z", attempt_number: 2 };
    expect(gate(ctx, "G1").status).toBe("PASSED");
    log.push("G1");

    // Phase 2 shadowing etc.
    ctx.today = 21;
    complete(ctx, (t) => t.day_number >= 16 && t.day_number <= 20);
    ctx.certification = CERT_CODES.map((c, i) => ({ scenario_code: c, score: 78 + i * 2, reviewer_score: null, at: "2026-10-21T10:00:00Z" }));
    complete(ctx, (t) => CERT_CODES.some((c) => t.action_ref === `scenario:${c}`));
    ctx.gateDecisions.push({ code: "G2", decision: "APPROVED", at: "2026-10-21T15:00:00Z" });
    complete(ctx, (t) => t.action_ref === "gate:G2");
    expect(gate(ctx, "G2").status).toBe("PASSED");
    log.push("G2");

    ctx.managerReviews.push({ review_type: "PRICING_EXPOSURE", decision: "APPROVED", created_at: "2026-10-22T09:00:00Z" });
    ctx.managerReviews.push({ review_type: "CUSTOMER_OWNERSHIP", decision: "APPROVED", created_at: "2026-10-22T09:00:00Z" });
    ctx.today = 30;
    complete(ctx, (t) => t.day_number >= 22 && t.day_number <= 29);
    ctx.mentorReviews.push({ review_type: "PANEL", decision: "APPROVED", rating: 4, created_at: "2026-10-30T10:00:00Z" });
    ctx.managerReviews.push({ review_type: "HR_PANEL_INPUT", decision: "NOTED", created_at: "2026-10-30T10:00:00Z" });
    complete(ctx, (t) => t.code === "D30-01" || t.code === "D30-02");
    expect(evaluateJourney(ctx).phase).toBe("READY_FOR_PANEL");
    ctx.finalDecision = "READY";
    complete(ctx, (t) => t.code === "D30-03");
    const end = evaluateJourney(ctx);
    expect(end.gates.every((g) => ["PASSED", "APPROVED"].includes(g.status))).toBe(true);
    expect(end.phase).toBe("SIGNED_OFF_READY");
    const p = progressFor(ctx);
    expect(p.taskCompletionPct).toBe(100);
    expect(p.reassessmentCount).toBe(1);
    log.push("G3");
    expect(log).toEqual(["G1", "G2", "G3"]);
  });
});

describe("dependency trend", () => {
  it("reports insufficient data rather than inventing a trend", () => {
    expect(dependencyTrend([], 10).direction).toBe("INSUFFICIENT_DATA");
    expect(dependencyTrend([{ event_type: "MENTOR_HELP", day_number: 2 }], 10).direction).toBe("INSUFFICIENT_DATA");
  });

  it("shows improving independence when dependent events fall", () => {
    const ev = [
      ...Array(4).fill({ event_type: "MENTOR_HELP", day_number: 2 }),
      { event_type: "INDEPENDENT_RESOLUTION", day_number: 3 },
      { event_type: "MENTOR_HELP", day_number: 7 },
      ...Array(3).fill({ event_type: "INDEPENDENT_RESOLUTION", day_number: 8 }),
    ];
    const t = dependencyTrend(ev, 10);
    expect(t.series[0].index).toBe(0.8);
    expect(t.series[1].index).toBe(0.25);
    expect(t.direction).toBe("IMPROVING");
  });
});
