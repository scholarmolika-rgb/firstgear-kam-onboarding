import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, ClipboardCheck } from "lucide-react";
import { kamSnapshot } from "@/lib/services/page";
import { Card, PageHeader, Notice, StatusPill, Empty, fmtDate } from "@/components/ui";
import { TaskList } from "@/components/kam/TaskList";
import { createServerSupabase } from "@/lib/supabase/server";
import { dateForDay } from "@/lib/engine/calendar";

export const dynamic = "force-dynamic";

export default async function DayDetail({ params }: { params: Promise<{ day: string }> }) {
  const { day: dayParam } = await params;
  const dayN = Number(dayParam);
  const { snap, error } = await kamSnapshot();
  if (!snap) return <Notice tone="warn" title="Onboarding not available">{error}</Notice>;
  if (!Number.isInteger(dayN) || dayN < 1 || dayN > snap.journey.days.length) notFound();
  const db = await createServerSupabase();
  const { data: day } = await db.from("onboarding_days").select("*").eq("template_id", snap.instance.template_id).eq("day_number", dayN).maybeSingle();
  const resources = (day?.resources ?? []) as { label: string; document_key: string }[];
  const { data: docs } = resources.length ? await db.from("knowledge_documents").select("document_key, name, version, effective_date").in("document_key", resources.map((r) => r.document_key)).eq("is_current", true) : { data: [] };
  const j = snap.journey;
  const dv = j.days.find((d) => d.day === dayN)!;
  const tasks = j.tasks.filter((t) => t.day_number === dayN);
  const gate = j.gates.find((g) => g.day === dayN);
  const sessions = snap.sessions.filter((s) => s.day_number === dayN || s.scheduled_at.slice(0, 10) === dateForDay(snap.instance.start_date, dayN, snap.config.dayCounting));
  const seg = j.segments.find((s) => dayN >= s.from && dayN <= s.to);
  const evidence = tasks.filter((t) => t.state?.status === "COMPLETED" || t.state?.status === "SUBMITTED");

  return (
    <>
      <div className="mb-4 flex items-center justify-between text-sm no-print">
        <Link href="/journey" className="link inline-flex items-center gap-1"><ArrowLeft size={14} />Journey</Link>
        <div className="flex gap-2">
          {dayN > 1 && <Link href={`/journey/${dayN - 1}`} className="btn-ghost btn-sm"><ArrowLeft size={13} />Day {dayN - 1}</Link>}
          {dayN < j.days.length && <Link href={`/journey/${dayN + 1}`} className="btn-ghost btn-sm">Day {dayN + 1}<ArrowRight size={13} /></Link>}
        </div>
      </div>
      <PageHeader
        eyebrow={`Phase ${day?.phase ?? (dayN <= 15 ? 1 : 2)} · ${day?.segment ?? ""} · ${fmtDate(dateForDay(snap.instance.start_date, dayN, snap.config.dayCounting))}`}
        title={<span className="flex flex-wrap items-center gap-3">Day {dayN} — {day?.title ?? "Additional day"} <StatusPill status={dv.status} /></span>}
        subtitle={(day?.pillars ?? []).map((p: string) => p.charAt(0) + p.slice(1).toLowerCase()).join(" · ")}
      />
      {seg && !seg.open && <div className="mb-6"><Notice tone={seg.blocked ? "bad" : "neutral"} title={seg.blocked ? "Blocked" : "Locked"}>{seg.reason}</Notice></div>}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card title="Objectives">
            {day?.objectives?.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">{day.objectives.map((o: string) => <li key={o}>{o}</li>)}</ul> : <p className="text-sm text-ink-muted">No objectives recorded.</p>}
          </Card>
          <Card title="Tasks" subtitle={`${dv.done} of ${dv.total} mandatory complete`}>
            <div className="-mx-5 -my-5"><TaskList tasks={tasks} employeeId={snap.employee.id} viewerRole="KAM" relation="SELF" empty="No tasks for this day." /></div>
          </Card>
          {gate && (
            <Card title={`Gate: ${gate.name}`} action={<StatusPill status={gate.status} />}>
              <div className="space-y-2 text-sm">
                {gate.score !== null && <div><span className="text-ink-muted">Score:</span> <strong>{gate.score}%</strong>{gate.band && <> · <StatusPill status={gate.band} /></>}</div>}
                {gate.decision && <div><span className="text-ink-muted">Decision:</span> {gate.decision}</div>}
                <div><span className="text-ink-muted">Next action:</span> {gate.nextAction}</div>
                <div className="pt-2">
                  <div className="label mb-1">Required</div>
                  <ul className="grid gap-1 sm:grid-cols-2">{gate.requiredTasks.map((r) => <li key={r.code} className="flex items-center gap-2 text-xs"><StatusPill status={r.done ? "DONE" : "PENDING"} />{r.title}</li>)}</ul>
                </div>
              </div>
            </Card>
          )}
          <Card title="Evidence & notes" subtitle="Recorded completions for this day">
            {evidence.length ? (
              <ul className="space-y-1.5 text-sm">{evidence.map((t) => <li key={t.id} className="flex flex-wrap items-center gap-2"><StatusPill status={t.state!.status} /><span>{t.title}</span><span className="text-xs text-ink-faint">{t.state?.completed_at ? fmtDate(t.state.completed_at, true) : "awaiting review"}</span></li>)}</ul>
            ) : <Empty title="No evidence recorded yet" />}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Resources" subtitle="Approved, current versions">
            {resources.length ? (
              <ul className="space-y-2">
                {resources.map((r) => {
                  const d = docs?.find((x) => x.document_key === r.document_key);
                  return (
                    <li key={r.document_key}>
                      <Link href={`/knowledge/${r.document_key}`} className="flex gap-2.5 rounded-md border border-line px-3 py-2 hover:bg-canvas">
                        <BookOpen size={15} className="mt-0.5 text-ink-faint" />
                        <span className="min-w-0"><span className="block text-sm">{d?.name ?? r.label}</span><span className="text-[11px] text-ink-muted">{d ? `Version ${d.version}${d.effective_date ? ` · effective ${d.effective_date}` : ""}` : "Not yet published"}</span></span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-ink-muted">No resources linked.</p>}
          </Card>
          {tasks.some((t) => t.action_ref?.startsWith("assessment:")) && (
            <Card title="Assessment">
              <div className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2"><ClipboardCheck size={15} className="text-ink-faint" />{dayN === 15 ? (j.day15Available.available ? "Available now" : j.day15Available.reason) : (j.day10Available.available ? "Available now" : j.day10Available.reason)}</span><Link href="/assessments" className="btn-secondary btn-sm">Open</Link></div>
            </Card>
          )}
          <Card title="Sessions" action={<Link href="/sessions" className="link text-xs">Schedule</Link>}>
            {sessions.length ? <ul className="space-y-2">{sessions.map((s) => <li key={s.id} className="flex gap-2.5 text-sm"><CalendarDays size={15} className="mt-0.5 text-ink-faint" /><span><span className="block">{s.title}</span><span className="text-xs text-ink-muted">{fmtDate(s.scheduled_at, true)} · <StatusPill status={s.status} /></span></span></li>)}</ul> : <p className="text-sm text-ink-muted">No sessions on this day.</p>}
          </Card>
        </div>
      </div>
      <nav aria-label="Day navigation" className="no-print mt-10 flex items-center justify-between gap-3 border-t border-line pt-5">
        {dayN > 1
          ? <Link href={`/journey/${dayN - 1}`} className="btn-secondary btn-sm"><ArrowLeft size={13} />Day {dayN - 1}</Link>
          : <Link href="/journey" className="btn-secondary btn-sm"><ArrowLeft size={13} />Journey overview</Link>}
        {dayN < j.days.length
          ? <Link href={`/journey/${dayN + 1}`} className="btn-primary btn-sm">Next: Day {dayN + 1}<ArrowRight size={13} /></Link>
          : <Link href="/tasks" className="btn-primary btn-sm">Next: Tasks<ArrowRight size={13} /></Link>}
      </nav>
    </>
  );
}
