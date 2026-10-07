/**
 * Applies supabase/migrations/007_pillar_ordered_phase1.sql to an existing
 * project through the service-role API:
 *
 *   npx tsx scripts/apply-pillar-order.ts
 *   npx tsx scripts/ingest-knowledge.ts      # updated journey FAQ + assessment guide
 *
 * Phase 1 becomes Governance (Days 1–4) → People (5–7) → Product (8–9) →
 * Process (10–14) → Day-15 gate. Template tasks keep their ids, so existing
 * completions are preserved. Idempotent. Uses SUPABASE_SERVICE_ROLE_KEY.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { TEMPLATE, TASKS, DAYS, SETTINGS } from "../lib/seed-data/journey";
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

async function run(what: string, p: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
}

async function main() {
  const { data: tpl, error } = await db.from("onboarding_templates").select("id").eq("code", TEMPLATE.code).single();
  if (error || !tpl) throw new Error(`template: ${error?.message}`);

  const order = new Map(TASKS.map((t, i) => [t.code, i + 1]));
  const phase1 = TASKS.filter((t) => t.day <= 15);
  for (const t of phase1) {
    await run(`task ${t.code}`, db.from("tasks").update({ day_number: t.day, due_day: t.due ?? t.day, sort_order: order.get(t.code), description: t.description })
      .eq("template_id", tpl.id).eq("code", t.code));
  }
  for (const d of DAYS.filter((x) => x.day <= 15)) {
    await run(`day ${d.day}`, db.from("onboarding_days").update({ segment: d.segment, title: d.title, pillars: d.pillars, objectives: d.objectives, resources: d.resources })
      .eq("template_id", tpl.id).eq("day_number", d.day));
  }
  const check = ASSESSMENTS.find((a) => a.code === "DAY10-CHECK")!;
  await run("interim check", db.from("assessments").update({ title: check.title, description: check.description, available_from_day: check.from }).eq("code", check.code));
  const s = SETTINGS.find((x) => x.key === "DAY10_PASS_THRESHOLD")!;
  await run("setting", db.from("app_settings").update({ label: s.label, description: s.description }).eq("key", s.key));

  const { data: days } = await db.from("onboarding_days").select("day_number, segment, title").eq("template_id", tpl.id).lte("day_number", 15).order("day_number");
  const { data: tasks } = await db.from("tasks").select("day_number, pillar").eq("template_id", tpl.id).eq("owner_role", "KAM").lte("day_number", 15);
  for (const d of days ?? []) {
    const p = (tasks ?? []).filter((t) => t.day_number === d.day_number).map((t) => t.pillar.slice(0, 3));
    console.log(`Day ${String(d.day_number).padStart(2)}  ${d.segment.padEnd(12)} ${d.title.padEnd(46)} ${p.join(" ")}`);
  }
  console.log(`Tasks re-scheduled: ${phase1.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
