import "server-only";
import { mayDecide, relationTo } from "@/lib/auth/access";
import { audit } from "./audit";
import { completeSystemTasks } from "./tasks";
import { syncEmployeeState } from "./sync";
import { loadSnapshot } from "./snapshot";
import { notifyOne } from "@/lib/notifications/service";
import { activeInstance, requireEmployeeAccess, ServiceError, type ActionContext } from "./context";

/* ── Mentor ─────────────────────────────────────────────────────── */

export async function reviewAccountBrief(ctx: ActionContext, employeeId: string, decision: "APPROVED" | "CHANGES_REQUESTED", comments: string, rating?: number) {
  const emp = await requireEmployeeAccess(ctx, employeeId);
  if (!mayDecide("ACCOUNT_BRIEF_REVIEW", ctx.actor, emp)) throw new ServiceError("Only the assigned Mentor can review the account brief.");
  const inst = await activeInstance(ctx.admin, employeeId);
  const { data: brief } = await ctx.admin.from("account_briefs").select("id, status").eq("employee_id", employeeId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!brief) throw new ServiceError("No account brief has been created yet.");
  if (brief.status === "DRAFT") throw new ServiceError("The KAM has not submitted the account brief yet.");
  if (decision === "CHANGES_REQUESTED" && !comments.trim()) throw new ServiceError("Explain what needs to change.");
  // Mentor writes the decision with their own client — RLS + trigger verify the mentor relationship.
  const { error } = await ctx.db.from("account_briefs").update({
    status: decision, approved: decision === "APPROVED", reviewed_by: ctx.actor.id, reviewed_at: new Date().toISOString(), review_comments: comments || null,
  }).eq("id", brief.id);
  if (error) throw new ServiceError("The database rejected the review.");
  await ctx.admin.from("mentor_reviews").insert({ employee_id: employeeId, instance_id: inst.id, mentor_id: ctx.actor.id, review_type: "ACCOUNT_BRIEF", entity_id: brief.id, decision, rating: rating ?? null, comments: comments || null });
  if (decision === "APPROVED") await completeSystemTasks(ctx.admin, inst.id, "review:ACCOUNT_BRIEF", ctx.actor, employeeId);
  await audit(ctx.admin, { employeeId, actor: ctx.actor, event: "MENTOR_REVIEWED", entityType: "account_brief", entityId: brief.id, previous: { status: brief.status }, next: { decision, comments } });
  return syncEmployeeState(employeeId, ctx.actor);
}

export async function reviewCustomer360(ctx: ActionContext, employeeId: string, decision: "APPROVED" | "CHANGES_REQUESTED", comments: string, rating?: number) {
  const emp = await requireEmployeeAccess(ctx, employeeId);
  if (!mayDecide("CUSTOMER_360_REVIEW", ctx.actor, emp)) throw new ServiceError("Only the assigned Mentor can review the Customer 360.");
  const inst = await activeInstance(ctx.admin, employeeId);
  const { count } = await ctx.admin.from("stakeholder_maps").select("id", { count: "exact", head: true }).eq("employee_id", employeeId);
  if (decision === "APPROVED" && (count ?? 0) < 4) throw new ServiceError("The stakeholder map needs at least four contacts (purchasing, engineering, quality, SCM/plant) before approval.");
  await ctx.admin.from("mentor_reviews").insert({ employee_id: employeeId, instance_id: inst.id, mentor_id: ctx.actor.id, review_type: "CUSTOMER_360", decision, rating: rating ?? null, comments: comments || null });
  if (decision === "APPROVED") await completeSystemTasks(ctx.admin, inst.id, "review:CUSTOMER_360", ctx.actor, employeeId);
  await audit(ctx.admin, { employeeId, actor: ctx.actor, event: "MENTOR_REVIEWED", entityType: "customer_360", next: { decision, comments } });
  return syncEmployeeState(employeeId, ctx.actor);
}

export async function recordCoaching(ctx: ActionContext, employeeId: string, input: { content: string; pillar?: string | null; category: "COACHING" | "STRENGTH" | "DEVELOPMENT" | "GENERAL"; visibleToKam: boolean; rating?: number | null; reinforcement?: string[] }) {
  const emp = await requireEmployeeAccess(ctx, employeeId);
  const rel = relationTo(ctx.actor, emp);
  if (!rel || rel === "SELF") throw new ServiceError("Only the Mentor, Reporting Boss or HR can record feedback.");
  if (input.content.trim().length < 5) throw new ServiceError("Feedback is too short.");
  const { error } = await ctx.db.from("feedback").insert({ employee_id: employeeId, author_id: ctx.actor.id, author_role: ctx.actor.role, category: input.category, pillar: input.pillar || null, content: input.content.trim(), visible_to_kam: input.visibleToKam });
  if (error) throw new ServiceError("Could not save feedback.");
  if (rel === "MENTOR") {
    const inst = await activeInstance(ctx.admin, employeeId);
    await ctx.admin.from("mentor_reviews").insert({ employee_id: employeeId, instance_id: inst.id, mentor_id: ctx.actor.id, review_type: "COACHING", decision: "NOTED", rating: input.rating ?? null, comments: input.content.trim(), reinforcement_areas: input.reinforcement ?? [] });
  }
  await audit(ctx.admin, { employeeId, actor: ctx.actor, event: "FEEDBACK_RECORDED", entityType: "feedback", next: { category: input.category, pillar: input.pillar } });
  return syncEmployeeState(employeeId, ctx.actor);
}

