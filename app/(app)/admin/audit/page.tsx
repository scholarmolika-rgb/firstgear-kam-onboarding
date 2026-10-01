import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, PageHeader, cn } from "@/components/ui";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ event?: string; page?: string; employee?: string }> }) {
  const { event, page = "1", employee } = await searchParams;
  await requireRole(["HR_ADMIN"]);
  const db = await createServerSupabase();
  const p = Math.max(1, Number(page) || 1);
  let q = db.from("audit_logs").select("id, created_at, event_type, entity_type, entity_id, actor_id, actor_role, employee_id, previous_value, new_value", { count: "exact" }).order("created_at", { ascending: false }).range((p - 1) * PAGE, p * PAGE - 1);
  if (event) q = q.eq("event_type", event);
  if (employee) q = q.eq("employee_id", employee);
  const { data: rows, count } = await q;
  const ids = Array.from(new Set((rows ?? []).flatMap((r) => [r.actor_id, r.employee_id]).filter(Boolean))) as string[];
  const { data: people } = ids.length ? await db.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const { data: emps } = ids.length ? await db.from("employees").select("id, full_name").in("id", ids) : { data: [] };
  const name = (id: string | null) => (id ? people?.find((x) => x.id === id)?.full_name ?? emps?.find((x) => x.id === id)?.full_name ?? id.slice(0, 8) : "System");
  const EVENTS = ["TASK_COMPLETED", "TASK_REOPENED", "ASSESSMENT_SUBMITTED", "ASSESSMENT_RETAKEN", "GATE_PASSED", "GATE_FAILED", "GATE_BLOCKED", "MENTOR_REVIEWED", "MANAGER_APPROVED", "MANAGER_DEFERRED", "FINAL_DECISION", "DOCUMENT_UPLOADED", "POLICY_UPDATED", "CONFIG_CHANGED", "SESSION_SCHEDULED", "SESSION_RESCHEDULED", "AI_ESCALATION"];
  const short = (v: unknown) => { const s = v ? JSON.stringify(v) : ""; return s.length > 140 ? s.slice(0, 140) + "…" : s; };
  return (
    <>
      <PageHeader title="Audit log" subtitle={`Append-only record of every important action (${count ?? 0} entries${event ? ` · ${event}` : ""}). Entries cannot be edited or deleted — even by the system.`} />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/admin/audit" className={cn("rounded-full border px-2.5 py-1 text-[11px]", !event ? "border-accent bg-accent text-white" : "border-line-strong bg-white")}>All</Link>
        {EVENTS.map((e) => <Link key={e} href={`/admin/audit?event=${e}`} className={cn("rounded-full border px-2.5 py-1 text-[11px]", event === e ? "border-accent bg-accent text-white" : "border-line-strong bg-white")}>{e.replace(/_/g, " ").toLowerCase()}</Link>)}
      </div>
      <Card>
        <div className="-mx-5 -my-5 overflow-x-auto">
          <table className="table min-w-[980px]">
            <thead><tr><th>Time</th><th>Event</th><th>Actor</th><th>Employee</th><th>Entity</th><th>Previous → new</th></tr></thead>
            <tbody>{(rows ?? []).map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Kolkata" })}</td>
                <td className="font-mono text-[11px]">{r.event_type}</td>
                <td className="text-xs">{name(r.actor_id)}<div className="text-ink-faint">{r.actor_role}</div></td>
                <td className="text-xs">{r.employee_id ? <Link className="link" href={`/admin/audit?employee=${r.employee_id}`}>{name(r.employee_id)}</Link> : "—"}</td>
                <td className="text-[11px]">{r.entity_type}<div className="font-mono text-ink-faint">{r.entity_id?.slice(0, 8)}</div></td>
                <td className="max-w-[360px] font-mono text-[10px] text-ink-muted"><div className="text-ink-faint">{short(r.previous_value)}</div><div>{short(r.new_value)}</div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
      <div className="mt-4 flex justify-between text-sm">
        {p > 1 ? <Link className="link" href={`/admin/audit?page=${p - 1}${event ? `&event=${event}` : ""}${employee ? `&employee=${employee}` : ""}`}>← Newer</Link> : <span />}
        {(count ?? 0) > p * PAGE && <Link className="link" href={`/admin/audit?page=${p + 1}${event ? `&event=${event}` : ""}${employee ? `&employee=${employee}` : ""}`}>Older →</Link>}
      </div>
    </>
  );
}
