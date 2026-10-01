import "server-only";
import { routeIntent } from "./intent/router";
import { INTENT_GROUNDING, type Intent } from "./intent/intents";
import { retrieve, validateCitations, formatCitation, toCitations, type Citation, type Hit } from "./rag/retrieve";
import { mistralChat } from "./llm/mistral";
import { renderPrompt } from "./prompts";
import { loadSnapshot, type Snapshot } from "@/lib/services/snapshot";
import { audit } from "@/lib/services/audit";
import { ServiceError, type ActionContext } from "@/lib/services/context";
import { assistantLimiter } from "@/lib/security/rate-limit";
import { phaseLabel } from "@/lib/report/build";
import { PILLAR_LABEL, type Pillar } from "@/types/domain";

export type Grounding = "COMPANY_KNOWLEDGE" | "EMPLOYEE_STATE" | "GENERAL" | "INSUFFICIENT" | "OUT_OF_SCOPE";

export interface AssistantAction {
  kind: "link" | "complete_task" | "ask_mentor" | "ask_manager";
  label: string;
  href?: string;
  taskId?: string;
}

export interface AssistantReply {
  sessionId: string;
  messageId: string;
  text: string;
  intent: Intent;
  intentSource: string;
  confidence: number;
  grounding: Grounding;
  citations: Citation[];
  actions: AssistantAction[];
  model: string | null;
}

const ASK_MENTOR: AssistantAction = { kind: "ask_mentor", label: "Ask Mentor" };

function numbersIn(s: string) { return (s.match(/\d+(\.\d+)?/g) ?? []); }

/** Lets the LLM phrase deterministic facts — but only if it preserves every number. */
async function phraseFacts(snap: Snapshot, intent: Intent, facts: string, question: string): Promise<{ text: string; model: string | null }> {
  const res = await mistralChat([
    { role: "system", content: renderPrompt("system") },
    { role: "user", content: renderPrompt("state_answer", { intent, employee_name: snap.employee.full_name, day: snap.day, duration: snap.config.duration, facts, question }) },
  ], { maxTokens: 250 });
  if (!res) return { text: facts, model: null };
  const missing = numbersIn(facts).filter((n) => !res.text.includes(n));
  return missing.length ? { text: facts, model: null } : { text: res.text, model: res.model };
}

