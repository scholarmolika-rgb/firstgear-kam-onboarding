/**
 * Proactive agent: OBSERVE the journey state and produce notifications.
 * Deterministic. Each alert has a dedupe key so the notification service can
 * upsert without spamming.
 */
import type { JourneyState } from "./journey";
import type { ProgressMetrics } from "./progress";
import { PILLAR_LABEL, type Pillar, type ProgrammeConfig } from "@/types/domain";

export interface Alert {
  type: string;
  severity: "INFO" | "ATTENTION" | "CRITICAL";
  title: string;
  body: string;
  link: string;
  dedupeKey: string;
  audience: ("KAM" | "MENTOR" | "REPORTING_BOSS" | "HR_ADMIN")[];
}

export interface UpcomingSession { id: string; title: string; dayOffset: number; when: string }

export function computeAlerts(
  journey: JourneyState,
  metrics: ProgressMetrics,
  today: number,
  cfg: ProgrammeConfig,
  sessions: UpcomingSession[],
): Alert[] {
  const a: Alert[] = [];
  const lead = cfg.reminderLeadDays;

  const todays = journey.tasks.filter((t) => t.owner_role === "KAM" && t.day_number === today && t.availability === "AVAILABLE");
  if (todays.length) a.push({ type: "TODAY_TASKS", severity: "INFO", title: `${todays.length} task${todays.length === 1 ? "" : "s"} for today`, body: todays.slice(0, 3).map((t) => t.title).join(" · "), link: `/journey/${today}`, dedupeKey: `today-${today}`, audience: ["KAM"] });

  if (metrics.overdueCount) a.push({ type: "OVERDUE", severity: "ATTENTION", title: `${metrics.overdueCount} overdue task${metrics.overdueCount === 1 ? "" : "s"}`, body: journey.tasks.filter((t) => t.overdue && t.owner_role === "KAM").slice(0, 3).map((t) => `${t.title} (Day ${t.due_day})`).join(" · "), link: "/tasks?filter=overdue", dedupeKey: `overdue-${today}`, audience: ["KAM", "MENTOR"] });

  for (const s of sessions.filter((x) => x.dayOffset >= 0 && x.dayOffset <= lead)) {
    a.push({ type: "SESSION", severity: "INFO", title: s.dayOffset === 0 ? `Today: ${s.title}` : `Tomorrow: ${s.title}`, body: s.when, link: "/sessions", dedupeKey: `session-${s.id}-${s.dayOffset}`, audience: ["KAM"] });
  }

  for (const g of journey.gates) {
    const dueIn = g.day - today;
    if (["PASSED", "APPROVED"].includes(g.status)) continue;
    if (dueIn >= 0 && dueIn <= lead && g.status !== "NOT_STARTED") {
      a.push({ type: "GATE_APPROACHING", severity: "ATTENTION", title: `${dueIn === 0 ? "Today" : "Tomorrow"}: ${g.name} (Day ${g.day})`, body: g.nextAction, link: "/journey", dedupeKey: `gate-approach-${g.code}-${today}`, audience: ["KAM", "MENTOR"] });
    }
    if (g.status === "BLOCKED" || g.status === "FAILED") {
      a.push({ type: "GATE_BLOCKED", severity: "CRITICAL", title: `${g.name}: ${g.status === "FAILED" ? "not passed" : "blocked"}`, body: g.nextAction, link: "/journey", dedupeKey: `gate-blocked-${g.code}-${g.status}`, audience: ["KAM", "MENTOR", "REPORTING_BOSS", "HR_ADMIN"] });
    }
    if (g.status === "SUBMITTED" && g.approverRole) {
      const who = g.approverRole === "MENTOR" ? "Mentor" : "Reporting Boss";
      a.push({ type: g.approverRole === "MENTOR" ? "MENTOR_REVIEW_REQUIRED" : "MANAGER_SIGNOFF_REQUIRED", severity: "ATTENTION", title: `${who} review pending: ${g.name}`, body: g.nextAction, link: "/journey", dedupeKey: `gate-review-${g.code}`, audience: ["KAM", g.approverRole] });
    }
  }

  const cert = journey.gates.find((g) => g.code === "G2");
  const d15Gate = journey.gates.find((g) => g.code === "G1");
  if (cert && d15Gate && !["PASSED", "APPROVED"].includes(d15Gate.status) && today >= 19) {
    a.push({ type: "GATE_BLOCKED", severity: "ATTENTION", title: "Your Day-21 scenario test is blocked until the Day-15 gate is cleared.", body: d15Gate.nextAction, link: "/journey/15", dedupeKey: `cert-blocked-${d15Gate.status}`, audience: ["KAM"] });
  }

  const d15 = journey.gates.find((g) => g.code === "G1");
  if (journey.day15Available.available && !journey.day15Available.isRecheck && d15 && d15.day - today <= lead && d15.day - today >= 0) {
    a.push({ type: "ASSESSMENT_UPCOMING", severity: "INFO", title: d15.day === today ? "Your Day-15 assessment is today." : "Your Day-15 assessment is tomorrow.", body: "Four-pillar, weighted assessment.", link: "/assessments", dedupeKey: `d15-upcoming-${today}`, audience: ["KAM"] });
  }
  if (journey.day15Available.available && journey.day15Available.isRecheck) {
    a.push({ type: "REASSESSMENT_DUE", severity: "ATTENTION", title: "Day-15 re-check is now available", body: "Your refresh tasks are complete.", link: "/assessments", dedupeKey: `recheck-${metrics.reassessmentCount}`, audience: ["KAM", "MENTOR"] });
  }

  if (metrics.pillarScores) {
    for (const [p, v] of Object.entries(metrics.pillarScores)) {
      if (v < cfg.greenThreshold) {
        const refresh = journey.tasks.some((t) => (t.task_type === "REFRESH" || t.task_type === "REMEDIATION") && t.pillar === p && t.availability !== "DONE");
        a.push({ type: "WEAK_PILLAR", severity: "ATTENTION", title: `Your ${PILLAR_LABEL[p as Pillar]} score is currently below the readiness threshold.`, body: refresh ? "A refresher module has been assigned." : `${v}% vs ${cfg.greenThreshold}% threshold.`, link: "/tasks", dedupeKey: `weak-${p}-${metrics.reassessmentCount}`, audience: ["KAM", "MENTOR"] });
      }
    }
  }

  const awaitingMentor = journey.tasks.filter((t) => t.availability === "AWAITING_REVIEW");
  if (awaitingMentor.length) a.push({ type: "MENTOR_REVIEW_REQUIRED", severity: "INFO", title: "Your Mentor review is pending.", body: awaitingMentor.map((t) => t.title).join(" · "), link: "/tasks", dedupeKey: `awaiting-${awaitingMentor.map((t) => t.code).join(",")}`, audience: ["KAM", "MENTOR"] });

  const mentorTasks = journey.tasks.filter((t) => t.owner_role === "MENTOR" && t.availability === "AVAILABLE" && !t.systemDriven);
  if (mentorTasks.length) a.push({ type: "MENTOR_ACTION", severity: "INFO", title: `${mentorTasks.length} mentor action${mentorTasks.length === 1 ? "" : "s"} open`, body: mentorTasks.map((t) => t.title).join(" · "), link: "/mentor", dedupeKey: `mentor-actions-${mentorTasks.map((t) => t.code).join(",")}`, audience: ["MENTOR"] });

  const panelGate = journey.gates.find((g) => g.code === "G3");
  if (panelGate?.status === "SUBMITTED") a.push({ type: "MANAGER_SIGNOFF_REQUIRED", severity: "ATTENTION", title: "Day-30 readiness sign-off required", body: "Mentor and HR panel inputs are in.", link: "/manager", dedupeKey: "panel-signoff", audience: ["REPORTING_BOSS"] });

  return a;
}
