import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSnapshot, type Snapshot } from "./snapshot";

/** Snapshots for every KAM the signed-in staff member can see (RLS decides who). */
export async function loadCohort(db: SupabaseClient): Promise<Snapshot[]> {
  const { data: emps } = await db.from("employees").select("id").eq("status", "ACTIVE").order("full_name");
  const out: Snapshot[] = [];
  for (const e of emps ?? []) {
    try { out.push(await loadSnapshot(db, e.id)); } catch { /* no active instance — skipped */ }
  }
  return out;
}

/** Items waiting on a given reviewer for one KAM. */
export function pendingFor(s: Snapshot, role: "MENTOR" | "REPORTING_BOSS" | "HR_ADMIN") {
  const items: { label: string; kind: string }[] = [];
  const j = s.journey;
  if (role === "MENTOR") {
    for (const t of j.tasks.filter((t) => t.availability === "AWAITING_REVIEW")) items.push({ label: `Review: ${t.title}`, kind: "TASK_REVIEW" });
    for (const t of j.tasks.filter((t) => t.owner_role === "MENTOR" && t.availability === "AVAILABLE")) items.push({ label: t.title, kind: t.action_ref ?? "MENTOR_TASK" });
    for (const a of s.scenarioAttempts.filter((a) => a.status === "REVIEW_REQUIRED")) items.push({ label: `Scenario review: ${a.title}`, kind: "SCENARIO" });
    const g4 = j.gates.find((g) => g.code === "G4");
    if (g4?.status === "SUBMITTED" && g4.nextAction.includes("Mentor")) items.push({ label: "Day-21 certification decision", kind: "G4" });
  }
  if (role === "REPORTING_BOSS") {
    const g4 = j.gates.find((g) => g.code === "G4");
    const g4ok = g4 && ["PASSED", "APPROVED"].includes(g4.status);
    const has = (t: string) => s.managerReviews.some((r) => r.review_type === t);
    if (g4ok && !has("PRICING_EXPOSURE") && s.metrics.band === "GREEN") items.push({ label: "Decide guided pricing exposure", kind: "PRICING" });
    if (g4ok && !has("CUSTOMER_OWNERSHIP")) items.push({ label: "Decide guided customer ownership", kind: "CUSTOMER" });
    if (j.gates.find((g) => g.code === "G5")?.status === "SUBMITTED") items.push({ label: "Day-30 readiness sign-off", kind: "SIGNOFF" });
    for (const t of j.tasks.filter((t) => t.owner_role === "REPORTING_BOSS" && t.availability === "AVAILABLE" && !t.systemDriven)) items.push({ label: t.title, kind: "BOSS_TASK" });
  }
  if (role === "HR_ADMIN") {
    const g5 = j.gates.find((g) => g.code === "G5");
    if (g5 && g5.nextAction.includes("HR")) items.push({ label: "HR panel input", kind: "PANEL_HR" });
  }
  return items;
}
