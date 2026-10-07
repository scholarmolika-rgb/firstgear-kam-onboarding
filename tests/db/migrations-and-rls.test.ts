import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createMigratedDb, asUser } from "./pglite";

const KAM = "00000000-0000-4000-8000-000000000001";
const MENTOR = "00000000-0000-4000-8000-000000000002";
const BOSS = "00000000-0000-4000-8000-000000000003";
const HR = "00000000-0000-4000-8000-000000000004";
const OTHER_KAM = "00000000-0000-4000-8000-000000000005";

let db: PGlite;
let employeeId: string;
let otherEmployeeId: string;
let instanceId: string;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<T>(sql, params);
  return r.rows[0];
}

beforeAll(async () => {
  db = await createMigratedDb();
  for (const [id, name, role] of [
    [KAM, "Riya Sharma", "KAM"], [MENTOR, "Arjun Rao", "MENTOR"], [BOSS, "Meera Iyer", "REPORTING_BOSS"],
    [HR, "Kavya Nair", "HR_ADMIN"], [OTHER_KAM, "Other KAM", "KAM"],
  ]) {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `${role.toLowerCase()}@example.test`]);
    await db.query("insert into public.profiles (id, full_name, email, role) values ($1,$2,$3,$4)", [id, name, `${id}@x.test`, role]);
  }
  employeeId = (await one<{ id: string }>(
    `insert into public.employees (profile_id, employee_code, full_name, email, joining_date, mentor_id, reporting_boss_id, hr_owner_id)
     values ($1,'FG-KAM-001','Riya Sharma','riya@x.test', current_date, $2, $3, $4) returning id`, [KAM, MENTOR, BOSS, HR])).id;
  otherEmployeeId = (await one<{ id: string }>(
    `insert into public.employees (profile_id, employee_code, full_name, email, joining_date)
     values ($1,'FG-KAM-002','Other KAM','other@x.test', current_date) returning id`, [OTHER_KAM])).id;
  instanceId = (await one<{ id: string }>(
    `insert into public.onboarding_instances (employee_id, template_id, start_date)
     select $1, id, current_date from public.onboarding_templates where code = 'KAM-30' returning id`, [employeeId])).id;
  await db.query(
    `insert into public.task_completions (instance_id, employee_id, task_id)
     select $1, $2, id from public.tasks where template_id is not null`, [instanceId, employeeId]);
});

describe("migrations & seed data", () => {
  it("seeds 30 days, 3 gates, 40+ tasks, 20+ questions, 10 scenarios", async () => {
    const c = await one<Record<string, number>>(`select
      (select count(*)::int from public.onboarding_days) days,
      (select count(*)::int from public.gate_definitions) gates,
      (select count(*)::int from public.tasks) tasks,
      (select count(*)::int from public.assessment_questions where assessment_stage = 'DAY15_READINESS') q15,
      (select count(*)::int from public.scenario_templates) scenarios,
      (select count(distinct pillar)::int from public.tasks) pillars`);
    expect(c.days).toBe(30);
    expect(c.gates).toBe(3);
    expect(c.tasks).toBeGreaterThanOrEqual(40);
    expect(c.q15).toBeGreaterThanOrEqual(20);
    expect(c.scenarios).toBe(10);
    expect(c.pillars).toBe(4);
  });

  it("default pillar weights total 100", async () => {
    const r = await one<{ total: number }>(`select sum((value)::text::numeric)::int total from public.app_settings
      where key in ('GOVERNANCE_WEIGHT','PEOPLE_WEIGHT','PROCESS_WEIGHT','PRODUCT_WEIGHT')`);
    expect(r.total).toBe(100);
  });

  it("every Day-15 question carries pillar, weight and a source", async () => {
    const r = await one<{ n: number }>(`select count(*)::int n from public.assessment_questions
      where pillar is null or weight <= 0 or source_document is null or source_reference is null`);
    expect(r.n).toBe(0);
  });

  it("vector retrieval only returns approved + current chunks", async () => {
    const vec = `[${Array.from({ length: 384 }, (_, i) => (i === 0 ? 1 : 0)).join(",")}]`;
    const doc = (approved: boolean, current: boolean, key: string) => one<{ id: string }>(
      `insert into public.knowledge_documents (document_key, name, category, version, approved, is_current, status, content)
       values ($1, $1, 'Processes', '1.0', $2, $3, 'APPROVED', 'x') returning id`, [key, approved, current]);
    for (const [a, c, k] of [[true, true, "OK"], [false, true, "DRAFT"], [true, false, "OLD"]] as const) {
      const d = await doc(a, c, k);
      await db.query(`insert into public.knowledge_chunks (document_id, chunk_index, content, document_name, category, version, approved, is_current, embedding)
        values ($1, 0, 'rfq intake feasibility', $2, 'Processes', '1.0', $3, $4, $5::vector)`, [d.id, k, a, c, vec]);
    }
    const v = await db.query<{ document_name: string }>(`select document_name from public.match_knowledge_chunks($1::vector, 10, null)`, [vec]);
    expect(v.rows.map((r) => r.document_name)).toEqual(["OK"]);
    const t = await db.query<{ document_name: string }>(`select document_name from public.search_knowledge_text('feasibility', 10, null)`);
    expect(t.rows.map((r) => r.document_name)).toEqual(["OK"]);
  });
});

