import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { actionContext } from "@/lib/services/context";
import { loadThread } from "@/lib/services/chat";
import { Card, PageHeader, Notice, fmtDate } from "@/components/ui";
import { ChatThread } from "@/components/chat/ChatThread";

export const metadata = { title: "Mentor & HR chat" };
export const dynamic = "force-dynamic";

export default async function KamChat({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const s = await requireRole(["KAM"]);
  if (!s.employeeId) return <Notice tone="warn" title="Chat not available">Your onboarding profile is not set up yet.</Notice>;
  const { t } = await searchParams;
  const ctx = await actionContext({ rateLimit: false });
  const th = await loadThread(ctx, s.employeeId);
  const { data: tasks } = await ctx.db.from("tasks").select("code, title").not("template_id", "is", null);
  const stepTitles = Object.fromEntries((tasks ?? []).map((x) => [x.code, x.title]));
  const w = th.window;
  return (
    <>
      <PageHeader
        title="Mentor & HR chat"
        subtitle={w.open
          ? `Message your Mentor and HR about anything in your training — open for your first ${w.lastDay} days${w.closesOn ? ` (until ${fmtDate(w.closesOn)})` : ""}. You are on Day ${Math.max(w.day, 0)}.`
          : "Your support chat window has closed; the conversation stays here for reference. Use sessions or your Reporting Boss for further help."}
        actions={<Link prefetch={false} href="/learn" className="btn-secondary">Back to training</Link>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          <ChatThread employeeId={s.employeeId} meId={s.profile.id} initial={th.messages} names={th.names} stepTitles={stepTitles}
            open={w.open} closedReason={w.reason} viewer="KAM" contextRef={t && stepTitles[t] ? t : null} contextTitle={t ? stepTitles[t] : null} />
        </Card>
        <Card title="Good to know">
          <ul className="list-disc space-y-1.5 pl-4 text-sm text-ink-soft">
            <li>Your Mentor and HR see every message here; your Reporting Boss does not.</li>
            <li>From any training step, use “Ask Mentor & HR” — your message is linked to that step.</li>
            <li>For quick facts about policies and processes, Ask FirstGear answers instantly from approved documents.</li>
            <li>Never share customer prices or drawings in chat.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
