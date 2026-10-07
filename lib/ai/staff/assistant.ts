import "server-only";
import { loadSnapshot, type Snapshot } from "@/lib/services/snapshot";
import { loadCohort, pendingFor } from "@/lib/services/cohort";
import { chatInbox, chatEnabled } from "@/lib/services/chat";
import { getConfig } from "@/lib/services/settings";
import { audit } from "@/lib/services/audit";
import { ServiceError, type ActionContext } from "@/lib/services/context";
import { assistantLimiter } from "@/lib/security/rate-limit";
import { retrieve, validateCitations, formatCitation, toCitations, focusedExcerpt, type Citation } from "@/lib/ai/rag/retrieve";
import { mistralChat } from "@/lib/ai/llm/mistral";
import { renderPrompt } from "@/lib/ai/prompts";
import { phaseLabel } from "@/lib/report/build";
import { PILLAR_LABEL, type Pillar } from "@/types/domain";
import { classify, matchKam, matchPlaybook, helpText, SUGGESTIONS, type Link, type StaffIntent, type StaffRole } from "./guide";
import { firstNameOf, relatedQuestions, sourceLead, warmText, type ToneKind } from "@/lib/ai/tone";

/**
 * Ask Compass — the staff assistant for Mentors, Reporting Bosses and HR.
 * Facts about KAMs come from journey snapshots read with the user's own
 * client (RLS decides which KAMs they may see); app guidance comes from the
 * role playbooks; policy answers come from approved documents with
 * citations. The assistant never records a decision.
 */

export type StaffGrounding = "COHORT_STATE" | "APP_GUIDE" | "COMPANY_KNOWLEDGE" | "INSUFFICIENT" | "GUARDRAIL" | "GENERAL";

export interface StaffReply { text: string; intent: StaffIntent; grounding: StaffGrounding; links: Link[]; citations: Citation[]; model: string | null; suggestions: string[] }
type Draft = Omit<StaffReply, "intent" | "suggestions"> & { suggestions?: string[] };

/** Follow-up questions that make sense after each kind of answer. */
function followUps(intent: StaffIntent, role: StaffRole, asked: string, kamName: string | null): string[] {
  const first = kamName ? firstNameOf(kamName) : null;
  const askedNorm = asked.toLowerCase();
  const defaults = SUGGESTIONS[role].map((s) => s.replace("{kam}", first ?? "")).filter((s) => !s.includes("support ?") && s.toLowerCase() !== askedNorm);
  switch (intent) {
    case "KAM_STATUS": return first ? [`How can I support ${first}?`, "How do I record coaching feedback?", "Who is at risk or overdue?"] : defaults.slice(0, 3);
    case "SUPPORT_KAM": return first ? [`Where is ${first} now?`, "How do I record coaching feedback?", "What happens on Amber or Red?"] : defaults.slice(0, 3);
    case "PENDING": return ["Who is at risk or overdue?", "Give me a cohort summary"];
    case "COHORT": return ["Who is at risk or overdue?", role === "REPORTING_BOSS" ? "What decisions are waiting on me?" : "What needs my review today?"];
    default: return defaults.slice(0, 3);
  }
}

const STAFF: StaffRole[] = ["MENTOR", "REPORTING_BOSS", "HR_ADMIN"];
const profileLink = (s: Snapshot): Link => ({ label: `Open ${s.employee.full_name}`, href: `/people/${s.employee.id}` });
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "not assessed" : `${v}%`);

function status(s: Snapshot): string {
  const m = s.metrics;
  const g = s.journey.currentGate;
  const parts = [
    `${s.employee.full_name} is on Day ${Math.max(s.day, 0)} of ${s.config.duration} (${phaseLabel(s.journey.phase)}).`,
    `Overall readiness ${m.overallReadiness}%, ${m.taskCompletionPct}% of mandatory tasks done${m.overdueCount ? `, ${m.overdueCount} overdue` : ""}.`,
    m.band ? `Day-15 result ${m.band} (${pct(m.assessmentScore)}).` : "Day-15 assessment not taken yet.",
    g ? `Current gate: ${g.name} (Day ${g.day}) — ${g.status.replace(/_/g, " ").toLowerCase()}; next: ${g.nextAction}.` : "All gates cleared.",
    `Exposure: customer ${s.journey.exposure.customer.toLowerCase()}, pricing ${s.journey.exposure.pricing.toLowerCase()}.`,
  ];
  return parts.join(" ");
}

