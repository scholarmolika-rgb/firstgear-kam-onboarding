"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Plus, Pencil, X } from "lucide-react";
import { saveConfigAction, saveTaskAction } from "@/app/actions/admin";
import { validateConfig } from "@/lib/engine/config";
import { Field, StatusPill, cn } from "@/components/ui";
import type { ProgrammeConfig } from "@/types/domain";

function Num({ label, value, onChange, hint, step = 1 }: { label: string; value: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; hint?: string; step?: number }) {
  return <Field label={label} hint={hint}><input className="input" type="number" step={step} value={Number.isFinite(value) ? value : ""} onChange={onChange} /></Field>;
}

export function ConfigForm({ initial }: { initial: ProgrammeConfig }) {
  const router = useRouter();
  const [c, setC] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const errors = validateConfig(c);
  const num = (fn: (v: number) => ProgrammeConfig) => (e: React.ChangeEvent<HTMLInputElement>) => setC(fn(Number(e.target.value)));
  const weightTotal = Object.values(c.weights).reduce((a, b) => a + b, 0);
  const rwTotal = Object.values(c.readinessWeights).reduce((a, b) => a + b, 0);
  const save = () => start(async () => {
    setMsg(null);
    const r = await saveConfigAction(c);
    setMsg(r.ok ? { ok: true, text: r.data ? `${r.data} setting(s) saved and audited.` : "No changes." } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
  });
  return (
    <div className="space-y-6">
      <section>
        <h3 className="label mb-3">Programme</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2"><Field label="Programme name"><input className="input" value={c.programmeName} onChange={(e) => setC({ ...c, programmeName: e.target.value })} /></Field></div>
          <Num label="Duration (days)" value={c.duration} onChange={num((v) => ({ ...c, duration: v }))} />
          <Num label="Start offset from joining (days)" value={c.startOffsetDays} onChange={num((v) => ({ ...c, startOffsetDays: v }))} />
          <Field label="Day counting"><select className="input" value={c.dayCounting} onChange={(e) => setC({ ...c, dayCounting: e.target.value as "CALENDAR" | "BUSINESS" })}><option value="CALENDAR">Calendar days</option><option value="BUSINESS">Business days</option></select></Field>
          <Num label="Reminder lead time (days)" value={c.reminderLeadDays} onChange={num((v) => ({ ...c, reminderLeadDays: v }))} />
        </div>
      </section>
      <section>
        <h3 className="label mb-3">Day-15 pillar weights <span className={cn("ml-2 normal-case tracking-normal", weightTotal === 100 ? "text-ok" : "text-bad")}>total {weightTotal}%</span></h3>
        <div className="grid gap-3 md:grid-cols-4">
          {(["GOVERNANCE", "PEOPLE", "PROCESS", "PRODUCT"] as const).map((p) => <Num key={p} label={`${p.charAt(0) + p.slice(1).toLowerCase()} (%)`} value={c.weights[p]} onChange={num((v) => ({ ...c, weights: { ...c.weights, [p]: v } }))} />)}
        </div>
      </section>
      <section>
        <h3 className="label mb-3">Gate thresholds</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <Num label="Day-15 Green ≥ (%)" value={c.greenThreshold} onChange={num((v) => ({ ...c, greenThreshold: v }))} />
          <Num label="Day-15 Amber ≥ (%)" value={c.amberThreshold} onChange={num((v) => ({ ...c, amberThreshold: v }))} hint="Below this is Red" />
          <Num label="Day-10 check pass (%)" value={c.day10PassThreshold} onChange={num((v) => ({ ...c, day10PassThreshold: v }))} />
          <Num label="Day-21 certification pass (%)" value={c.day21PassThreshold} onChange={num((v) => ({ ...c, day21PassThreshold: v }))} />
          <Num label="Amber refresh (days, 3–5)" value={c.amberRefreshDays} onChange={num((v) => ({ ...c, amberRefreshDays: v }))} />
          <Num label="Red proposed extension (days)" value={c.redExtensionDays} onChange={num((v) => ({ ...c, redExtensionDays: v }))} />
        </div>
        <div className="mt-3 flex flex-wrap gap-5 text-sm">
          {([["day21Required", "Day-21 certification required"], ["pricingGateRequired", "Pricing gate required"], ["customerOwnershipGateRequired", "Customer-ownership gate required"]] as const).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.checked })} />{l}</label>
          ))}
        </div>
      </section>
      <section>
        <h3 className="label mb-3">Overall readiness composition <span className={cn("ml-2 normal-case tracking-normal", rwTotal === 100 ? "text-ok" : "text-bad")}>total {rwTotal}%</span></h3>
        <div className="grid gap-3 md:grid-cols-4">
          {(["tasks", "knowledge", "scenario", "gates"] as const).map((k) => <Num key={k} label={`${k[0].toUpperCase() + k.slice(1)} (%)`} value={c.readinessWeights[k]} onChange={num((v) => ({ ...c, readinessWeights: { ...c.readinessWeights, [k]: v } }))} />)}
        </div>
      </section>
      <section>
        <h3 className="label mb-3">Sessions, knowledge & retrieval</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Session types (one per line)"><textarea className="input" rows={5} value={c.sessionTypes.join("\n")} onChange={(e) => setC({ ...c, sessionTypes: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} /></Field>
          <Field label="Knowledge categories (one per line)" hint="Documents must use one of the ten supported categories"><textarea className="input" rows={5} value={c.knowledgeCategories.join("\n")} onChange={(e) => setC({ ...c, knowledgeCategories: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} /></Field>
          <Num label="Passages per answer" value={c.ragTopK} onChange={num((v) => ({ ...c, ragTopK: v }))} />
          <Num label="Minimum retrieval similarity (0–1)" step={0.05} value={c.ragMinSimilarity} onChange={num((v) => ({ ...c, ragMinSimilarity: v }))} hint="Below this the assistant says evidence is insufficient" />
        </div>
      </section>
      {errors.length > 0 && <ul className="rounded-md border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">{errors.map((e) => <li key={e}>• {e}</li>)}</ul>}
      <div className="flex items-center gap-3"><button className="btn-primary" disabled={pending || errors.length > 0} onClick={save}><Save size={15} />Save configuration</button>{msg && <span role="status" className={msg.ok ? "text-sm text-ok" : "text-sm text-bad"}>{msg.text}</span>}</div>
    </div>
  );
}

