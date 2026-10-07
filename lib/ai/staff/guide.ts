/**
 * "Ask Compass" for staff (Mentor, Reporting Boss, HR) — the deterministic
 * half. Intent rules, KAM-name matching, role-specific how-to playbooks and
 * fact sentences built from journey snapshots. No I/O, no LLM: everything a
 * staff member is told about a KAM is computed from recorded data.
 */
import type { Role } from "@/types/domain";

export type StaffRole = Extract<Role, "MENTOR" | "REPORTING_BOSS" | "HR_ADMIN">;
export type StaffIntent = "DECISION_GUARD" | "HOW_TO" | "SUPPORT_KAM" | "KAM_STATUS" | "PENDING" | "AT_RISK" | "COHORT" | "MESSAGES" | "KNOWLEDGE" | "HELP";

export interface Link { label: string; href: string }
export interface PlaybookEntry { id: string; roles: StaffRole[]; title: string; patterns: RegExp[]; steps: string[]; link: (kamId: string | null) => Link }

const profile = (id: string | null, fallback: Link): Link => (id ? { label: "Open KAM profile", href: `/people/${id}` } : fallback);

/** How the app actually works, per role. Each answer ends in a link to the exact screen. */
export const PLAYBOOK: PlaybookEntry[] = [
  { id: "review-brief", roles: ["MENTOR"], title: "Review an account brief or Customer 360",
    patterns: [/\b(account )?brief\b/i, /customer ?360/i, /stakeholder map/i],
    steps: ["Open the KAM's profile (Mentor dashboard → KAM name).", "In Mentor reviews & decisions, use Account brief review or Customer 360 & stakeholder map review.", "Choose Approve or Request changes, write evidence-based comments, give a 1–5 quality rating, then Record decision.", "Both reviews are required before the Day-15 gate (Gate 1) can pass."],
    link: (id) => profile(id, { label: "Mentor dashboard", href: "/mentor" }) },
  { id: "approve-work", roles: ["MENTOR", "REPORTING_BOSS"], title: "Approve work a KAM submitted for review",
    patterns: [/submitted work/i, /approve (a |the )?(task|work|draft|response|position)/i, /pre-?send/i, /awaiting (my )?review/i, /request changes/i],
    steps: ["Open the KAM's profile.", "Find Submitted work awaiting review (drafts, routine queries, the internal review, pricing positions).", "Add a review comment and choose Approve, or Request changes (a comment is required).", "Approved work completes the task; requested changes send it back to the KAM."],
    link: (id) => profile(id, { label: "Dashboard", href: "/mentor" }) },
  { id: "certify", roles: ["MENTOR"], title: "Certify the Day-21 scenario test (Gate 2)",
    patterns: [/certif/i, /scenario test/i, /gate 2/i, /day[- ]?21/i],
    steps: ["Gate 2 opens once the KAM has submitted all four certification scenarios.", "On the KAM's profile, optionally adjust individual scenario scores (comments are required for changes over 15 points).", "In Day-21 scenario test (Gate 2) choose Certify, Extend practice or Do not certify, with reasons.", "You cannot certify below the pass mark (default 75%) — the rules block it."],
    link: (id) => profile(id, { label: "Mentor dashboard", href: "/mentor" }) },
  { id: "panel", roles: ["MENTOR", "HR_ADMIN"], title: "Give Day-30 readiness panel input",
    patterns: [/panel/i, /day[- ]?30/i, /gate 3/i, /readiness input/i],
    steps: ["Panel input opens after Gate 2 (scenario test) has passed.", "On the KAM's profile, open Day-30 readiness panel input.", "Choose Recommend ready, Recommend extension or Not ready and write evidence-based comments.", "Once both Mentor and HR inputs are in, the Reporting Boss can record the final decision."],
    link: (id) => profile(id, { label: "Dashboard", href: "/hr" }) },
  { id: "coaching", roles: ["MENTOR", "REPORTING_BOSS", "HR_ADMIN"], title: "Record coaching feedback or a support event",
    patterns: [/feedback/i, /coach/i, /support event/i, /dependency/i, /log (help|support)/i],
    steps: ["On the KAM's profile, use the Feedback form: category, pillar, whether the KAM can see it, and areas needing reinforcement.", "Use Record support event when the KAM needed Mentor or colleague help, escalated, or resolved something alone — this drives the dependency trend.", "Feedback and events are visible in the KAM's progress report."],
    link: (id) => profile(id, { label: "Dashboard", href: "/mentor" }) },
  { id: "progression", roles: ["REPORTING_BOSS"], title: "Approve or defer Phase-2 progression",
    patterns: [/progression/i, /defer/i, /phase ?2/i, /hold (back|them)/i],
    steps: ["Available after the KAM's Day-15 assessment.", "On the KAM's profile, open Reporting Boss decisions → Phase-2 progression.", "Approve progression, or Defer with the reason — deferring blocks Phase 2 until you approve.", "Every decision is audited with your comments."],
    link: (id) => profile(id, { label: "Readiness dashboard", href: "/manager" }) },
  { id: "exposure", roles: ["REPORTING_BOSS"], title: "Approve guided pricing or customer ownership",
    patterns: [/pricing exposure/i, /guided pricing/i, /customer ownership/i, /own the account/i, /exposure/i],
    steps: ["Both open only after Gate 2 (scenario test). Guided pricing also needs a Green Day-15 result.", "On the KAM's profile, open Guided pricing exposure (Days 22–25) or Guided customer ownership (Days 26–29).", "Approve or Defer with reasons. Pricing positions are then prepared by the KAM and decided jointly with you."],
    link: (id) => profile(id, { label: "Readiness dashboard", href: "/manager" }) },
  { id: "signoff", roles: ["REPORTING_BOSS"], title: "Record the Day-30 readiness sign-off",
    patterns: [/sign[- ]?off/i, /final decision/i, /\bready\b/i, /extend (the )?onboarding/i, /extension/i],
    steps: ["Sign-off opens when Gate 3 shows Submitted — Phase-2 work done and Mentor + HR panel inputs recorded.", "On the KAM's profile, open Day-30 readiness sign-off (final).", "Choose READY, Extend onboarding (1–60 days) or Not ready, with written justification and development actions.", "Only you can record this; 30 elapsed days never make a KAM ready on their own."],
    link: (id) => profile(id, { label: "Readiness dashboard", href: "/manager" }) },
  { id: "dev-actions", roles: ["REPORTING_BOSS"], title: "Record development actions",
    patterns: [/development action/i, /development plan/i],
    steps: ["On the KAM's profile, use Record development actions — one action per line, plus a reason.", "They appear in the KAM's report and the audit log."],
    link: (id) => profile(id, { label: "Readiness dashboard", href: "/manager" }) },
  { id: "add-employee", roles: ["HR_ADMIN"], title: "Add a KAM and assign onboarding",
    patterns: [/add (a )?(new )?(kam|employee|joiner)/i, /new joiner/i, /assign onboarding/i, /onboard (a |someone)/i, /create (a )?(kam|employee)/i],
    steps: ["Go to Employees.", "Fill in the new KAM's details, joining type (New joiner or Reassigned KAM), Mentor, Reporting Boss and start date.", "Click Create KAM & assign onboarding — the 30-day journey, tasks and gates are created automatically."],
    link: () => ({ label: "Employees", href: "/admin/employees" }) },
  { id: "reassign", roles: ["HR_ADMIN"], title: "Change a KAM's Mentor or Reporting Boss, or reset onboarding",
    patterns: [/reassign/i, /change (the )?(mentor|boss|reporting)/i, /reset/i, /restart/i],
    steps: ["Go to Employees and find the KAM.", "Pick a new Mentor or Reporting Boss and click Save.", "To restart the journey, use Reset / reassign, choose the new start date and give a reason, then Confirm reset. The reset is audited."],
    link: () => ({ label: "Employees", href: "/admin/employees" }) },
  { id: "config", roles: ["HR_ADMIN"], title: "Change programme settings",
    patterns: [/threshold/i, /pass mark/i, /weight/i, /configur/i, /setting/i, /chat window/i, /duration/i, /green|amber/i],
    steps: ["Go to Programme configuration.", "Edit pillar weights (must total 100), Green/Amber thresholds, interim check and scenario pass marks, gate requirements, refresh and extension lengths, reminders and the support chat window.", "Save — changes apply to everyone immediately and are audited."],
    link: () => ({ label: "Programme configuration", href: "/admin/config" }) },
  { id: "questions", roles: ["HR_ADMIN"], title: "Add or edit assessment questions and scenario rubrics",
    patterns: [/question/i, /quiz/i, /rubric/i, /assessment (bank|management)/i],
    steps: ["Go to Assessment management.", "Use Add question (stage, type, pillar, topic, weight, correct answer or rubric, source) and Save question; set Active to include it.", "Edit scenario rubrics with Save rubric. Old attempts keep the questions they were scored on."],
    link: () => ({ label: "Assessment management", href: "/admin/assessments" }) },
  { id: "knowledge", roles: ["HR_ADMIN"], title: "Publish or update a knowledge document",
    patterns: [/upload/i, /publish/i, /document/i, /\bsop\b/i, /policy/i, /knowledge base/i],
    steps: ["Go to Knowledge management.", "Upload the file with the same document key and a higher version number to supersede the current one, and mark it approved.", "Only approved, current versions are used by Ask FirstGear and Ask Compass."],
    link: () => ({ label: "Knowledge management", href: "/admin/knowledge" }) },
  { id: "audit", roles: ["HR_ADMIN"], title: "Check who changed or decided what",
    patterns: [/audit/i, /who (changed|approved|decided)/i, /history of/i],
    steps: ["Open the Audit log and filter by event (task completed, gate passed, manager decision, config changed…) or by KAM.", "Audit entries are append-only."],
    link: () => ({ label: "Audit log", href: "/admin/audit" }) },
  { id: "chat", roles: ["MENTOR", "HR_ADMIN"], title: "Reply to a KAM in the support chat",
    patterns: [/\bchat\b/i, /message/i, /reply/i, /unread/i],
    steps: ["Open Messages — KAMs with unread messages are shown first.", "Pick the KAM and reply. Messages linked to a training step show which step they are about.", "The chat is open for each KAM's first support-window days (default 15) and read-only afterwards."],
    link: (id) => ({ label: "Messages", href: id ? `/messages?kam=${id}` : "/messages" }) },
  { id: "bands", roles: ["MENTOR", "REPORTING_BOSS", "HR_ADMIN"], title: "What happens on Amber or Red",
    patterns: [/\bamber\b/i, /\bred\b/i, /remediation/i, /refresh/i, /re-?check/i, /re-?assess/i],
    steps: ["Amber (60–79%): a 3–5 day targeted refresh is generated for the weakest pillars; supervised shadowing is allowed; the scenario test and pricing stay blocked until a re-check reaches 80%.", "Red (below 60%): Phase 2 is paused and a remediation plan is generated (1:1 coaching, repeat modules, mentor pairing, extra assessment) with a proposed extension for the Reporting Boss.", "The re-check unlocks automatically once the KAM's refresh tasks are complete."],
    link: (id) => profile(id, { label: "Dashboard", href: "/mentor" }) },
  { id: "gates", roles: ["MENTOR", "REPORTING_BOSS", "HR_ADMIN"], title: "How the three gates work",
    patterns: [/\bgates?\b/i, /day[- ]?15/i, /phase 1/i, /journey structure/i],
    steps: ["Gate 1 — Day 15: Phase-1 learning done (Governance → People → Product → Process), interim check passed, Customer 360 and brief reviewed by the Mentor, readiness score ≥ 80%.", "Gate 2 — Day 21: scenario test, certified by the Mentor.", "Gate 3 — Day 30: readiness panel sign-off by the Reporting Boss.", "Customer and pricing access are earned by passing gates, not by days passing."],
    link: () => ({ label: "Knowledge — assessment guide", href: "/knowledge/ASSESSMENT-GUIDE" }) },
];

