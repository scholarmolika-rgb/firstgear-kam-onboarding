import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { loadSnapshot, type Snapshot } from "./snapshot";
import { audit } from "./audit";
import { dispatchAlerts } from "@/lib/notifications/service";
import type { Role } from "@/types/domain";

/**
 * VERIFY + REPORT step after every state change:
 *   1. Re-evaluates the journey from stored evidence (admin read, full view).
 *   2. Persists any gate status change to gate_results (+ audit GATE_*).
 *   3. Mirrors exposure flags onto the onboarding instance.
 *   4. Upserts today's progress snapshot (history for trend charts).
 *   5. Dispatches proactive notifications to KAM / Mentor / Boss / HR.
 * Returns the fresh snapshot so callers can return updated state to the UI.
 */
export async function syncEmployeeState(employeeId: string, actor: { id: string; role: Role } | null): Promise<Snapshot> {
  const admin = createAdminClient();
  const snap = await loadSnapshot(admin, employeeId);
  const stored = new Map(snap.storedGates.map((g) => [g.gate_id, g]));

  for (const g of snap.journey.gates) {
    const prev = stored.get(g.id);
    const row = {
      employee_id: employeeId,
      instance_id: snap.instance.id,
      gate_id: g.id,
      status: g.status,
      score: g.score,
      band: g.band,
      required_tasks: g.requiredTasks,
      evidence: g.evidence,
      decision: g.decision,
      next_action: g.nextAction,
      ...(prev?.status !== g.status ? { decided_at: new Date().toISOString() } : {}),
    };
    if (!prev || prev.status !== g.status) {
      await admin.from("gate_results").upsert(row, { onConflict: "instance_id,gate_id" });
      if (prev || g.status !== "NOT_STARTED") {
        const event = g.status === "PASSED" || g.status === "APPROVED" ? "GATE_PASSED"
          : g.status === "FAILED" ? "GATE_FAILED" : g.status === "BLOCKED" ? "GATE_BLOCKED" : "GATE_STATUS_CHANGED";
        await audit(admin, { employeeId, actor, event, entityType: "gate", entityId: g.id, previous: prev ? { status: prev.status } : null, next: { code: g.code, status: g.status, score: g.score, band: g.band } });
      }
    } else {
      await admin.from("gate_results").update({ score: g.score, band: g.band, evidence: g.evidence, required_tasks: g.requiredTasks, next_action: g.nextAction, decision: g.decision }).eq("instance_id", snap.instance.id).eq("gate_id", g.id);
    }
  }

  const exposureUpdate: Record<string, unknown> = {};
  if (snap.instance.pricing_exposure !== snap.journey.exposure.pricing) exposureUpdate.pricing_exposure = snap.journey.exposure.pricing;
  if (snap.instance.customer_exposure !== snap.journey.exposure.customer) exposureUpdate.customer_exposure = snap.journey.exposure.customer;
  if (Object.keys(exposureUpdate).length) await admin.from("onboarding_instances").update(exposureUpdate).eq("id", snap.instance.id);

  const m = snap.metrics;
  await admin.from("progress_snapshots").upsert({
    employee_id: employeeId,
    instance_id: snap.instance.id,
    snapshot_date: snap.todayDate,
    day_number: snap.day,
    task_completion_pct: m.taskCompletionPct,
    learning_completion_pct: m.learningCompletionPct,
    knowledge_score: m.knowledgeScore,
    scenario_score: m.scenarioScore,
    overall_readiness: m.overallReadiness,
    band: m.band,
    dependency_index: m.dependency.latestIndex,
    overdue_count: m.overdueCount,
    metrics: { gatesCleared: m.gatesCleared, phase: snap.journey.phase, reassessments: m.reassessmentCount, responseQuality: m.responseQuality },
  }, { onConflict: "instance_id,snapshot_date" });

  await dispatchAlerts(admin, employeeId, {
    KAM: snap.employee.profile_id, MENTOR: snap.employee.mentor_id, REPORTING_BOSS: snap.employee.reporting_boss_id, HR_ADMIN: snap.employee.hr_owner_id,
  }, snap.alerts);

  return snap;
}
