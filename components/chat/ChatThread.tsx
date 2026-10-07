"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Send, Lock, GraduationCap } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { sendChatAction, markChatReadAction } from "@/app/actions/chat";
import { cn } from "@/components/ui";

export interface ChatMsg { id: string; sender_id: string; sender_role: string; body: string; context_ref: string | null; created_at: string }

const ROLE: Record<string, string> = { KAM: "KAM", MENTOR: "Mentor", HR_ADMIN: "HR" };
const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Live support thread. New messages from the other participants arrive via
 * Supabase Realtime (RLS decides who receives them); sending goes through a
 * server action that enforces the chat window.
 */
export function ChatThread({ employeeId, meId, initial, names, stepTitles = {}, open, closedReason, viewer, contextRef, contextTitle, compact = false }: {
  employeeId: string;
  meId: string;
  initial: ChatMsg[];
  names: Record<string, string>;
  stepTitles?: Record<string, string>;
  open: boolean;
  closedReason: string | null;
  viewer: "KAM" | "STAFF";
  contextRef?: string | null;
  contextTitle?: string | null;
  compact?: boolean;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(initial);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setMsgs(initial); }, [initial]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs.length]);
  useEffect(() => { void markChatReadAction(employeeId); }, [employeeId, msgs.length]);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const sb = getBrowserSupabase();
    const ch = sb.channel(`chat-${employeeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `employee_id=eq.${employeeId}` }, (p) => {
        const m = p.new as ChatMsg;
        setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
      })
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [employeeId]);

  function send() {
    const body = text.trim();
    if (!body) return;
    setErr(null);
    start(async () => {
      const r = await sendChatAction({ employeeId, body, contextRef: contextRef ?? null });
      if (!r.ok) { setErr(r.error); return; }
      setText("");
      setMsgs((cur) => (cur.some((x) => x.id === r.data.id) ? cur : [...cur, r.data]));
    });
  }

  return (
    <div className="flex flex-col">
      <div className={cn("space-y-3 overflow-y-auto pr-1", compact ? "max-h-72" : "max-h-[60vh] min-h-[16rem]")}>
        {msgs.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">{viewer === "KAM" ? "No messages yet. Ask your Mentor or HR anything about your training." : "No messages yet."}</p>}
        {msgs.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm", mine ? "bg-accent text-white" : "border border-line bg-surface")}>
                <div className={cn("mb-0.5 text-[11px]", mine ? "text-white/80" : "text-ink-muted")}>
                  {mine ? "You" : names[m.sender_id] ?? "Participant"} · {ROLE[m.sender_role] ?? m.sender_role} · {fmt(m.created_at)}
                </div>
                {m.context_ref && (
                  <div className={cn("mb-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]", mine ? "bg-white/15" : "bg-accent-soft text-accent")}>
                    <GraduationCap size={12} />
                    {viewer === "KAM"
                      ? <Link prefetch={false} href={`/learn/${encodeURIComponent(m.context_ref)}`} className="underline">{stepTitles[m.context_ref] ?? m.context_ref}</Link>
                      : <span>Training step: {stepTitles[m.context_ref] ?? m.context_ref}</span>}
                  </div>
                )}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      {open ? (
        <div className="mt-3 border-t border-line pt-3">
          {contextRef && <p className="mb-1.5 text-[11px] text-ink-muted">About this step: <strong className="text-ink-soft">{contextTitle ?? contextRef}</strong></p>}
          <div className="flex items-end gap-2">
            <textarea className="input min-h-[2.5rem] flex-1 resize-y" rows={compact ? 2 : 2} maxLength={2000} value={text} placeholder={viewer === "KAM" ? "Message your Mentor and HR…" : "Reply…"}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button className="btn-primary" disabled={pending || !text.trim()} onClick={send} aria-label="Send">{pending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}</button>
          </div>
          <p className="mt-1 text-[11px] text-ink-faint">Enter to send · Shift+Enter for a new line · visible to the KAM, their Mentor and HR</p>
          {err && <p role="alert" className="mt-1 text-xs text-bad">{err}</p>}
        </div>
      ) : (
        <p className="mt-3 flex items-start gap-2 border-t border-line pt-3 text-xs text-ink-muted"><Lock size={13} className="mt-0.5 shrink-0" />{closedReason}</p>
      )}
    </div>
  );
}
