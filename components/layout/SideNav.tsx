"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Route, ListChecks, MessageSquareText, CalendarDays, ClipboardCheck, Swords, Building2, FileText,
  BookOpen, BarChart3, Settings, Users, SlidersHorizontal, FileCog, Library, ScrollText, Menu, X, Gauge, GraduationCap, MessagesSquare, Bot,
} from "lucide-react";
import { cn } from "@/components/ui";
import type { Role } from "@/types/domain";

type Item = { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> };

export const NAV: Record<Role, { section?: string; items: Item[] }[]> = {
  KAM: [
    { items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/learn", label: "Training", icon: GraduationCap },
      { href: "/journey", label: "30-day journey", icon: Route },
      { href: "/tasks", label: "Tasks", icon: ListChecks },
      { href: "/assistant", label: "Ask FirstGear", icon: MessageSquareText },
      { href: "/chat", label: "Mentor & HR chat", icon: MessagesSquare },
      { href: "/sessions", label: "Sessions", icon: CalendarDays },
    ] },
    { section: "Readiness", items: [
      { href: "/assessments", label: "Assessments", icon: ClipboardCheck },
      { href: "/scenarios", label: "Scenario practice", icon: Swords },
      { href: "/report", label: "Progress report", icon: BarChart3 },
    ] },
    { section: "Account", items: [
      { href: "/customer-360", label: "Customer 360", icon: Building2 },
      { href: "/account-brief", label: "Account brief", icon: FileText },
      { href: "/knowledge", label: "Knowledge", icon: BookOpen },
    ] },
  ],
  MENTOR: [
    { items: [
      { href: "/mentor", label: "Mentor dashboard", icon: GraduationCap },
      { href: "/messages", label: "Messages", icon: MessagesSquare },
      { href: "/copilot", label: "Ask Compass", icon: Bot },
      { href: "/knowledge", label: "Knowledge", icon: BookOpen },
    ] },
  ],
  REPORTING_BOSS: [
    { items: [
      { href: "/manager", label: "Readiness dashboard", icon: Gauge },
      { href: "/copilot", label: "Ask Compass", icon: Bot },
      { href: "/knowledge", label: "Knowledge", icon: BookOpen },
    ] },
  ],
  HR_ADMIN: [
    { items: [
      { href: "/hr", label: "HR dashboard", icon: LayoutDashboard },
      { href: "/messages", label: "Messages", icon: MessagesSquare },
      { href: "/copilot", label: "Ask Compass", icon: Bot },
      { href: "/admin/employees", label: "Employees", icon: Users },
    ] },
    { section: "Programme", items: [
      { href: "/admin/config", label: "Programme configuration", icon: SlidersHorizontal },
      { href: "/admin/assessments", label: "Assessment management", icon: FileCog },
      { href: "/admin/knowledge", label: "Knowledge management", icon: Library },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText },
    ] },
  ],
};

const CHAT_ROUTES = new Set(["/chat", "/messages"]);

/** The role's navigation; chat entries appear only once the chat tables exist. */
export function navFor(role: Role, opts: { chat: boolean }) {
  return NAV[role].map((g) => ({ ...g, items: g.items.filter((it) => opts.chat || !CHAT_ROUTES.has(it.href)) }));
}

export function SideNav({ role, chat = true }: { role: Role; chat?: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const groups = [...navFor(role, { chat }), { section: undefined, items: [{ href: "/settings", label: "Settings", icon: Settings }] }];
  const list = (
    <nav className="space-y-5" aria-label="Main">
      {groups.map((g, i) => (
        <div key={i}>
          {g.section && <div className="mb-1.5 px-3 text-[11px] font-medium text-ink-faint">{g.section}</div>}
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = path === it.href || (it.href !== "/" && path.startsWith(it.href + "/"));
              const Icon = it.icon;
              return (
                <li key={it.href}>
                  <Link href={it.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                    className={cn("relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors", active ? "bg-canvas font-medium text-ink before:absolute before:inset-y-2 before:left-0 before:w-[2px] before:rounded-full before:bg-accent" : "text-ink-muted hover:bg-canvas hover:text-ink")}>
                    <Icon size={16} className={active ? "text-accent" : "text-ink-faint"} />
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
  return (
    <>
      <button className="btn-ghost -ml-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={18} /></button>
      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-line bg-surface px-3 py-6 lg:block">{list}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-surface px-3 py-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between px-2">
              <span className="text-sm font-semibold">Menu</span>
              <button className="btn-ghost" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={18} /></button>
            </div>
            {list}
          </div>
        </div>
      )}
    </>
  );
}
