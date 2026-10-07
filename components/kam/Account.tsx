"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Send, Trash2, UserPlus, Upload } from "lucide-react";
import { saveBriefAction, submitBriefAction, addStakeholderAction, removeStakeholderAction } from "@/app/actions/onboarding";
import { Field, StatusPill, Badge } from "@/components/ui";
import { BRIEF_SECTIONS } from "./briefSections";

export function BriefForm({ brief, editable }: { brief: Record<string, string | null | boolean | number> | null; editable: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const init: Record<string, string> = { customer_name: String(brief?.customer_name ?? "Northwind Motors") };
  for (const s of BRIEF_SECTIONS) init[s.key] = String(brief?.[s.key] ?? "");
  const [f, setF] = useState(init);

  const save = () => start(async () => {
    setMsg(null);
    const r = await saveBriefAction(f as never);
    setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
  });
  const submit = () => start(async () => {
    setMsg(null);
    const s = await saveBriefAction(f as never);
    if (!s.ok) { setMsg({ ok: false, text: s.error }); return; }
    const r = await submitBriefAction();
    setMsg(r.ok ? { ok: true, text: "Submitted for mentor review." } : { ok: false, text: r.error });
    router.refresh();
  });
  async function importFile(file: File) {
    const text = await file.text();
    setF((cur) => ({ ...cur, source_notes: `${cur.source_notes ? cur.source_notes + "\n" : ""}Imported from ${file.name}:\n${text.slice(0, 4000)}` }));
  }

  return (
    <div className="space-y-4">
      <Field label="Customer"><input className="input" value={f.customer_name} disabled={!editable} onChange={(e) => setF({ ...f, customer_name: e.target.value })} /></Field>
      <div className="grid gap-4 md:grid-cols-2">
        {BRIEF_SECTIONS.map((s) => (
          <Field key={s.key} label={`${s.label}${s.required ? " *" : ""}`} hint={s.hint}>
            <textarea className="input" rows={3} disabled={!editable} value={f[s.key]} onChange={(e) => setF({ ...f, [s.key]: e.target.value })} maxLength={5000} />
          </Field>
        ))}
      </div>
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary" disabled={pending} onClick={save}><Save size={14} />Save draft</button>
          <button className="btn-primary" disabled={pending} onClick={submit}><Send size={14} />Submit for mentor review</button>
          <label className="btn-ghost cursor-pointer"><Upload size={14} />Import notes (.txt/.md)<input type="file" accept=".txt,.md" className="hidden" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} /></label>
          {msg && <span role="status" className={msg.ok ? "text-xs text-ok" : "text-xs text-bad"}>{msg.text}</span>}
        </div>
      )}
    </div>
  );
}

export interface Stakeholder { id: string; side: string; function: string; name: string; title: string | null; influence: string; relationship_status: string; notes: string | null }

const FUNCTIONS = ["PURCHASING", "ENGINEERING", "QUALITY", "SCM", "PLANT", "FINANCE", "NPD", "PROGRAMME", "LEADERSHIP", "OTHER"];

export function StakeholderMap({ employeeId, items, editable }: { employeeId: string; items: Stakeholder[]; editable: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ side: "CUSTOMER", function: "PURCHASING", name: "", title: "", influence: "MEDIUM", relationship_status: "NEW", notes: "" });
  const add = () => start(async () => {
    setErr(null);
    const r = await addStakeholderAction(employeeId, f as never);
    if (r.ok) { setF({ ...f, name: "", title: "", notes: "" }); router.refresh(); } else setErr(r.error);
  });
  const del = (id: string) => start(async () => { const r = await removeStakeholderAction(employeeId, id); if (!r.ok) setErr(r.error); else router.refresh(); });
  const covered = new Set(items.filter((i) => i.side === "CUSTOMER").map((i) => i.function));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {["PURCHASING", "ENGINEERING", "QUALITY", "SCM", "PLANT"].map((fn) => <Badge key={fn} tone={covered.has(fn) ? "ok" : "muted"}>{covered.has(fn) ? "✓ " : ""}{fn.toLowerCase()}</Badge>)}
      </div>
      {items.length ? (
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Name</th><th>Side</th><th>Function</th><th>Influence</th><th>Relationship</th>{editable && <th />}</tr></thead>
            <tbody>{items.map((s) => (
              <tr key={s.id}>
                <td><div className="font-medium">{s.name}</div>{s.title && <div className="text-xs text-ink-muted">{s.title}</div>}{s.notes && <div className="text-[11px] text-ink-faint">{s.notes}</div>}</td>
                <td className="text-xs">{s.side.toLowerCase()}</td><td className="text-xs">{s.function.toLowerCase()}</td><td className="text-xs">{s.influence.toLowerCase()}</td>
                <td><StatusPill status={s.relationship_status === "AT_RISK" ? "BLOCKED" : s.relationship_status === "ESTABLISHED" ? "APPROVED" : "IN_PROGRESS"} /> <span className="text-[11px] text-ink-faint">{s.relationship_status.replace("_", " ").toLowerCase()}</span></td>
                {editable && <td><button className="btn-ghost btn-sm" disabled={pending} onClick={() => del(s.id)} aria-label={`Remove ${s.name}`}><Trash2 size={13} /></button></td>}
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="text-sm text-ink-muted">No stakeholders yet. Add at least purchasing, engineering, quality and SCM/plant contacts.</p>}
      {editable && (
        <div className="rounded-md border border-line p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Role-based or synthetic name" /></Field>
            <Field label="Title"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <Field label="Side"><select className="input" value={f.side} onChange={(e) => setF({ ...f, side: e.target.value })}><option value="CUSTOMER">Customer</option><option value="INTERNAL">Internal</option></select></Field>
            <Field label="Function"><select className="input" value={f.function} onChange={(e) => setF({ ...f, function: e.target.value })}>{FUNCTIONS.map((x) => <option key={x} value={x}>{x.toLowerCase()}</option>)}</select></Field>
            <Field label="Influence"><select className="input" value={f.influence} onChange={(e) => setF({ ...f, influence: e.target.value })}>{["HIGH", "MEDIUM", "LOW"].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Relationship"><select className="input" value={f.relationship_status} onChange={(e) => setF({ ...f, relationship_status: e.target.value })}>{["NEW", "DEVELOPING", "ESTABLISHED", "AT_RISK"].map((x) => <option key={x}>{x}</option>)}</select></Field>
          </div>
          <div className="mt-2"><Field label="Notes"><input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field></div>
          <div className="mt-3 flex items-center gap-3"><button className="btn-secondary btn-sm" disabled={pending || f.name.trim().length < 2} onClick={add}><UserPlus size={13} />Add stakeholder</button>{err && <span className="text-xs text-bad">{err}</span>}</div>
        </div>
      )}
    </div>
  );
}
