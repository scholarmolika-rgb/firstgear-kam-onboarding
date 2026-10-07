/**
 * Deterministic fallback intent classifier and policy guards.
 *
 * Guards run BEFORE any model: requests to provision IT access, or to have
 * the assistant authorise prices/commitments, are out of scope regardless of
 * what a classifier says.
 */
import type { Intent } from "./intents";

export type Guard = "OUT_OF_SCOPE_IT" | "PRICING_AUTHORITY" | null;

const IT_PATTERNS = [
  /\b(create|set ?up|give|grant|provision|enable|reset|unlock)\b.{0,40}\b(account|access|login|password|vpn|sap|crm access|admin rights?|permissions?|licen[cs]e|laptop|email id)\b/i,
  /\b(account|access|login|password|vpn|permissions?)\b.{0,25}\b(create|grant|provision|reset|unlock|enable)\b/i,
];

const PRICING_AUTHORITY_PATTERNS = [
  /\b(approve|authori[sz]e|sign off|ok|okay|confirm)\b.{0,40}\b(price|pricing|discount|price[- ]?down|rebate|payment terms?|quotation|quote|commercial)\b/i,
  /\b(can|may|should) i\b.{0,30}\b(offer|give|agree to|accept|commit to)\b.{0,40}\b(discount|price|%|percent|payment terms?|reduction)\b/i,
  /\bwhat (price|discount) should i (quote|offer|give)\b/i,
];

export function guard(text: string): Guard {
  if (IT_PATTERNS.some((r) => r.test(text))) return "OUT_OF_SCOPE_IT";
  if (PRICING_AUTHORITY_PATTERNS.some((r) => r.test(text))) return "PRICING_AUTHORITY";
  return null;
}

const RULES: [Intent, RegExp[]][] = [
  ["TASK_COMPLETE", [/\b(i(?:'ve| have)? (?:just )?(?:finished|completed|done|attended)|mark (?:it |this |.{0,40})?(?:as )?(?:done|complete)|tick (?:off)?)\b/i]],
  ["RESCHEDULE", [/\b(reschedule|move|postpone|shift|change the time|push back)\b.{0,40}\b(session|meeting|check-?in|walk|review|training)\b/i, /\breschedul/i]],
  ["SCHEDULE", [/\b(schedule|book|set up|arrange|when is|upcoming|next)\b.{0,30}\b(session|meeting|check-?in|plant walk|training|review|1:1)\b/i, /\bmy (calendar|sessions)\b/i]],
  ["MENTOR_REQUEST", [/\b(ask|talk to|speak to|contact|escalate to|need)\b.{0,20}\bmentor\b/i, /\bmentor\b.{0,20}\b(help|call|meet)\b/i]],
  ["MANAGER_REQUEST", [/\b(ask|talk to|speak to|contact|escalate to|need|request)\b.{0,25}\b(manager|reporting boss|boss|kam head|head of key accounts)\b/i]],
  ["GATE_STATUS", [/\bgate\b/i, /\b(day[- ]?(5|10|15|21|30))\b.{0,20}\b(gate|check|status|unlock)/i, /\bwhy (is|are) .{0,30}(locked|blocked)\b/i, /\bunlock/i]],
  ["READINESS", [/\breadiness\b/i, /\b(am i|when will i be) (ready|cleared|allowed)\b/i, /\bband\b/i, /\b(green|amber|red)\b.{0,15}\b(status|band|score)?/i, /\bpricing exposure\b/i]],
  ["ASSESSMENT", [/\b(assessment|quiz|test|exam|knowledge check|re-?check)\b/i]],
  ["SCENARIO", [/\b(scenario|simulation|role[- ]?play|certification|practi[cs]e)\b/i]],
  ["ACCOUNT_BRIEF", [/\baccount brief\b/i, /\bstakeholder map\b/i]],
  ["CUSTOMER_360", [/\b(customer 360|northwind|oem|customer'?s?|account)\b.{0,40}\b(organi[sz]ation|strategy|programmes?|programs?|volumes?|pipeline|contacts?|history|commitments?|parts|lessons|issues)\b/i, /\bproject aster\b/i, /\bnorthwind\b/i]],
  ["PROGRESS", [/\b(progress\w*|how am i doing|how far|percentage|% complete|completion|overall)\b/i, /\bwhat day\b/i, /\bday \d+ of\b/i]],
  ["TASK_STATUS", [/\b(what should i do|what(?:'s| is) next|next (task|step|action)|today'?s tasks|my tasks|pending|overdue|to-?do|left to do)\b/i]],
  ["FEEDBACK", [/\bfeedback\b/i, /\bcoaching notes?\b/i, /\bwhat did (my )?(mentor|manager|boss) say\b/i]],
  ["KNOWLEDGE_SEARCH", [/\b(where (can|do) i find|which document|sop|policy|manual|guide|playbook|matrix|procedure)\b/i]],
  ["FAQ", [/^(what|how|who|why|when|which|explain|define|tell me about|describe)\b/i, /\b(rfq|apqp|ppap|8d|quotation|feasibility|margin|tooling|index|payment terms?|bev|hybrid|ice|traceability|escalation|code of conduct|gift|approval)\b/i]],
];

export function ruleClassify(text: string): { intent: Intent; confidence: number } {
  const t = text.trim();
  if (!t) return { intent: "GENERAL_HELP", confidence: 0.3 };
  for (const [intent, patterns] of RULES) {
    if (patterns.some((p) => p.test(t))) return { intent, confidence: 0.7 };
  }
  return { intent: "GENERAL_HELP", confidence: 0.4 };
}

/**
 * Company policy topics (HR, leave, travel, conveyance, reimbursement, admin,
 * IT, KPIs, organisation, SOPs, compliance, safety). These are answered from
 * the policy FAQ documents, so they go straight to knowledge search — before
 * the intent model, which was not trained on them and could mistake "overdue
 * claims" or "leave for exams" for onboarding-state questions.
 */
const POLICY_TOPICS = /\b(leaves?|holidays?|vacation|sick|maternity|paternity|bereavement|comp(ensatory)?[- ]?off|salary|payslips?|payroll|ctc|provident fund|pf|uan|gratuity|insurance|mediclaim|notice period|resign(ation)?|probation|confirmation|appraisal|promotions?|increment|variable pay|bonus|incentives?|reimburs\w*|expenses?|claims?|allowances?|per diem|da|travel\w*|hotels?|flights?|trains?|rail|taxi|cabs?|conveyance|mileage|per km|tolls?|parking|visas?|forex|advance|laptop|id card|access card|visiting cards?|stationery|courier|canteen|pool car|dress code|working hours|office hours|attendance|work from home|wfh|posh|harass\w*|grievance|ethics|whistle\w*|insider|trading window|upsi|conflicts? of interest|bribe\w*|gifts?|hospitality|competition law|passwords?|phishing|usb|social media|ai tools?|data classification|ppe|safety shoes|near miss|plant visits?|org(anisation|anization)? chart|departments?|who (handles|owns|approves)|kpis?|otif|ppm|dso|hit rate|scorecard|credit (limit|note|hold)|nda|warranty|incoterms?|sops?|rma|cost centre|grade|hr ?bp|helpdesk)\b/i;
const ONBOARDING_STATE = /\b(my (progress|journey|tasks?|gates?|readiness|band|sessions?|next step)|day[- ]?(15|21|30) (assessment|gate|panel|test)|what should i do next|northwind|project aster|account brief|customer 360)\b/i;

export function isPolicyQuestion(text: string): boolean {
  return POLICY_TOPICS.test(text) && !ONBOARDING_STATE.test(text);
}
