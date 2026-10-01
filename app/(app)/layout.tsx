import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { SideNav } from "@/components/layout/SideNav";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { RealtimeRefresher } from "@/components/layout/RealtimeRefresher";
import { ROLE_LABEL } from "@/types/domain";
import { LogOut } from "lucide-react";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, employeeId } = await requireSession();
  const db = await createServerSupabase();
  const { data: notes } = await db.from("notifications").select("id, title, body, link, severity, created_at").eq("recipient_id", profile.id).is("read_at", null).order("created_at", { ascending: false }).limit(20);
  const initials = profile.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          <div className="lg:hidden"><SideNavMobileSlot role={profile.role} /></div>
          <Link href="/" className="flex items-center gap-2.5">
            <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="7" fill="#1F4E79" /><circle cx="16" cy="16" r="8.5" fill="none" stroke="#fff" strokeWidth="2" /><path d="M16 9.5 18.6 16 16 22.5 13.4 16z" fill="#fff" /></svg>
            <span className="leading-tight">
              <span className="block text-[13px] font-bold tracking-[0.14em] text-ink">FIRSTGEAR</span>
              <span className="block text-[10px] font-medium tracking-[0.12em] text-ink-muted">KAM ONBOARDING COMPASS</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell items={notes ?? []} />
            <div className="ml-2 hidden items-center gap-2.5 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{initials}</div>
              <div className="leading-tight">
                <div className="text-[13px] font-medium">{profile.full_name}</div>
                <div className="text-[11px] text-ink-muted">{ROLE_LABEL[profile.role]}</div>
              </div>
            </div>
            <form action="/auth/signout" method="post">
              <button className="btn-ghost ml-1" aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
            </form>
          </div>
        </div>
      </header>
      <div className="flex flex-1">
        <div className="hidden lg:block"><SideNav role={profile.role} /></div>
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1240px]">{children}</div>
        </main>
      </div>
      <RealtimeRefresher employeeId={employeeId} userId={profile.id} />
    </div>
  );
}

function SideNavMobileSlot({ role }: { role: Parameters<typeof SideNav>[0]["role"] }) {
  return <SideNav role={role} />;
}