export interface EditableTask { id?: string; code: string; day_number: number; due_day: number; title: string; description: string; pillar: string; task_type: string; owner_role: string; is_mandatory: boolean; requires_approval: boolean; exposure: string; is_active: boolean; depends_on: string[]; action_ref?: string | null }

const blank: EditableTask = { code: "", day_number: 1, due_day: 1, title: "", description: "", pillar: "GOVERNANCE", task_type: "LEARNING", owner_role: "KAM", is_mandatory: true, requires_approval: false, exposure: "NONE", is_active: true, depends_on: [] };

export function TaskEditor({ templateId, tasks }: { templateId: string; tasks: EditableTask[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<EditableTask | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [day, setDay] = useState<number | "all">("all");
  const list = tasks.filter((t) => day === "all" || t.day_number === day);
  const save = () => edit && start(async () => {
    setErr(null);
    const r = await saveTaskAction(templateId, { ...edit, owner_role: edit.owner_role as "KAM" } as never);
    if (r.ok) { setEdit(null); router.refresh(); } else setErr(r.error);
  });
  const sel = (k: keyof EditableTask, opts: string[]) => <select className="input" value={String(edit![k])} onChange={(e) => setEdit({ ...edit!, [k]: e.target.value })}>{opts.map((o) => <option key={o}>{o}</option>)}</select>;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className="input w-40" value={String(day)} onChange={(e) => setDay(e.target.value === "all" ? "all" : Number(e.target.value))}><option value="all">All days</option>{Array.from({ length: 30 }, (_, i) => <option key={i} value={i + 1}>Day {i + 1}</option>)}</select>
        <span className="text-xs text-ink-muted">{tasks.length} tasks · {tasks.filter((t) => t.is_active).length} active</span>
        <button className="btn-secondary btn-sm ml-auto" onClick={() => setEdit({ ...blank, day_number: day === "all" ? 1 : day, due_day: day === "all" ? 1 : day })}><Plus size={13} />Add task</button>
      </div>
      {edit && (
        <div className="mb-4 rounded-md border border-accent/30 bg-accent-soft/40 p-4">
          <div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold">{edit.id ? `Edit ${edit.code}` : "New task"}</span><button className="btn-ghost btn-sm" onClick={() => setEdit(null)}><X size={14} /></button></div>
          {edit.action_ref && <p className="mb-2 text-xs text-warn">System-linked task ({edit.action_ref}) — it completes automatically; keep the link intact.</p>}
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Code"><input className="input" value={edit.code} disabled={!!edit.id} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></Field>
            <div className="md:col-span-3"><Field label="Title"><input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field></div>
            <div className="md:col-span-4"><Field label="Description"><textarea className="input" rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field></div>
            <Field label="Day"><input className="input" type="number" min={1} max={30} value={edit.day_number} onChange={(e) => setEdit({ ...edit, day_number: Number(e.target.value) })} /></Field>
            <Field label="Due day"><input className="input" type="number" min={1} value={edit.due_day} onChange={(e) => setEdit({ ...edit, due_day: Number(e.target.value) })} /></Field>
            <Field label="Pillar">{sel("pillar", ["GOVERNANCE", "PEOPLE", "PROCESS", "PRODUCT"])}</Field>
            <Field label="Type">{sel("task_type", ["LEARNING", "ACTIVITY", "SESSION", "ASSESSMENT", "SCENARIO", "REVIEW", "DELIVERABLE"])}</Field>
            <Field label="Owner">{sel("owner_role", ["KAM", "MENTOR", "REPORTING_BOSS", "HR_ADMIN"])}</Field>
            <Field label="Exposure">{sel("exposure", ["NONE", "CUSTOMER", "PRICING"])}</Field>
            <div className="md:col-span-2"><Field label="Depends on (task codes, comma-separated)"><input className="input" value={edit.depends_on.join(", ")} onChange={(e) => setEdit({ ...edit, depends_on: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></Field></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={edit.is_mandatory} onChange={(e) => setEdit({ ...edit, is_mandatory: e.target.checked })} />Mandatory</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={edit.requires_approval} onChange={(e) => setEdit({ ...edit, requires_approval: e.target.checked })} />Requires reviewer approval</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />Active</label>
          </div>
          <div className="mt-3 flex items-center gap-3"><button className="btn-primary btn-sm" disabled={pending} onClick={save}><Save size={13} />Save task</button>{err && <span className="text-xs text-bad">{err}</span>}</div>
        </div>
      )}
      <div className="-mx-5 overflow-x-auto">
        <table className="table min-w-[860px]">
          <thead><tr><th>Code</th><th>Day</th><th>Task</th><th>Pillar</th><th>Owner</th><th>Flags</th><th /></tr></thead>
          <tbody>{list.map((t) => (
            <tr key={t.id} className={cn(!t.is_active && "opacity-50")}>
              <td className="font-mono text-xs">{t.code}</td><td className="text-xs">{t.day_number}{t.due_day !== t.day_number ? ` → ${t.due_day}` : ""}</td>
              <td><div className="text-sm">{t.title}</div>{t.depends_on.length > 0 && <div className="text-[11px] text-ink-faint">after {t.depends_on.join(", ")}</div>}</td>
              <td className="text-xs">{t.pillar.toLowerCase()}</td><td className="text-xs">{t.owner_role.replace("_", " ").toLowerCase()}</td>
              <td className="space-x-1 text-[10px]">{!t.is_mandatory && <span>optional</span>}{t.requires_approval && <span>approval</span>}{t.exposure !== "NONE" && <span>{t.exposure.toLowerCase()}</span>}{t.action_ref && <span className="text-accent">auto</span>}{!t.is_active && <StatusPill status="CANCELLED" />}</td>
              <td><button className="btn-ghost btn-sm" onClick={() => setEdit(t)} aria-label={`Edit ${t.code}`}><Pencil size={13} /></button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
