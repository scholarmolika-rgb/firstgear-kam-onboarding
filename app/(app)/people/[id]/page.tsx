import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3, ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadSnapshot } from "@/lib/services/snapshot";
import { relationTo } from "@/lib/auth/access";
import { Card, PageHeader, Stat, StatusPill, fmtPct, fmtDate, Notice } from "@/components/ui";
import { PillarBars, GateTimeline, DependencyBars, Ring } from "@/components/charts";
import { JourneyStrip } from "@/components/kam/Widgets";
import { TaskList } from "@/components/kam/TaskList";
import { DecisionForm, FeedbackForm, SupportEventForm, ScenarioReviewForm, TaskReviewButtons } from "@/components/staff/Decisions";
import { ScheduleForm, SessionRow } from "@/components/kam/Sessions";
import { BRIEF_SECTIONS } from "@/components/kam/Account";
import { phaseLabel } from "@/lib/report/build";

export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireRole(["MENTOR", "REPORTING_BOSS", "HR_ADMIN"]);
  const db = await createServerSupabase();
  const { data: emp } = await db.from("employees").select("id, profile_id, mentor_id, reporting_boss_id").eq("id", id).maybeSingle();
  if (!emp) notFound();
  const rel = relationTo({ id: s.profile.id, role: s.profile.role }, emp);
  if (!rel || rel === "SELF") notFound();
  let snap;
  try { snap = await loadSnapshot(db, id); } catch (e) { return <Notice tone="warn" title="No active onboarding">{(e as Error).message}</Notice>; }
  const j = snap.journey;
  const m = snap.metrics;
  const g = (c: string) => j.gates.find((x) => x.code === c)!;
  const { data: brief } = await db.from("account_briefs").select("*").eq("employee_id", id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  const { data: stakeholders } = await db.from("stakeholder_maps").select("name, side, function, title, influence").eq("employee_id", id);
  const { data: scen } = await db.from("scenario_attempts").select("id, score, rule_score, status, response, feedback, missing_considerations, red_flags_triggered, created_at, is_certification, reviewer_score, reviewer_comments, scenario_id").eq("employee_id", id).order("created_at", { ascending: false }).limit(20);
  const titleById = new Map(snap.scenarioAttempts.map((a) => [a.id, a.title]));
  const awaiting = j.tasks.filter((t) => t.availability === "AWAITING_REVIEW");
  const myTasks = j.tasks.filter((t) => (rel === "HR_ADMIN" ? t.owner_role === "HR_ADMIN" : t.owner_role === rel) && t.availability !== "DONE");
  const g4ok = ["PASSED", "APPROVED"].includes(g("G4").status);
  const hasDecision = (t: string) => snap.managerReviews.filter((r) => r.review_type === t).at(-1);

  return (
    <>
      <Link href={rel === "MENTOR" ? "/mentor" : rel === "REPORTING_BOSS" ? "/manager" : "/hr"} className="link mb-4 inline-flex items-center gap-1 text-sm"><ArrowLeft size={14} />Dashboard</Link>
      <PageHeader eyebrow={`${snap.employee.employee_code} · ${snap.employee.joining_type === "REASSIGNED" ? "Reassigned" : "New joiner"} · ${snap.employee.assigned_customer ?? ""}`} title={snap.employee.full_name}
        subtitle={<>Day {snap.day} of {snap.config.duration} · {phaseLabel(j.phase)} · You are viewing as <strong>{rel === "HR_ADMIN" ? "HR" : rel === "MENTOR" ? "Mentor" : "Reporting Boss"}</strong></>}
        actions={<Link href={`/report?employee=${id}`} className="btn-primary"><BarChart3 size={15} />Generate progress report</Link>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="card card-pad flex items-center gap-3"><Ring value={m.overallReadiness} size={64} label="Overall readiness" /><div className="label">Overall readiness</div></div>
        <Stat label="Task completion" value={fmtPct(m.taskCompletionPct)} sub={`${m.overdueCount} overdue`} />
        <Stat label="Day-15" value={fmtPct(m.assessmentScore, 1)} sub={m.band ? <StatusPill status={m.band} /> : "Not assessed"} />
        <Stat label="Day-21 scenarios" value={fmtPct(m.scenarioScore, 1)} sub={`Δ vs Day-15: ${(g("G4").evidence.delta_vs_day15 as number | null) ?? "—"}`} />
        <Stat label="Current gate" value={<span className="text-base">{j.currentGate ? `Day ${j.currentGate.day}` : "Cleared"}</span>} sub={j.currentGate ? <StatusPill status={j.currentGate.status} /> : null} />
        <Stat label="Dependency" value={<span className="text-base">{m.dependency.direction.replace("_", " ").toLowerCase()}</span>} sub={`${m.dependency.totalEvents} recorded events`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div id="decisions" className="space-y-4">
            {rel === "MENTOR" && (
              <Card title="Mentor reviews & decisions" subtitle="Judgement calls reserved for you — recorded with your reasons">
                <div className="space-y-4">
                  <DecisionForm kind="BRIEF" employeeId={id} title="Account brief review (Day 15)" help={brief ? `Status: ${brief.status} · version ${brief.version}` : undefined} disabledReason={!brief ? "No account brief yet." : brief.status === "DRAFT" ? "The KAM has not submitted the brief yet." : brief.status === "APPROVED" ? "Approved." : null} />
                  <DecisionForm kind="C360" employeeId={id} title="Customer 360 & stakeholder map review (Day 15)" help={`${stakeholders?.length ?? 0} stakeholders mapped`} disabledReason={j.tasks.find((t) => t.action_ref === "review:CUSTOMER_360")?.availability === "DONE" ? "Approved." : null} />
                  <DecisionForm kind="G4" employeeId={id} title="Day-21 scenario certification (Gate 4)" help={`Rules average ${fmtPct(g("G4").score, 1)} · pass threshold ${snap.config.day21PassThreshold}%. You cannot certify below the threshold.`} disabledReason={["SUBMITTED", "FAILED"].includes(g("G4").status) ? null : g4ok ? "Certified." : g("G4").nextAction} />
                  <DecisionForm kind="PANEL" employeeId={id} title="Day-30 readiness panel — mentor input" disabledReason={!g4ok ? "Opens after Gate 4." : snap.mentorReviews.some((r) => r.review_type === "PANEL") ? "Your panel input is recorded." : null} />
                </div>
              </Card>
            )}
            {rel === "REPORTING_BOSS" && (
              <Card title="Reporting Boss decisions" subtitle="You are the final decision-maker for independent account handling">
                <div className="space-y-4">
                  <DecisionForm kind="PROGRESSION" employeeId={id} title="Phase-2 progression" help={`Day-15 gate: ${g("G3").status.replace(/_/g, " ").toLowerCase()} — ${g("G3").decision ?? g("G3").nextAction}`} disabledReason={!snap.day15Pillars ? "Available after the Day-15 assessment." : null} />
                  <DecisionForm kind="PRICING_EXPOSURE" employeeId={id} title="Guided pricing exposure (Days 22–25)" help={`Requires Gate 4 and a Green Day-15 result. Latest: ${m.band ?? "not assessed"}.${hasDecision("PRICING_EXPOSURE") ? ` Last decision: ${hasDecision("PRICING_EXPOSURE")!.decision}.` : ""}`} disabledReason={!g4ok ? "Available after scenario certification (Gate 4)." : null} />
                  <DecisionForm kind="CUSTOMER_OWNERSHIP" employeeId={id} title="Guided customer ownership (Days 26–29)" help={hasDecision("CUSTOMER_OWNERSHIP") ? `Last decision: ${hasDecision("CUSTOMER_OWNERSHIP")!.decision}.` : undefined} disabledReason={!g4ok ? "Available after scenario certification (Gate 4)." : null} />
                  <DecisionForm kind="SIGNOFF" employeeId={id} title="Day-30 readiness sign-off (final)" help="Readiness is a human-certified decision based on the evidence below — never on elapsed days." disabledReason={g("G5").status === "SUBMITTED" ? null : snap.instance.final_decision ? `Recorded: ${snap.instance.final_decision} on ${fmtDate(snap.instance.final_decision_at)}` : g("G5").nextAction} />
                  <DecisionForm kind="DEV_ACTION" employeeId={id} title="Record development actions" />
                </div>
              </Card>
            )}
            {rel === "HR_ADMIN" && (
              <Card title="HR actions">
                <div className="space-y-4">
                  <DecisionForm kind="PANEL" employeeId={id} title="Day-30 readiness panel — HR input" disabledReason={!g4ok ? "Opens after Gate 4." : snap.managerReviews.some((r) => r.review_type === "HR_PANEL_INPUT") ? "HR input recorded." : null} />
                  <p className="text-xs text-ink-muted">Assignments, resets and reassignment are in <Link className="link" href="/admin/employees">Employee management</Link>.</p>
                </div>
              </Card>
            )}
          </div>

          {awaiting.length > 0 && rel !== "HR_ADMIN" && (
            <Card title="Submitted work awaiting review" subtitle="Mandatory pre-send review: approve before anything goes to the customer">
              <ul className="space-y-3">{awaiting.map((t) => <li key={t.id} className="rounded-md border border-line p-3"><div className="text-sm font-medium">{t.title}</div><div className="text-xs text-ink-muted">Day {t.day_number} · {t.description}</div><TaskReviewButtons employeeId={id} taskId={t.id} /></li>)}</ul>
            </Card>
          )}

          {myTasks.length > 0 && (
            <Card title="Your tasks for this KAM"><div className="-mx-5 -my-5"><TaskList tasks={myTasks} employeeId={id} viewerRole={s.profile.role} relation={rel} /></div></Card>
          )}

          <Card title="Scenario attempts">
            {scen?.length ? (
              <ul className="space-y-3">{scen.map((a) => (
                <li key={a.id} className="rounded-md border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{titleById.get(a.id) ?? "Scenario"} {a.is_certification && <span className="text-xs text-accent">· certification</span>}</span><span className="flex items-center gap-2 text-sm"><span className="tabular-nums">{a.reviewer_score ?? a.score}%</span><StatusPill status={a.status} /></span></div>
                  <details className="mt-1"><summary className="cursor-pointer text-xs text-ink-muted">Response & evaluation</summary>
                    <p className="mt-2 whitespace-pre-wrap rounded bg-canvas p-2 text-xs">{a.response}</p>
                    <p className="mt-2 text-xs text-ink-soft">{a.feedback}</p>
                    {a.missing_considerations?.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-ink-muted">{a.missing_considerations.map((x: string) => <li key={x}>{x}</li>)}</ul>}
                    {a.reviewer_comments && <p className="mt-1 text-xs">Reviewer: {a.reviewer_comments}</p>}
                  </details>
                  {a.status === "REVIEW_REQUIRED" && rel !== "HR_ADMIN" && <ScenarioReviewForm attemptId={a.id} score={Number(a.score)} />}
                </li>
              ))}</ul>
            ) : <p className="text-sm text-ink-muted">No attempts yet.</p>}
          </Card>

          <Card title="Account brief" action={brief ? <StatusPill status={brief.status} /> : null}>
            {brief ? <dl className="grid gap-3 text-sm sm:grid-cols-2">{BRIEF_SECTIONS.map((b) => <div key={b.key}><dt className="label">{b.label}</dt><dd className="mt-0.5 whitespace-pre-wrap text-ink-soft">{(brief[b.key] as string) || "—"}</dd></div>)}</dl> : <p className="text-sm text-ink-muted">Not started.</p>}
            {stakeholders && stakeholders.length > 0 && <div className="mt-4"><div className="label mb-1">Stakeholder map</div><ul className="grid gap-1 text-xs sm:grid-cols-2">{stakeholders.map((x, i) => <li key={i}>{x.name} — {x.side.toLowerCase()} {x.function.toLowerCase()} ({x.influence.toLowerCase()})</li>)}</ul></div>}
          </Card>

          <Card title="30-day journey"><JourneyStrip days={j.days.slice(0, snap.config.duration)} gateDays={j.gates.map((x) => x.day)} hrefBase={null} /></Card>
        </div>

        <div className="space-y-6">
          <Card title="Gates"><GateTimeline gates={j.gates} /></Card>
          <Card title="Pillar scores"><PillarBars scores={snap.day15Pillars} threshold={snap.config.greenThreshold} weights={snap.config.weights} /></Card>
          <Card title="Exposure"><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-ink-muted">Customer</span><StatusPill status={j.exposure.customer} /></div><div className="flex justify-between"><span className="text-ink-muted">Pricing</span><StatusPill status={j.exposure.pricing} /></div></div></Card>
          <Card title="Dependency trend" subtitle="Record support events to make this measurable"><DependencyBars series={m.dependency.series} /><div className="mt-3"><SupportEventForm employeeId={id} /></div></Card>
          <Card title="Feedback & coaching notes"><FeedbackForm employeeId={id} isMentor={rel === "MENTOR"} />
            <ul className="mt-4 space-y-2 border-t border-line pt-3">{snap.feedback.slice(0, 6).map((f) => <li key={f.id} className="text-xs"><span className="text-ink-faint">{fmtDate(f.created_at)} · {f.author_name ?? f.author_role}</span><div className="text-ink-soft">{f.content}</div></li>)}</ul>
          </Card>
          <Card title="Sessions"><ul className="-mx-5 -my-5 divide-y divide-line">{snap.sessions.slice(-5).map((x) => <SessionRow key={x.id} s={x} />)}</ul></Card>
          <Card title="Schedule a session"><ScheduleForm employeeId={id} sessionTypes={snap.config.sessionTypes} /></Card>
        </div>
      </div>
    </>
  );
}
