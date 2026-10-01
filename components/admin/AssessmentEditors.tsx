"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Save, X, Trash2 } from "lucide-react";
import { saveQuestionAction, saveRubricAction } from "@/app/actions/admin";
import { Field, cn } from "@/components/ui";

type Opt = { id: string; text: string };
type Rubric = { label: string; keywords: string[] };
export interface QuestionData {
  id?: string; question_code: string; assessment_stage: string; question_type: string; pillar: string; topic: string; difficulty: string;
  question: string; options: Opt[]; correct_answer: { value?: string | boolean; values?: string[]; rubric?: Rubric[] }; explanation: string;
  weight: number; source_document: string; source_reference: string; is_active: boolean;
}

const TYPES = ["MULTIPLE_CHOICE", "MULTI_SELECT", "TRUE_FALSE", "SHORT_ANSWER", "SCENARIO", "CASE_STUDY", "ROLE_PLAY"];
const blank: QuestionData = { question_code: "", assessment_stage: "DAY15_READINESS", question_type: "MULTIPLE_CHOICE", pillar: "PROCESS", topic: "", difficulty: "medium", question: "", options: [{ id: "a", text: "" }, { id: "b", text: "" }], correct_answer: { value: "a" }, explanation: "", weight: 1, source_document: "", source_reference: "", is_active: true };

