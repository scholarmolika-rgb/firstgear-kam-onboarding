import "server-only";
import { audit } from "./audit";
import { completeSystemTasks } from "./tasks";
import { syncEmployeeState } from "./sync";
import { activeInstance, requireEmployeeAccess, ServiceError, type ActionContext } from "./context";
import type { BriefSchema, StakeholderSchema } from "@/lib/security/validation";
import type { z } from "zod";

type BriefInput = z.infer<typeof BriefSchema>;
type StakeholderInput = z.infer<typeof StakeholderSchema>;

export async function getBrief(ctx: ActionContext, employeeId: string) {
  await requireEmployeeAccess(ctx, employeeId);
  const { data: brief } = await ctx.db.from("account_briefs").select("*").eq("employee_id", employeeId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  const { data: stakeholders } = await ctx.db.from("stakeholder_maps").select("*").eq("employee_id", employeeId).order("side").order("function");
  return { brief, stakeholders: stakeholders ?? [] };
}

/** KAM saves their brief (draft). Editing an approved brief sends it back for review (DB trigger). */
export async function saveBrief(ctx: ActionContext, input: BriefInput) {
  if (ctx.actor.role !== "KAM" || !ctx.employeeId) throw new ServiceError("Only the KAM edits their own account brief.");
  const employeeId = ctx.employeeId;
  const inst = await activeInstance(ctx.admin, employeeId);
  const { data: existing } = await ctx.db.from("account_briefs").select("id, status").eq("employee_id", employeeId).eq("customer_name", input.customer_name).maybeSingle();
  if (existing) {
    const { error } = await ctx.db.from("account_briefs").update({ ...input, status: existing.status === "CHANGES_REQUESTED" ? "DRAFT" : existing.status }).eq("id", existing.id);
    if (error) throw new ServiceError("Could not save the brief.");
  } else {
    const { error } = await ctx.db.from("account_briefs").insert({ ...input, employee_id: employeeId, instance_id: inst.id });
    if (error) throw new ServiceError("Could not create the brief.");
  }
  await audit(ctx.admin, { employeeId, actor: ctx.actor, event: "ACCOUNT_BRIEF_SAVED", entityType: "account_brief", entityId: existing?.id ?? null, next: { customer: input.customer_name } });
}

const REQUIRED_FIELDS: (keyof BriefInput)[] = ["customer_organization", "strategic_context", "supplied_parts", "programmes", "pricing_history", "open_commitments", "lessons_learned"];

export async function submitBrief(ctx: ActionContext) {
  if (ctx.actor.role !== "KAM" || !ctx.employeeId) throw new ServiceError("Only the KAM submits their account brief.");
  const employeeId = ctx.employeeId;
  const { data: brief } = await ctx.db.from("account_briefs").select("*").eq("employee_id", employeeId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!brief) throw new ServiceError("Create the account brief first.");
  const missing = REQUIRED_FIELDS.filter((f) => !String(brief[f] ?? "").trim());
  if (missing.length) throw new ServiceError(`Complete these sections before submitting: ${missing.map((m) => m.replace(/_/g, " ")).join(", ")}.`);
  const { count } = await ctx.db.from("stakeholder_maps").select("id", { count: "exact", head: true }).eq("employee_id", employeeId);
  if ((count ?? 0) < 4) throw new ServiceError("Add at least four stakeholders (purchasing, engineering, quality, SCM/plant) before submitting.");
  const { error } = await ctx.db.from("account_briefs").update({ status: "SUBMITTED", submitted_at: new Date().toISOString() }).eq("id", brief.id);
  if (error) throw new ServiceError("Could not submit.");
  const inst = await activeInstance(ctx.admin, employeeId);
  await completeSystemTasks(ctx.admin, inst.id, "brief:SUBMIT", ctx.actor, employeeId);
  await audit(ctx.admin, { employeeId, actor: ctx.actor, event: "ACCOUNT_BRIEF_SUBMITTED", entityType: "account_brief", entityId: brief.id, previous: { status: brief.status }, next: { status: "SUBMITTED" } });
  return syncEmployeeState(employeeId, ctx.actor);
}

export async function addStakeholder(ctx: ActionContext, employeeId: string, s: StakeholderInput) {
  await requireEmployeeAccess(ctx, employeeId);
  const { data: brief } = await ctx.db.from("account_briefs").select("id").eq("employee_id", employeeId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  const { error } = await ctx.db.from("stakeholder_maps").insert({ ...s, employee_id: employeeId, account_brief_id: brief?.id ?? null });
  if (error) throw new ServiceError("Could not add the stakeholder.");
  await audit(ctx.admin, { employeeId, actor: ctx.actor, event: "STAKEHOLDER_CHANGED", entityType: "stakeholder_map", next: { action: "added", side: s.side, function: s.function } });
}

export async function removeStakeholder(ctx: ActionContext, employeeId: string, id: string) {
  await requireEmployeeAccess(ctx, employeeId);
  const { error } = await ctx.db.from("stakeholder_maps").delete().eq("id", id).eq("employee_id", employeeId);
  if (error) throw new ServiceError("Could not remove the stakeholder.");
  await audit(ctx.admin, { employeeId, actor: ctx.actor, event: "STAKEHOLDER_CHANGED", entityType: "stakeholder_map", entityId: id, next: { action: "removed" } });
}
