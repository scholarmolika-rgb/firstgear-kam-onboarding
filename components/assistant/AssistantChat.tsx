"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, BookOpen, ShieldAlert, UserRound, Loader2, CheckCircle2, ArrowRight, Info } from "lucide-react";
import { toggleTaskAction, escalateAction } from "@/app/actions/onboarding";
import { cn } from "@/components/ui";

interface Citation { tag: string; document_name: string; section: string | null; page: number | null; version: string; effective_date: string | null; source_url: string | null; snippet: string }
interface Action { kind: "link" | "complete_task" | "ask_mentor" | "ask_manager" | "suggest"; label: string; href?: string; taskId?: string }
export interface ChatMessage { id: string; role: "user" | "assistant"; content: string; citations?: Citation[]; actions?: Action[]; grounding?: string | null; intent?: string | null; intent_source?: string | null }

const SUGGESTIONS = ["What should I do next?", "How many casual leaves do I get?", "What is the RFQ process?", "What is the daily allowance on travel?", "How am I progressing?", "Who approves a price below the margin floor?"];

function sectionLabel(c: Citation) {
  const num = c.section?.match(/^(\d+(\.\d+)*)/)?.[1];
  return [num ? `Section ${num}` : c.section, c.page ? `Page ${c.page}` : null].filter(Boolean).join(" · ");
}

function SourceCard({ c }: { c: Citation }) {
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-accent"><BookOpen size={12} />{c.tag} · {c.document_name}</div>
      <div className="mt-0.5 text-[11px] text-ink-muted">{[sectionLabel(c), `Version ${c.version}`, c.effective_date ? `effective ${c.effective_date}` : null].filter(Boolean).join(" · ")}</div>
    </>
  );
  return c.source_url ? <Link href={c.source_url} className="block rounded-md border border-line bg-canvas px-2.5 py-2 hover:bg-white">{body}</Link> : <div className="rounded-md border border-line bg-canvas px-2.5 py-2">{body}</div>;
}

