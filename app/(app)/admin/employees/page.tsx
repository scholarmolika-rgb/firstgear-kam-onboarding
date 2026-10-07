import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, PageHeader, StatusPill, fmtDate } from "@/components/ui";
import { CreateEmployeeForm, AssignmentRow, EditEmployee } from "@/components/admin/Employees";

export const metadata = { title: "Employee management" };
export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  await requireRole(["HR_ADMIN"]);
  const db = await createServerSupabase();
  const { data: emps } = await db.from("employees").select("id, full_name, email, employee_code, joining_date, joining_type, location, assigned_customer, mentor_id, reporting_boss_id, status").order("full_name");
  const { data: insts } = await db.from("onboarding_instances").select("employee_id, start_date, status, final_decision").neq("status", "ARCHIVED");
  const { data: people } = await db.from("profiles").select("id, full_name, role").in("role", ["MENTOR", "REPORTING_BOSS"]).eq("is_active", true).order("full_name");
  const mentors = (people ?? []).filter((p) => p.role === "MENTOR");
  const bosses = (people ?? []).filter((p) => p.role === "REPORTING_BOSS");
  return (
    <>
      <PageHeader title="Employee management" subtitle="Create and edit KAMs, assign the onboarding template, mentor and Reporting Boss, and reset or reassign onboarding. Every change is audited." />
      <Card title="KAMs">
        <div className="-mx-5 -my-5 overflow-x-auto">
          <table className="table min-w-[900px]">
            <thead><tr><th>KAM</th><th>Joining</th><th>Onboarding</th><th>Mentor · Reporting Boss</th></tr></thead>
            <tbody>{(emps ?? []).map((e) => {
              const inst = insts?.find((i) => i.employee_id === e.id);
              return (
                <tr key={e.id}>
                  <td><Link href={`/people/${e.id}`} className="font-medium text-accent hover:underline">{e.full_name}</Link><div className="text-[11px] text-ink-muted">{e.employee_code} · {e.email}</div><div className="text-[11px] text-ink-faint">{e.assigned_customer}</div>{e.status === "INACTIVE" && <div className="text-[11px] text-bad">Inactive</div>}<EditEmployee e={e} /></td>
                  <td className="text-xs">{fmtDate(e.joining_date)}<div className="text-ink-faint">{e.joining_type === "REASSIGNED" ? "Reassigned" : "New joiner"}</div></td>
                  <td className="text-xs">{inst ? <>Day 1: {fmtDate(inst.start_date)}<div className="mt-1"><StatusPill status={inst.final_decision ?? inst.status} /></div></> : <span className="text-ink-faint">Not assigned</span>}</td>
                  <td><AssignmentRow employeeId={e.id} mentorId={e.mentor_id} bossId={e.reporting_boss_id} mentors={mentors} bosses={bosses} startDate={inst?.start_date ?? null} /></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </Card>
      <div className="mt-6"><Card title="Add a KAM" subtitle="Assigns the active KAM 30-day template on save"><CreateEmployeeForm mentors={mentors} bosses={bosses} /></Card></div>
    </>
  );
}
