"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Route, ListChecks, MessageSquareText, CalendarDays, ClipboardCheck, Swords, Building2, FileText,
  BookOpen, BarChart3, Settings, Users, SlidersHorizontal, FileCog, Library, ScrollText, Menu, X, Gauge, GraduationCap,
} from "lucide-react";
import { cn } from "@/components/ui";
import type { Role } from "@/types/domain";

type Item = { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> };

export const NAV: Record<Role, { section?: string; items: Item[] }[]> = {
  KAM: [
    { items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/journey", label: "30-day journey", icon: Route },
      { href: "/tasks", label: "Tasks", icon: ListChecks },
      { href: "/assistant", label: "Ask FirstGear", icon: MessageSquareText },
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
      { href: "/knowledge", label: "Knowledge", icon: BookOpen },
    ] },
  ],
  REPORTING_BOSS: [
    { items: [
      { href: "/manager", label: "Readiness dashboard", icon: Gauge },
      { href: "/knowledge", label: "Knowledge", icon: BookOpen },
    ] },
  ],
  HR_ADMIN: [
    { items: [
      { href: "/hr", label: "HR dashboard", icon: LayoutDashboard },
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

export function SideNav({ role }: { role: Role }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const groups = [...NAV[role], { section: undefined, items: [{ href: "/settings", label: "Settings", icon: Settings }] }];
  const list = (
    <nav className="space-y-5" aria-label="Main">
      {groups.map((g, i) => (
        <div key={i}>
          {g.section && <div className="label mb-1.5 px-3">{g.section}</div>}
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = path === it.href || (it.href !== "/" && path.startsWith(it.href + "/"));
              const Icon = it.icon;
              return (
                <li key={it.href}>
                  <Link href={it.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                    className={cn("flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium", active ? "bg-accent-soft text-accent" : "text-ink-soft hover:bg-canvas hover:text-ink")}>
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
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface px-3 py-5 lg:block">{list}</aside>
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
