"use server";
/**
 * Server actions — the only write path from the UI. Each validates input
 * (zod), resolves the actor, delegates to a service (which authorises, writes,
 * audits and recomputes) and returns a Result. Pages revalidate so every
 * device shows the same persisted state.
 */
import { revalidatePath } from "next/cache";
import { actionContext, run, ServiceError, type Result } from "@/lib/services/context";
import { toggleTask, reviewTask } from "@/lib/services/tasks";
import { startAttempt, submitAttempt } from "@/lib/services/assessments";
import { submitScenario, reviewScenario, decideCertification } from "@/lib/services/scenarios";
import { scheduleSession, rescheduleSession, cancelSession, confirmAttendance } from "@/lib/services/sessions";
import { saveBrief, submitBrief, addStakeholder, removeStakeholder } from "@/lib/services/account";
import { reviewAccountBrief, reviewCustomer360, recordCoaching, recordSupportEvent, submitPanelInput, managerDecision, finalSignOff, type ManagerDecisionType } from "@/lib/services/reviews";
import { escalateToHuman } from "@/lib/ai/assistant";
import {
  TaskToggleSchema, TaskReviewSchema, SubmitAttemptSchema, ScenarioSubmitSchema, ScenarioReviewSchema,
  SessionSchema, BriefSchema, StakeholderSchema, uuid, firstError,
} from "@/lib/security/validation";
import type { z } from "zod";

function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (!r.success) throw new ServiceError(firstError(r.error));
  return r.data;
}

function refresh(...paths: string[]) {
  for (const p of ["/dashboard", "/journey", "/tasks", ...paths]) revalidatePath(p, "layout");
}

/* ── Tasks ─────────────────────────────────────────────── */

export async function toggleTaskAction(input: z.input<typeof TaskToggleSchema>): Promise<Result<Awaited<ReturnType<typeof toggleTask>>>> {
  return run(async () => {
    const v = parse(TaskToggleSchema, input);
    const ctx = await actionContext();
    const out = await toggleTask(ctx, v.employeeId, v.taskId, v.done, v.evidence);
    refresh(`/people/${v.employeeId}`);
    return out;
  });
}

export async function reviewTaskAction(input: z.input<typeof TaskReviewSchema>): Promise<Result<true>> {
  return run(async () => {
    const v = parse(TaskReviewSchema, input);
    const ctx = await actionContext();
    await reviewTask(ctx, v.employeeId, v.taskId, v.decision, v.comments);
    refresh(`/people/${v.employeeId}`, "/mentor", "/manager");
    return true as const;
  });
}

/* ── Assessments & scenarios ───────────────────────────── */

export async function startAttemptAction(code: string): Promise<Result<string>> {
  return run(async () => {
    const ctx = await actionContext();
    const id = await startAttempt(ctx, String(code).slice(0, 40));
    revalidatePath("/assessments");
    return id;
  });
}

export async function submitAttemptAction(input: z.input<typeof SubmitAttemptSchema>): Promise<Result<Awaited<ReturnType<typeof submitAttempt>>>> {
  return run(async () => {
    const v = parse(SubmitAttemptSchema, input);
    const ctx = await actionContext();
    const out = await submitAttempt(ctx, v.attemptId, v.answers, v.confidence);
    refresh("/assessments", "/report");
    return out;
  });
}

export async function submitScenarioAction(input: z.input<typeof ScenarioSubmitSchema>): Promise<Result<Awaited<ReturnType<typeof submitScenario>>>> {
  return run(async () => {
    const v = parse(ScenarioSubmitSchema, input);
    const ctx = await actionContext();
    const out = await submitScenario(ctx, v.code, v.response);
    refresh("/scenarios");
    return out;
  });
}

export async function reviewScenarioAction(input: z.input<typeof ScenarioReviewSchema>): Promise<Result<true>> {
  return run(async () => {
    const v = parse(ScenarioReviewSchema, input);
    const ctx = await actionContext();
    const s = await reviewScenario(ctx, v.attemptId, v.reviewerScore, v.comments);
    refresh(`/people/${s.employee.id}`, "/mentor");
    return true as const;
  });
}

