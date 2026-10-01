"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, RotateCcw, Save } from "lucide-react";
import { createEmployeeAction, updateAssignmentsAction, resetOnboardingAction } from "@/app/actions/admin";
import { Field } from "@/components/ui";

interface Person { id: string; full_name: string }

export function CreateEmployeeForm({ mentors, bosses }: { mentors: Person[]; bosses: Person[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ full_name: "", email: "", employee_code: "", joining_date: today, joining_type: "NEW_JOINER", location: "", assigned_customer: "", mentor_id: mentors[0]?.id ?? "", reporting_boss_id: bosses[0]?.id ?? "", temp_password: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => {
      const r = await createEmployeeAction({ ...f, joining_type: f.joining_type as "NEW_JOINER", mentor_id: f.mentor_id || null, reporting_boss_id: f.reporting_boss_id || null });
      setMsg(r.ok ? { ok: true, text: "KAM created, sign-in account provisioned in the Compass, onboarding assigned." } : { ok: false, text: r.error });
      if (r.ok) { setF({ ...f, full_name: "", email: "", employee_code: "", temp_password: "" }); router.refresh(); }
    }); }}>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Full name"><input className="input" required value={f.full_name} onChange={set("full_name")} /></Field>
        <Field label="Work email"><input className="input" type="email" required value={f.email} onChange={set("email")} /></Field>
        <Field label="Employee code"><input className="input" required value={f.employee_code} onChange={set("employee_code")} placeholder="FG-KAM-003" /></Field>
        <Field label="Joining date"><input className="input" type="date" required value={f.joining_date} onChange={set("joining_date")} /></Field>
        <Field label="Joining type"><select className="input" value={f.joining_type} onChange={set("joining_type")}><option value="NEW_JOINER">New joiner</option><option value="REASSIGNED">Reassigned KAM</option></select></Field>
        <Field label="Assigned customer"><input className="input" value={f.assigned_customer} onChange={set("assigned_customer")} /></Field>
        <Field label="Mentor"><select className="input" value={f.mentor_id} onChange={set("mentor_id")}><option value="">—</option>{mentors.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></Field>
        <Field label="Reporting Boss"><select className="input" value={f.reporting_boss_id} onChange={set("reporting_boss_id")}><option value="">—</option>{bosses.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></Field>
        <Field label="Temporary password" hint="Min 10 characters; share securely"><input className="input" type="text" minLength={10} value={f.temp_password} onChange={set("temp_password")} /></Field>
      </div>
      <p className="text-[11px] text-ink-faint">This creates the KAM&apos;s sign-in to the Compass only. It never creates or changes accounts in other IT systems.</p>
      <div className="flex items-center gap-3"><button className="btn-primary" disabled={pending}><UserPlus size={15} />Create KAM & assign onboarding</button>{msg && <span className={msg.ok ? "text-xs text-ok" : "text-xs text-bad"}>{msg.text}</span>}</div>
    </form>
  );
}

export function AssignmentRow({ employeeId, mentorId, bossId, mentors, bosses, startDate }: { employeeId: string; mentorId: string | null; bossId: string | null; mentors: Person[]; bosses: Person[]; startDate: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [m, setM] = useState(mentorId ?? "");
  const [b, setB] = useState(bossId ?? "");
  const [reset, setReset] = useState(false);
  const [rs, setRs] = useState({ date: new Date().toISOString().slice(0, 10), reason: "" });
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-44 py-1.5 text-xs" value={m} onChange={(e) => setM(e.target.value)} aria-label="Mentor"><option value="">No mentor</option>{mentors.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select>
        <select className="input w-44 py-1.5 text-xs" value={b} onChange={(e) => setB(e.target.value)} aria-label="Reporting Boss"><option value="">No boss</option>{bosses.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select>
        <button className="btn-secondary btn-sm" disabled={pending || (m === (mentorId ?? "") && b === (bossId ?? ""))} onClick={() => start(async () => { const r = await updateAssignmentsAction(employeeId, m || null, b || null); setMsg(r.ok ? "Saved." : r.error); router.refresh(); })}><Save size={12} />Save</button>
        <button className="btn-ghost btn-sm" onClick={() => setReset(!reset)}><RotateCcw size={12} />{startDate ? "Reset / reassign" : "Assign onboarding"}</button>
        {msg && <span className="text-xs text-ink-muted">{msg}</span>}
      </div>
      {reset && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-warn/30 bg-warn-soft/40 p-2">
          <Field label="New Day 1"><input className="input py-1.5 text-xs" type="date" value={rs.date} onChange={(e) => setRs({ ...rs, date: e.target.value })} /></Field>
          <div className="min-w-[200px] flex-1"><Field label="Reason (audited)"><input className="input py-1.5 text-xs" value={rs.reason} onChange={(e) => setRs({ ...rs, reason: e.target.value })} /></Field></div>
          <button className="btn-danger btn-sm" disabled={pending || !rs.reason.trim()} onClick={() => start(async () => { const r = await resetOnboardingAction(employeeId, rs.date, rs.reason); setMsg(r.ok ? "Onboarding reset — previous journey archived." : r.error); setReset(false); router.refresh(); })}>Confirm reset</button>
        </div>
      )}
    </div>
  );
}
