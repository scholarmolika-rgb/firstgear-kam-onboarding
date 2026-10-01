/**
 * Generates the labelled DistilBERT intent dataset:
 *   ml/intent-router/data/intents.jsonl          (all examples)
 *   ml/intent-router/data/{train,validation,test}.jsonl  (stratified 80/10/10)
 *
 *   npx tsx scripts/generate-intent-dataset.ts
 *
 * Synthetic, template-expanded seed data. Replace or extend with real,
 * anonymised KAM questions (one JSON object per line: {"text","label"}),
 * then retrain. The label set comes from lib/ai/intent/intents.ts.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { INTENTS, type Intent } from "../lib/ai/intent/intents";

const topics = ["RFQ process", "APQP", "PPAP levels", "8D", "margin floor", "tooling amortisation", "payment terms", "approval matrix", "code of conduct gifts", "BEV product family", "hybrid components", "traceability", "escalation levels", "engineering change", "quotation validity", "raw material index", "KAM charter", "governance calendar", "complaint handling", "premium freight approval"];
const tasks = ["plant walk", "HR orientation", "code of conduct", "mock RFQ", "ownership mapping", "BEV module", "quotation workflow module", "stakeholder map", "pricing history", "action tracker"];
const sessions = ["mentor check-in", "plant walk", "Customer 360 review", "manager review", "product training", "process training"];

const T: Record<Intent, string[]> = {
  FAQ: [...topics.map((t) => `What is the ${t}?`), ...topics.map((t) => `Explain ${t} to me`), ...topics.slice(0, 10).map((t) => `How does ${t} work here?`)],
  KNOWLEDGE_SEARCH: [...topics.map((t) => `Where can I find the document on ${t}?`), ...topics.slice(0, 12).map((t) => `Which SOP covers ${t}?`), "Show me the escalation playbook", "Find the approval authority matrix", "Is there a policy on gifts?", "Open the quality governance manual"],
  TASK_STATUS: ["What should I do next?", "What's next for me?", "What are my tasks today?", "Do I have anything overdue?", "What is pending for me?", "Show my to-do list", "Which tasks are left this week?", "What do I need to finish today?", "Anything I missed?", "What's my next step?", "List my open tasks", "What remains on Day 7?", "Which activity should I start now?", "Am I behind on anything?", "Give me today's checklist", "What's left before the gate?", "What tasks are overdue?", "Which task is blocking me?", "What should I work on now?", "Next task please"],
  TASK_COMPLETE: [...tasks.map((t) => `I have finished the ${t}`), ...tasks.map((t) => `Mark the ${t} as done`), ...tasks.slice(0, 10).map((t) => `I just completed ${t}, please tick it`), "Done with today's reading", "I attended the session already"],
  SCHEDULE: [...sessions.map((s) => `Schedule a ${s} for Thursday`), ...sessions.map((s) => `When is my next ${s}?`), ...sessions.map((s) => `Book a ${s} with my mentor`), "What sessions do I have this week?", "Show my calendar", "Set up a meeting with Quality"],
  RESCHEDULE: [...sessions.map((s) => `Reschedule my ${s} to Monday`), ...sessions.map((s) => `Can we move the ${s}?`), ...sessions.map((s) => `Postpone the ${s} by a day`), "I can't make tomorrow's session, move it", "Shift my check-in to the afternoon"],
  PROGRESS: ["How am I doing?", "What is my progress?", "How far along am I?", "What percentage have I completed?", "What day am I on?", "Show my overall readiness", "How much of the journey is done?", "Am I on track?", "Give me a progress summary", "What's my completion rate?", "How many tasks have I completed?", "Progress update please", "Where do I stand overall?", "How is my onboarding going?", "Am I ahead or behind?", "What's my readiness percentage?", "Overall status?", "Summarise my journey so far", "How many days are left?", "Show my dashboard numbers"],
  ASSESSMENT: ["When is the Day-15 assessment?", "Can I take the knowledge check now?", "What's on the Day-10 check?", "How is the assessment scored?", "When can I retake the assessment?", "What did I score on the quiz?", "Is the re-check open?", "How many questions are in the assessment?", "What is the pass mark for the Day-10 check?", "Start my assessment", "How are pillar weights applied?", "Can I see my assessment results?", "When is my re-check?", "What topics does the Day-15 test cover?", "Is there a practice quiz?", "Show my test history", "Why did I get Amber?", "What happens if I fail the knowledge check?", "Open the assessment", "How long is the test?"],
  SCENARIO: ["I want to practise a price challenge", "Open the RFQ scenario", "When is scenario certification?", "How are scenarios scored?", "Give me a delivery risk simulation", "Practice a quality escalation", "What's in Day-21 certification?", "Show my scenario scores", "Can I retry the scenario?", "Role play a customer complaint", "Start the costing challenge", "Which scenarios are certification?", "What did I miss in my scenario answer?", "Practise an engineering change case", "How do I pass certification?", "Open scenario practice", "Try the programme delay scenario", "Simulate an internal escalation", "APQP PPAP issue practice", "Compare my scenario attempts"],
  CUSTOMER_360: ["What does Northwind buy from us?", "Who are Northwind's purchasing contacts?", "What programmes does Northwind have?", "What is Project Aster?", "What are Northwind's volumes?", "What's in the Northwind pipeline?", "What is Northwind's strategy?", "What are our open commitments to Northwind?", "Pricing history with Northwind?", "What issues have we had with Northwind?", "Lessons learned on this account?", "How is the customer's purchasing organised?", "Who is the SQE at the customer plant?", "What parts do we supply the OEM?", "What did we agree on price-downs with Northwind?", "Customer 360 summary", "Tell me about my assigned customer", "What's the customer's EV plan?", "Any premium freight claims with Northwind?", "Which customer programmes launch next year?"],
  ACCOUNT_BRIEF: ["Is my account brief approved?", "Has my mentor reviewed the brief?", "How do I submit the account brief?", "What's missing in my account brief?", "Update my stakeholder map", "What sections does the brief need?", "Status of my account brief", "Can I edit the brief after approval?", "Submit my brief", "Why was my brief sent back?", "Add a contact to the stakeholder map", "How many stakeholders do I need?", "Open my account brief", "Who reviews the account brief?", "When is the brief due?", "Brief feedback?", "Is the stakeholder map complete?", "Save my brief draft", "What does the mentor check in the brief?", "Account brief requirements"],
  MENTOR_REQUEST: ["I need to talk to my mentor", "Ask my mentor about this", "Can my mentor help me?", "Escalate this to my mentor", "Contact Arjun", "I'm stuck, get my mentor", "Book time with my mentor", "Send this question to my mentor", "My mentor should look at this", "Need mentor help on costing", "Can you ping my mentor?", "Request a mentor call", "I want mentor feedback", "Ask the mentor to review my draft", "Get mentor support", "Message my mentor", "Mentor please", "Talk to the senior KAM", "Need guidance from my mentor", "Loop in my mentor"],
  MANAGER_REQUEST: ["I need my reporting boss to approve this", "Ask my manager", "Escalate to the Head of Key Accounts", "Can my boss review my pricing position?", "Request manager sign-off", "Talk to Meera", "Send this to my reporting boss", "Need my manager's decision", "Ask the KAM head", "Get approval from my manager", "Can I speak to my boss?", "Request a manager review", "Escalate to reporting boss", "Manager approval needed", "Contact my line manager", "Loop in my manager", "Boss needs to see this", "Reporting boss please", "I need manager guidance", "Ask the head of key accounts"],
  GATE_STATUS: ["Why is Day 16 locked?", "What is blocking my progress?", "Status of gate 3", "Has my Day-10 gate passed?", "When does Phase 2 unlock?", "What do I need to pass the gate?", "Which gate am I on?", "Why can't I start certification?", "Is gate 1 complete?", "What unlocks pricing exposure?", "Day 15 gate status", "Show my gates", "Why is the scenario certification blocked?", "What's required for the Day-21 gate?", "Has the mentor approved my gate?", "Gate requirements please", "Why is Day 6 locked?", "Gate timeline", "What happens at the Day-30 gate?", "Am I blocked?"],
  READINESS: ["Am I ready for customer meetings?", "What is my readiness band?", "Am I Green?", "When will I be allowed to price?", "Is pricing exposure approved?", "Am I ready for independent handling?", "What's my readiness status?", "When can I own the account?", "Am I Amber or Red?", "Readiness score?", "Can I handle customers alone now?", "When will I be cleared?", "Have I earned customer access?", "Will I be ready on Day 30?", "What decides my readiness?", "Customer exposure status", "Pricing readiness?", "Am I allowed to quote?", "Readiness panel status", "Who decides if I'm ready?"],
  FEEDBACK: ["What feedback did my mentor give?", "Show my feedback", "Any coaching notes for me?", "What did my manager say?", "Where can I improve?", "My development areas?", "Strengths noted by my mentor?", "Latest feedback please", "Did my boss comment on my progress?", "What should I work on according to my mentor?", "Feedback on my scenario?", "Review comments on my draft?", "Show mentor notes", "What did the panel say?", "Any feedback this week?", "Comments on my account brief?", "Coaching summary", "How did my mentor rate me?", "Areas needing reinforcement?", "Recent reviews"],
  GENERAL_HELP: ["Hi", "Hello", "Help", "What can you do?", "How does this app work?", "Who are you?", "Good morning", "Thanks", "What is the Compass?", "How do I use the assistant?", "Can you help me?", "I'm new here", "Where do I start?", "Explain this tool", "What does Ask FirstGear do?", "Hey there", "Menu", "Options?", "How do I navigate?", "Start"],
};

const rows: { text: string; label: Intent }[] = [];
for (const label of INTENTS) for (const text of T[label]) rows.push({ text, label });

// deterministic shuffle
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const split = { train: [] as typeof rows, validation: [] as typeof rows, test: [] as typeof rows };
for (const label of INTENTS) {
  const xs = rows.filter((r) => r.label === label).sort(() => rnd() - 0.5);
  const nTest = Math.max(2, Math.round(xs.length * 0.1));
  const nVal = Math.max(2, Math.round(xs.length * 0.1));
  split.test.push(...xs.slice(0, nTest));
  split.validation.push(...xs.slice(nTest, nTest + nVal));
  split.train.push(...xs.slice(nTest + nVal));
}
const dir = path.resolve(__dirname, "..", "ml", "intent-router", "data");
mkdirSync(dir, { recursive: true });
const jsonl = (xs: typeof rows) => xs.map((r) => JSON.stringify(r)).join("\n") + "\n";
writeFileSync(path.join(dir, "intents.jsonl"), jsonl(rows));
for (const [k, v] of Object.entries(split)) writeFileSync(path.join(dir, `${k}.jsonl`), jsonl(v));
writeFileSync(path.join(dir, "labels.json"), JSON.stringify(INTENTS, null, 2) + "\n");
console.log(`${rows.length} examples across ${INTENTS.length} intents → train ${split.train.length}, validation ${split.validation.length}, test ${split.test.length}`);
