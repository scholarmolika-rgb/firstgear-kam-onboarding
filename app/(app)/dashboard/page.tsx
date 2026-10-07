import Link from "next/link";
import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";
import { kamSnapshot } from "@/lib/services/page";
import { Card, PageHeader, Stat, StatusPill, Notice, fmtDate, scoreTone, bandTone } from "@/components/ui";
import { PillarBars, GateTimeline, Ring } from "@/components/charts";
import { TaskList } from "@/components/kam/TaskList";
import { AlertCards, JourneyStrip } from "@/components/kam/Widgets";
import { trainingSteps, resumeStep } from "@/lib/engine/training";
import { phaseLabel } from "@/lib/report/build";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const PHASE_STATUS: Record<string, string> = {
  LEARN: "LEARN", PRACTICE: "PRACTICE", GUIDED_OWNERSHIP: "GUIDED OWNERSHIP", READY_FOR_PANEL: "READY FOR PANEL",
  REMEDIATION: "REMEDIATION", SIGNED_OFF_READY: "SIGNED OFF — READY", EXTENDED: "EXTENDED", NOT_READY: "NOT READY",
};

export default async function KamDashboard() {
  const { snap, error } = await kamSnapshot();
  if (!snap) return <Notice tone="warn" title="Onboarding not available">{error}</Notice>;
  const { journey: j, metrics: m, config: cfg } = snap;
  const firstName = snap.employee.full_name.split(" ")[0];
  const todays = j.tasks.filter((t) => t.day_number === snap.day && t.is_mandatory);
  const overdue = j.tasks.filter((t) => t.overdue && t.owner_role === "KAM" && t.day_number !== snap.day);
  const focus = [...overdue, ...todays];
  const todayDone = todays.filter((t) => t.availability === "DONE").length;
  const nextSession = snap.sessions.find((s) => !["CANCELLED", "COMPLETED"].includes(s.status) && Date.parse(s.scheduled_at) >= Date.now() - 3_600_000);
  const gate = j.currentGate;
  const resume = resumeStep({ steps: trainingSteps(snap.journey) });
  const trainingHref = resume ? `/learn/${encodeURIComponent(resume.code)}` : "/learn";
  const kamAlerts = snap.alerts.filter((a) => a.audience.includes("KAM"));
  const dayLabel = snap.day < 1 ? `Starts ${fmtDate(snap.instance.start_date)}` : snap.day > cfg.duration ? `Day ${snap.day} (beyond Day ${cfg.duration})` : `Day ${snap.day} of ${cfg.duration}`;

  return (
    <>
      <PageHeader
        eyebrow="Learn first. Then earn access."
        title={`Welcome, ${firstName}`}
        subtitle={<>{dayLabel} · Current status <strong className="font-semibold text-ink">{PHASE_STATUS[j.phase]}</strong> · Overall readiness <strong className="font-semibold text-ink">{m.overallReadiness}%</strong></>}
        actions={<>
          <Link href="/journey" className="btn-secondary">Open journey</Link>
          <Link prefetch={false} href={trainingHref} className="btn-primary">Continue training<ArrowRight size={15} /></Link>
        </>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <div className="card card-pad col-span-2 flex items-center gap-4 md:col-span-1">
          <Ring value={m.overallReadiness} size={76} label="Overall readiness" />
          <div><div className="label">Progress</div><div className="mt-1 text-xs text-ink-muted">Overall readiness · {m.taskCompletionPct}% tasks</div></div>
        </div>
        <Stat label="Tasks" value={`${todayDone}/${todays.length}`} sub={<>today{m.overdueCount ? <span className="ml-1 font-medium text-bad">· {m.overdueCount} overdue</span> : null}</>} />
        <Stat label="Next session" value={<span className="text-base">{nextSession ? nextSession.title : "—"}</span>} sub={nextSession ? fmtDate(nextSession.scheduled_at, true) : "Nothing scheduled"} />
        <Stat label="Current gate" value={<span className="text-base">{gate ? `Day ${gate.day}` : "All cleared"}</span>} sub={gate ? <StatusPill status={gate.status} /> : "Sign-off recorded"} />
        <Stat label="Knowledge score" value={m.knowledgeScore !== null ? `${m.knowledgeScore}%` : "—"} sub={m.knowledgeScoreSource === "DAY15" ? <>Day-15 · <StatusPill status={m.band ?? ""} /></> : m.knowledgeScoreSource === "DAY10" ? "Interim check" : "Not assessed yet"} tone={m.knowledgeScoreSource === "DAY15" ? bandTone(m.band) : undefined} />
        <Stat label="Scenario score" value={m.scenarioScore !== null ? `${m.scenarioScore}%` : "—"} sub={m.scenarioScore !== null ? "Day-21 certification" : m.practiceScenarioScore !== null ? `Practice avg ${m.practiceScenarioScore}%` : "Not attempted"} tone={m.scenarioScore !== null ? scoreTone(m.scenarioScore, cfg.day21PassThreshold, 60) : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card title="Next recommended action" subtitle="Determined by your gates, dependencies and due dates">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><Sparkles size={16} /></span>
                <div>
                  <div className="text-sm font-semibold">{snap.nextAction.title}</div>
                  <div className="text-xs text-ink-muted">{snap.nextAction.detail}</div>
                </div>
              </div>
              {snap.nextAction.kind !== "DONE" && <Link prefetch={false} href={snap.nextAction.link} className="btn-primary btn-sm shrink-0">{snap.nextAction.kind === "WAIT" ? "View" : "Start step"}<ArrowRight size={13} /></Link>}
            </div>
          </Card>

          <Card title={`Today · Day ${Math.max(1, snap.day)}`} subtitle={overdue.length ? `${overdue.length} overdue from earlier days shown first` : j.days[Math.max(0, snap.day - 1)]?.status === "LOCKED" ? "Today's work is locked by a gate — finish earlier work first" : undefined} action={<Link href={`/journey/${Math.max(1, Math.min(snap.day, cfg.duration))}`} className="link text-xs">Day detail</Link>}>
            <div className="-mx-5 -my-5">
              <TaskList tasks={focus} employeeId={snap.employee.id} viewerRole="KAM" relation="SELF" empty="No required activities today." />
            </div>
          </Card>

          <Card title="30-day journey" subtitle="Segments unlock through readiness gates, not the calendar">
            <JourneyStrip days={j.days.slice(0, Math.max(cfg.duration, 30))} gateDays={j.gates.map((g) => g.day)} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Needs attention"><AlertCards alerts={kamAlerts} /></Card>
          <Card title="Readiness gates"><GateTimeline gates={j.gates} compact /><p className="mt-4 text-xs text-ink-muted">{gate ? <><strong className="font-medium text-ink-soft">{gate.name}:</strong> {gate.nextAction}</> : "All gates cleared."}</p></Card>
          <Card title="Pillar scores" subtitle={m.pillarScores ? `Day-15 attempt ${m.reassessmentCount + 1} · threshold ${cfg.greenThreshold}%` : "Shown after the Day-15 assessment"}>
            <PillarBars scores={snap.day15Pillars} threshold={cfg.greenThreshold} weights={cfg.weights} />
          </Card>
          <Card title="Exposure" subtitle="Controlled by gates and Reporting Boss approval">
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between"><dt className="text-ink-muted">Customer</dt><dd><StatusPill status={j.exposure.customer} /></dd></div>
              <div className="flex items-center justify-between"><dt className="text-ink-muted">Pricing</dt><dd><StatusPill status={j.exposure.pricing} /></dd></div>
              <div className="flex items-center justify-between"><dt className="text-ink-muted">Phase</dt><dd className="text-ink-soft">{phaseLabel(j.phase)}</dd></div>
            </dl>
          </Card>
          {nextSession && (
            <Card title="Next session" action={<Link href="/sessions" className="link text-xs">All sessions</Link>}>
              <div className="flex gap-3"><CalendarDays size={18} className="mt-0.5 text-ink-faint" /><div><div className="text-sm font-medium">{nextSession.title}</div><div className="text-xs text-ink-muted">{fmtDate(nextSession.scheduled_at, true)} · {nextSession.duration_minutes} min{nextSession.location ? ` · ${nextSession.location}` : ""}</div></div></div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
