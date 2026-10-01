import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canTickTask, mayDecide, relationTo } from "@/lib/auth/access";
import { audit } from "./audit";
import { syncEmployeeState } from "./sync";
import { loadSnapshot } from "./snapshot";
import { activeInstance, requireEmployeeAccess, ServiceError, type ActionContext } from "./context";
import type { Role } from "@/types/domain";

export interface ToggleOutcome {
  taskId: string;
  status: string;
  completedAt: string | null;
  progress: { taskCompletionPct: number; overallReadiness: number; gate: string | null; gateStatus: string | null };
}

/**
 * The checkbox path: UI → server action → authorise → Supabase (user client,
 * RLS enforced) → audit → recompute gates/progress → return updated state.
 */
export async function toggleTask(ctx: ActionContext, employeeId: string, taskId: string, done: boolean, evidence?: string): Promise<ToggleOutcome> {
  const emp = await requireEmployeeAccess(ctx, employeeId);
  const snap = await loadSnapshot(ctx.db, employeeId);
  const task = snap.journey.tasks.find((t) => t.id === taskId);
  if (!task) throw new ServiceError("Task not found in this onboarding journey.");
  if (!canTickTask(ctx.actor, emp, task)) {
    throw new ServiceError(task.systemDriven ? "This item completes automatically when the linked activity is done." : "You are not the owner of this task.");
  }
  const prev = task.state?.status ?? "PENDING";

  let next: string;
  if (done) {
    if (task.availability === "LOCKED" || task.availability === "BLOCKED") throw new ServiceError(task.reason ?? "This task is locked.");
    if (task.availability === "WAITING") throw new ServiceError(task.reason ?? "Complete the prerequisite tasks first.");
    if (task.availability === "DONE") throw new ServiceError("Already completed.");
    const needsReview = task.requires_approval && relationTo(ctx.actor, emp) === "SELF";
    next = needsReview ? "SUBMITTED" : "COMPLETED";
  } else {
    if (prev === "PENDING") throw new ServiceError("Task is not completed.");
    // Un-ticking is not allowed once a gate depending on it has been decided by a human.
    const gate = snap.journey.gates.find((g) => g.code === task.gate_code);
    if (gate && ["PASSED", "APPROVED"].includes(gate.status) && gate.approverRole) {
      throw new ServiceError(`${gate.name} has already been decided; this task can no longer be reopened.`);
    }
    next = "PENDING";
  }

  const now = new Date().toISOString();
  const patch = next === "PENDING"
    ? { status: "PENDING", completed_at: null, completed_by: null }
    : next === "SUBMITTED"
      ? { status: "SUBMITTED", completed_at: null, completed_by: null, evidence: evidence ?? null }
      : { status: "COMPLETED", completed_at: now, completed_by: ctx.actor.id, ...(evidence ? { evidence } : {}) };

  // Tasks added to the template after this instance started have no row yet — create it (system), then update as the user.
  if (!task.state) {
    await ctx.admin.from("task_completions").upsert({ instance_id: snap.instance.id, employee_id: employeeId, task_id: taskId }, { onConflict: "instance_id,task_id", ignoreDuplicates: true });
  }

  // Write with the user's own client: RLS + triggers enforce ownership even if this code were bypassed.
  const { data, error } = await ctx.db.from("task_completions").update(patch).eq("instance_id", snap.instance.id).eq("task_id", taskId).select("task_id, status, completed_at");
  if (error) throw new ServiceError(error.message.includes("approval") ? "This task needs reviewer approval — it has been submitted for review instead." : "The database rejected this change.");
  if (!data?.length) throw new ServiceError("You are not permitted to change this task.");

  await audit(ctx.admin, {
    employeeId, actor: ctx.actor,
    event: next === "PENDING" ? "TASK_REOPENED" : next === "SUBMITTED" ? "TASK_SUBMITTED" : "TASK_COMPLETED",
    entityType: "task", entityId: taskId,
    previous: { status: prev }, next: { status: next, code: task.code, title: task.title },
  });

  const fresh = await syncEmployeeState(employeeId, ctx.actor);
  const g = fresh.journey.gates.find((x) => x.code === task.gate_code) ?? null;
  return {
    taskId, status: data[0].status, completedAt: data[0].completed_at,
    progress: { taskCompletionPct: fresh.metrics.taskCompletionPct, overallReadiness: fresh.metrics.overallReadiness, gate: g?.name ?? null, gateStatus: g?.status ?? null },
  };
}

