/**
 * Voice of Ask FirstGear and Ask Compass: friendly, warm and suggestive —
 * without changing a single fact. These helpers only add a short personal
 * opener, a gentle next-step suggestion and follow-up questions around the
 * grounded content; numbers, policy text and citations are never rewritten.
 * Phrasing is picked deterministically from the message, so the same
 * question gets the same wording.
 */

export type ToneKind = "KNOWLEDGE" | "STATE" | "INSUFFICIENT" | "OUT_OF_SCOPE" | "PRICING" | "ACTION" | "GUARD";

function seedOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
const pick = <T,>(xs: T[], seed: string): T => xs[seedOf(seed) % xs.length];

export function firstNameOf(fullName: string | null | undefined): string {
  return (fullName ?? "").trim().split(/\s+/)[0] ?? "";
}

const OPENERS: Record<ToneKind, string[]> = {
  KNOWLEDGE: ["Good question, {name}!", "Happy to help, {name}.", "Sure thing, {name} — here's what I found.", "Glad you asked, {name}."],
  STATE: ["Here's where things stand, {name}.", "Let's take a look, {name}.", "Here's your latest picture, {name}."],
  INSUFFICIENT: ["Thanks for asking, {name}.", "Good one, {name} — let me be straight with you."],
  OUT_OF_SCOPE: ["I'd love to help with that, {name}, but it's outside what I can do."],
  PRICING: ["Great that you're thinking about pricing, {name} — let me help you prepare."],
  ACTION: ["Of course, {name}."],
  GUARD: ["Happy to point you in the right direction, {name}."],
};

/** A short, personal opener. Empty name → the opener still reads naturally. */
export function opener(kind: ToneKind, firstName: string, seed: string): string {
  const line = pick(OPENERS[kind], seed);
  return firstName ? line.replace("{name}", firstName) : line.replace(/,? \{name\}/, "");
}

const CLOSERS: Record<string, string[]> = {
  KNOWLEDGE: ["Would you like to explore anything related? A few ideas are below.", "Anything else you'd like to check? Here are some related questions.", "Happy to dig deeper — just pick a question below or ask your own."],
  KNOWLEDGE_NONE: ["Anything else I can help you with?", "Is there anything else you'd like to know?"],
  PROGRESS: ["You're building a solid foundation — keep going! Want to see your next step?", "Nice momentum. Shall we look at what's next?"],
  PROGRESS_BEHIND: ["No pressure — let's catch up one step at a time. Shall I show you the next one?", "You can catch up quickly — the training player takes you through each step. Want to start with the next one?"],
  TASK_STATUS: ["Shall I open it for you? I'm right here if you get stuck along the way.", "You've got this — open it whenever you're ready, and ask me anything as you go."],
  GATE_STATUS: ["If any requirement is unclear, just ask — or your Mentor is a message away.", "One step at a time — I can explain any of these requirements."],
  READINESS: ["Every completed step counts towards it. Want me to show what to focus on next?"],
  ASSESSMENT: ["Tip: a quick look at the related FAQs before you start really helps. Good luck!", "You can practise first if you like — and I'm here for any last-minute questions."],
  SCENARIO: ["Practice scenarios are a great warm-up — try one whenever you like."],
  ACCOUNT_BRIEF: ["Need a hand with any section? Ask me about the customer or the brief format."],
  FEEDBACK: ["Feedback is a gift — want ideas on how to act on it?"],
  SCHEDULE: ["Want help preparing for the session?"],
  INSUFFICIENT: ["Your Mentor will know — tap “Ask Mentor” and I'll pass your question on. You could also try naming the policy or process."],
  OUT_OF_SCOPE: ["Your Reporting Boss can approve access if needed. In the meantime, I'm happy to help with your onboarding, products, processes or policies."],
  PRICING: ["When you're ready, your Reporting Boss is the right person to decide — I can help you prepare the facts."],
  // Ask Compass (staff)
  PENDING: ["Want to start with the first one? The links below take you straight there.", "Clearing these keeps your KAMs moving — the links below open each one."],
  AT_RISK: ["Pick a name below and I'll suggest a support plan.", "Want a plan for any of them? Just tap a suggestion below."],
  COHORT: ["Want me to dig into who needs attention?", "Shall I show who is at risk, or what's waiting on you?"],
  KAM_STATUS: ["Would a short support plan help? Ask me below.", "Want ideas on how to help them move forward?"],
  SUPPORT_KAM: ["A quick check-in usually goes a long way — the links below help you act on it.", "Small, timely nudges make a big difference. Shall I show how to record coaching feedback?"],
  HOW_TO: ["The link below takes you to the right screen. Anything else you'd like a hand with?", "Shout if any step looks different on your screen — happy to help."],
  DECISION_GUARD: ["The decision stays with you — I'm happy to pull together the facts first."],
  MESSAGES: ["Replying early keeps new KAMs confident — the link below opens the thread."],
  HELP: ["Try one of the suggestions below to get started."],
  DEFAULT: ["Anything else I can help you with?"],
};