function stateFacts(snap: Snapshot, intent: Intent): { facts: string; actions: AssistantAction[] } {
  const j = snap.journey;
  const m = snap.metrics;
  const today = j.tasks.filter((t) => t.day_number === snap.day && t.is_mandatory && t.owner_role === "KAM");
  const todayDone = today.filter((t) => t.availability === "DONE").length;
  const na = snap.nextAction;
  const gate = j.currentGate;
  const gateWhen = gate ? (gate.day - snap.day === 1 ? "due tomorrow" : gate.day - snap.day === 0 ? "due today" : gate.day > snap.day ? `due on Day ${gate.day}` : `was due on Day ${gate.day}`) : "";
  const nextTask = j.tasks.find((t) => t.id === na.taskId);
  const actions: AssistantAction[] = [];
  if (na.kind !== "DONE") actions.push({ kind: "link", label: na.kind === "ASSESSMENT" ? "Open assessment" : na.kind === "SCENARIO" ? "Open scenario" : "Open task", href: na.link });
  if (nextTask) actions.push({ kind: "link", label: "View module", href: `/knowledge?day=${nextTask.day_number}` });
  actions.push(ASK_MENTOR);

  switch (intent) {
    case "PROGRESS":
      return { facts: `You are on Day ${snap.day} of ${snap.config.duration} (${phaseLabel(j.phase)}). Overall readiness is ${m.overallReadiness}%: ${m.taskCompletionPct}% of mandatory tasks complete, ${m.gatesCleared} of ${m.gatesTotal} gates cleared${m.knowledgeScore !== null ? `, knowledge score ${m.knowledgeScore}%` : ""}${m.scenarioScore !== null ? `, scenario score ${m.scenarioScore}%` : ""}.${m.overdueCount ? ` ${m.overdueCount} task${m.overdueCount === 1 ? " is" : "s are"} overdue.` : ""}`, actions: [{ kind: "link", label: "View progress report", href: "/report" }, ...actions] };
    case "GATE_STATUS": {
      const lines = j.gates.map((g) => `${g.code} ${g.name} (Day ${g.day}): ${g.status.replace(/_/g, " ").toLowerCase()}${g.score !== null ? ` — ${g.score}%` : ""}.`);
      return { facts: `${lines.join(" ")} ${gate ? `Current gate: ${gate.name} — ${gate.nextAction}.` : "All gates are cleared."}`, actions: [{ kind: "link", label: "Open journey", href: "/journey" }, ASK_MENTOR] };
    }
    case "READINESS": {
      const band = m.band ? `Your latest Day-15 band is ${m.band} (${m.assessmentScore}%).` : "You have not taken the Day-15 assessment yet.";
      return { facts: `${band} Customer exposure: ${j.exposure.customer.toLowerCase()}. Pricing exposure: ${j.exposure.pricing.toLowerCase()}. Readiness for independent handling is decided by your Reporting Boss at the Day-30 panel — it is never automatic.`, actions: [{ kind: "link", label: "Open journey", href: "/journey" }, ASK_MENTOR] };
    }
    case "ASSESSMENT": {
      const d10 = j.day10Available.available ? "The Day-10 knowledge check is available." : `Day-10 check: ${j.day10Available.reason}.`;
      const d15 = j.day15Available.available ? `The Day-15 ${j.day15Available.isRecheck ? "re-check" : "assessment"} is available.` : `Day-15 assessment: ${j.day15Available.reason}.`;
      return { facts: `${d10} ${d15}${m.assessmentScore !== null ? ` Latest Day-15 score: ${m.assessmentScore}% (${m.band}).` : ""}`, actions: [{ kind: "link", label: "Open assessments", href: "/assessments" }] };
    }
    case "SCENARIO":
      return { facts: `${j.certificationAvailable.available ? "Day-21 scenario certification is available." : `Day-21 certification: ${j.certificationAvailable.reason}.`} Practice scenarios are open at any time.${m.scenarioScore !== null ? ` Certification score so far: ${m.scenarioScore}%.` : ""}`, actions: [{ kind: "link", label: "Open scenario practice", href: "/scenarios" }] };
    case "ACCOUNT_BRIEF": {
      const t = j.tasks.find((x) => x.action_ref === "brief:SUBMIT");
      const r = j.tasks.find((x) => x.action_ref === "review:ACCOUNT_BRIEF");
      return { facts: `Account brief: ${t?.availability === "DONE" ? "submitted" : "not yet submitted"}; mentor review: ${r?.availability === "DONE" ? "approved" : "pending"}.${t?.reason ? ` ${t.reason}.` : ""}`, actions: [{ kind: "link", label: "Open account brief", href: "/account-brief" }] };
    }
    case "FEEDBACK": {
      const f = snap.feedback.slice(0, 2);
      return { facts: f.length ? f.map((x) => `${x.author_name ?? x.author_role.replace("_", " ")} (${x.created_at.slice(0, 10)}): ${x.content}`).join(" ") : "No feedback has been recorded yet.", actions: [{ kind: "link", label: "Open progress report", href: "/report" }] };
    }
    default: {
      const lead = today.length ? `You have completed ${todayDone} of today's ${today.length} required activities.` : `There are no required activities scheduled for Day ${snap.day}.`;
      const next = na.kind === "DONE" ? "All gates are cleared." : na.kind === "WAIT" ? `Next: ${na.title} — ${na.detail}.` : `Next: ${na.title} (Day ${nextTask?.day_number ?? snap.day}).`;
      const gateLine = gate ? ` Your ${gate.code === "G5" ? "Day-30 panel" : `Day-${gate.day} gate`} is ${gateWhen}.` : "";
      return { facts: `${lead} ${next}${gateLine}${m.overdueCount ? ` ${m.overdueCount} task${m.overdueCount === 1 ? " is" : "s are"} overdue.` : ""}`, actions };
    }
  }
}

function tokens(s: string) { return new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2)); }

function matchTask(snap: Snapshot, message: string) {
  const q = tokens(message);
  let best: { id: string; title: string; score: number } | null = null;
  for (const t of snap.journey.tasks.filter((x) => x.owner_role === "KAM" && !x.systemDriven && (x.availability === "AVAILABLE"))) {
    const tt = tokens(t.title);
    const score = [...tt].filter((w) => q.has(w)).length / Math.max(1, tt.size);
    if (score > (best?.score ?? 0.34)) best = { id: t.id, title: t.title, score };
  }
  return best;
}

