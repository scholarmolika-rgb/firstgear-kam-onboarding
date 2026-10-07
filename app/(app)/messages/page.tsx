import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { actionContext } from "@/lib/services/context";
import { chatInbox, loadThread } from "@/lib/services/chat";
import { Card, PageHeader, Empty, cn } from "@/components/ui";
import { ChatThread } from "@/components/chat/ChatThread";

export const metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function StaffMessages({ searchParams }: { searchParams: Promise<{ kam?: string }> }) {
  const s = await requireRole(["MENTOR", "HR_ADMIN"]);
  const { kam } = await searchParams;
  const ctx = await actionContext({ rateLimit: false });
  const inbox = await chatInbox(ctx);
  const selected = inbox.find((r) => r.employeeId === kam) ?? inbox.find((r) => r.unread > 0) ?? inbox[0];
  const th = selected ? await loadThread(ctx, selected.employeeId) : null;
  const { data: tasks } = await ctx.db.from("tasks").select("code, title").not("template_id", "is", null);
  const stepTitles = Object.fromEntries((tasks ?? []).map((x) => [x.code, x.title]));
  const unread = inbox.reduce((n, r) => n + r.unread, 0);
  return (
    <>
      <PageHeader title="Messages" subtitle={`Support chat with ${s.profile.role === "MENTOR" ? "your assigned KAMs" : "every KAM"} during their first days of training. ${unread ? `${unread} unread.` : "All caught up."}`} />
      {!inbox.length ? <Empty title="No KAMs to message">KAMs appear here once they are assigned.</Empty> : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <Card className="self-start">
            <ul className="-mx-5 -my-5 divide-y divide-line">
              {inbox.map((r) => (
                <li key={r.employeeId}>
                  <Link prefetch={false} href={`/messages?kam=${r.employeeId}`} className={cn("block px-4 py-3 hover:bg-canvas", r.employeeId === selected?.employeeId && "bg-accent-soft")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{r.name}</span>
                      {r.unread > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">{r.unread}</span>}
                    </div>
                    <div className="truncate text-xs text-ink-muted">{r.lastMessage ? r.lastMessage.body : "No messages yet"}</div>
                    <div className="mt-0.5 text-[11px] text-ink-faint">Day {Math.max(r.window.day, 0)} · {r.window.open ? "chat open" : "read-only"}{r.lastMessage ? ` · ${when(r.lastMessage.created_at)}` : ""}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          {selected && th && (
            <Card title={th.kamName} subtitle={th.window.open ? `Day ${Math.max(th.window.day, 0)} of the ${th.window.lastDay}-day support window` : "Support window closed — read-only"}
              action={<Link prefetch={false} href={`/people/${selected.employeeId}`} className="btn-secondary btn-sm">Open KAM profile</Link>}>
              <ChatThread employeeId={selected.employeeId} meId={s.profile.id} initial={th.messages} names={th.names} stepTitles={stepTitles}
                open={th.window.open} closedReason={th.window.reason} viewer="STAFF" />
            </Card>
          )}
        </div>
      )}
    </>
  );
}