const HOW = /\b(how|where|what steps|steps to|guide me|walk me|explain|can i|do i|help me (to )?|show me how)\b/i;
const DECIDE_FOR_ME = /\b(approve|certify|sign[- ]?off|defer|reject|decide|mark)\b.{0,40}\b(for me|on my behalf|yourself|automatically)\b|\b(can|could|will) you (approve|certify|sign|defer|decide)\b/i;

/** Finds the KAM a question is about from the cohort the user may see. Full names win over first names. */
export function matchKam<T extends { id: string; full_name: string }>(message: string, kams: T[]): T | null {
  const m = message.toLowerCase();
  const full = kams.find((k) => m.includes(k.full_name.toLowerCase()));
  if (full) return full;
  const firsts = kams.filter((k) => {
    const first = k.full_name.split(/\s+/)[0].toLowerCase();
    return first.length >= 3 && new RegExp(`\\b${first.replace(/[^a-z]/g, "")}\\b`, "i").test(m);
  });
  return firsts.length === 1 ? firsts[0] : null;
}

export function matchPlaybook(message: string, role: StaffRole): PlaybookEntry | null {
  const scored = PLAYBOOK.filter((p) => p.roles.includes(role))
    .map((p) => ({ p, hits: p.patterns.filter((r) => r.test(message)).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits);
  return scored[0]?.p ?? null;
}

export function classify(message: string, role: StaffRole, hasKam: boolean): StaffIntent {
  const m = message.toLowerCase();
  if (DECIDE_FOR_ME.test(message)) return "DECISION_GUARD";
  const play = matchPlaybook(message, role);
  if (play && HOW.test(message)) return "HOW_TO";
  if (hasKam && /\b(help|support|struggl|stuck|coach|improve|what should i|how can i|weak|advice|guide)\b/.test(m)) return "SUPPORT_KAM";
  if (hasKam) return "KAM_STATUS";
  if (/\b(pending|waiting on me|to-?do|my (queue|reviews|approvals|tasks)|need(s)? (my )?(attention|action|review)|what should i do|today|inbox)\b/.test(m)) return "PENDING";
  if (/\b(unread|messages?|chats?)\b/.test(m) && role !== "REPORTING_BOSS") return "MESSAGES";
  if (/\b(at risk|risk|behind|overdue|red|amber|struggl|falling|late|blocked|failing|stuck)\b/.test(m)) return "AT_RISK";
  if (/\b(overview|summary|cohort|everyone|all (my )?kams|team|progress|status|dashboard|how (is|are))\b/.test(m)) return "COHORT";
  if (play) return "HOW_TO";
  if (/^(hi|hello|hey|help|what can you do)\b/.test(m.trim())) return "HELP";
  return "KNOWLEDGE";
}

export const SUGGESTIONS: Record<StaffRole, string[]> = {
  MENTOR: ["What needs my review today?", "Who is at risk or overdue?", "How do I certify the Day-21 scenario test?", "How can I support {kam}?", "Any unread messages?"],
  REPORTING_BOSS: ["What decisions are waiting on me?", "Who is at risk?", "How do I record the Day-30 sign-off?", "When can I approve guided pricing?", "Give me a cohort summary"],
  HR_ADMIN: ["Give me a cohort summary", "Who is at risk or overdue?", "How do I add a new KAM?", "How do I change the pass marks?", "Any unread messages?"],
};

export function helpText(role: StaffRole): string {
  const who = role === "MENTOR" ? "your assigned KAMs" : role === "REPORTING_BOSS" ? "the KAMs reporting to you" : "every KAM";
  return `I'm Ask Compass. I can tell you, from live data on ${who}: what's waiting on you, who is at risk or overdue, any KAM's status and how to support them. I can walk you through any step in the app, and answer policy and process questions from the approved documents — with sources. I never make approvals, certifications or sign-offs myself; those stay with you.`;
}