export async function recordSupportEvent(ctx: ActionContext, employeeId: string, eventType: "MENTOR_HELP" | "COLLEAGUE_HELP" | "ESCALATION" | "INDEPENDENT_RESOLUTION", description: string) {
  await requireEmployeeAccess(ctx, employeeId);
  const snap = await loadSnapshot(ctx.admin, employeeId);
  const { error } = await ctx.db.from("support_events").insert({ employee_id: employeeId, instance_id: snap.instance.id, event_type: eventType, day_number: Math.max(1, snap.day), description: description.slice(0, 500), recorded_by: ctx.actor.id });
  if (error) throw new ServiceError("Could not record the event.");
  await audit(ctx.admin, { employeeId, actor: ctx.actor, event: "SUPPORT_EVENT", entityType: "support_event", next: { eventType, day: snap.day } });
  return syncEmployeeState(employeeId, ctx.actor);
}

/* ── Panel (Day 30) ─────────────────────────────────────────────── */

export async function submitPanelInput(ctx: ActionContext, employeeId: string, input: { recommendation: "READY" | "EXTEND" | "NOT_READY"; comments: string; rating?: number }) {
  const emp = await requireEmployeeAccess(ctx, employeeId);
  const rel = relationTo(ctx.actor, emp);
  const snap = await loadSnapshot(ctx.admin, employeeId);
  const g5 = snap.journey.gates.find((g) => g.code === "G5")!;
  const g4 = snap.journey.gates.find((g) => g.code === "G4")!;
  if (!["PASSED", "APPROVED"].includes(g4.status)) throw new ServiceError("The readiness panel opens after scenario certification (Gate 4).");
  if (["APPROVED", "EXTENDED", "FAILED"].includes(g5.status) && snap.instance.final_decision) throw new ServiceError("The final decision has already been recorded.");
  if (!input.comments.trim()) throw new ServiceError("Panel input needs written evidence-based comments.");
  const inst = snap.instance;
  if (rel === "MENTOR") {
    await ctx.admin.from("mentor_reviews").insert({ employee_id: employeeId, instance_id: inst.id, mentor_id: ctx.actor.id, review_type: "PANEL", decision: input.recommendation === "READY" ? "APPROVED" : "CHANGES_REQUESTED", rating: input.rating ?? null, comments: `[${input.recommendation}] ${input.comments}` });
    await completeSystemTasks(ctx.admin, inst.id, "panel:MENTOR", ctx.actor, employeeId);
  } else if (rel === "HR_ADMIN") {
    await ctx.admin.from("manager_reviews").insert({ employee_id: employeeId, instance_id: inst.id, manager_id: ctx.actor.id, review_type: "HR_PANEL_INPUT", decision: "NOTED", comments: `[${input.recommendation}] ${input.comments}` });
    await completeSystemTasks(ctx.admin, inst.id, "panel:HR", ctx.actor, employeeId);
  } else throw new ServiceError("Panel input is recorded by the Mentor and HR; the Reporting Boss records the final decision.");
  await audit(ctx.admin, { employeeId, actor: ctx.actor, event: rel === "MENTOR" ? "MENTOR_REVIEWED" : "MANAGER_DECISION", entityType: "panel", next: input });
  return syncEmployeeState(employeeId, ctx.actor);
}

/* ── Reporting Boss ─────────────────────────────────────────────── */

export type ManagerDecisionType = "PROGRESSION" | "PRICING_EXPOSURE" | "CUSTOMER_OWNERSHIP" | "DEVELOPMENT_ACTION";