export function QuestionBank({ questions }: { questions: QuestionData[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<QuestionData | null>(null);
  const [stage, setStage] = useState("DAY15_READINESS");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const list = questions.filter((q) => stage === "ALL" || q.assessment_stage === stage);
  const isChoice = edit && ["MULTIPLE_CHOICE", "MULTI_SELECT"].includes(edit.question_type);
  const isRubric = edit && ["SHORT_ANSWER", "SCENARIO", "CASE_STUDY", "ROLE_PLAY"].includes(edit.question_type);
  const save = () => edit && start(async () => {
    setErr(null);
    const r = await saveQuestionAction({ ...edit, question_type: edit.question_type as "MULTIPLE_CHOICE", pillar: edit.pillar as "PROCESS", assessment_stage: edit.assessment_stage as "DAY15_READINESS", difficulty: edit.difficulty as "medium" } as never);
    if (r.ok) { setEdit(null); router.refresh(); } else setErr(r.error);
  });
  const setType = (t: string) => {
    if (!edit) return;
    const ca = t === "MULTIPLE_CHOICE" ? { value: edit.options[0]?.id ?? "a" } : t === "MULTI_SELECT" ? { values: [edit.options[0]?.id ?? "a"] } : t === "TRUE_FALSE" ? { value: true } : { rubric: edit.correct_answer.rubric ?? [{ label: "", keywords: [] }] };
    setEdit({ ...edit, question_type: t, correct_answer: ca });
  };
  const counts = (s: string) => questions.filter((q) => q.assessment_stage === s && q.is_active).length;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {["DAY10_CHECK", "DAY15_READINESS", "PRACTICE", "ALL"].map((s) => <button key={s} onClick={() => setStage(s)} className={cn("rounded-full border px-3 py-1 text-xs", stage === s ? "border-accent bg-accent text-white" : "border-line-strong bg-white")}>{s.replace(/_/g, " ").toLowerCase()} {s !== "ALL" && <span className="opacity-75">({counts(s)} active)</span>}</button>)}
        <button className="btn-secondary btn-sm ml-auto" onClick={() => setEdit({ ...blank, assessment_stage: stage === "ALL" ? "DAY15_READINESS" : stage })}><Plus size={13} />Add question</button>
      </div>
      {edit && (
        <div className="mb-4 rounded-md border border-accent/30 bg-accent-soft/40 p-4">
          <div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold">{edit.id ? `Edit ${edit.question_code}` : "New question"}</span><button className="btn-ghost btn-sm" onClick={() => setEdit(null)}><X size={14} /></button></div>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Question ID"><input className="input" value={edit.question_code} onChange={(e) => setEdit({ ...edit, question_code: e.target.value })} placeholder="PROC-008" /></Field>
            <Field label="Stage"><select className="input" value={edit.assessment_stage} onChange={(e) => setEdit({ ...edit, assessment_stage: e.target.value })}><option value="DAY10_CHECK">Day-10 check</option><option value="DAY15_READINESS">Day-15 readiness</option><option value="PRACTICE">Practice</option></select></Field>
            <Field label="Type"><select className="input" value={edit.question_type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ").toLowerCase()}</option>)}</select></Field>
            <Field label="Pillar"><select className="input" value={edit.pillar} onChange={(e) => setEdit({ ...edit, pillar: e.target.value })}>{["GOVERNANCE", "PEOPLE", "PROCESS", "PRODUCT"].map((p) => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Topic"><input className="input" value={edit.topic} onChange={(e) => setEdit({ ...edit, topic: e.target.value })} /></Field>
            <Field label="Difficulty"><select className="input" value={edit.difficulty} onChange={(e) => setEdit({ ...edit, difficulty: e.target.value })}><option>easy</option><option>medium</option><option>hard</option></select></Field>
            <Field label="Weight"><input className="input" type="number" step={0.5} min={0.5} max={10} value={edit.weight} onChange={(e) => setEdit({ ...edit, weight: Number(e.target.value) })} /></Field>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />Active</label>
            <div className="md:col-span-4"><Field label="Question"><textarea className="input" rows={2} value={edit.question} onChange={(e) => setEdit({ ...edit, question: e.target.value })} /></Field></div>
          </div>
          {isChoice && (
            <div className="mt-3 space-y-1.5">
              <div className="label">Options — tick the correct answer{edit.question_type === "MULTI_SELECT" ? "s" : ""}</div>
              {edit.options.map((o, i) => {
                const checked = edit.question_type === "MULTI_SELECT" ? (edit.correct_answer.values ?? []).includes(o.id) : edit.correct_answer.value === o.id;
                return (
                  <div key={o.id} className="flex items-center gap-2">
                    <input type={edit.question_type === "MULTI_SELECT" ? "checkbox" : "radio"} checked={checked} onChange={() => setEdit({ ...edit, correct_answer: edit.question_type === "MULTI_SELECT" ? { values: checked ? (edit.correct_answer.values ?? []).filter((v) => v !== o.id) : [...(edit.correct_answer.values ?? []), o.id] } : { value: o.id } })} aria-label={`Correct: option ${o.id}`} />
                    <span className="w-5 text-xs text-ink-muted">{o.id}</span>
                    <input className="input py-1.5" value={o.text} onChange={(e) => setEdit({ ...edit, options: edit.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
                    <button className="btn-ghost btn-sm" onClick={() => setEdit({ ...edit, options: edit.options.filter((_, j) => j !== i) })} aria-label="Remove option"><Trash2 size={12} /></button>
                  </div>
                );
              })}
              {edit.options.length < 8 && <button className="btn-ghost btn-sm" onClick={() => setEdit({ ...edit, options: [...edit.options, { id: String.fromCharCode(97 + edit.options.length), text: "" }] })}><Plus size={12} />Option</button>}
            </div>
          )}
          {edit.question_type === "TRUE_FALSE" && (
            <div className="mt-3 flex gap-4 text-sm">{[true, false].map((v) => <label key={String(v)} className="flex items-center gap-2"><input type="radio" checked={edit.correct_answer.value === v} onChange={() => setEdit({ ...edit, correct_answer: { value: v } })} />Correct answer: {v ? "True" : "False"}</label>)}</div>
          )}
          {isRubric && (
            <div className="mt-3 space-y-1.5">
              <div className="label">Scoring rubric — each point is met when the answer mentions any of its keywords</div>
              {(edit.correct_answer.rubric ?? []).map((r, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                  <input className="input py-1.5" placeholder="Point (e.g. Feasibility review)" value={r.label} onChange={(e) => setEdit({ ...edit, correct_answer: { rubric: edit.correct_answer.rubric!.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) } })} />
                  <input className="input py-1.5" placeholder="keywords, comma-separated" value={r.keywords.join(", ")} onChange={(e) => setEdit({ ...edit, correct_answer: { rubric: edit.correct_answer.rubric!.map((x, j) => (j === i ? { ...x, keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) } : x)) } })} />
                  <button className="btn-ghost btn-sm" onClick={() => setEdit({ ...edit, correct_answer: { rubric: edit.correct_answer.rubric!.filter((_, j) => j !== i) } })} aria-label="Remove point"><Trash2 size={12} /></button>
                </div>
              ))}
              <button className="btn-ghost btn-sm" onClick={() => setEdit({ ...edit, correct_answer: { rubric: [...(edit.correct_answer.rubric ?? []), { label: "", keywords: [] }] } })}><Plus size={12} />Rubric point</button>
            </div>
          )}
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="md:col-span-3"><Field label="Explanation (shown after submission)"><textarea className="input" rows={2} value={edit.explanation} onChange={(e) => setEdit({ ...edit, explanation: e.target.value })} /></Field></div>
            <Field label="Source document"><input className="input" value={edit.source_document} onChange={(e) => setEdit({ ...edit, source_document: e.target.value })} /></Field>
            <Field label="Source reference"><input className="input" value={edit.source_reference} onChange={(e) => setEdit({ ...edit, source_reference: e.target.value })} placeholder="Section 3.2, v4.1" /></Field>
          </div>
          <div className="mt-3 flex items-center gap-3"><button className="btn-primary btn-sm" disabled={pending} onClick={save}><Save size={13} />Save question</button>{err && <span className="text-xs text-bad">{err}</span>}</div>
        </div>
      )}
      <div className="-mx-5 overflow-x-auto">
        <table className="table min-w-[860px]">
          <thead><tr><th>ID</th><th>Question</th><th>Pillar</th><th>Type</th><th>Weight</th><th>Source</th><th /></tr></thead>
          <tbody>{list.map((q) => (
            <tr key={q.id} className={cn(!q.is_active && "opacity-50")}>
              <td className="font-mono text-xs">{q.question_code}</td>
              <td className="max-w-[380px]"><div className="line-clamp-2 text-sm">{q.question}</div><div className="text-[11px] text-ink-faint">{q.topic} · {q.difficulty}{!q.is_active && " · inactive"}</div></td>
              <td className="text-xs">{q.pillar.toLowerCase()}</td><td className="text-xs">{q.question_type.replace(/_/g, " ").toLowerCase()}</td><td className="text-xs">{q.weight}</td>
              <td className="text-[11px] text-ink-muted">{q.source_document}<div>{q.source_reference}</div></td>
              <td><button className="btn-ghost btn-sm" onClick={() => setEdit({ ...q, explanation: q.explanation ?? "", source_document: q.source_document ?? "", source_reference: q.source_reference ?? "" })} aria-label={`Edit ${q.question_code}`}><Pencil size={13} /></button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

export interface ScenarioData { id: string; code: string; title: string; is_certification: boolean; is_active: boolean; rubric: { id: string; criterion: string; description: string; weight: number; keywords: string[]; min_matches?: number }[] }

export function RubricEditor({ scenarios }: { scenarios: ScenarioData[] }) {
  const router = useRouter();
  const [sel, setSel] = useState(scenarios[0]?.id ?? "");
  const cur = scenarios.find((s) => s.id === sel);
  const [rubric, setRubric] = useState(cur?.rubric ?? []);
  const [active, setActive] = useState(cur?.is_active ?? true);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const pick = (id: string) => { const s = scenarios.find((x) => x.id === id)!; setSel(id); setRubric(s.rubric); setActive(s.is_active); setMsg(null); };
  const total = rubric.reduce((a, c) => a + Number(c.weight || 0), 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto" value={sel} onChange={(e) => pick(e.target.value)}>{scenarios.map((s) => <option key={s.id} value={s.id}>{s.title}{s.is_certification ? " (certification)" : ""}</option>)}</select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />Active</label>
        <span className={cn("text-xs", total === 100 ? "text-ok" : "text-bad")}>Weights total {total}</span>
      </div>
      {rubric.map((c, i) => (
        <div key={i} className="grid gap-2 rounded-md border border-line p-2 md:grid-cols-[1.2fr_2fr_80px_2fr_auto]">
          <input className="input py-1.5" value={c.criterion} onChange={(e) => setRubric(rubric.map((x, j) => (j === i ? { ...x, criterion: e.target.value } : x)))} aria-label="Criterion" />
          <input className="input py-1.5" value={c.description} onChange={(e) => setRubric(rubric.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} aria-label="Description" />
          <input className="input py-1.5" type="number" value={c.weight} onChange={(e) => setRubric(rubric.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))} aria-label="Weight" />
          <input className="input py-1.5" value={c.keywords.join(", ")} onChange={(e) => setRubric(rubric.map((x, j) => (j === i ? { ...x, keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) } : x)))} aria-label="Keywords" />
          <button className="btn-ghost btn-sm" onClick={() => setRubric(rubric.filter((_, j) => j !== i))} aria-label="Remove criterion"><Trash2 size={12} /></button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost btn-sm" onClick={() => setRubric([...rubric, { id: `c${rubric.length + 1}`, criterion: "", description: "", weight: 0, keywords: [] }])}><Plus size={12} />Criterion</button>
        <button className="btn-primary btn-sm" disabled={pending || total !== 100} onClick={() => start(async () => { const r = await saveRubricAction(sel, rubric, active); setMsg(r.ok ? { ok: true, text: "Rubric saved." } : { ok: false, text: r.error }); if (r.ok) router.refresh(); })}><Save size={13} />Save rubric</button>
        {msg && <span className={msg.ok ? "text-xs text-ok" : "text-xs text-bad"}>{msg.text}</span>}
      </div>
      <p className="text-[11px] text-ink-faint">Red-flag penalties (e.g. committing to a price without approval) are part of the governance rules and are not editable here.</p>
    </div>
  );
}
