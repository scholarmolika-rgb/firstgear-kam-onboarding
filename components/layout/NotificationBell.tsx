"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bell, AlertTriangle, Info, OctagonAlert } from "lucide-react";
import { markNotificationReadAction } from "@/app/actions/onboarding";
import { cn } from "@/components/ui";

export interface NotificationItem { id: string; title: string; body: string | null; link: string | null; severity: string; created_at: string }

export function NotificationBell({ items }: { items: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  const visible = items.filter((i) => !hidden.has(i.id));
  const read = (id: string) => { setHidden((s) => new Set(s).add(id)); start(() => { void markNotificationReadAction(id); }); };
  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost relative" onClick={() => setOpen((o) => !o)} aria-label={`Notifications (${visible.length} unread)`}>
        <Bell size={18} />
        {visible.length > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">{visible.length}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          <div className="border-b border-line px-4 py-2.5 text-sm font-semibold">Notifications</div>
          <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
            {visible.length === 0 && <li className="px-4 py-6 text-center text-xs text-ink-muted">You&apos;re all caught up.</li>}
            {visible.map((n) => (
              <li key={n.id} className="flex gap-3 px-4 py-3">
                <span className={cn("mt-0.5", n.severity === "CRITICAL" ? "text-bad" : n.severity === "ATTENTION" ? "text-warn" : "text-accent")}>
                  {n.severity === "CRITICAL" ? <OctagonAlert size={16} /> : n.severity === "ATTENTION" ? <AlertTriangle size={16} /> : <Info size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium leading-snug">{n.link ? <Link href={n.link} onClick={() => read(n.id)} className="hover:underline">{n.title}</Link> : n.title}</div>
                  {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{n.body}</div>}
                </div>
                <button className="self-start text-[11px] text-ink-faint hover:text-ink" onClick={() => read(n.id)}>Dismiss</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