export async function managerDecision(ctx: ActionContext, employeeId: string, type: ManagerDecisionType, decision: "APPROVED" | "DEFERRED", comments: string, developmentActions: string[] = []) {
  const emp = await requireEmployeeAccess(ctx, employeeId);
  const authority = type === "DEVELOPMENT_ACTION" ? "PROGRESSION" : type;
  if (!mayDecide(authority, ctx.actor, emp)) throw new ServiceError("Only the assigned Reporting Boss can make this decision.");
  if (!comments.trim()) throw new ServiceError("Record the reason for this decision.");
  const snap = await loadSnapshot(ctx.admin, employeeId);
  const g4 = snap.journey.gates.find((g) => g.code === "G4")!;
  if (decision === "APPROVED" && (type === "PRICING_EXPOSURE" || type === "CUSTOMER_OWNERSHIP") && !["PASSED", "APPROVED"].includes(g4.status) && snap.config.day21Required) {
    throw new ServiceError("Guided exposure can only be approved after scenario certification (Gate 4) passes.");
  }
  if (decision === "APPROVED" && type === "PRICING_EXPOSURE" && snap.config.pricingGateRequired && snap.metrics.band !== "GREEN") {
    throw new ServiceError(`Pricing exposure requires a Green Day-15 result (latest: ${snap.metrics.band ?? "not assessed"}). A re-check must reach ${snap.config.greenThreshold}% first.`);
  }
  // Written as the boss — RLS verifies the reporting relationship.
  const { error } = await ctx.db.from("manager_reviews").insert({ employee_id: employeeId, instance_id: snap.instance.id, manager_id: ctx.actor.id, review_type: type, decision: type === "DEVELOPMENT_ACTION" ? "NOTED" : decision, comments, development_actions: developmentActions });
  if (error) throw new ServiceError("The database rejected this decision.");
  await audit(ctx.admin, { employeeId, actor: ctx.actor, event: decision === "DEFERRED" ? "MANAGER_DEFERRED" : "MANAGER_APPROVED", entityType: "manager_review", next: { type, decision, comments, developmentActions } });
  if (emp.profile_id) await notifyOne(ctx.admin, { recipientId: emp.profile_id, employeeId, type: "MANAGER_DECISION", severity: decision === "DEFERRED" ? "ATTENTION" : "INFO", title: `Reporting Boss ${decision === "DEFERRED" ? "deferred" : "approved"}: ${type.replace(/_/g, " ").toLowerCase()}`, body: comments, link: "/journey", dedupeKey: `${employeeId}:mgr-${type}-${Date.now()}` });
  return syncEmployeeState(employeeId, ctx.actor);
}

export async function finalSignOff(ctx: ActionContext, employeeId: string, decision: "READY" | "EXTENDED" | "NOT_READY", comments: string, developmentActions: string[], extensionDays = 0) {
  const emp = await requireEmployeeAccess(ctx, employeeId);
  if (!mayDecide("DAY30_SIGNOFF", ctx.actor, emp)) throw new ServiceError("Only the assigned Reporting Boss can record the Day-30 readiness decision.");
  if (!comments.trim()) throw new ServiceError("The final decision needs written justification.");
  const snap = await loadSnapshot(ctx.admin, employeeId);
  const g5 = snap.journey.gates.find((g) => g.code === "G5")!;
  if (g5.status !== "SUBMITTED") throw new ServiceError(`The panel is not ready for a decision: ${g5.nextAction}.`);
  if (decision === "EXTENDED" && (extensionDays < 1 || extensionDays > 60)) throw new ServiceError("Extension must be 1–60 days.");
  const { error } = await ctx.db.from("manager_reviews").insert({ employee_id: employeeId, instance_id: snap.instance.id, manager_id: ctx.actor.id, review_type: "DAY30_SIGNOFF", decision, comments, development_actions: developmentActions });
  if (error) throw new ServiceError("The database rejected this decision.");
  const now = new Date().toISOString();
  await ctx.admin.from("onboarding_instances").update({
    final_decision: decision, final_decision_at: now, final_decision_by: ctx.actor.id,
    status: decision === "READY" ? "READY" : decision === "EXTENDED" ? "EXTENDED" : "NOT_READY",
    extension_days: decision === "EXTENDED" ? snap.instance.extension_days + extensionDays : snap.instance.extension_days,
    independent_since: decision === "READY" ? snap.todayDate : null,
  }).eq("id", snap.instance.id);
  await ctx.admin.from("gate_results").update({ assessor_id: ctx.actor.id, comments }).eq("instance_id", snap.instance.id).eq("gate_id", g5.id);
  await completeSystemTasks(ctx.admin, snap.instance.id, "panel:SIGNOFF", ctx.actor, employeeId);
  await audit(ctx.admin, { employeeId, actor: ctx.actor, event: "FINAL_DECISION", entityType: "onboarding_instance", entityId: snap.instance.id, previous: { final_decision: snap.instance.final_decision }, next: { decision, comments, developmentActions, extensionDays } });
  return syncEmployeeState(employeeId, ctx.actor);
}
