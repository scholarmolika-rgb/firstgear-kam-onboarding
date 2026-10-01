/**
 * Application-level authorisation. Mirrors the RLS policies in
 * supabase/migrations/004_rls.sql so server actions can reject a request with
 * a clear message before touching the database (RLS remains the backstop).
 */
import type { Role } from "@/types/domain";

export interface EmployeeAccessRow {
  id: string;
  profile_id: string | null;
  mentor_id: string | null;
  reporting_boss_id: string | null;
}

export interface Actor { id: string; role: Role }

export function canAccessEmployee(actor: Actor, e: EmployeeAccessRow): boolean {
  if (actor.role === "HR_ADMIN") return true;
  if (actor.role === "KAM") return e.profile_id === actor.id;
  if (actor.role === "MENTOR") return e.mentor_id === actor.id;
  if (actor.role === "REPORTING_BOSS") return e.reporting_boss_id === actor.id;
  return false;
}

/** Relationship of the actor to the employee — what hat they wear for this KAM. */
export function relationTo(actor: Actor, e: EmployeeAccessRow): "SELF" | "MENTOR" | "REPORTING_BOSS" | "HR_ADMIN" | null {
  if (actor.role === "HR_ADMIN") return "HR_ADMIN";
  if (e.profile_id === actor.id) return "SELF";
  if (e.mentor_id === actor.id) return "MENTOR";
  if (e.reporting_boss_id === actor.id) return "REPORTING_BOSS";
  return null;
}

/** Who may tick a manual task by hand. */
export function canTickTask(actor: Actor, e: EmployeeAccessRow, task: { owner_role: Role; action_ref: string | null }): boolean {
  if (task.action_ref) return false; // system-driven: completed by the linked action
  const rel = relationTo(actor, e);
  if (rel === "HR_ADMIN") return true;
  if (task.owner_role === "KAM") return rel === "SELF";
  if (task.owner_role === "MENTOR") return rel === "MENTOR";
  if (task.owner_role === "REPORTING_BOSS") return rel === "REPORTING_BOSS";
  return false;
}

/** Decisions reserved for humans in specific roles. The AI can never hold these. */
export const DECISION_AUTHORITY: Record<string, ("MENTOR" | "REPORTING_BOSS" | "HR_ADMIN")[]> = {
  ACCOUNT_BRIEF_REVIEW: ["MENTOR"],
  CUSTOMER_360_REVIEW: ["MENTOR"],
  G4_CERTIFICATION: ["MENTOR"],
  SCENARIO_REVIEW: ["MENTOR", "REPORTING_BOSS"],
  TASK_APPROVAL: ["MENTOR", "REPORTING_BOSS"],
  PANEL_MENTOR_INPUT: ["MENTOR"],
  PANEL_HR_INPUT: ["HR_ADMIN"],
  PROGRESSION: ["REPORTING_BOSS"],
  PRICING_EXPOSURE: ["REPORTING_BOSS"],
  CUSTOMER_OWNERSHIP: ["REPORTING_BOSS"],
  DAY30_SIGNOFF: ["REPORTING_BOSS"],
  EXTENSION: ["REPORTING_BOSS"],
};

export function mayDecide(decision: keyof typeof DECISION_AUTHORITY, actor: Actor, e: EmployeeAccessRow): boolean {
  const rel = relationTo(actor, e);
  if (!rel || rel === "SELF") return false;
  return (DECISION_AUTHORITY[decision] as string[]).includes(rel);
}
