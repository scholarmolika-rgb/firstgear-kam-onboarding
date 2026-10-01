import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, createServerSupabase } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { canAccessEmployee, type Actor, type EmployeeAccessRow } from "@/lib/auth/access";
import { mutationLimiter } from "@/lib/security/rate-limit";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const fail = (error: string): Result<never> => ({ ok: false, error });

export class ServiceError extends Error {}

export interface ActionContext {
  actor: Actor & { name: string };
  db: SupabaseClient;      // user-scoped (RLS)
  admin: SupabaseClient;   // service role — system writes only, after authorisation
  employeeId: string | null;
}

export async function actionContext(opts: { rateLimit?: boolean } = { rateLimit: true }): Promise<ActionContext> {
  const s = await getSession();
  if (!s) throw new ServiceError("Your session has expired. Please sign in again.");
  if (opts.rateLimit !== false) {
    const rl = await mutationLimiter.take(`mut:${s.profile.id}`);
    if (!rl.ok) throw new ServiceError("Too many requests — please wait a moment.");
  }
  return {
    actor: { id: s.profile.id, role: s.profile.role, name: s.profile.full_name },
    db: await createServerSupabase(),
    admin: createAdminClient(),
    employeeId: s.employeeId,
  };
}

export async function requireEmployeeAccess(ctx: ActionContext, employeeId: string): Promise<EmployeeAccessRow & { full_name: string; hr_owner_id: string | null }> {
  const { data } = await ctx.admin.from("employees").select("id, profile_id, mentor_id, reporting_boss_id, hr_owner_id, full_name").eq("id", employeeId).maybeSingle();
  if (!data || !canAccessEmployee(ctx.actor, data)) throw new ServiceError("You do not have access to this employee.");
  return data;
}

export async function activeInstance(admin: SupabaseClient, employeeId: string) {
  const { data } = await admin.from("onboarding_instances").select("*").eq("employee_id", employeeId).neq("status", "ARCHIVED").maybeSingle();
  if (!data) throw new ServiceError("No active onboarding for this employee.");
  return data as { id: string; template_id: string; start_date: string; status: string; extension_days: number; final_decision: string | null };
}

/** Wraps a service call so server actions return `Result` instead of throwing. */
export async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    if (e instanceof ServiceError) return fail(e.message);
    console.error("[service]", (e as Error).message);
    return fail("Something went wrong. The change was not saved.");
  }
}