async function approvedBriefHit(ctx: ActionContext, employeeId: string): Promise<Hit | null> {
  const { data: b } = await ctx.db.from("account_briefs").select("*").eq("employee_id", employeeId).eq("approved", true).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!b) return null;
  const fields: [string, string][] = [["Organisation", b.customer_organization], ["Strategic context", b.strategic_context], ["Supplied parts", b.supplied_parts], ["Applications", b.applications], ["Programmes", b.programmes], ["Volumes", b.volumes], ["Pipeline", b.pipeline], ["Pricing history", b.pricing_history], ["Commercial history", b.commercial_history], ["Open commitments", b.open_commitments], ["Past issues", b.past_issues], ["Lessons learned", b.lessons_learned]];
  return {
    id: `brief-${b.id}`, document_id: b.id, content: fields.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n"), section: null, page: null,
    document_name: `Account brief — ${b.customer_name} (mentor-approved)`, category: "Account", topic: b.customer_name, version: String(b.version),
    owner: "KAM / Mentor", effective_date: (b.reviewed_at ?? b.updated_at)?.slice(0, 10) ?? null, source_url: "/account-brief", last_updated: b.updated_at,
  };
}

async function knowledgeAnswer(ctx: ActionContext, snap: Snapshot, intent: Intent, question: string, history: string, opts: { categories?: string[]; extra?: Hit | null } = {}) {
  const r = await retrieve(ctx.db, question, { topK: snap.config.ragTopK, minSimilarity: snap.config.ragMinSimilarity, categories: opts.categories });
  let passages: Hit[] = r.passages;
  let sufficient = r.sufficient;
  if (opts.extra) {
    passages = [opts.extra, ...passages].slice(0, snap.config.ragTopK);
    sufficient = sufficient || true;
  }
  const citations = toCitations(passages);
  if (!sufficient || !passages.length) {
    return {
      text: "I couldn't find enough evidence in the approved FirstGear knowledge base to answer that reliably, so I won't guess. Your Mentor can help — or try rephrasing with the process or document name.",
      grounding: "INSUFFICIENT" as Grounding, citations: [] as Citation[], model: null as string | null,
    };
  }
  const block = citations.map((c, i) => `[${c.tag}] ${formatCitation(c)}\n${passages[i].content}`).join("\n\n");
  const stateBlock = `Day ${snap.day} of ${snap.config.duration}; phase ${phaseLabel(snap.journey.phase)}; pricing exposure ${snap.journey.exposure.pricing}; customer exposure ${snap.journey.exposure.customer}.`;
  const llm = await mistralChat([
    { role: "system", content: renderPrompt("system") },
    { role: "user", content: renderPrompt("grounded_answer", { intent, day: snap.day, duration: snap.config.duration, employee_name: snap.employee.full_name, role: "KAM", state: stateBlock, passages: block, history: history || "(none)", question }) },
  ]);
  if (llm) {
    const v = validateCitations(llm.text, citations);
    if (v.used.length) return { text: v.text, grounding: "COMPANY_KNOWLEDGE" as Grounding, citations: v.used, model: llm.model };
    // The model answered without citing — fall through to the extractive answer rather than show an unsourced claim.
  }
  // Extractive fallback: quote the best passages directly, each with its tag.
  const top = passages.slice(0, 2).map((p, i) => {
    const body = p.content.replace(/^[^\n]*\n/, "").replace(/\s+/g, " ").trim();
    return `${body.length > 600 ? body.slice(0, 600).replace(/\s\S*$/, "") + " …" : body} [${citations[i].tag}]`;
  });
  return { text: `From the approved sources:\n\n${top.join("\n\n")}`, grounding: "COMPANY_KNOWLEDGE" as Grounding, citations: citations.slice(0, 2), model: null };
}

