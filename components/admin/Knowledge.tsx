"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, RefreshCw, Loader2 } from "lucide-react";
import { setDocumentApprovalAction, reindexAction } from "@/app/actions/admin";
import { Field } from "@/components/ui";

const CATEGORIES = ["Company", "Products", "Customers", "Sales", "Processes", "Training", "Policies", "Quality", "Governance", "Account"];

export function UploadForm({ existingKeys }: { existingKeys: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    fd.set("approved", (e.currentTarget.elements.namedItem("approved") as HTMLInputElement).checked ? "true" : "false");
    try {
      const res = await fetch("/api/knowledge/ingest", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ ok: true, text: `Indexed ${data.chunks} chunks (v${data.version})${data.supersededId ? " — previous version superseded and kept in history" : ""}${data.embedded ? "" : " — full-text only (no embedding provider configured)"}.` });
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="File (PDF, .md or .txt — max 8 MB)" hint="Markdown front matter can supply the metadata fields"><input className="input" type="file" name="file" accept=".pdf,.md,.txt,.markdown" required /></Field>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Document key" hint="Stable across versions, e.g. RFQ-SOP"><input className="input" name="document_key" list="doc-keys" placeholder="RFQ-SOP" /></Field>
        <datalist id="doc-keys">{existingKeys.map((k) => <option key={k} value={k} />)}</datalist>
        <Field label="Document name"><input className="input" name="name" /></Field>
        <Field label="Category"><select className="input" name="category" defaultValue="Processes">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Version"><input className="input" name="version" placeholder="4.2" /></Field>
        <Field label="Owner"><input className="input" name="owner" /></Field>
        <Field label="Topic"><input className="input" name="topic" /></Field>
        <Field label="Effective date"><input className="input" type="date" name="effective_date" /></Field>
        <Field label="Review / expiry date"><input className="input" type="date" name="review_date" /></Field>
        <Field label="Source URL (optional)"><input className="input" type="url" name="source_url" /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="approved" defaultChecked />Approved — available to the assistant immediately</label>
      <div className="flex items-center gap-3"><button className="btn-primary" disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}Upload & index</button>{msg && <span role="status" className={msg.ok ? "text-xs text-ok" : "text-xs text-bad"}>{msg.text}</span>}</div>
    </form>
  );
}

export function ApprovalToggle({ id, approved, current }: { id: string; approved: boolean; current: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  if (!current) return <span className="text-[11px] text-ink-faint">history</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <button className={approved ? "btn-secondary btn-sm" : "btn-primary btn-sm"} disabled={pending} onClick={() => start(async () => { const r = await setDocumentApprovalAction(id, !approved); if (!r.ok) setErr(r.error); router.refresh(); })}>{approved ? "Withdraw" : "Approve"}</button>
      {err && <span className="text-[11px] text-bad">{err}</span>}
    </span>
  );
}

export function ReindexButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button className="btn-secondary btn-sm" disabled={pending} onClick={() => start(async () => { const r = await reindexAction(); setMsg(r.ok ? `Re-embedded ${r.data} chunks` : r.error); router.refresh(); })}>{pending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}Re-index embeddings</button>
      {msg && <span className="text-[11px] text-ink-muted">{msg}</span>}
    </span>
  );
}
