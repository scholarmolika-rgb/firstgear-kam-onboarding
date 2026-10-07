import Link from "next/link";
import { Bot, FileCog, Library, MessagesSquare, ScrollText, SlidersHorizontal, UserPlus, Users, type LucideIcon } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { actionContext } from "@/lib/services/context";
import { loadCohort, pendingFor } from "@/lib/services/cohort";
import { chatInbox, chatEnabled } from "@/lib/services/chat";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, fmtPct, cn } from "@/components/ui";
import { CohortTable } from "@/components/staff/CohortTable";
import { StaffAssistant } from "@/components/assistant/StaffAssistant";
import { helpText } from "@/lib/ai/staff/guide";
import { staffSuggestions } from "@/lib/ai/staff/suggestions";
import type { Snapshot } from "@/lib/services/snapshot";

export const metadata = { title: "HR dashboard" };
export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "all", label: "All KAMs" },
  { key: "attention", label: "Needs attention" },
  { key: "phase1", label: "Phase 1 (Days 1–15)" },
  { key: "phase2", label: "Phase 2 (Days 16–30)" },
  { key: "done", label: "Signed off / decided" },
] as const;

function flags(s: Snapshot): string[] {
  const f: string[] = [];
  if (s.metrics.overdueCount) f.push(`${s.metrics.overdueCount} overdue`);
  if (s.metrics.band === "RED" || s.metrics.band === "AMBER") f.push(`Day-15 ${s.metrics.band.toLowerCase()}`);
  for (const g of s.journey.gates) if (g.status === "FAILED" || g.status === "BLOCKED") f.push(`${g.name} ${g.status.toLowerCase()}`);
  if (!s.employee.mentor_id) f.push("no mentor assigned");
  return f;
}

const decided = (s: Snapshot) => !!s.instance.final_decision;
const inPhase1 = (s: Snapshot) => !decided(s) && !["PASSED", "APPROVED"].includes(s.journey.gates[0]?.status ?? "");

function Tile({ href, icon: Icon, title, text, count, tone }: { href: string; icon: LucideIcon; title: string; text: string; count?: string | number; tone?: "accent" | "warn" }) {
  return (
    <Link prefetch={false} href={href} className="card card-pad flex gap-3 transition-colors hover:border-accent/50 hover:bg-canvas">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", tone === "warn" ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent")}><Icon size={18} /></span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">{title}{count !== undefined && <span className={cn("rounded-full px-2 py-0.5 text-[11px] tabular-nums", tone === "warn" ? "bg-warn text-white" : "bg-canvas text-ink-muted")}>{count}</span>}</span>
        <span className="block text-xs text-ink-muted">{text}</span>
      </span>
    </Link>
  );
}