export async function handleAssistantMessage(ctx: ActionContext, message: string, sessionId?: string): Promise<AssistantReply> {
  if (ctx.actor.role !== "KAM" || !ctx.employeeId) throw new ServiceError("The onboarding assistant is available to KAMs.");
  const rl = await assistantLimiter.take(`ai:${ctx.actor.id}`);
  if (!rl.ok) throw new ServiceError(`You're sending messages quickly — try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.`);
  const employeeId = ctx.employeeId;
  const snap = await loadSnapshot(ctx.db, employeeId);

  let sid = sessionId;
  if (sid) {
    const { data } = await ctx.db.from("conversation_sessions").select("id").eq("id", sid).maybeSingle();
    if (!data) sid = undefined;
  }
  if (!sid) {
    const { data, error } = await ctx.db.from("conversation_sessions").insert({ employee_id: employeeId, user_id: ctx.actor.id, title: message.slice(0, 60) }).select("id").single();
    if (error || !data) throw new ServiceError("Could not start a conversation.");
    sid = data.id as string;
  }
  const { data: prior } = await ctx.db.from("conversation_messages").select("role, content").eq("session_id", sid).order("created_at", { ascending: false }).limit(6);
  const history = (prior ?? []).reverse().map((m) => `${m.role === "user" ? "KAM" : "Assistant"}: ${m.content.slice(0, 300)}`).join("\n");

  const routed = await routeIntent(message);
  await ctx.admin.from("conversation_messages").insert({ session_id: sid, employee_id: employeeId, role: "user", content: message, intent: routed.intent, intent_confidence: routed.confidence, intent_source: routed.source });

  let text: string;
  let grounding: Grounding;
  let citations: Citation[] = [];
  let actions: AssistantAction[] = [];
  let model: string | null = null;

  if (routed.guard === "OUT_OF_SCOPE_IT") {
    text = "I can't create accounts, grant system access or change permissions — that's handled by the IT service desk, outside the onboarding programme. Please raise a request with IT (your Reporting Boss can approve access if needed). I can help with your onboarding tasks, products, processes and policies.";
    grounding = "OUT_OF_SCOPE";
    actions = [{ kind: "ask_manager", label: "Ask Reporting Boss" }];
  } else if (routed.guard === "PRICING_AUTHORITY") {
    const k = await knowledgeAnswer(ctx, snap, "KNOWLEDGE_SEARCH", "approval authority for pricing, discounts and payment terms", history, { categories: ["Governance", "Sales"] });
    const exposure = snap.journey.exposure.pricing === "GUIDED" ? "You are in guided pricing exposure, which means positions are prepared by you and decided jointly with your Reporting Boss." : "Pricing exposure is currently blocked for you — this is knowledge-only until your gates and Reporting Boss approval are in place.";
    text = `I can't approve or recommend a price, discount or payment term — those are human decisions under the approval authority matrix. ${exposure}${k.grounding === "COMPANY_KNOWLEDGE" ? `\n\nFor learning purposes:\n\n${k.text}` : ""}`;
    grounding = k.grounding === "COMPANY_KNOWLEDGE" ? "COMPANY_KNOWLEDGE" : "GENERAL";
    citations = k.citations;
    model = k.model;
    actions = [{ kind: "ask_manager", label: "Ask Reporting Boss" }, ASK_MENTOR];
  } else {
    const kind = INTENT_GROUNDING[routed.intent];
    if (kind === "KNOWLEDGE") {
      const k = await knowledgeAnswer(ctx, snap, routed.intent, message, history);
      ({ text, grounding, citations, model } = k);
      actions = k.grounding === "INSUFFICIENT" ? [ASK_MENTOR] : [{ kind: "link", label: "Browse knowledge", href: "/knowledge" }];
    } else if (kind === "ACCOUNT") {
      const brief = await approvedBriefHit(ctx, employeeId);
      const k = await knowledgeAnswer(ctx, snap, routed.intent, message, history, { categories: ["Account", "Customers"], extra: brief });
      ({ text, grounding, citations, model } = k);
      actions = [{ kind: "link", label: "Open Customer 360", href: "/customer-360" }, ...(k.grounding === "INSUFFICIENT" ? [ASK_MENTOR] : [])];
    } else if (routed.intent === "TASK_COMPLETE") {
      const t = matchTask(snap, message);
      text = t ? `Do you want me to mark "${t.title}" as complete? I'll record it against your journey and update your progress.` : "I couldn't match that to an open task of yours. Open your journey to tick it off, or tell me the task name.";
      grounding = "EMPLOYEE_STATE";
      actions = t ? [{ kind: "complete_task", label: `Mark "${t.title}" complete`, taskId: t.id }, { kind: "link", label: "Open journey", href: "/journey" }] : [{ kind: "link", label: "Open journey", href: "/journey" }];
    } else if (routed.intent === "SCHEDULE" || routed.intent === "RESCHEDULE") {
      const up = snap.sessions.filter((s) => !["CANCELLED", "COMPLETED"].includes(s.status)).slice(0, 3);
      const list = up.map((s) => `${s.title} — ${new Date(s.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.APP_TIMEZONE || "Asia/Kolkata" })}`).join("; ");
      text = `${up.length ? `Your upcoming sessions: ${list}.` : "You have no upcoming sessions."} ${routed.intent === "RESCHEDULE" ? "You can reschedule from the Sessions page; your mentor is notified automatically." : "You can schedule a session from the Sessions page."}`;
      grounding = "EMPLOYEE_STATE";
      actions = [{ kind: "link", label: routed.intent === "RESCHEDULE" ? "Reschedule a session" : "Schedule a session", href: "/sessions" }];
    } else if (routed.intent === "MENTOR_REQUEST" || routed.intent === "MANAGER_REQUEST") {
      const who = routed.intent === "MENTOR_REQUEST" ? snap.people.mentor?.full_name ?? "your Mentor" : snap.people.boss?.full_name ?? "your Reporting Boss";
      text = `I can send ${who} a request with your question and current context. Use the button below to confirm.`;
      grounding = "EMPLOYEE_STATE";
      actions = [routed.intent === "MENTOR_REQUEST" ? ASK_MENTOR : { kind: "ask_manager", label: "Ask Reporting Boss" }];
    } else {
      const f = stateFacts(snap, routed.intent);
      const p = await phraseFacts(snap, routed.intent, f.facts, message);
      text = p.text;
      model = p.model;
      grounding = "EMPLOYEE_STATE";
      actions = f.actions;
    }
  }

  const { data: saved } = await ctx.admin.from("conversation_messages").insert({
    session_id: sid, employee_id: employeeId, role: "assistant", content: text, intent: routed.intent, intent_confidence: routed.confidence,
    intent_source: routed.source, grounding, citations, actions, model,
  }).select("id").single();
  await ctx.admin.from("conversation_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sid);
  if (grounding === "INSUFFICIENT" || grounding === "OUT_OF_SCOPE") {
    await audit(ctx.admin, { employeeId, actor: ctx.actor, event: "AI_ESCALATION", entityType: "conversation_message", entityId: saved?.id ?? null, next: { intent: routed.intent, grounding } });
  }
  return { sessionId: sid, messageId: saved?.id ?? "", text, intent: routed.intent, intentSource: routed.source, confidence: routed.confidence, grounding, citations, actions, model };
}

/** "Ask Mentor / Ask Reporting Boss" — notifies the human and records a dependency event. */
export async function escalateToHuman(ctx: ActionContext, target: "MENTOR" | "REPORTING_BOSS", question: string) {
  if (ctx.actor.role !== "KAM" || !ctx.employeeId) throw new ServiceError("Only KAMs can raise requests from the assistant.");
  const snap = await loadSnapshot(ctx.db, ctx.employeeId);
  const recipient = target === "MENTOR" ? snap.employee.mentor_id : snap.employee.reporting_boss_id;
  if (!recipient) throw new ServiceError(`No ${target === "MENTOR" ? "Mentor" : "Reporting Boss"} is assigned yet — contact HR.`);
  const { notifyOne } = await import("@/lib/notifications/service");
  await notifyOne(ctx.admin, { recipientId: recipient, employeeId: ctx.employeeId, type: "KAM_REQUEST", severity: "ATTENTION", title: `${snap.employee.full_name} is asking for help`, body: question.slice(0, 400), link: `/people/${ctx.employeeId}`, dedupeKey: `${ctx.employeeId}:ask-${Date.now()}` });
  await ctx.admin.from("support_events").insert({ employee_id: ctx.employeeId, instance_id: snap.instance.id, event_type: target === "MENTOR" ? "MENTOR_HELP" : "ESCALATION", day_number: Math.max(1, snap.day), description: question.slice(0, 500), recorded_by: ctx.actor.id });
  await audit(ctx.admin, { employeeId: ctx.employeeId, actor: ctx.actor, event: "AI_ESCALATION", entityType: "support_event", next: { target, question: question.slice(0, 200) } });
  return { sentTo: target === "MENTOR" ? snap.people.mentor?.full_name ?? "Mentor" : snap.people.boss?.full_name ?? "Reporting Boss" };
}

export function pillarName(p: string) { return PILLAR_LABEL[p as Pillar] ?? p; }
