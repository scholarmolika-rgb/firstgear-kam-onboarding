"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, MessageSquareText, PanelLeftClose, X } from "lucide-react";
import { AssistantChat, type ChatMessage } from "@/components/assistant/AssistantChat";
import { cn } from "@/components/ui";

const KEY = "ask-dock-open";

/**
 * Ask FirstGear, docked on the left of every KAM page. On desktop it sits
 * beside the menu and collapses to a slim rail; on mobile it is a button that
 * opens a drawer. The conversation is the same one as the full Ask FirstGear
 * page (stored server-side), loaded when the dock first opens.
 */
export function AskDock({ employeeId, firstName }: { employeeId: string; firstName?: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [history, setHistory] = useState<{ sessionId: string | null; messages: ChatMessage[] } | null>(null);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(KEY); } catch { /* storage unavailable */ }
    setOpen(saved === null ? window.innerWidth >= 1440 : saved === "1");
  }, []);

  const shown = open || mobileOpen;
  useEffect(() => {
    if (!shown || history) return;
    fetch("/api/assistant").then((r) => r.json()).then((d) => setHistory({ sessionId: d.sessionId ?? null, messages: d.messages ?? [] })).catch(() => setHistory({ sessionId: null, messages: [] }));
  }, [shown, history]);

  const toggle = (v: boolean) => { setOpen(v); try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* storage unavailable */ } };
  if (path.startsWith("/assistant")) return null; // the full-page assistant is already open

  const chat = history
    ? <AssistantChat key={history.sessionId ?? "new"} dock firstName={firstName} initial={history.messages} sessionId={history.sessionId} employeeId={employeeId} />
    : <div className="flex flex-1 items-center justify-center gap-2 text-xs text-ink-muted"><Loader2 size={14} className="animate-spin" />Loading your conversation…</div>;

  return (
    <>
      {/* Desktop: docked panel or rail */}
      <aside aria-label="Ask FirstGear" className={cn("sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 border-r border-line bg-surface lg:flex", open ? "w-[340px] flex-col" : "w-12 flex-col items-center")}>
        {open ? (
          <>
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="flex items-center gap-2 text-sm font-semibold"><MessageSquareText size={16} className="text-accent" />Ask FirstGear</span>
              <button className="btn-ghost -mr-2 p-1.5" onClick={() => toggle(false)} aria-label="Collapse Ask FirstGear" title="Collapse"><PanelLeftClose size={16} /></button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2">{chat}</div>
          </>
        ) : (
          <button onClick={() => toggle(true)} className="mt-3 flex flex-col items-center gap-2 rounded-md px-1.5 py-3 text-accent hover:bg-accent-soft" aria-label="Open Ask FirstGear" title="Ask FirstGear">
            <MessageSquareText size={18} />
            <span className="text-[11px] font-semibold [writing-mode:vertical-rl] rotate-180">Ask FirstGear</span>
          </button>
        )}
      </aside>

      {/* Mobile: floating button + drawer */}
      <button onClick={() => setMobileOpen(true)} className="btn-primary fixed bottom-4 left-4 z-40 rounded-full px-4 py-3 shadow-lg lg:hidden" aria-label="Open Ask FirstGear">
        <MessageSquareText size={17} />Ask
      </button>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[92vw] max-w-sm flex-col bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold"><MessageSquareText size={16} className="text-accent" />Ask FirstGear</span>
              <button className="btn-ghost p-1.5" onClick={() => setMobileOpen(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2">{chat}</div>
          </div>
        </div>
      )}
    </>
  );
}