export async function decideCertificationAction(employeeId: string, decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED", comments: string): Promise<Result<true>> {
  return run(async () => {
    parse(uuid, employeeId);
    if (!["APPROVED", "REJECTED", "CHANGES_REQUESTED"].includes(decision)) throw new ServiceError("Invalid decision.");
    const ctx = await actionContext();
    await decideCertification(ctx, employeeId, decision, String(comments).slice(0, 3000));
    refresh(`/people/${employeeId}`, "/mentor");
    return true as const;
  });
}

/* ── Sessions ──────────────────────────────────────────── */

export async function scheduleSessionAction(input: z.input<typeof SessionSchema>): Promise<Result<string>> {
  return run(async () => {
    const v = parse(SessionSchema, input);
    const ctx = await actionContext();
    const id = await scheduleSession(ctx, { ...v, meetingLink: v.meetingLink || undefined });
    refresh("/sessions");
    return id;
  });
}

export async function rescheduleSessionAction(id: string, scheduledAt: string, reason: string): Promise<Result<true>> {
  return run(async () => {
    parse(uuid, id);
    const ctx = await actionContext();
    await rescheduleSession(ctx, id, scheduledAt, String(reason).slice(0, 500));
    refresh("/sessions");
    return true as const;
  });
}

export async function cancelSessionAction(id: string, reason: string): Promise<Result<true>> {
  return run(async () => {
    parse(uuid, id);
    if (!String(reason).trim()) throw new ServiceError("Give a reason for cancelling.");
    const ctx = await actionContext();
    await cancelSession(ctx, id, String(reason).slice(0, 500));
    refresh("/sessions");
    return true as const;
  });
}

export async function attendanceAction(id: string, status: "CONFIRMED" | "ATTENDED" | "ABSENT"): Promise<Result<true>> {
  return run(async () => {
    parse(uuid, id);
    if (!["CONFIRMED", "ATTENDED", "ABSENT"].includes(status)) throw new ServiceError("Invalid status.");
    const ctx = await actionContext();
    await confirmAttendance(ctx, id, status);
    refresh("/sessions");
    return true as const;
  });
}

/* ── Customer 360 / account brief ──────────────────────── */

export async function saveBriefAction(input: z.input<typeof BriefSchema>): Promise<Result<true>> {
  return run(async () => {
    const v = parse(BriefSchema, input);
    const ctx = await actionContext();
    await saveBrief(ctx, v);
    revalidatePath("/account-brief");
    revalidatePath("/customer-360");
    return true as const;
  });
}

export async function submitBriefAction(): Promise<Result<true>> {
  return run(async () => {
    const ctx = await actionContext();
    await submitBrief(ctx);
    refresh("/account-brief", "/customer-360");
    return true as const;
  });
}

export async function addStakeholderAction(employeeId: string, input: z.input<typeof StakeholderSchema>): Promise<Result<true>> {
  return run(async () => {
    parse(uuid, employeeId);
    const v = parse(StakeholderSchema, input);
    const ctx = await actionContext();
    await addStakeholder(ctx, employeeId, v);
    revalidatePath("/customer-360");
    return true as const;
  });
}

export async function removeStakeholderAction(employeeId: string, id: string): Promise<Result<true>> {
  return run(async () => {
    parse(uuid, employeeId); parse(uuid, id);
    const ctx = await actionContext();
    await removeStakeholder(ctx, employeeId, id);
    revalidatePath("/customer-360");
    return true as const;
  });
}

/* ── Human decisions ───────────────────────────────────── */

export async function reviewBriefAction(employeeId: string, kind: "ACCOUNT_BRIEF" | "CUSTOMER_360", decision: "APPROVED" | "CHANGES_REQUESTED", comments: string, rating?: number): Promise<Result<true>> {
  return run(async () => {
    parse(uuid, employeeId);
    if (!["APPROVED", "CHANGES_REQUESTED"].includes(decision)) throw new ServiceError("Invalid decision.");
    const ctx = await actionContext();
    if (kind === "ACCOUNT_BRIEF") await reviewAccountBrief(ctx, employeeId, decision, String(comments).slice(0, 3000), rating);
    else await reviewCustomer360(ctx, employeeId, decision, String(comments).slice(0, 3000), rating);
    refresh(`/people/${employeeId}`, "/mentor");
    return true as const;
  });
}

