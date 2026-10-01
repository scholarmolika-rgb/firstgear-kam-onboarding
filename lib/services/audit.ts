import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "@/types/domain";

export type AuditEvent =
  | "TASK_COMPLETED" | "TASK_REOPENED" | "TASK_SUBMITTED" | "TASK_APPROVED" | "TASK_REJECTED"
  | "ASSESSMENT_STARTED" | "ASSESSMENT_SUBMITTED" | "ASSESSMENT_RETAKEN"
  | "SCENARIO_SUBMITTED" | "SCENARIO_REVIEWED"
  | "GATE_PASSED" | "GATE_FAILED" | "GATE_BLOCKED" | "GATE_STATUS_CHANGED"
  | "MENTOR_REVIEWED" | "MANAGER_APPROVED" | "MANAGER_DEFERRED" | "MANAGER_DECISION" | "FINAL_DECISION"
  | "REMEDIATION_PLANNED" | "DOCUMENT_UPLOADED" | "POLICY_UPDATED" | "DOCUMENT_APPROVAL_CHANGED"
  | "CONFIG_CHANGED" | "TASK_TEMPLATE_CHANGED" | "QUESTION_CHANGED" | "SCENARIO_TEMPLATE_CHANGED"
  | "SESSION_SCHEDULED" | "SESSION_RESCHEDULED" | "SESSION_CANCELLED" | "SESSION_ATTENDANCE"
  | "ACCOUNT_BRIEF_SAVED" | "ACCOUNT_BRIEF_SUBMITTED" | "STAKEHOLDER_CHANGED"
  | "EMPLOYEE_CREATED" | "EMPLOYEE_UPDATED" | "ONBOARDING_ASSIGNED" | "ONBOARDING_RESET"
  | "SUPPORT_EVENT" | "AI_ESCALATION" | "FEEDBACK_RECORDED" | "REPORT_EXPORTED";

export interface AuditInput {
  employeeId?: string | null;
  actor: { id: string; role: Role } | null;
  event: AuditEvent;
  entityType: string;
  entityId?: string | null;
  previous?: unknown;
  next?: unknown;
}

/**
 * Appends to audit_logs (append-only table). Written with the service-role
 * client so a user cannot forge or suppress entries. Never throws into the
 * caller's happy path, but logs loudly if it fails.
 */
export async function audit(admin: SupabaseClient, a: AuditInput): Promise<void> {
  const { error } = await admin.from("audit_logs").insert({
    employee_id: a.employeeId ?? null,
    actor_id: a.actor?.id ?? null,
    actor_role: a.actor?.role ?? "SYSTEM",
    event_type: a.event,
    entity_type: a.entityType,
    entity_id: a.entityId ?? null,
    previous_value: a.previous ?? null,
    new_value: a.next ?? null,
  });
  if (error) console.error(`[audit] failed to record ${a.event}: ${error.message}`);
}