export function AssistantChat({ initial, sessionId: initialSession, employeeId, compact = false, prefill, dock = false, firstName }: { initial: ChatMessage[]; sessionId: string | null; employeeId: string; compact?: boolean; prefill?: string; dock?: boolean; firstName?: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [sessionId, setSessionId] = useState(initialSession);
  const [input, setInput] = useState(prefill ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<Record<string, string>>({});
  const [, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: msg }]);
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, sessionId: sessionId ?? undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The assistant is unavailable.");
      setSessionId(data.sessionId);
      setMessages((m) => [...m, { id: data.messageId || `a-${Date.now()}`, role: "assistant", content: data.text, citations: data.citations, actions: data.actions, grounding: data.grounding, intent: data.intent, intent_source: data.intentSource }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function runAction(msgId: string, a: Action, question: string) {
    const key = `${msgId}:${a.label}`;
    setActionState((s) => ({ ...s, [key]: "…" }));
    start(async () => {
      if (a.kind === "complete_task" && a.taskId) {
        const r = await toggleTaskAction({ employeeId, taskId: a.taskId, done: true });
        setActionState((s) => ({ ...s, [key]: r.ok ? (r.data.status === "SUBMITTED" ? "Submitted for review" : `Done · progress ${r.data.progress.taskCompletionPct}%`) : r.error }));
        if (r.ok) router.refresh();
      } else if (a.kind === "ask_mentor" || a.kind === "ask_manager") {
        const r = await escalateAction(a.kind === "ask_mentor" ? "MENTOR" : "REPORTING_BOSS", question);
        setActionState((s) => ({ ...s, [key]: r.ok ? `Sent to ${r.data.sentTo}` : r.error }));
      }
    });
  }

  const lastUserBefore = (idx: number) => [...messages.slice(0, idx)].reverse().find((m) => m.role === "user")?.content ?? "";

  return (
    <div className={cn("flex flex-col", dock ? "h-full min-h-0" : compact ? "h-[520px]" : "h-[calc(100vh-220px)] min-h-[520px]")}>
      <div className="flex-1 space-y-5 overflow-y-auto px-1 pb-4" aria-live="polite">
        {messages.length === 0 && (
          <div className={cn("mx-auto max-w-xl text-center", dock ? "pt-3" : "pt-8")}>
            <div className="text-[15px] font-semibold text-ink">{firstName ? `Hi ${firstName}, how can I help today?` : "Hi, how can I help today?"}</div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">Ask me about your training, products, processes or any company policy — leave, travel, expenses and more. I answer from approved documents and always show the source.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.slice(0, dock ? 4 : 6).map((s) => <button key={s} onClick={() => send(s)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-accent/40 hover:text-accent">{s}</button>)}
            </div>
          </div>
        )}
        {messages.map((m, idx) => (
          <div key={m.id} className={cn("flex gap-3", m.role === "user" && "justify-end")}>
            {m.role === "assistant" && !dock && <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">FG</div>}
            <div className={cn(dock ? (m.role === "user" ? "max-w-[88%]" : "w-full min-w-0") : "max-w-[min(680px,85%)]", m.role === "user" ? "rounded-lg bg-accent px-3.5 py-2.5 text-sm text-white" : "")}>
              {m.role === "assistant" ? (
                <div className="space-y-2.5">
                  <div className="rounded-lg border border-line bg-surface px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">{m.content}</div>
                  {m.grounding && (
                    <div className="flex items-center gap-1.5 text-[11px] text-ink-faint">
                      {m.grounding === "COMPANY_KNOWLEDGE" && <><BookOpen size={11} />Company knowledge — approved sources</>}
                      {m.grounding === "EMPLOYEE_STATE" && <><UserRound size={11} />From your recorded onboarding state</>}
                      {m.grounding === "INSUFFICIENT" && <><Info size={11} />Insufficient evidence — not answered</>}
                      {m.grounding === "OUT_OF_SCOPE" && <><ShieldAlert size={11} />Outside the assistant&apos;s scope</>}
                      {m.grounding === "GENERAL" && <><Info size={11} />General guidance</>}
                      {m.intent && !dock && <span className="ml-1 rounded bg-canvas px-1.5 py-0.5 font-mono text-[10px]">{m.intent}{m.intent_source ? ` · ${m.intent_source}` : ""}</span>}
                    </div>
                  )}
                  {!!m.citations?.length && (
                    <div>
                      <div className="label mb-1">Source{m.citations.length > 1 ? "s" : ""}</div>
                      <div className={cn("grid gap-1.5", !dock && "sm:grid-cols-2")}>{m.citations.map((c) => <SourceCard key={c.tag} c={c} />)}</div>
                    </div>
                  )}
                  {!!m.actions?.some((a) => a.kind !== "suggest") && (
                    <div className="flex flex-wrap gap-2">
                      {m.actions!.filter((a) => a.kind !== "suggest").map((a) => {
                        const key = `${m.id}:${a.label}`;
                        if (a.kind === "link" && a.href) return <Link key={key} prefetch={false} href={a.href} className="btn-secondary btn-sm">{a.label}<ArrowRight size={12} /></Link>;
                        const st = actionState[key];
                        return (
                          <button key={key} className="btn-secondary btn-sm" disabled={!!st} onClick={() => runAction(m.id, a, lastUserBefore(idx))}>
                            {st === "…" ? <Loader2 size={12} className="animate-spin" /> : st ? <CheckCircle2 size={12} /> : null}{st && st !== "…" ? st : a.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {idx === messages.length - 1 && !busy && !!m.actions?.some((a) => a.kind === "suggest") && (
                    <div>
                      <div className="mb-1.5 text-[11px] text-ink-faint">You might also ask</div>
                      <div className="flex flex-wrap gap-1.5">
                        {m.actions!.filter((a) => a.kind === "suggest").map((a) => (
                          <button key={a.label} onClick={() => void send(a.label)} className="rounded-full border border-line bg-surface px-3 py-1 text-left text-xs text-ink-soft transition-colors hover:border-accent/40 hover:text-accent">{a.label}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : m.content}
            </div>
          </div>
        ))}
        {busy && <div className={cn("flex items-center gap-2 text-xs text-ink-muted", !dock && "pl-10")}><Loader2 size={14} className="animate-spin" />Checking your journey and approved sources…</div>}
        {error && <div role="alert" className={cn("rounded-md border border-bad/30 bg-bad-soft px-3 py-2 text-xs text-bad", !dock && "ml-10")}>{error}</div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="mt-2 flex gap-2 border-t border-line pt-3">
        <label htmlFor="ask" className="sr-only">Ask FirstGear</label>
        <input id="ask" className="input flex-1" placeholder={dock ? "Ask about policies, products, your next task…" : "Ask about your onboarding, products, processes, policies or next task..."} value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} autoComplete="off" />
        <button className="btn-primary" disabled={busy || !input.trim()} aria-label="Send"><Send size={15} /></button>
      </form>
    </div>
  );
}