function risk(s: Snapshot): string[] {
  const r: string[] = [];
  if (s.metrics.overdueCount) r.push(`${s.metrics.overdueCount} overdue task${s.metrics.overdueCount === 1 ? "" : "s"}`);
  if (s.metrics.band === "RED" || s.metrics.band === "AMBER") r.push(`Day-15 ${s.metrics.band}`);
  for (const g of s.journey.gates) if (g.status === "FAILED" || g.status === "BLOCKED") r.push(`${g.name} ${g.status.toLowerCase()}`);
  return r;
}

function supportPlan(s: Snapshot, role: StaffRole): string {
  const out: string[] = [status(s)];
  const weak = Object.entries(s.day15Pillars ?? {}).filter(([, v]) => v < s.config.greenThreshold).map(([p, v]) => `${PILLAR_LABEL[p as Pillar]} ${v}%`);
  const overdue = s.journey.tasks.filter((t) => t.overdue && t.owner_role === "KAM").slice(0, 4).map((t) => `${t.title} (Day ${t.due_day})`);
  const waiting = pendingFor(s, role).map((p) => p.label);
  if (weak.length) out.push(`Weak pillars: ${weak.join(", ")}.`);
  if (overdue.length) out.push(`Overdue: ${overdue.join("; ")}.`);
  const actions: string[] = [];
  if (waiting.length) actions.push(`clear what is waiting on you — ${waiting.join("; ")}`);
  if (role === "MENTOR") {
    if (weak.length) actions.push(`run a short coaching session on ${weak.map((w) => w.split(" ")[0]).join(" and ")}, and record it with the Feedback form`);
    if (overdue.length) actions.push("agree a catch-up plan for the overdue items in the support chat or a session");
    actions.push("check the KAM's Messages thread for open questions");
  } else if (role === "REPORTING_BOSS") {
    if (s.metrics.band === "RED") actions.push("review the remediation plan and decide on the proposed extension");
    if (weak.length || overdue.length) actions.push("record development actions so expectations are explicit");
    actions.push("keep pricing and customer-ownership decisions tied to the gates and evidence");
  } else {
    if (!s.employee.mentor_id) actions.push("assign a Mentor in Employees");
    if (overdue.length) actions.push("check whether sessions are scheduled and the Mentor is engaged");
    actions.push("reply in the support chat if the KAM has asked anything");
  }
  out.push(`Suggested next steps: ${actions.map((a, i) => `(${i + 1}) ${a}`).join(" ")}.`);
  return out.join("\n\n");
}

async function knowledge(ctx: ActionContext, role: StaffRole, question: string, history: string): Promise<Draft> {
  const cfg = await getConfig(ctx.admin);
  const r = await retrieve(ctx.db, question, { topK: cfg.ragTopK, minSimilarity: cfg.ragMinSimilarity });
  if (!r.sufficient || !r.passages.length) {
    return { text: "I couldn't find this in our approved documents, so I'd rather not guess. Try naming the process or policy — or ask me about a KAM, what's waiting on you, or how to do something in the app.", grounding: "INSUFFICIENT", links: [{ label: "Browse knowledge", href: "/knowledge" }], citations: [], model: null };
  }
  const citations = toCitations(r.passages);
  const block = citations.map((c, i) => `[${c.tag}] ${formatCitation(c)}\n${r.passages[i].content}`).join("\n\n");
  const llm = await mistralChat([
    { role: "system", content: renderPrompt("system") },
    { role: "user", content: renderPrompt("grounded_answer", { intent: "STAFF_KNOWLEDGE", day: "-", duration: cfg.duration, employee_name: ctx.actor.name, role, state: `The person asking is a ${role.replace("_", " ").toLowerCase()} supporting KAMs in onboarding, not a KAM.`, passages: block, history: history || "(none)", question }) },
  ]);
  if (llm) {
    const v = validateCitations(llm.text, citations);
    if (v.used.length) return { text: v.text, grounding: "COMPANY_KNOWLEDGE", links: [], citations: v.used, model: llm.model, suggestions: relatedQuestions(r.passages.slice(2).map((p) => p.section), question) };
  }
  const top = r.passages.slice(0, 2).map((p, i) => `${focusedExcerpt(p.content, question)} [${citations[i].tag}]`);
  return { text: `${sourceLead(r.passages[0].document_name)}\n\n${top.join("\n\n")}`, grounding: "COMPANY_KNOWLEDGE", links: [], citations: citations.slice(0, 2), model: null, suggestions: relatedQuestions(r.passages.slice(2).map((p) => p.section), question) };
}

