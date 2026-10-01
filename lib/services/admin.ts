import "server-only";
import { validateConfig, configToSettings } from "@/lib/engine/config";
import { addDays } from "@/lib/engine/calendar";
import { audit } from "./audit";
import { initialiseInstance } from "./tasks";
import { syncEmployeeState } from "./sync";
import { getConfig, todayIso } from "./settings";
import { normaliseCorrectAnswer } from "./assessments";
import { ServiceError, type ActionContext } from "./context";
import type { ProgrammeConfig, QuestionType, Role } from "@/types/domain";

function requireHr(ctx: ActionContext) {
  if (ctx.actor.role !== "HR_ADMIN") throw new ServiceError("Only HR / Admin can change programme configuration.");
}

/* ── Programme configuration ───────────────────────────────────── */

export async function saveConfig(ctx: ActionContext, next: ProgrammeConfig) {
  requireHr(ctx);
  const errors = validateConfig(next);
  if (errors.length) throw new ServiceError(errors.join(" "));
  const prev = await getConfig(ctx.admin);
  const prevRows = new Map(configToSettings(prev).map((r) => [r.key, JSON.stringify(r.value)]));
  const changed = configToSettings(next).filter((r) => prevRows.get(r.key) !== JSON.stringify(r.value));
  for (const r of changed) {
    const { error } = await ctx.db.from("app_settings").update({ value: r.value, updated_by: ctx.actor.id, updated_at: new Date().toISOString() }).eq("key", r.key);
    if (error) throw new ServiceError(`Could not save ${r.key}.`);
  }
  if (changed.length) {
    await audit(ctx.admin, { actor: ctx.actor, event: "CONFIG_CHANGED", entityType: "app_settings", previous: Object.fromEntries(changed.map((r) => [r.key, JSON.parse(prevRows.get(r.key) ?? "null")])), next: Object.fromEntries(changed.map((r) => [r.key, r.value])) });
  }
  return changed.length;
}

export interface TaskEdit {
  id?: string; code: string; day_number: number; due_day: number; title: string; description: string;
  pillar: string; task_type: string; owner_role: Role; is_mandatory: boolean; requires_approval: boolean;
  exposure: string; is_active: boolean; depends_on: string[];
}

export async function saveTemplateTask(ctx: ActionContext, templateId: string, t: TaskEdit) {
  requireHr(ctx);
  const cfg = await getConfig(ctx.admin);
  if (t.day_number < 1 || t.day_number > cfg.duration || t.due_day < t.day_number) throw new ServiceError(`Day must be 1–${cfg.duration} and the due day cannot be before it.`);
  const gate = t.day_number <= 5 ? "G1" : t.day_number <= 10 ? "G2" : t.day_number <= 15 ? "G3" : t.day_number <= 21 ? "G4" : "G5";
  const row = {
    template_id: templateId, code: t.code.trim().toUpperCase(), day_number: t.day_number, due_day: t.due_day, title: t.title.trim(),
    description: t.description.trim(), pillar: t.pillar, task_type: t.task_type, owner_role: t.owner_role, is_mandatory: t.is_mandatory,
    requires_approval: t.requires_approval, exposure: t.exposure, is_active: t.is_active, gate_code: gate,
  };
  let id = t.id;
  let prev: unknown = null;
  if (id) {
    const { data: before } = await ctx.admin.from("tasks").select("*").eq("id", id).single();
    prev = before;
    const { error } = await ctx.db.from("tasks").update(row).eq("id", id);
    if (error) throw new ServiceError(`Could not save the task: ${error.message}`);
  } else {
    const { data, error } = await ctx.db.from("tasks").insert(row).select("id").single();
    if (error || !data) throw new ServiceError(`Could not create the task: ${error?.message}`);
    id = data.id;
    // Give every active instance a completion row so the task appears immediately.
    const { data: insts } = await ctx.admin.from("onboarding_instances").select("id, employee_id").eq("template_id", templateId).neq("status", "ARCHIVED");
    if (insts?.length) await ctx.admin.from("task_completions").upsert(insts.map((i) => ({ instance_id: i.id, employee_id: i.employee_id, task_id: id })), { onConflict: "instance_id,task_id", ignoreDuplicates: true });
  }
  // Dependencies (by code) — reject cycles of length 1 and unknown codes.
  await ctx.db.from("task_dependencies").delete().eq("task_id", id!);
  if (t.depends_on.length) {
    const { data: deps } = await ctx.admin.from("tasks").select("id, code").eq("template_id", templateId).in("code", t.depends_on.map((c) => c.trim().toUpperCase()));
    const found = deps ?? [];
    if (found.length !== t.depends_on.length) throw new ServiceError("One or more dependency codes do not exist in this template.");
    if (found.some((d) => d.id === id)) throw new ServiceError("A task cannot depend on itself.");
    await ctx.db.from("task_dependencies").insert(found.map((d) => ({ task_id: id, depends_on_task_id: d.id })));
  }
  await audit(ctx.admin, { actor: ctx.actor, event: "TASK_TEMPLATE_CHANGED", entityType: "task", entityId: id, previous: prev, next: { ...row, depends_on: t.depends_on } });
  return id!;
}