/** A gentle, suggestive closing line matched to what was asked. */
export function closer(kind: ToneKind, intent: string, seed: string, hasSuggestions = false): string {
  if (kind === "KNOWLEDGE") return pick(hasSuggestions ? CLOSERS.KNOWLEDGE : CLOSERS.KNOWLEDGE_NONE, seed);
  if (kind === "INSUFFICIENT" || kind === "OUT_OF_SCOPE" || kind === "PRICING") return pick(CLOSERS[kind], seed);
  return pick(CLOSERS[intent] ?? CLOSERS.DEFAULT, seed);
}

/** "Here's what the Leave Policy says:" — a friendly lead-in for quoted passages. */
export function sourceLead(documentName: string | null | undefined): string {
  const name = (documentName ?? "").replace(/^(Policy FAQ|KAM FAQ)\s+—\s+/, "").trim();
  return name ? `Here's what the ${name} says:` : "Here's what our approved documents say:";
}

/** Follow-up questions taken from the other FAQ entries that retrieval found. */
export function relatedQuestions(sections: (string | null | undefined)[], asked: string, max = 3): string[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const seen = new Set([norm(asked)]);
  const out: string[] = [];
  for (const s of sections) {
    if (!s || !s.startsWith("Q:")) continue;
    const q = s.slice(2).trim();
    if (seen.has(norm(q))) continue;
    seen.add(norm(q));
    out.push(q);
    if (out.length >= max) break;
  }
  return out;
}

const STATE_SUGGESTIONS: Record<string, string[]> = {
  PROGRESS: ["What should I do next?", "Why is Day 16 locked?", "How is the Day-15 assessment scored?"],
  TASK_STATUS: ["How am I progressing?", "What happens at the Day-15 gate?", "Who do I contact about the Leave Policy?"],
  GATE_STATUS: ["What should I do next?", "What do Green, Amber and Red mean?", "How do I score well on the scenarios?"],
  READINESS: ["What should I do next?", "When can I take part in pricing discussions?", "How is the Day-15 assessment scored?"],
  ASSESSMENT: ["How is the Day-15 assessment scored?", "What is the interim knowledge check and what happens if I fail it?", "What should I do next?"],
  SCENARIO: ["How do I score well on the scenarios?", "What is the Day-21 scenario test?", "What should I do next?"],
  ACCOUNT_BRIEF: ["What must my account brief contain before I can submit it?", "How do I build a stakeholder map?", "What goes into a Customer 360?"],
  FEEDBACK: ["What should I do next?", "How am I progressing?"],
  SCHEDULE: ["What should I do next?", "Can I take leave during my onboarding?"],
};

export function stateSuggestions(intent: string): string[] {
  return STATE_SUGGESTIONS[intent] ?? ["What should I do next?", "How am I progressing?"];
}

/** Puts it together: opener, the grounded body untouched, then the suggestive close. */
export function warmText(body: string, opts: { kind: ToneKind; intent: string; firstName: string; seed: string; hasSuggestions?: boolean }): string {
  return `${opener(opts.kind, opts.firstName, opts.seed)}\n\n${body.trim()}\n\n${closer(opts.kind, opts.intent, opts.seed, opts.hasSuggestions)}`;
}
