"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Loader2, Send } from "lucide-react";
import { cn } from "@/components/ui";

interface Turn { role: "user" | "assistant"; text: string; links?: { label: string; href: string }[]; citations?: { tag: string; document_name: string; version: string; section?: string | null }[]; grounding?: string }

const BADGE: Record<string, string> = { COHORT_STATE: "Live data", APP_GUIDE: "App guide", COMPANY_KNOWLEDGE: "Approved documents", GUARDRAIL: "Human decision", INSUFFICIENT: "Not enough evidence" };
const KEY = "ask-compass-history";

/** Ask Compass chat panel for Mentors, Reporting Bosses and HR. History is kept per browser tab. */
export function StaffAssistant({ suggestions, compact = false, intro }: { suggestions: string[]; compact?: boolean; intro: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try { const s = sessionStorage.getItem(KEY); if (s) setTurns(JSON.parse(s)); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(KEY, JSON.stringify(turns.slice(-30))); } catch { /* storage unavailable */ }
    end.current?.scrollIntoView({ block: "nearest" });
  }, [turns]);

  async function ask(q: string) {
    const message = q.trim();
    if (!message || busy) return;
    setErr(null);
    setBusy(true);
    const history = turns.slice(-8).map((t) => ({ role: t.role, text: t.text }));
    setTurns((cur) => [...cur, { role: "user", text: message }]);
    setText("");
    try {
      const res = await fetch("/api/staff-assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setTurns((cur) => [...cur, { role: "assistant", text: data.text, links: data.links, citations: data.citations, grounding: data.grounding }]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col">
      <div className={cn("space-y-3 overflow-y-auto pr-1", compact ? "max-h-80" : "max-h-[62vh] min-h-[18rem]")}>
        {turns.length === 0 && (
          <div className="flex gap-2.5 rounded-lg border border-line bg-canvas p-3 text-sm text-ink-soft">
            <Bot size={18} className="mt-0.5 shrink-0 text-accent" /><p>{intro}</p>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[92%] rounded-lg px-3 py-2 text-sm", t.role === "user" ? "bg-accent text-white" : "border border-line bg-surface")}>
              {t.grounding && BADGE[t.grounding] && <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-accent">{BADGE[t.grounding]}</div>}
              <p className="whitespace-pre-wrap">{t.text}</p>
              {!!t.citations?.length && (
                <ul className="mt-2 space-y-0.5 border-t border-line pt-1.5 text-[11px] text-ink-muted">
                  {t.citations.map((c) => <li key={c.tag}>[{c.tag}] {c.document_name} · v{c.version}{c.section ? ` · ${c.section}` : ""}</li>)}
                </ul>
              )}
              {!!t.links?.length && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {t.links.map((l) => <Link key={l.href} prefetch={false} href={l.href} className="btn-secondary btn-sm">{l.label}<ArrowRight size={12} /></Link>)}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-xs text-ink-muted"><Loader2 size={13} className="animate-spin" />Checking live data and documents…</div>}
        <div ref={end} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {suggestions.map((s) => <button key={s} type="button" disabled={busy} onClick={() => void ask(s)} className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-soft hover:bg-canvas">{s}</button>)}
      </div>
      <form className="mt-3 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void ask(text); }}>
        <textarea className="input min-h-[2.5rem] flex-1 resize-y" rows={2} maxLength={2000} value={text} placeholder="Ask about a KAM, your pending items, how to do something, or a policy…"
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(text); } }} />
        <button className="btn-primary" disabled={busy || !text.trim()} aria-label="Ask"><Send size={15} /></button>
      </form>
      {err && <p role="alert" className="mt-1 text-xs text-bad">{err}</p>}
      {turns.length > 0 && <button type="button" className="mt-2 self-start text-[11px] text-ink-faint hover:underline" onClick={() => setTurns([])}>Clear conversation</button>}
    </div>
  );
}