export interface QuestionEdit {
  id?: string; question_code: string; assessment_stage: string; question_type: QuestionType; pillar: string; topic: string; difficulty: string;
  question: string; options: { id: string; text: string }[]; correct_answer: unknown; explanation?: string; weight: number;
  source_document?: string; source_reference?: string; is_active: boolean;
}

export async function saveQuestion(ctx: ActionContext, q: QuestionEdit) {
  requireHr(ctx);
  const needsOptions = ["MULTIPLE_CHOICE", "MULTI_SELECT"].includes(q.question_type);
  if (needsOptions && q.options.length < 2) throw new ServiceError("Provide at least two options.");
  const correct = normaliseCorrectAnswer(q.question_type, q.correct_answer);
  if (needsOptions) {
    const ids = new Set(q.options.map((o) => o.id));
    const c = correct as { value?: string; values?: string[] };
    if ((c.value && !ids.has(c.value)) || c.values?.some((v) => !ids.has(v))) throw new ServiceError("The correct answer must be one of the options.");
  }
  const row = { ...q, options: needsOptions ? q.options : [], correct_answer: correct };
  delete (row as { id?: string }).id;
  const res = q.id ? await ctx.db.from("assessment_questions").update(row).eq("id", q.id).select("id").single() : await ctx.db.from("assessment_questions").insert(row).select("id").single();
  if (res.error || !res.data) throw new ServiceError(`Could not save the question: ${res.error?.message}`);
  await audit(ctx.admin, { actor: ctx.actor, event: "QUESTION_CHANGED", entityType: "assessment_question", entityId: res.data.id, next: { code: q.question_code, active: q.is_active, pillar: q.pillar, weight: q.weight } });
  return res.data.id as string;
}

export async function saveScenarioRubric(ctx: ActionContext, id: string, rubric: { id: string; criterion: string; description: string; weight: number; keywords: string[]; min_matches?: number }[], isActive: boolean) {
  requireHr(ctx);
  const total = rubric.reduce((s, c) => s + c.weight, 0);
  if (Math.abs(total - 100) > 0.01) throw new ServiceError(`Rubric weights must total 100 (currently ${total}).`);
  if (rubric.some((c) => !c.keywords.length)) throw new ServiceError("Every criterion needs at least one keyword.");
  const { error } = await ctx.db.from("scenario_templates").update({ rubric, is_active: isActive }).eq("id", id);
  if (error) throw new ServiceError("Could not save the rubric.");
  await audit(ctx.admin, { actor: ctx.actor, event: "SCENARIO_TEMPLATE_CHANGED", entityType: "scenario_template", entityId: id, next: { criteria: rubric.length, active: isActive } });
}

/* ── Employees ─────────────────────────────────────────────────── */

export interface EmployeeInput {
  full_name: string; email: string; employee_code: string; joining_date: string; joining_type: "NEW_JOINER" | "REASSIGNED";
  location?: string; assigned_customer?: string; mentor_id: string | null; reporting_boss_id: string | null; temp_password?: string;
}