export async function feedbackAction(employeeId: string, input: { content: string; pillar?: string | null; category: "COACHING" | "STRENGTH" | "DEVELOPMENT" | "GENERAL"; visibleToKam: boolean; rating?: number | null; reinforcement?: string[] }): Promise<Result<true>> {
  return run(async () => {
    parse(uuid, employeeId);
    const ctx = await actionContext();
    await recordCoaching(ctx, employeeId, { ...input, content: String(input.content).slice(0, 3000) });
    refresh(`/people/${employeeId}`);
    return true as const;
  });
}

export async function supportEventAction(employeeId: string, eventType: "MENTOR_HELP" | "COLLEAGUE_HELP" | "ESCALATION" | "INDEPENDENT_RESOLUTION", description: string): Promise<Result<true>> {
  return run(async () => {
    parse(uuid, employeeId);
    if (!["MENTOR_HELP", "COLLEAGUE_HELP", "ESCALATION", "INDEPENDENT_RESOLUTION"].includes(eventType)) throw new ServiceError("Invalid event type.");
    const ctx = await actionContext();
    await recordSupportEvent(ctx, employeeId, eventType, String(description));
    refresh(`/people/${employeeId}`, "/report");
    return true as const;
  });
}

export async function panelInputAction(employeeId: string, recommendation: "READY" | "EXTEND" | "NOT_READY", comments: string, rating?: number): Promise<Result<true>> {
  return run(async () => {
    parse(uuid, employeeId);
    const ctx = await actionContext();
    await submitPanelInput(ctx, employeeId, { recommendation, comments: String(comments).slice(0, 3000), rating });
    refresh(`/people/${employeeId}`, "/mentor", "/manager", "/hr");
    return true as const;
  });
}

export async function managerDecisionAction(employeeId: string, type: ManagerDecisionType, decision: "APPROVED" | "DEFERRED", comments: string, developmentActions: string[] = []): Promise<Result<true>> {
  return run(async () => {
    parse(uuid, employeeId);
    if (!["PROGRESSION", "PRICING_EXPOSURE", "CUSTOMER_OWNERSHIP", "DEVELOPMENT_ACTION"].includes(type)) throw new ServiceError("Invalid decision type.");
    const ctx = await actionContext();
    await managerDecision(ctx, employeeId, type, decision, String(comments).slice(0, 3000), developmentActions.map((d) => String(d).slice(0, 300)).slice(0, 10));
    refresh(`/people/${employeeId}`, "/manager");
    return true as const;
  });
}

export async function finalSignOffAction(employeeId: string, decision: "READY" | "EXTENDED" | "NOT_READY", comments: string, developmentActions: string[], extensionDays: number): Promise<Result<true>> {
  return run(async () => {
    parse(uuid, employeeId);
    if (!["READY", "EXTENDED", "NOT_READY"].includes(decision)) throw new ServiceError("Invalid decision.");
    const ctx = await actionContext();
    await finalSignOff(ctx, employeeId, decision, String(comments).slice(0, 3000), developmentActions.map((d) => String(d).slice(0, 300)).slice(0, 10), Number(extensionDays) || 0);
    refresh(`/people/${employeeId}`, "/manager", "/hr", "/report");
    return true as const;
  });
}

export async function escalateAction(target: "MENTOR" | "REPORTING_BOSS", question: string): Promise<Result<{ sentTo: string }>> {
  return run(async () => {
    if (!["MENTOR", "REPORTING_BOSS"].includes(target)) throw new ServiceError("Invalid target.");
    const ctx = await actionContext();
    const out = await escalateToHuman(ctx, target, String(question).slice(0, 1000));
    refresh();
    return out;
  });
}

export async function markNotificationReadAction(id: string): Promise<Result<true>> {
  return run(async () => {
    parse(uuid, id);
    const ctx = await actionContext({ rateLimit: false });
    await ctx.db.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    revalidatePath("/", "layout");
    return true as const;
  });
}
