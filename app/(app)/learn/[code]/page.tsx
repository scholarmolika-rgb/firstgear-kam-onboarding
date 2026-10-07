import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, MessagesSquare, Route } from "lucide-react";
import { kamSnapshot } from "@/lib/services/page";
import { createServerSupabase } from "@/lib/supabase/server";
import { trainingPath, blockOf, relevantSections } from "@/lib/engine/training";
import { Card, Notice, StatusPill, cn } from "@/components/ui";
import { DocText } from "@/components/kam/DocText";
import { StepAction } from "@/components/kam/Training";
import { createAdminClient } from "@/lib/supabase/server";
import { chatWindow } from "@/lib/services/chat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Training" };

const PILLAR: Record<string, string> = { GOVERNANCE: "Governance", PEOPLE: "People", PRODUCT: "Product", PROCESS: "Process" };
const done = (a: string) => a === "DONE" || a === "AWAITING_REVIEW";

export default async function TrainingStep({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ advance?: string }> }) {
  const { code: raw } = await params;
  const { advance } = await searchParams;
  const code = decodeURIComponent(raw);
  const { snap, error } = await kamSnapshot();
  if (!snap) return <Notice tone="warn" title="Training not available">{error}</Notice>;
  const db = await createServerSupabase();
  const { data: days } = await db.from("onboarding_days").select("day_number, phase, segment, title, objectives, resources").eq("template_id", snap.instance.template_id).order("day_number");
  const path = trainingPath(snap.journey, days ?? []);
  const i = path.steps.findIndex((s) => s.code === code);
  if (i < 0) notFound();
  const step = path.steps[i];
  const prev = path.steps[i - 1];
  const next = path.steps[i + 1];
  // Coming back from linked work (assessment, scenario, brief): move on once this step is finished.
  if (advance && done(step.availability) && next) redirect(`/learn/${encodeURIComponent(next.code)}`);

  const block = blockOf(path, step);
  const day = days?.find((d) => d.day_number === step.day_number);
  const resources = (day?.resources ?? []) as { label: string; document_key: string }[];
  const { data: docs } = resources.length
    ? await db.from("knowledge_documents").select("document_key, name, version, content").in("document_key", resources.map((r) => r.document_key)).eq("is_current", true)
    : { data: [] };
  const material = relevantSections(docs ?? [], step);
  const dayPlan = path.steps.filter((s) => s.day_number === step.day_number);
  const nextHref = next ? `/learn/${encodeURIComponent(next.code)}` : "/journey";
  const completed = path.steps.filter((s) => done(s.availability)).length;
  const t = `t=${encodeURIComponent(step.code)}`;
  const chat = await chatWindow(createAdminClient(), snap.employee.id).catch(() => null);

  const nav = (
    <div className="flex items-center justify-between gap-3">
      {prev
        ? <Link prefetch={false} href={`/learn/${encodeURIComponent(prev.code)}`} className="btn-secondary btn-sm"><ArrowLeft size={13} /><span className="hidden sm:inline">Back:</span> <span className="max-w-[16rem] truncate">{prev.title}</span></Link>
        : <Link href="/journey" className="btn-secondary btn-sm"><ArrowLeft size={13} />Journey overview</Link>}
      {next
        ? <Link prefetch={false} href={nextHref} className="btn-primary btn-sm"><span className="hidden sm:inline">Next:</span> <span className="max-w-[16rem] truncate">{next.title}</span><ArrowRight size={13} /></Link>
        : <Link href="/journey" className="btn-primary btn-sm">Finish — journey overview<ArrowRight size={13} /></Link>}
    </div>
  );

  return (
    <>
      {/* Training header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5"><Route size={14} />Training · Phase {day?.phase ?? (step.day_number <= 15 ? 1 : 2)} · {block?.label} · Day {step.day_number}{day?.title ? ` — ${day.title}` : ""}</span>
        <span className="tabular-nums">Step {i + 1} of {path.steps.length} · {completed} done</span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-accent" style={{ width: `${(completed / Math.max(1, path.steps.length)) * 100}%` }} /></div>

      {/* Training tabs — one per block, in journey order */}
      <nav aria-label="Training blocks" className="-mx-1 mb-5 flex gap-1.5 overflow-x-auto pb-1">
        {path.blocks.map((b) => {
          const active = b.key === block?.key;
          return (
            <Link key={b.key} prefetch={false} href={b.firstCode ? `/learn/${encodeURIComponent(b.firstCode)}` : "/journey"} aria-current={active ? "step" : undefined}
              className={cn("shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium", active ? "border-accent bg-accent-soft text-accent" : b.done === b.total ? "border-ok/40 bg-ok-soft text-ok" : "border-line bg-surface text-ink-soft hover:bg-canvas")}>
              {b.label}<span className="ml-1.5 tabular-nums opacity-70">{b.done}/{b.total}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mb-5">{nav}</div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
              <span className="font-semibold uppercase tracking-wide text-accent">{PILLAR[step.pillar] ?? step.pillar}</span>
              <span>· {step.task_type.toLowerCase()}</span>
              {step.exposure !== "NONE" && <span>· {step.exposure === "PRICING" ? "guided pricing" : "customer exposure"}</span>}
              <span className="ml-auto"><StatusPill status={step.availability} /></span>
            </div>
            <h1 className="mt-2 text-xl font-semibold text-ink">{step.title}</h1>
            {step.description && <p className="mt-1.5 text-sm text-ink-soft">{step.description}</p>}
            {step.overdue && <p className="mt-2 text-xs font-medium text-bad">Overdue — was due on Day {step.due_day}</p>}
            {day?.objectives?.length ? (
              <div className="mt-4 border-t border-line pt-3">
                <div className="label mb-1.5">Day {step.day_number} objectives</div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">{(day.objectives as string[]).map((o) => <li key={o}>{o}</li>)}</ul>
              </div>
            ) : null}
          </Card>

          <Card title="Learning material" subtitle="From the approved documents assigned to this day">
            {material.length ? (
              <div className="space-y-5">
                {material.map((m) => (
                  <section key={`${m.documentKey}-${m.heading}`} className="rounded-md border border-line p-4">
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-[15px] font-semibold text-ink">{m.heading ?? m.documentName}</h2>
                      <Link href={`/knowledge/${m.documentKey}?${t}`} className="link text-xs">{m.documentName} · v{m.version}</Link>
                    </div>
                    <DocText text={m.text} />
                  </section>
                ))}
              </div>
            ) : <p className="text-sm text-ink-muted">This step is practical — use the resources on the right and your mentor.</p>}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Complete this step">
            <StepAction code={step.code} taskId={step.id} employeeId={snap.employee.id} availability={step.availability} reason={step.reason}
              requiresApproval={step.requires_approval} actionRef={step.action_ref} taskType={step.task_type} nextHref={nextHref} />
          </Card>

          {chat?.open && (
            <Card title="Stuck on this step?">
              <p className="mb-3 text-sm text-ink-soft">Ask your Mentor and HR — your message is linked to this step. Open for your first {chat.lastDay} days.</p>
              <Link prefetch={false} href={`/chat?${t}`} className="btn-secondary w-full justify-center"><MessagesSquare size={15} />Ask Mentor &amp; HR</Link>
            </Card>
          )}

          <Card title={`Day ${step.day_number} plan`} subtitle={`${dayPlan.filter((s) => done(s.availability)).length} of ${dayPlan.length} done`}>
            <ol className="space-y-1">
              {dayPlan.map((s) => (
                <li key={s.id}>
                  <Link prefetch={false} href={`/learn/${encodeURIComponent(s.code)}`} aria-current={s.id === step.id ? "step" : undefined}
                    className={cn("flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm", s.id === step.id ? "bg-accent-soft font-medium text-accent" : "hover:bg-canvas")}>
                    <span className="min-w-0 truncate">{s.title}</span>
                    {done(s.availability) ? <StatusPill status={s.availability} /> : null}
                  </Link>
                </li>
              ))}
            </ol>
          </Card>

          <Card title="Resources">
            {resources.length ? (
              <ul className="space-y-1.5">{resources.map((r) => (
                <li key={r.document_key}><Link prefetch={false} href={`/knowledge/${r.document_key}?${t}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-canvas"><BookOpen size={14} className="shrink-0 text-ink-faint" />{r.label}</Link></li>
              ))}</ul>
            ) : <p className="text-sm text-ink-muted">No documents for this day.</p>}
            {step.task_type === "SESSION" && <Link href={`/sessions?${t}`} className="mt-3 flex items-center gap-2 text-sm link"><CalendarDays size={14} />Schedule or confirm this session</Link>}
          </Card>
        </div>
      </div>

      <div className="no-print mt-10 border-t border-line pt-5">{nav}</div>
    </>
  );
}