export async function createEmployee(ctx: ActionContext, e: EmployeeInput) {
  requireHr(ctx);
  // Create the sign-in account (service role) — the only place the app creates auth users.
  const { data: created, error: authErr } = await ctx.admin.auth.admin.createUser({
    email: e.email, password: e.temp_password || undefined, email_confirm: true, user_metadata: { full_name: e.full_name },
  });
  if (authErr || !created.user) throw new ServiceError(`Could not create the sign-in account: ${authErr?.message}`);
  await ctx.admin.from("profiles").insert({ id: created.user.id, full_name: e.full_name, email: e.email, role: "KAM", title: "Key Account Manager" });
  const { data: emp, error } = await ctx.db.from("employees").insert({
    profile_id: created.user.id, employee_code: e.employee_code, full_name: e.full_name, email: e.email, joining_date: e.joining_date,
    joining_type: e.joining_type, location: e.location || null, assigned_customer: e.assigned_customer || null,
    mentor_id: e.mentor_id, reporting_boss_id: e.reporting_boss_id, hr_owner_id: ctx.actor.id,
  }).select("id").single();
  if (error || !emp) throw new ServiceError(`Could not create the employee: ${error?.message}`);
  await audit(ctx.admin, { employeeId: emp.id, actor: ctx.actor, event: "EMPLOYEE_CREATED", entityType: "employee", entityId: emp.id, next: { name: e.full_name, code: e.employee_code } });
  await assignOnboarding(ctx, emp.id, e.joining_date);
  return emp.id as string;
}

export async function updateAssignments(ctx: ActionContext, employeeId: string, mentorId: string | null, bossId: string | null) {
  requireHr(ctx);
  const { data: before } = await ctx.admin.from("employees").select("mentor_id, reporting_boss_id").eq("id", employeeId).single();
  const { error } = await ctx.db.from("employees").update({ mentor_id: mentorId, reporting_boss_id: bossId }).eq("id", employeeId);
  if (error) throw new ServiceError("Could not update assignments.");
  await audit(ctx.admin, { employeeId, actor: ctx.actor, event: "EMPLOYEE_UPDATED", entityType: "employee", entityId: employeeId, previous: before, next: { mentor_id: mentorId, reporting_boss_id: bossId } });
  await syncEmployeeState(employeeId, ctx.actor);
}

/** Assigns the active KAM template. Starts on joining date + configured offset (or today if later supplied). */
export async function assignOnboarding(ctx: ActionContext, employeeId: string, joiningDate: string, opts: { exactStart?: boolean } = {}) {
  requireHr(ctx);
  const cfg = await getConfig(ctx.admin);
  const { data: tpl } = await ctx.admin.from("onboarding_templates").select("id").eq("is_active", true).order("created_at").limit(1).single();
  if (!tpl) throw new ServiceError("No active onboarding template.");
  const start = opts.exactStart ? joiningDate : addDays(joiningDate || todayIso(), cfg.startOffsetDays);
  const { data: inst, error } = await ctx.admin.from("onboarding_instances").insert({ employee_id: employeeId, template_id: tpl.id, start_date: start }).select("id").single();
  if (error || !inst) throw new ServiceError(`Could not assign onboarding: ${error?.message}`);
  await initialiseInstance(ctx.admin, inst.id, employeeId, tpl.id);
  await audit(ctx.admin, { employeeId, actor: ctx.actor, event: "ONBOARDING_ASSIGNED", entityType: "onboarding_instance", entityId: inst.id, next: { start_date: start, template: tpl.id } });
  await syncEmployeeState(employeeId, ctx.actor);
  return inst.id as string;
}

/** Archives the current instance (history kept) and starts a fresh one. */
export async function resetOnboarding(ctx: ActionContext, employeeId: string, startDate: string, reason: string) {
  requireHr(ctx);
  if (!reason.trim()) throw new ServiceError("A reason is required to reset onboarding.");
  const { data: cur } = await ctx.admin.from("onboarding_instances").select("id, start_date, status").eq("employee_id", employeeId).neq("status", "ARCHIVED").maybeSingle();
  if (cur) await ctx.admin.from("onboarding_instances").update({ status: "ARCHIVED" }).eq("id", cur.id);
  await audit(ctx.admin, { employeeId, actor: ctx.actor, event: "ONBOARDING_RESET", entityType: "onboarding_instance", entityId: cur?.id ?? null, previous: cur, next: { start_date: startDate, reason } });
  return assignOnboarding(ctx, employeeId, startDate, { exactStart: true });
}