/** Mentor / Reporting Boss approves or rejects a submitted (approval-required) task. */
export async function reviewTask(ctx: ActionContext, employeeId: string, taskId: string, decision: "APPROVE" | "REJECT", comments?: string) {
  const emp = await requireEmployeeAccess(ctx, employeeId);
  if (!mayDecide("TASK_APPROVAL", ctx.actor, emp)) throw new ServiceError("Only the assigned Mentor or Reporting Boss can review submitted work.");
  const inst = await activeInstance(ctx.admin, employeeId);
  const { data: row } = await ctx.admin.from("task_completions").select("status").eq("instance_id", inst.id).eq("task_id", taskId).maybeSingle();
  if (row?.status !== "SUBMITTED") throw new ServiceError("This task is not awaiting review.");
  const status = decision === "APPROVE" ? "COMPLETED" : "REJECTED";
  await ctx.admin.from("task_completions").update({
    status, completed_at: status === "COMPLETED" ? new Date().toISOString() : null, completed_by: status === "COMPLETED" ? ctx.actor.id : null,
    notes: comments ?? null,
  }).eq("instance_id", inst.id).eq("task_id", taskId);
  await ctx.admin.from("mentor_reviews").insert({
    employee_id: employeeId, instance_id: inst.id, mentor_id: ctx.actor.id,
    review_type: "DRAFT_RESPONSE", entity_id: taskId, decision: decision === "APPROVE" ? "APPROVED" : "CHANGES_REQUESTED", comments: comments ?? null,
  });
  await audit(ctx.admin, { employeeId, actor: ctx.actor, event: decision === "APPROVE" ? "TASK_APPROVED" : "TASK_REJECTED", entityType: "task", entityId: taskId, previous: { status: "SUBMITTED" }, next: { status, comments } });
  return syncEmployeeState(employeeId, ctx.actor);
}

/**
 * Completes system-driven tasks (assessment / scenario / review / panel links)
 * when the linked action happens. Called by other services, never by the UI.
 */
export async function completeSystemTasks(admin: SupabaseClient, instanceId: string, actionRef: string, actor: { id: string; role: Role } | null, employeeId: string) {
  const { data: inst } = await admin.from("onboarding_instances").select("template_id").eq("id", instanceId).single();
  const { data: tasks } = await admin.from("tasks").select("id, code, title").eq("action_ref", actionRef).or(`template_id.eq.${inst!.template_id},instance_id.eq.${instanceId}`);
  for (const t of tasks ?? []) {
    const { data: cur } = await admin.from("task_completions").select("status").eq("instance_id", instanceId).eq("task_id", t.id).maybeSingle();
    if (cur?.status === "COMPLETED") continue;
    await admin.from("task_completions").upsert({ instance_id: instanceId, employee_id: employeeId, task_id: t.id, status: "COMPLETED", completed_at: new Date().toISOString(), completed_by: actor?.id ?? null }, { onConflict: "instance_id,task_id" });
    await audit(admin, { employeeId, actor, event: "TASK_COMPLETED", entityType: "task", entityId: t.id, previous: { status: cur?.status ?? "PENDING" }, next: { status: "COMPLETED", code: t.code, via: actionRef } });
  }
}

/** Creates task_completion rows for every template task (and gate rows) — used when onboarding is assigned. */
export async function initialiseInstance(admin: SupabaseClient, instanceId: string, employeeId: string, templateId: string) {
  const { data: tasks } = await admin.from("tasks").select("id").eq("template_id", templateId).eq("is_active", true);
  const rows = (tasks ?? []).map((t) => ({ instance_id: instanceId, employee_id: employeeId, task_id: t.id }));
  if (rows.length) await admin.from("task_completions").upsert(rows, { onConflict: "instance_id,task_id", ignoreDuplicates: true });
  const { data: gates } = await admin.from("gate_definitions").select("id").eq("template_id", templateId);
  const gateRows = (gates ?? []).map((g) => ({ instance_id: instanceId, employee_id: employeeId, gate_id: g.id, status: "NOT_STARTED" }));
  if (gateRows.length) await admin.from("gate_results").upsert(gateRows, { onConflict: "instance_id,gate_id", ignoreDuplicates: true });
}