export async function handleStaffMessage(ctx: ActionContext, message: string, history: { role: "user" | "assistant"; text: string }[] = []): Promise<StaffReply> {
  const role = ctx.actor.role as StaffRole;
  if (!STAFF.includes(role)) throw new ServiceError("Ask Compass is for Mentors, Reporting Bosses and HR.");
  const rl = await assistantLimiter.take(`staff-ai:${ctx.actor.id}`);
  if (!rl.ok) throw new ServiceError(`You're sending messages quickly — try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.`);

  const { data: kams } = await ctx.db.from("employees").select("id, full_name").eq("status", "ACTIVE");
  const kam = matchKam(message, kams ?? []);
  const intent = classify(message, role, !!kam);
  const hist = history.slice(-6).map((h) => `${h.role === "user" ? "Staff" : "Assistant"}: ${h.text.slice(0, 300)}`).join("\n");
  let reply: Draft;

  switch (intent) {
    case "DECISION_GUARD": {
      const play = matchPlaybook(message, role);
      reply = {
        text: `I can't make approvals, certifications, deferrals or sign-offs — those are human decisions recorded and audited under your name.${play ? `\n\nHere is how to do it yourself — ${play.title}:\n${play.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}` : ""}`,
        grounding: "GUARDRAIL", links: play ? [play.link(kam?.id ?? null)] : [], citations: [], model: null,
      };
      break;
    }
    case "HOW_TO": {
      const play = matchPlaybook(message, role)!;
      reply = { text: `${play.title}:\n${play.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`, grounding: "APP_GUIDE", links: [play.link(kam?.id ?? null)], citations: [], model: null };
      break;
    }
    case "SUPPORT_KAM":
    case "KAM_STATUS": {
      const snap = await loadSnapshot(ctx.db, kam!.id);
      reply = {
        text: intent === "SUPPORT_KAM" ? supportPlan(snap, role) : `${status(snap)}${pendingFor(snap, role).length ? `\n\nWaiting on you: ${pendingFor(snap, role).map((p) => p.label).join("; ")}.` : ""}`,
        grounding: "COHORT_STATE",
        links: [profileLink(snap), ...(role !== "REPORTING_BOSS" ? [{ label: "Message thread", href: `/messages?kam=${snap.employee.id}` }] : [])],
        citations: [], model: null,
      };
      break;
    }
    case "PENDING": {
      const cohort = await loadCohort(ctx.db);
      const items = Array.from(new Map(cohort.flatMap((s) => pendingFor(s, role).map((p) => [`${s.employee.id}|${p.label}`, { s, label: p.label }] as const))).values());
      reply = {
        text: items.length ? `${items.length} item${items.length === 1 ? "" : "s"} waiting on you:\n${items.map((x) => `• ${x.s.employee.full_name} — ${x.label}`).join("\n")}` : "Nothing is waiting on you right now.",
        grounding: "COHORT_STATE", links: Array.from(new Map(items.map((x) => [x.s.employee.id, profileLink(x.s)])).values()).slice(0, 4), citations: [], model: null,
      };
      break;
    }
    case "AT_RISK": {
      const cohort = await loadCohort(ctx.db);
      const flagged = cohort.map((s) => ({ s, r: risk(s) })).filter((x) => x.r.length).sort((a, b) => b.r.length - a.r.length);
      reply = {
        text: flagged.length ? `${flagged.length} of ${cohort.length} KAM${cohort.length === 1 ? "" : "s"} need attention:\n${flagged.map((x) => `• ${x.s.employee.full_name} (Day ${Math.max(x.s.day, 0)}) — ${x.r.join(", ")}`).join("\n")}` : `Good news — none of your ${cohort.length} KAMs is flagged: no overdue work, Amber/Red results or blocked gates.`,
        suggestions: flagged.slice(0, 3).map((x) => `How can I support ${firstNameOf(x.s.employee.full_name)}?`),
        grounding: "COHORT_STATE", links: flagged.slice(0, 4).map((x) => profileLink(x.s)), citations: [], model: null,
      };
      break;
    }
    case "COHORT": {
      const cohort = await loadCohort(ctx.db);
      const n = cohort.length;
      const avg = n ? Math.round((cohort.reduce((a, s) => a + s.metrics.overallReadiness, 0) / n) * 10) / 10 : 0;
      const phase = (p: string) => cohort.filter((s) => phaseLabel(s.journey.phase) === p).length;
      const gate = (c: string) => cohort.filter((s) => ["PASSED", "APPROVED"].includes(s.journey.gates.find((g) => g.code === c)?.status ?? "")).length;
      const phases = Array.from(new Set(cohort.map((s) => phaseLabel(s.journey.phase)))).map((p) => `${p} ${phase(p)}`).join(", ");
      reply = {
        text: n ? `${n} active KAM${n === 1 ? "" : "s"}, average readiness ${avg}%. Phases: ${phases}. Gates cleared — Day 15: ${gate("G1")}, Day 21: ${gate("G2")}, Day 30: ${gate("G3")}. Overdue tasks: ${cohort.reduce((a, s) => a + s.metrics.overdueCount, 0)}. Flagged for attention: ${cohort.filter((s) => risk(s).length).length}.` : "You have no active KAMs.",
        grounding: "COHORT_STATE", links: [{ label: "Dashboard", href: role === "HR_ADMIN" ? "/hr" : role === "MENTOR" ? "/mentor" : "/manager" }], citations: [], model: null,
      };
      break;
    }
    case "MESSAGES": {
      const inbox = (await chatEnabled(ctx.admin)) ? await chatInbox(ctx) : [];
      const unread = inbox.filter((r) => r.unread);
      reply = {
        text: unread.length ? `Unread support messages from ${unread.length} KAM${unread.length === 1 ? "" : "s"}:\n${unread.map((r) => `• ${r.name} — ${r.unread} unread: "${(r.lastMessage?.body ?? "").slice(0, 90)}"`).join("\n")}` : "No unread support messages.",
        grounding: "COHORT_STATE", links: [{ label: "Open Messages", href: unread[0] ? `/messages?kam=${unread[0].employeeId}` : "/messages" }], citations: [], model: null,
      };
      break;
    }
    case "HELP":
      reply = { text: helpText(role), grounding: "GENERAL", links: [], citations: [], model: null };
      break;
    default:
      reply = await knowledge(ctx, role, message, hist);
  }

  // Warm, suggestive voice around the grounded content (facts untouched).
  const suggestions = reply.suggestions?.length ? reply.suggestions : followUps(intent, role, message, kam?.full_name ?? null);
  const tone: ToneKind = reply.grounding === "INSUFFICIENT" ? "INSUFFICIENT" : reply.grounding === "COMPANY_KNOWLEDGE" ? "KNOWLEDGE" : reply.grounding === "GUARDRAIL" ? "GUARD" : reply.grounding === "APP_GUIDE" ? "ACTION" : "STATE";
  const text = reply.model ? reply.text : warmText(reply.text, { kind: tone, intent: tone === "KNOWLEDGE" || tone === "INSUFFICIENT" ? tone : intent, firstName: firstNameOf(ctx.actor.name), seed: message, hasSuggestions: suggestions.length > 0 });

  await audit(ctx.admin, { employeeId: kam?.id ?? null, actor: ctx.actor, event: "STAFF_ASSISTANT_QUERY", entityType: "assistant", next: { intent, grounding: reply.grounding } });
  return { ...reply, text, suggestions, intent };
}