describe("row level security", () => {
  it("a KAM sees only their own employee record and progress", async () => {
    await asUser(db, KAM, async (d) => {
      const e = await d.query<{ id: string }>("select id from public.employees");
      expect(e.rows.map((r) => r.id)).toEqual([employeeId]);
      const c = await d.query<{ n: number }>("select count(*)::int n from public.task_completions where employee_id = $1", [otherEmployeeId]);
      expect(c.rows[0].n).toBe(0);
    });
  });

  it("another KAM cannot see Riya's data", async () => {
    await asUser(db, OTHER_KAM, async (d) => {
      const r = await d.query<{ n: number }>("select count(*)::int n from public.task_completions where employee_id = $1", [employeeId]);
      expect(r.rows[0].n).toBe(0);
    });
  });

  it("a KAM can tick their own KAM-owned task and the change persists", async () => {
    const task = await one<{ id: string }>(`select id from public.tasks where code = 'D01-04'`);
    await asUser(db, KAM, async (d) => {
      const r = await d.query(`update public.task_completions set status = 'COMPLETED', completed_at = now(), completed_by = $1
        where instance_id = $2 and task_id = $3`, [KAM, instanceId, task.id]);
      expect(r.affectedRows).toBe(1);
    });
    const after = await one<{ status: string; completed_by: string }>(
      `select status, completed_by from public.task_completions where instance_id = $1 and task_id = $2`, [instanceId, task.id]);
    expect(after).toEqual({ status: "COMPLETED", completed_by: KAM });
  });

  it("a KAM cannot tick a mentor-owned or system-driven task", async () => {
    const tasks = await db.query<{ id: string }>(`select id from public.tasks where code in ('D10-04', 'D15-01')`);
    await asUser(db, KAM, async (d) => {
      for (const t of tasks.rows) {
        const r = await d.query(`update public.task_completions set status = 'COMPLETED' where instance_id = $1 and task_id = $2`, [instanceId, t.id]);
        expect(r.affectedRows).toBe(0);
      }
    });
  });

  it("a KAM cannot mark an approval-required task COMPLETED (only submit it)", async () => {
    const task = await one<{ id: string }>(`select id from public.tasks where code = 'D17-02'`);
    await asUser(db, KAM, async (d) => {
      await expect(d.query(`update public.task_completions set status = 'COMPLETED' where instance_id = $1 and task_id = $2`, [instanceId, task.id]))
        .rejects.toThrow(/requires reviewer approval/);
      const ok = await d.query(`update public.task_completions set status = 'SUBMITTED' where instance_id = $1 and task_id = $2`, [instanceId, task.id]);
      expect(ok.affectedRows).toBe(1);
    });
  });

  it("a KAM cannot write scores, gate results or audit entries", async () => {
    const gate = await one<{ id: string }>(`select id from public.gate_definitions where code = 'G1'`);
    await asUser(db, KAM, async (d) => {
      await expect(d.query(`insert into public.gate_results (employee_id, instance_id, gate_id, status) values ($1,$2,$3,'PASSED')`,
        [employeeId, instanceId, gate.id])).rejects.toThrow();
      await expect(d.query(`insert into public.pillar_scores (employee_id, instance_id, source, pillar, raw_score, weight, weighted_score)
        values ($1,$2,'DAY15_READINESS','PROCESS',100,30,30)`, [employeeId, instanceId])).rejects.toThrow();
      await expect(d.query(`insert into public.audit_logs (employee_id, event_type, entity_type) values ($1,'X','Y')`, [employeeId])).rejects.toThrow();
    });
  });

  it("a KAM cannot read correct answers or scenario rubrics", async () => {
    await asUser(db, KAM, async (d) => {
      expect((await d.query("select * from public.assessment_questions")).rows.length).toBe(0);
      expect((await d.query("select * from public.scenario_templates")).rows.length).toBe(0);
    });
  });

  it("a KAM cannot approve their own account brief; the mentor can", async () => {
    const brief = await one<{ id: string }>(
      `insert into public.account_briefs (employee_id, instance_id, customer_name, status) values ($1,$2,'Northwind Motors','SUBMITTED') returning id`,
      [employeeId, instanceId]);
    await asUser(db, KAM, async (d) => {
      await expect(d.query(`update public.account_briefs set approved = true, status = 'APPROVED' where id = $1`, [brief.id]))
        .rejects.toThrow(/cannot review or approve/);
    });
    await asUser(db, MENTOR, async (d) => {
      const r = await d.query(`update public.account_briefs set approved = true, status = 'APPROVED', reviewed_by = $2 where id = $1`, [brief.id, MENTOR]);
      expect(r.affectedRows).toBe(1);
    });
  });

  it("the mentor and reporting boss see only assigned KAMs", async () => {
    for (const who of [MENTOR, BOSS]) {
      await asUser(db, who, async (d) => {
        const e = await d.query<{ id: string }>("select id from public.employees");
        expect(e.rows.map((r) => r.id)).toEqual([employeeId]);
      });
    }
  });

  it("only the assigned reporting boss can record a Day-30 sign-off", async () => {
    await asUser(db, MENTOR, async (d) => {
      await expect(d.query(`insert into public.manager_reviews (employee_id, instance_id, manager_id, review_type, decision)
        values ($1,$2,$3,'DAY30_SIGNOFF','READY')`, [employeeId, instanceId, MENTOR])).rejects.toThrow();
    });
    await asUser(db, BOSS, async (d) => {
      const r = await d.query(`insert into public.manager_reviews (employee_id, instance_id, manager_id, review_type, decision)
        values ($1,$2,$3,'DAY30_SIGNOFF','READY')`, [employeeId, instanceId, BOSS]);
      expect(r.affectedRows).toBe(1);
    });
  });

  it("HR can change programme settings; a KAM cannot", async () => {
    await asUser(db, KAM, async (d) => {
      const r = await d.query(`update public.app_settings set value = '50'::jsonb where key = 'DAY15_GREEN_THRESHOLD'`);
      expect(r.affectedRows).toBe(0);
    });
    await asUser(db, HR, async (d) => {
      const r = await d.query(`update public.app_settings set value = '82'::jsonb where key = 'DAY15_GREEN_THRESHOLD'`);
      expect(r.affectedRows).toBe(1);
    });
  });

  it("audit logs are append-only, even for the system", async () => {
    const a = await one<{ id: string }>(`insert into public.audit_logs (employee_id, event_type, entity_type) values ($1,'TASK_COMPLETED','task') returning id`, [employeeId]);
    await expect(db.query(`update public.audit_logs set event_type = 'X' where id = $1`, [a.id])).rejects.toThrow(/append-only/);
    await expect(db.query(`delete from public.audit_logs where id = $1`, [a.id])).rejects.toThrow(/append-only/);
  });

  it("anonymous visitors see nothing", async () => {
    await db.exec("set role anon");
    try {
      const r = await db.query<{ n: number }>("select count(*)::int n from public.employees");
      expect(r.rows[0].n).toBe(0);
    } finally {
      await db.exec("reset role");
    }
  });
});

