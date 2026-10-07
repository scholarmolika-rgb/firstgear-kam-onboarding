/**
 * Applies supabase/migrations/006_real_company_profile.sql to an existing
 * project through the service-role API, then the knowledge documents are
 * ingested separately:
 *
 *   npx tsx scripts/apply-real-company.ts
 *   npx tsx scripts/ingest-knowledge.ts
 *
 * Idempotent. Old product/company quiz questions are deactivated, not
 * deleted, so past attempts keep their questions.
 * Uses SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { TEMPLATE, TASKS, DAYS } from "../lib/seed-data/journey";
import { QUESTIONS, SCENARIOS } from "../lib/seed-data/assessments";

config({ path: ".env.local" });
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const TASK_CODES = ["D01-01", "D01-02", "D02-01", "D02-02", "D02-03", "D02-04", "D02-05"];
const RESOURCE_DAYS = [1, 2, 3, 5, 8, 15];
const RETIRED = ["D10-PRD-01", "D10-PRD-02", "PPL-005", "PRD-001", "PRD-003", "PRD-004", "PRD-005", "PRD-006"];
const ADDED = ["D10-PRD-03", "D10-PRD-04", "PPL-008", "PRD-007", "PRD-008", "PRD-009", "PRD-010", "PRD-011", "PRD-012", "GOV-011"];

async function run(what: string, p: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
}

async function main() {
  const { data: tpl, error } = await db.from("onboarding_templates").select("id").eq("code", TEMPLATE.code).single();
  if (error || !tpl) throw new Error(`template: ${error?.message}`);

  for (const t of TASKS.filter((x) => TASK_CODES.includes(x.code))) {
    await run(`task ${t.code}`, db.from("tasks").update({ title: t.title, description: t.description }).eq("template_id", tpl.id).eq("code", t.code));
  }
  for (const d of DAYS.filter((x) => RESOURCE_DAYS.includes(x.day))) {
    await run(`day ${d.day}`, db.from("onboarding_days").update({ resources: d.resources }).eq("template_id", tpl.id).eq("day_number", d.day));
  }
  console.log(`Tasks updated: ${TASK_CODES.length} · journey days relinked: ${RESOURCE_DAYS.length}`);

  await run("retire questions", db.from("assessment_questions").update({ is_active: false }).in("question_code", RETIRED));
  const prd002 = QUESTIONS.find((q) => q.code === "PRD-002")!;
  await run("PRD-002", db.from("assessment_questions").update({ explanation: prd002.explanation, source_reference: prd002.ref }).eq("question_code", "PRD-002"));
  const rows = QUESTIONS.map((q, i) => ({ q, i })).filter(({ q }) => ADDED.includes(q.code)).map(({ q, i }) => ({
    question_code: q.code, assessment_stage: q.stage, question_type: q.type, pillar: q.pillar, topic: q.topic, difficulty: q.difficulty,
    question: q.question, options: q.options ?? [], correct_answer: q.correct, explanation: q.explanation, weight: q.weight ?? 1,
    source_document: q.source, source_reference: q.ref, sort_order: i + 1,
  }));
  await run("add questions", db.from("assessment_questions").upsert(rows, { onConflict: "question_code", ignoreDuplicates: true }));
  console.log(`Questions retired: ${RETIRED.length} · added: ${rows.length}`);

  for (const s of SCENARIOS) await run(`scenario ${s.code}`, db.from("scenario_templates").update({ situation: s.situation }).eq("code", s.code));
  console.log(`Scenario situations refreshed: ${SCENARIOS.length}`);

  const { data: active } = await db.from("assessment_questions").select("assessment_stage").eq("is_active", true);
  const by: Record<string, number> = {};
  for (const a of active ?? []) by[a.assessment_stage] = (by[a.assessment_stage] ?? 0) + 1;
  console.log("Active questions by stage:", JSON.stringify(by));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
