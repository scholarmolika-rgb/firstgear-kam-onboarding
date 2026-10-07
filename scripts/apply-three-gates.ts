/**
 * Applies supabase/migrations/005_three_gates.sql to an existing project
 * through the service-role API (for when the SQL editor / CLI isn't handy).
 *
 *   npx tsx scripts/apply-three-gates.ts
 *
 * Five gates (Day 5 · 10 · 15 · 21 · 30) → three (Day 15 · 21 · 30). Gate rows
 * are renumbered in place so their ids, and the decisions that reference
 * them, survive. Idempotent: re-running changes nothing.
 * Uses SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { TEMPLATE, GATES, DAYS, SETTINGS } from "../lib/seed-data/journey";
import { ASSESSMENTS } from "../lib/seed-data/assessments";

config({ path: ".env.local" });
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

function must<T>(r: { data: T | null; error: { message: string } | null }, what: string): NonNullable<T> {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data as NonNullable<T>;
}

const gateForDay = (day: number) => (day <= 15 ? "G1" : day <= 21 ? "G2" : "G3");

async function main() {
  const tpl: { id: string } = must(await db.from("onboarding_templates").select("id").eq("code", TEMPLATE.code).single(), "template");
  const before = must(await db.from("gate_definitions").select("id, code, day_number").eq("template_id", tpl.id).order("sort_order"), "gates");
  console.log("Gates before:", before.map((g) => `${g.code}@Day${g.day_number}`).join(" "));

  // 1. Renumber gates (only on a five-gate project).
  if (before.some((g) => g.code === "G5")) {
    must(await db.from("gate_definitions").delete().eq("template_id", tpl.id).in("code", ["G1", "G2"]), "delete Day-5/Day-10 gates");
    for (const [from, to] of [["G3", "G1"], ["G4", "G2"], ["G5", "G3"]]) {
      must(await db.from("gate_definitions").update({ code: to }).eq("template_id", tpl.id).eq("code", from), `rename ${from}→${to}`);
    }
  }
  for (const [i, g] of GATES.entries()) {
    must(await db.from("gate_definitions").update({
      day_number: g.day, name: g.name, description: g.description, gate_type: g.type, approver_role: g.approver, unlocks: g.unlocks, sort_order: i + 1,
    }).eq("template_id", tpl.id).eq("code", g.code), `gate ${g.code}`);
  }

  // 2. Tasks (template + instance-specific): gate follows the day window.
  const instances = must(await db.from("onboarding_instances").select("id").eq("template_id", tpl.id), "instances");
  const instIds = instances.map((i) => i.id);
  const tasks = [
    ...must(await db.from("tasks").select("id, day_number, gate_code").eq("template_id", tpl.id), "template tasks"),
    ...(instIds.length ? must(await db.from("tasks").select("id, day_number, gate_code").in("instance_id", instIds), "instance tasks") : []),
  ];
  const byGate = new Map<string, string[]>();
  for (const t of tasks) {
    if (!t.gate_code) continue;
    const want = gateForDay(t.day_number);
    if (t.gate_code !== want) byGate.set(want, [...(byGate.get(want) ?? []), t.id]);
  }
  for (const [gate, ids] of byGate) {
    for (let i = 0; i < ids.length; i += 100) must(await db.from("tasks").update({ gate_code: gate }).in("id", ids.slice(i, i + 100)), `tasks → ${gate}`);
  }
  must(await db.from("tasks").update({ action_ref: "gate:G2" }).eq("action_ref", "gate:G4"), "certification task ref");
  console.log(`Tasks re-mapped: ${[...byGate.values()].reduce((n, x) => n + x.length, 0)}`);

  // 3. Days: gate markers and labels from the seed content.
  for (const d of DAYS) {
    must(await db.from("onboarding_days").update({ segment: d.segment, title: d.title, objectives: d.objectives, gate_code: d.gate ?? null })
      .eq("template_id", tpl.id).eq("day_number", d.day), `day ${d.day}`);
  }

  // 4. Assessments and setting labels (values are left untouched).
  for (const a of ASSESSMENTS) must(await db.from("assessments").update({ gate_code: a.gate }).eq("code", a.code), `assessment ${a.code}`);
  for (const k of ["DAY10_PASS_THRESHOLD", "DAY21_PASS_THRESHOLD", "DAY21_REQUIRED"]) {
    const s = SETTINGS.find((x) => x.key === k)!;
    must(await db.from("app_settings").update({ label: s.label, description: s.description }).eq("key", k), `setting ${k}`);
  }

  const after = must(await db.from("gate_definitions").select("code, day_number, name").eq("template_id", tpl.id).order("sort_order"), "gates");
  console.log("Gates after: ", after.map((g) => `${g.code}@Day${g.day_number} (${g.name})`).join(" · "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
