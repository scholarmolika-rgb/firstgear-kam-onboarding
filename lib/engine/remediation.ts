/**
 * Remediation planning after a Day-15 result. Deterministic: the band and the
 * weakest pillars decide which instance-specific tasks are proposed.
 */
import type { Band, Pillar, ProgrammeConfig } from "@/types/domain";
import { PILLAR_LABEL } from "@/types/domain";

export interface PlannedTask {
  code: string;
  title: string;
  description: string;
  pillar: Pillar;
  task_type: "REFRESH" | "REMEDIATION";
  owner_role: "KAM" | "MENTOR";
  day_number: number;
  due_day: number;
  gate_code: "G3";
}

export interface RemediationPlan {
  band: Band;
  tasks: PlannedTask[];
  extensionDays: number;
  summary: string;
}

const MODULES: Record<Pillar, string> = {
  GOVERNANCE: "KAM charter, approval authority matrix, quality governance and escalation playbook",
  PEOPLE: "ownership map, customer organisation and stakeholder map",
  PROCESS: "RFQ-to-quotation SOP, costing & commercial mechanics and manufacturing flow",
  PRODUCT: "product portfolio (ICE / hybrid / BEV), applications and customer programmes",
};

export function planRemediation(band: Band, weakPillars: Pillar[], today: number, attempt: number, cfg: ProgrammeConfig): RemediationPlan | null {
  if (band === "GREEN") return null;
  const focus = (weakPillars.length ? weakPillars : (["PROCESS"] as Pillar[])).slice(0, band === "AMBER" ? 2 : 4);
  const start = Math.max(today, 15);
  const tag = `A${attempt}`;
  const tasks: PlannedTask[] = [];

  if (band === "AMBER") {
    const len = cfg.amberRefreshDays;
    focus.forEach((p, i) => {
      tasks.push({
        code: `RF-${tag}-${p}`, title: `Targeted refresh: ${PILLAR_LABEL[p]}`,
        description: `Re-study ${MODULES[p]} and note three points you would now answer differently.`,
        pillar: p, task_type: "REFRESH", owner_role: "KAM", day_number: 15, due_day: start + Math.min(len - 1, i + 1), gate_code: "G3",
      });
    });
    tasks.push({
      code: `RF-${tag}-COACH`, title: "Mentor refresh check-in",
      description: `Mentor reviews the refresh on ${focus.map((p) => PILLAR_LABEL[p]).join(" and ")} before the re-check.`,
      pillar: focus[0], task_type: "REFRESH", owner_role: "MENTOR", day_number: 15, due_day: start + len - 1, gate_code: "G3",
    });
    return {
      band, tasks, extensionDays: 0,
      summary: `Amber: ${len}-day targeted refresh on ${focus.map((p) => PILLAR_LABEL[p]).join(" and ")}. Supervised Phase-2 shadowing may continue; pricing exposure stays blocked until the re-check reaches ${cfg.greenThreshold}%.`,
    };
  }

  // RED
  tasks.push(
    { code: `RM-${tag}-COACH`, title: "1:1 coaching plan with mentor", description: "Agree a written coaching plan covering every weak pillar.", pillar: focus[0], task_type: "REMEDIATION", owner_role: "MENTOR", day_number: 15, due_day: start + 2, gate_code: "G3" },
    ...focus.map((p, i): PlannedTask => ({ code: `RM-${tag}-${p}`, title: `Repeat modules: ${PILLAR_LABEL[p]}`, description: `Repeat ${MODULES[p]}.`, pillar: p, task_type: "REMEDIATION", owner_role: "KAM", day_number: 15, due_day: start + 3 + i, gate_code: "G3" })),
    { code: `RM-${tag}-PAIR`, title: "Additional mentor pairing sessions", description: "Shadow the mentor on two live account activities (observation only).", pillar: "PEOPLE", task_type: "REMEDIATION", owner_role: "KAM", day_number: 15, due_day: start + 5, gate_code: "G3" },
  );
  return {
    band, tasks, extensionDays: cfg.redExtensionDays,
    summary: `Red: Phase 2 paused. Remediation covers ${focus.map((p) => PILLAR_LABEL[p]).join(", ")} with 1:1 coaching, repeated modules and extra mentor pairing, then an additional assessment. Proposed extension: ${cfg.redExtensionDays} days (Reporting Boss decision).`,
  };
}
