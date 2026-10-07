"use server";
/** HR / Admin server actions: configuration, content and people management. */
import { revalidatePath } from "next/cache";
import { actionContext, run, ServiceError, type Result } from "@/lib/services/context";
import { saveConfig, saveTemplateTask, saveQuestion, saveScenarioRubric, createEmployee, updateEmployee, updateAssignments, resetOnboarding, type TaskEdit, type QuestionEdit, type EmployeeInput, type EmployeeEdit } from "@/lib/services/admin";
import { setDocumentApproval, reindexAll } from "@/lib/services/knowledge";
import { QuestionSchema, uuid, firstError } from "@/lib/security/validation";
import type { ProgrammeConfig } from "@/types/domain";
import { z } from "zod";

function hrOnly(role: string) { if (role !== "HR_ADMIN") throw new ServiceError("HR / Admin only."); }

export async function saveConfigAction(config: ProgrammeConfig): Promise<Result<number>> {
  return run(async () => {
    const ctx = await actionContext();
    const n = await saveConfig(ctx, config);
    revalidatePath("/", "layout");
    return n;
  });
}

const TaskEditSchema = z.object({
  id: uuid.optional(), code: z.string().trim().min(2).max(20), day_number: z.number().int().min(1).max(120), due_day: z.number().int().min(1).max(150),
  title: z.string().trim().min(3).max(160), description: z.string().max(2000), pillar: z.enum(["GOVERNANCE", "PEOPLE", "PROCESS", "PRODUCT"]),
  task_type: z.enum(["LEARNING", "ACTIVITY", "SESSION", "ASSESSMENT", "SCENARIO", "REVIEW", "DELIVERABLE"]),
  owner_role: z.enum(["KAM", "MENTOR", "REPORTING_BOSS", "HR_ADMIN"]), is_mandatory: z.boolean(), requires_approval: z.boolean(),
  exposure: z.enum(["NONE", "CUSTOMER", "PRICING"]), is_active: z.boolean(), depends_on: z.array(z.string().max(20)).max(10),
});

export async function saveTaskAction(templateId: string, task: TaskEdit): Promise<Result<string>> {
  return run(async () => {
    uuid.parse(templateId);
    const v = TaskEditSchema.safeParse(task);
    if (!v.success) throw new ServiceError(firstError(v.error));
    const ctx = await actionContext();
    const id = await saveTemplateTask(ctx, templateId, v.data as TaskEdit);
    revalidatePath("/", "layout");
    return id;
  });
}

export async function saveQuestionAction(q: QuestionEdit): Promise<Result<string>> {
  return run(async () => {
    const v = QuestionSchema.extend({ id: uuid.optional() }).safeParse(q);
    if (!v.success) throw new ServiceError(firstError(v.error));
    const ctx = await actionContext();
    const id = await saveQuestion(ctx, v.data as QuestionEdit);
    revalidatePath("/admin/assessments");
    return id;
  });
}

const RubricSchema = z.array(z.object({ id: z.string().min(1).max(30), criterion: z.string().min(2).max(120), description: z.string().max(300), weight: z.number().min(0).max(100), keywords: z.array(z.string().min(1).max(60)).max(30), min_matches: z.number().int().min(1).max(10).optional() })).min(1).max(12);

export async function saveRubricAction(id: string, rubric: unknown, isActive: boolean): Promise<Result<true>> {
  return run(async () => {
    uuid.parse(id);
    const v = RubricSchema.safeParse(rubric);
    if (!v.success) throw new ServiceError(firstError(v.error));
    const ctx = await actionContext();
    await saveScenarioRubric(ctx, id, v.data, !!isActive);
    revalidatePath("/admin/assessments");
    return true as const;
  });
}

const EmployeeSchema = z.object({
  full_name: z.string().trim().min(3).max(120), email: z.string().email(), employee_code: z.string().trim().min(3).max(30),
  joining_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), joining_type: z.enum(["NEW_JOINER", "REASSIGNED"]), location: z.string().max(120).optional(),
  assigned_customer: z.string().max(120).optional(), mentor_id: uuid.nullable(), reporting_boss_id: uuid.nullable(), temp_password: z.string().min(10).max(72).optional().or(z.literal("")),
});

export async function createEmployeeAction(input: EmployeeInput): Promise<Result<string>> {
  return run(async () => {
    const v = EmployeeSchema.safeParse(input);
    if (!v.success) throw new ServiceError(firstError(v.error));
    const ctx = await actionContext();
    const id = await createEmployee(ctx, v.data as EmployeeInput);
    revalidatePath("/admin/employees");
    revalidatePath("/hr");
    return id;
  });
}

const EmployeeEditSchema = z.object({
  full_name: z.string().trim().min(3).max(120), email: z.string().trim().email(), employee_code: z.string().trim().min(3).max(30),
  joining_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), joining_type: z.enum(["NEW_JOINER", "REASSIGNED"]), location: z.string().max(120).optional(),
  assigned_customer: z.string().max(120).optional(), status: z.enum(["ACTIVE", "INACTIVE"]), new_password: z.string().min(10).max(72).optional().or(z.literal("")),
});

export async function updateEmployeeAction(employeeId: string, input: EmployeeEdit): Promise<Result<true>> {
  return run(async () => {
    uuid.parse(employeeId);
    const v = EmployeeEditSchema.safeParse(input);
    if (!v.success) throw new ServiceError(firstError(v.error));
    const ctx = await actionContext();
    await updateEmployee(ctx, employeeId, v.data as EmployeeEdit);
    revalidatePath("/", "layout");
    return true as const;
  });
}

export async function updateAssignmentsAction(employeeId: string, mentorId: string | null, bossId: string | null): Promise<Result<true>> {
  return run(async () => {
    uuid.parse(employeeId);
    if (mentorId) uuid.parse(mentorId);
    if (bossId) uuid.parse(bossId);
    const ctx = await actionContext();
    await updateAssignments(ctx, employeeId, mentorId, bossId);
    revalidatePath("/admin/employees");
    return true as const;
  });
}

export async function resetOnboardingAction(employeeId: string, startDate: string, reason: string): Promise<Result<string>> {
  return run(async () => {
    uuid.parse(employeeId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new ServiceError("Invalid start date.");
    const ctx = await actionContext();
    const id = await resetOnboarding(ctx, employeeId, startDate, String(reason).slice(0, 500));
    revalidatePath("/", "layout");
    return id;
  });
}

export async function setDocumentApprovalAction(documentId: string, approved: boolean): Promise<Result<true>> {
  return run(async () => {
    uuid.parse(documentId);
    const ctx = await actionContext();
    hrOnly(ctx.actor.role);
    await setDocumentApproval(ctx.admin, documentId, !!approved, ctx.actor);
    revalidatePath("/admin/knowledge");
    return true as const;
  });
}

export async function reindexAction(): Promise<Result<number>> {
  return run(async () => {
    const ctx = await actionContext();
    hrOnly(ctx.actor.role);
    const n = await reindexAll(ctx.admin, ctx.actor);
    revalidatePath("/admin/knowledge");
    return n;
  });
}
