import { requireRole } from "@/lib/auth/session";
import { Card, PageHeader } from "@/components/ui";
import { StaffAssistant } from "@/components/assistant/StaffAssistant";
import { helpText, type StaffRole } from "@/lib/ai/staff/guide";
import { staffSuggestions } from "@/lib/ai/staff/suggestions";

export const metadata = { title: "Ask Compass" };
export const dynamic = "force-dynamic";

export default async function Copilot() {
  const s = await requireRole(["MENTOR", "REPORTING_BOSS", "HR_ADMIN"]);
  const role = s.profile.role as StaffRole;
  return (
    <>
      <PageHeader title="Ask Compass" subtitle="Your guide for supporting KAMs: live status, what's waiting on you, how to do anything in the app, and answers from approved documents — without leaving the page." />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card><StaffAssistant suggestions={await staffSuggestions(role)} intro={helpText(role)} /></Card>
        <Card title="What it uses">
          <ul className="list-disc space-y-1.5 pl-4 text-sm text-ink-soft">
            <li><strong className="text-ink">Live data</strong> — only the KAMs you are allowed to see.</li>
            <li><strong className="text-ink">App guide</strong> — step-by-step help for your role, with a link to the right screen.</li>
            <li><strong className="text-ink">Approved documents</strong> — policy and process answers with sources.</li>
            <li>It never approves, certifies, defers or signs off — those stay with you, and are audited.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
