/** In-memory fixtures built from the same seed data that populates the database. */
import { TASKS, GATES, SEGMENTS } from "@/lib/seed-data/journey";
import { DEFAULT_CONFIG } from "@/lib/engine/config";
import type { JourneyContext } from "@/lib/engine/journey";
import type { GateCode, GateDef, ProgrammeConfig, TaskDef, TaskState } from "@/types/domain";

export const CERT_CODES = ["SCN-RFQ", "SCN-PRICE", "SCN-DELIVERY", "SCN-QUALITY"];

export function seedTasks(): TaskDef[] {
  return TASKS.map((t, i) => ({
    id: `t-${t.code}`, code: t.code, day_number: t.day, due_day: t.due ?? t.day, title: t.title, description: t.description,
    pillar: t.pillar, task_type: t.type, owner_role: t.owner ?? "KAM", is_mandatory: t.mandatory ?? true,
    requires_approval: t.approval ?? false, exposure: t.exposure ?? "NONE",
    gate_code: SEGMENTS.find((s) => t.day >= s.from && t.day <= s.to)!.gate, action_ref: t.ref ?? null, is_active: true, sort_order: i,
  }));
}

export function seedGates(): GateDef[] {
  return GATES.map((g) => ({ id: `g-${g.code}`, code: g.code as GateCode, day_number: g.day, name: g.name, gate_type: g.type, approver_role: g.approver }));
}

export function seedDependencies() {
  return TASKS.flatMap((t) => (t.dependsOn ?? []).map((d) => ({ task_id: `t-${t.code}`, depends_on_task_id: `t-${d}` })));
}

export function freshContext(over: Partial<JourneyContext> = {}, cfg: Partial<ProgrammeConfig> = {}): JourneyContext {
  return {
    config: { ...DEFAULT_CONFIG, ...cfg },
    today: 1,
    instanceStatus: "ACTIVE",
    finalDecision: null,
    tasks: seedTasks(),
    states: {},
    dependencies: seedDependencies(),
    gates: seedGates(),
    day10Best: null,
    day15Latest: null,
    certification: [],
    certificationCodes: CERT_CODES,
    gateDecisions: [],
    managerReviews: [],
    mentorReviews: [],
    ...over,
  };
}

export const doneState = (id: string): TaskState => ({ task_id: id, status: "COMPLETED", completed_at: "2026-10-01T10:00:00Z" });

/** Mark tasks complete by predicate (mutates ctx.states). */
export function complete(ctx: JourneyContext, pred: (t: TaskDef) => boolean) {
  for (const t of ctx.tasks.filter(pred)) ctx.states[t.id] = doneState(t.id);
}
