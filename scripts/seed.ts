/**
 * Seeds synthetic demo data into a Supabase project (run AFTER the migrations).
 *
 *   npx tsx scripts/seed.ts            # 4 demo users + Riya Sharma's journey + knowledge base
 *   npx tsx scripts/seed.ts --cohort   # also adds a second synthetic KAM mid-journey for the HR/cohort views
 *
 * Idempotent: re-running reuses existing users and skips existing records.
 * All people and companies are fictional. Uses SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import { config } from "dotenv";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseFrontMatter, type DocMeta } from "../lib/ai/rag/chunker";
import { ingestDocument } from "../lib/ai/rag/ingest";

config({ path: ".env.local" });
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const db: SupabaseClient = createClient(url, key, { auth: { persistSession: false } });
const PASSWORD = process.env.DEMO_PASSWORD || "FirstGear!2026";
const today = new Date().toLocaleDateString("en-CA", { timeZone: process.env.APP_TIMEZONE || "Asia/Kolkata" });
const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);

const USERS = [
  { key: "kam", email: "riya.sharma@firstgear.example", name: "Riya Sharma", role: "KAM", title: "Key Account Manager" },
  { key: "mentor", email: "arjun.rao@firstgear.example", name: "Arjun Rao", role: "MENTOR", title: "Senior KAM (Mentor)" },
  { key: "boss", email: "meera.iyer@firstgear.example", name: "Meera Iyer", role: "REPORTING_BOSS", title: "Head of Key Accounts" },
  { key: "hr", email: "kavya.nair@firstgear.example", name: "Kavya Nair", role: "HR_ADMIN", title: "HR Business Partner" },
] as const;

async function ensureUser(u: { email: string; name: string; role: string; title: string }): Promise<string> {
  let id: string | undefined;
  const { data: created, error } = await db.auth.admin.createUser({ email: u.email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: u.name } });
  if (created?.user) id = created.user.id;
  else {
    // Already exists — find it.
    for (let page = 1; page < 20 && !id; page++) {
      const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
      id = data.users.find((x) => x.email?.toLowerCase() === u.email)?.id;
      if (!data.users.length) break;
    }
    if (!id) throw new Error(`Could not create or find ${u.email}: ${error?.message}`);
  }
  const { error: pErr } = await db.from("profiles").upsert({ id, full_name: u.name, email: u.email, role: u.role, title: u.title });
  if (pErr) throw new Error(`profile ${u.email}: ${pErr.message}`);
  return id;
}

async function ensureEmployee(profileId: string | null, e: { code: string; name: string; email: string; joining: string; type: string; customer: string; mentor: string; boss: string; hr: string }) {
  const { data: existing } = await db.from("employees").select("id").eq("employee_code", e.code).maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await db.from("employees").insert({
    profile_id: profileId, employee_code: e.code, full_name: e.name, email: e.email, joining_date: e.joining, joining_type: e.type,
    location: "Pune", assigned_customer: e.customer, mentor_id: e.mentor, reporting_boss_id: e.boss, hr_owner_id: e.hr,
  }).select("id").single();
  if (error) throw new Error(`employee ${e.code}: ${error.message}`);
  return data.id as string;
}

async function ensureInstance(employeeId: string, start: string) {
  const { data: tpl } = await db.from("onboarding_templates").select("id").eq("code", "KAM-30").single();
  if (!tpl) throw new Error("Template KAM-30 missing — run the migrations first.");
  let { data: inst } = await db.from("onboarding_instances").select("id").eq("employee_id", employeeId).neq("status", "ARCHIVED").maybeSingle();
  if (!inst) {
    const r = await db.from("onboarding_instances").insert({ employee_id: employeeId, template_id: tpl.id, start_date: start }).select("id").single();
    if (r.error) throw new Error(r.error.message);
    inst = r.data;
  }
  const { data: tasks } = await db.from("tasks").select("id").eq("template_id", tpl.id).eq("is_active", true);
  await db.from("task_completions").upsert((tasks ?? []).map((t) => ({ instance_id: inst!.id, employee_id: employeeId, task_id: t.id })), { onConflict: "instance_id,task_id", ignoreDuplicates: true });
  const { data: gates } = await db.from("gate_definitions").select("id").eq("template_id", tpl.id);
  await db.from("gate_results").upsert((gates ?? []).map((g) => ({ instance_id: inst!.id, employee_id: employeeId, gate_id: g.id })), { onConflict: "instance_id,gate_id", ignoreDuplicates: true });
  return inst!.id as string;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : [];
  });
}

async function seedKnowledge(hrId: string) {
  const files = walk(path.resolve(__dirname, "..", "knowledge"));
  for (const f of files) {
    const { meta, body } = parseFrontMatter(readFileSync(f, "utf8"));
    if (!meta.document_key || !meta.version) { console.warn(`  skip ${f}: no front matter`); continue; }
    const { data: exists } = await db.from("knowledge_documents").select("id").eq("document_key", meta.document_key).eq("version", meta.version).maybeSingle();
    if (exists) { console.log(`  = ${meta.name} v${meta.version} (exists)`); continue; }
    const r = await ingestDocument(db, { ...(meta as DocMeta), approved: meta.approved !== false }, body, { id: hrId, role: "HR_ADMIN" });
    console.log(`  + ${meta.name} v${meta.version}: ${r.chunks} chunks${r.embedded ? " (embedded)" : " (full-text only — set HF_API_TOKEN to embed)"}`);
  }
}

async function seedSessions(employeeId: string, instanceId: string, start: string, ids: Record<string, string>) {
  const { count } = await db.from("sessions").select("id", { count: "exact", head: true }).eq("employee_id", employeeId);
  if (count) return;
  const at = (day: number, hhmm: string) => new Date(`${addDays(start, day - 1)}T${hhmm}:00+05:30`).toISOString();
  const sessions = [
    { title: "HR orientation", session_type: "HR Orientation", owner_id: ids.hr, day_number: 1, scheduled_at: at(1, "10:00"), duration_minutes: 90, location: "Pune HQ — Training Room 2" },
    { title: "Expectations with Reporting Boss", session_type: "Manager Review", owner_id: ids.boss, day_number: 1, scheduled_at: at(1, "15:00"), duration_minutes: 45, meeting_link: "https://meet.example.com/firstgear-expectations" },
    { title: "Plant walk — transmission-shaft line", session_type: "Plant Walk", owner_id: ids.mentor, day_number: 3, scheduled_at: at(3, "09:30"), duration_minutes: 120, location: "Pune Plant 1" },
    { title: "Mentor check-in: week 1", session_type: "Mentor Check-in", owner_id: ids.mentor, day_number: 5, scheduled_at: at(5, "16:00"), duration_minutes: 45, meeting_link: "https://meet.example.com/firstgear-mentor" },
    { title: "Customer 360 review", session_type: "Customer 360 Review", owner_id: ids.mentor, day_number: 12, scheduled_at: at(12, "14:00"), duration_minutes: 60, meeting_link: "https://meet.example.com/firstgear-c360" },
    { title: "Day-15 readiness assessment", session_type: "Assessment", owner_id: ids.hr, day_number: 15, scheduled_at: at(15, "11:00"), duration_minutes: 60, location: "Online — Compass" },
  ];
  await db.from("sessions").insert(sessions.map((s) => ({ ...s, employee_id: employeeId, instance_id: instanceId, created_by: ids.hr })));
}

async function seedCohortKam(ids: Record<string, string>) {
  const start = addDays(today, -11);
  const empId = await ensureEmployee(null, { code: "FG-KAM-002", name: "Dev Malhotra", email: "dev.malhotra@firstgear.example", joining: start, type: "REASSIGNED", customer: "Northwind Motors", mentor: ids.mentor, boss: ids.boss, hr: ids.hr });
  const instId = await ensureInstance(empId, start);
  const { data: tasks } = await db.from("tasks").select("id, day_number, owner_role, action_ref, code").not("template_id", "is", null).lte("day_number", 10);
  const now = new Date().toISOString();
  for (const t of tasks ?? []) await db.from("task_completions").update({ status: "COMPLETED", completed_at: now }).eq("instance_id", instId).eq("task_id", t.id);
  const { data: asmt } = await db.from("assessments").select("id").eq("code", "DAY10-CHECK").single();
  const { count } = await db.from("assessment_attempts").select("id", { count: "exact", head: true }).eq("instance_id", instId);
  if (!count && asmt) {
    await db.from("assessment_attempts").insert({ employee_id: empId, instance_id: instId, assessment_id: asmt.id, status: "SCORED", overall_score: 82, submitted_at: now, confidence: 3, feedback: "Synthetic demo attempt (seed --cohort).", evidence: { synthetic: true } });
  }
  await db.from("support_events").insert([
    ...Array.from({ length: 4 }, (_, i) => ({ employee_id: empId, instance_id: instId, event_type: "MENTOR_HELP", day_number: 2 + i, description: "Synthetic demo event", recorded_by: ids.mentor })),
    { employee_id: empId, instance_id: instId, event_type: "INDEPENDENT_RESOLUTION", day_number: 4, description: "Synthetic demo event", recorded_by: ids.mentor },
    { employee_id: empId, instance_id: instId, event_type: "MENTOR_HELP", day_number: 8, description: "Synthetic demo event", recorded_by: ids.mentor },
    ...Array.from({ length: 3 }, (_, i) => ({ employee_id: empId, instance_id: instId, event_type: "INDEPENDENT_RESOLUTION", day_number: 7 + i, description: "Synthetic demo event", recorded_by: ids.mentor })),
  ]);
  console.log("  + Dev Malhotra (synthetic, Day 12, Days 1–10 complete, no sign-in account)");
}

async function main() {
  console.log(`Seeding ${url} …`);
  const ids: Record<string, string> = {};
  for (const u of USERS) {
    ids[u.key] = await ensureUser(u);
    console.log(`  user ${u.role.padEnd(14)} ${u.email}`);
  }
  const start = process.env.SEED_START_DATE || today;
  const empId = await ensureEmployee(ids.kam, { code: "FG-KAM-001", name: "Riya Sharma", email: USERS[0].email, joining: start, type: "NEW_JOINER", customer: "Northwind Motors", mentor: ids.mentor, boss: ids.boss, hr: ids.hr });
  const instId = await ensureInstance(empId, start);
  console.log(`  Riya Sharma — onboarding starts ${start} (Day 1)`);
  await seedSessions(empId, instId, start, ids);
  console.log("  sessions scheduled");
  console.log("Knowledge base:");
  await seedKnowledge(ids.hr);
  if (process.argv.includes("--cohort")) await seedCohortKam(ids);
  await db.from("audit_logs").insert({ actor_role: "SYSTEM", event_type: "ONBOARDING_ASSIGNED", entity_type: "seed", employee_id: empId, new_value: { seeded: true, start } });
  console.log(`\nDone. Sign in with any demo account and password "${PASSWORD}".`);
}

main().catch((e) => { console.error(e); process.exit(1); });