export default async function HrDashboard({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireRole(["HR_ADMIN"]);
  const { view = "all" } = await searchParams;
  const db = await createServerSupabase();
  const ctx = await actionContext({ rateLimit: false });
  const chatOn = await chatEnabled(createAdminClient());
  const [cohort, inbox, { count: docCount }, suggestions] = await Promise.all([
    loadCohort(db),
    chatOn ? chatInbox(ctx).catch(() => []) : Promise.resolve([]),
    db.from("knowledge_documents").select("id", { count: "exact", head: true }).eq("is_current", true).eq("approved", true),
    staffSuggestions("HR_ADMIN"),
  ]);

  const n = cohort.length;
  const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x !== null); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };
  const flagged = cohort.map((s) => ({ s, f: flags(s) })).filter((x) => x.f.length).sort((a, b) => b.f.length - a.f.length);
  const hrPending = cohort.flatMap((s) => pendingFor(s, "HR_ADMIN").map((p) => ({ s, label: p.label })));
  const unread = inbox.reduce((a, r) => a + r.unread, 0);
  const cleared = (code: string) => cohort.filter((c) => ["PASSED", "APPROVED"].includes(c.journey.gates.find((g) => g.code === code)?.status ?? "")).length;
  const funnel = [
    { label: "In onboarding", value: n },
    { label: "Gate 1 · Day 15 readiness", value: cleared("G1") },
    { label: "Gate 2 · Day 21 scenario test", value: cleared("G2") },
    { label: "Gate 3 · Day 30 sign-off", value: cleared("G3") },
  ];
  const rows = cohort.filter((s) =>
    view === "attention" ? flags(s).length > 0 : view === "phase1" ? inPhase1(s) : view === "phase2" ? !inPhase1(s) && !decided(s) : view === "done" ? decided(s) : true);

  return (
    <>
      <PageHeader
        title="HR dashboard"
        subtitle={`${n} KAM${n === 1 ? "" : "s"} in onboarding · ${flagged.length} need attention · ${unread} unread message${unread === 1 ? "" : "s"}`}
        actions={<>
          {chatOn && <Link prefetch={false} href="/messages" className="btn-secondary"><MessagesSquare size={15} />Messages{unread ? ` (${unread})` : ""}</Link>}
          <Link prefetch={false} href="/admin/employees" className="btn-primary"><UserPlus size={15} />Add KAM</Link>
        </>}
      />

      {/* Where do you want to go? */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Tile href="/admin/employees" icon={Users} title="People & onboarding" text="Add KAMs, assign Mentor and Reporting Boss, reset a journey" count={n} />
        {chatOn && <Tile href="/messages" icon={MessagesSquare} title="Messages" text="Support chat with KAMs in their first 15 days" count={unread} tone={unread ? "warn" : undefined} />}
        <Tile href="/copilot" icon={Bot} title="Ask Compass" text="Status, what to do next and how-to — in one question" />
        <Tile href="/admin/config" icon={SlidersHorizontal} title="Programme configuration" text="Weights, pass marks, gates, chat window, reminders" />
        <Tile href="/admin/assessments" icon={FileCog} title="Assessments & scenarios" text="Question bank and scenario rubrics" />
        <Tile href="/admin/knowledge" icon={Library} title="Knowledge" text="Publish approved documents and FAQs" count={docCount ?? 0} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Avg readiness" value={fmtPct(avg(cohort.map((c) => c.metrics.overallReadiness)), 1)} />
            <Stat label="In Phase 1" value={cohort.filter(inPhase1).length} />
            <Stat label="Overdue tasks" value={cohort.reduce((a, c) => a + c.metrics.overdueCount, 0)} tone="bad" />
            <Stat label="Waiting on HR" value={hrPending.length} tone={hrPending.length ? "warn" : undefined} />
          </div>

          <Card title="Needs attention" subtitle="Overdue work, Amber/Red results, blocked gates, missing Mentor — and anything waiting on HR">
            {flagged.length || hrPending.length ? (
              <ul className="-mx-5 -my-5 divide-y divide-line">
                {hrPending.map((x, i) => (
                  <li key={`p${i}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <span><span className="font-medium">{x.s.employee.full_name}</span> — <span className="text-warn">{x.label}</span></span>
                    <Link prefetch={false} href={`/people/${x.s.employee.id}`} className="btn-primary btn-sm">Do it now</Link>
                  </li>
                ))}
                {flagged.map(({ s, f }) => (
                  <li key={s.employee.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <span><span className="font-medium">{s.employee.full_name}</span> <span className="text-xs text-ink-muted">Day {Math.max(s.day, 0)}</span> — <span className="text-bad">{f.join(" · ")}</span></span>
                    <span className="flex gap-1.5">
                      {chatOn && <Link prefetch={false} href={`/messages?kam=${s.employee.id}`} className="btn-secondary btn-sm">Message</Link>}
                      <Link prefetch={false} href={`/people/${s.employee.id}`} className="btn-secondary btn-sm">Open</Link>
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-muted">Nothing needs attention right now.</p>}
          </Card>

          <Card title="Gate progress" subtitle="How many KAMs have cleared each gate">
            <ul className="space-y-2.5">
              {funnel.map((f) => (
                <li key={f.label}>
                  <div className="mb-1 flex justify-between text-xs"><span className="text-ink-soft">{f.label}</span><span className="tabular-nums text-ink-muted">{f.value} / {n}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-accent" style={{ width: `${n ? (f.value / n) * 100 : 0}%` }} /></div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Cohort">
            <nav aria-label="Cohort filter" className="-mt-1 mb-4 flex flex-wrap gap-1.5">
              {VIEWS.map((v) => (
                <Link key={v.key} prefetch={false} href={v.key === "all" ? "/hr" : `/hr?view=${v.key}`} aria-current={view === v.key ? "page" : undefined}
                  className={cn("rounded-md border px-3 py-1.5 text-xs font-medium", view === v.key ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-soft hover:bg-canvas")}>
                  {v.label}
                </Link>
              ))}
            </nav>
            <div className="pt-5"><CohortTable rows={rows} pending={(c) => pendingFor(c, "HR_ADMIN")} showExposure /></div>
          </Card>

        </div>

        <div className="space-y-6">
          <Card title="Ask Compass" subtitle="Ask anything — live data, how-to, policies" action={<Link prefetch={false} href="/copilot" className="link text-xs">Full screen</Link>}>
            <StaffAssistant compact suggestions={suggestions} intro={helpText("HR_ADMIN")} />
          </Card>
          {chatOn && <Card title="Recent messages" action={<Link prefetch={false} href="/messages" className="link text-xs">All messages</Link>}>
            {inbox.some((r) => r.lastMessage) ? (
              <ul className="-mx-5 -my-5 divide-y divide-line">
                {inbox.filter((r) => r.lastMessage).slice(0, 5).map((r) => (
                  <li key={r.employeeId}>
                    <Link prefetch={false} href={`/messages?kam=${r.employeeId}`} className="block px-5 py-2.5 hover:bg-canvas">
                      <span className="flex items-center justify-between text-sm font-medium">{r.name}{r.unread > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-white">{r.unread}</span>}</span>
                      <span className="block truncate text-xs text-ink-muted">{r.lastMessage!.body}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-muted">No messages yet.</p>}
          </Card>}
          <Link prefetch={false} href="/admin/audit" className="card card-pad flex items-center gap-3 text-sm hover:bg-canvas"><ScrollText size={16} className="text-ink-faint" />Audit log — who changed or decided what</Link>
        </div>
      </div>
    </>
  );
}