describe("KAM support chat (KAM ↔ Mentor ↔ HR)", () => {
  let threadId: string;
  const send = (d: PGlite, sender: string, role: string, body: string, emp = employeeId, thread = threadId) =>
    d.query(`insert into public.chat_messages (thread_id, employee_id, sender_id, sender_role, body) values ($1,$2,$3,$4,$5)`, [thread, emp, sender, role, body]);

  beforeAll(async () => {
    threadId = (await one<{ id: string }>(`insert into public.chat_threads (employee_id) values ($1) returning id`, [employeeId])).id;
  });

  it("the KAM, their Mentor and HR can all post and read the thread", async () => {
    await asUser(db, KAM, (d) => send(d, KAM, "KAM", "Where do I find the approval matrix?"));
    await asUser(db, MENTOR, (d) => send(d, MENTOR, "MENTOR", "Day 2 resources — Approval authority matrix."));
    await asUser(db, HR, (d) => send(d, HR, "HR_ADMIN", "HR here: ping me for any access issues."));
    for (const who of [KAM, MENTOR, HR]) {
      await asUser(db, who, async (d) => {
        const r = await d.query<{ n: number }>("select count(*)::int n from public.chat_messages where thread_id = $1", [threadId]);
        expect(r.rows[0].n).toBe(3);
      });
    }
  });

  it("another KAM and the Reporting Boss cannot read or post", async () => {
    for (const who of [OTHER_KAM, BOSS]) {
      await asUser(db, who, async (d) => {
        const r = await d.query<{ n: number }>("select count(*)::int n from public.chat_messages");
        expect(r.rows[0].n).toBe(0);
        expect((await d.query("select id from public.chat_threads")).rows).toEqual([]);
        await expect(send(d, who, who === BOSS ? "REPORTING_BOSS" : "KAM", "hello")).rejects.toThrow();
      });
    }
  });

  it("nobody can post as someone else or claim another role", async () => {
    await asUser(db, KAM, async (d) => {
      await expect(send(d, MENTOR, "MENTOR", "spoofed")).rejects.toThrow();
      await expect(send(d, KAM, "MENTOR", "wrong role")).rejects.toThrow();
    });
  });

  it("messages cannot be edited or deleted by users", async () => {
    await asUser(db, KAM, async (d) => {
      const u = await d.query("update public.chat_messages set body = 'edited' where sender_id = $1", [KAM]);
      expect(u.affectedRows ?? 0).toBe(0);
      const del = await d.query("delete from public.chat_messages where sender_id = $1", [KAM]);
      expect(del.affectedRows ?? 0).toBe(0);
    });
  });

  it("each user tracks only their own read position", async () => {
    await asUser(db, MENTOR, (d) => d.query("insert into public.chat_reads (thread_id, user_id) values ($1, $2)", [threadId, MENTOR]));
    await asUser(db, KAM, async (d) => {
      await expect(d.query("insert into public.chat_reads (thread_id, user_id) values ($1, $2)", [threadId, MENTOR])).rejects.toThrow();
      expect((await d.query("select * from public.chat_reads")).rows).toEqual([]);
    });
  });
});
