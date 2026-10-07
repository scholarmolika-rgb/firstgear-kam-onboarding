/**
 * Default assessment bank and scenario library. Rendered into
 * supabase/migrations/003_assessments.sql. HR edits these in the UI
 * (Assessment Management); the app reads only from the database.
 *
 * correct_answer formats:
 *   MULTIPLE_CHOICE { value: "b" }
 *   MULTI_SELECT    { values: ["a","c"] }       partial credit, wrong picks subtract
 *   TRUE_FALSE      { value: true }
 *   SHORT_ANSWER / SCENARIO / CASE_STUDY / ROLE_PLAY
 *                   { rubric: [{ label, keywords[] }] }   share of rubric points matched
 */
import type { Pillar, QuestionType, AssessmentStage } from "@/types/domain";

export interface SeedQuestion {
  code: string;
  stage: AssessmentStage;
  type: QuestionType;
  pillar: Pillar;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  question: string;
  options?: { id: string; text: string }[];
  correct: unknown;
  explanation: string;
  weight?: number;
  source: string;
  ref: string;
}

const o = (...texts: string[]) => texts.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));

export const ASSESSMENTS = [
  { code: "DAY10-CHECK", title: "Day-10 interim knowledge check", stage: "DAY10_CHECK" as const, gate: "G1", from: 6, minutes: 20, description: "Interim check on Days 1–10: governance, products, plant, quality, RFQ and costing knowledge." },
  { code: "DAY15-READINESS", title: "Day-15 four-pillar readiness assessment", stage: "DAY15_READINESS" as const, gate: "G1", from: 11, minutes: 45, description: "Weighted Governance / People / Process / Product assessment that decides the readiness band." },
  { code: "PRACTICE", title: "Practice quiz", stage: "PRACTICE" as const, gate: null, from: 1, minutes: null, description: "Unscored practice on any topic. Does not affect gates." },
];

export const QUESTIONS: SeedQuestion[] = [
  // ── Day-10 interim check ──────────────────────────────────────────
  { code: "D10-GOV-01", stage: "DAY10_CHECK", type: "MULTIPLE_CHOICE", pillar: "GOVERNANCE", topic: "Code of conduct", difficulty: "easy", question: "A customer buyer offers you a gift worth about ₹12,000 after a meeting. What does the code of conduct require?", options: o("Accept it if your manager is copied", "Declare it to Compliance; it is normally declined", "Accept it, gifts from customers are allowed", "Share it with the team"), correct: { value: "b" }, explanation: "Gifts above the nominal ₹5,000 value must be declared to Compliance and are normally declined.", source: "Code of Conduct", ref: "Section 1, v6.0" },
  { code: "D10-PRD-01", stage: "DAY10_CHECK", type: "MULTIPLE_CHOICE", pillar: "PRODUCT", topic: "BEV", difficulty: "easy", question: "Which component belongs to the BEV technology family?", options: o("Fuel-rail assembly", "Rocker arm", "E-axle gear set", "Oil-pump housing"), correct: { value: "c" }, explanation: "E-axle gear sets are BEV components; the others are ICE.", source: "Product Portfolio Guide", ref: "Section 3, v3.0" },
  { code: "D10-PRC-01", stage: "DAY10_CHECK", type: "TRUE_FALSE", pillar: "PROCESS", topic: "Traceability", difficulty: "easy", question: "Lot traceability lets Quality contain a suspect lot precisely instead of sorting all stock.", options: [], correct: { value: true }, explanation: "Laser-marked lot codes link parts to heat lot, machine, shift and test data.", source: "Manufacturing Process Overview", ref: "Section 3, v2.1" },
  { code: "D10-PRC-02", stage: "DAY10_CHECK", type: "MULTIPLE_CHOICE", pillar: "PROCESS", topic: "RFQ", difficulty: "medium", question: "Within how many working days must an RFQ be logged in the CRM?", options: o("One", "Two", "Five", "Ten"), correct: { value: "a" }, explanation: "Log within one working day; acknowledge the customer within two.", source: "RFQ to Quotation SOP", ref: "Section 3.1, v4.1" },
  { code: "D10-PRC-03", stage: "DAY10_CHECK", type: "MULTI_SELECT", pillar: "PROCESS", topic: "Cost build-up", difficulty: "medium", question: "Which elements are part of a piece-price cost build-up? Select all that apply.", options: o("Material cost", "Conversion cost", "Customer's own margin target", "Logistics and packaging", "Overheads"), correct: { values: ["a", "b", "d", "e"] }, explanation: "Material, conversion, overheads, logistics & packaging, SG&A and margin build the price.", source: "Costing and Commercial Mechanics Guide", ref: "Section 1, v3.0" },
  { code: "D10-GOV-02", stage: "DAY10_CHECK", type: "MULTIPLE_CHOICE", pillar: "GOVERNANCE", topic: "PPAP", difficulty: "medium", question: "Which PPAP submission level is the default unless the customer specifies otherwise?", options: o("Level 1", "Level 2", "Level 3", "Level 5"), correct: { value: "c" }, explanation: "Level 3 — full submission with samples — is the default.", source: "Customer Quality Governance Manual", ref: "Section 3, v5.2" },
  { code: "D10-PPL-01", stage: "DAY10_CHECK", type: "MULTIPLE_CHOICE", pillar: "PEOPLE", topic: "Ownership map", difficulty: "easy", question: "Who approves premium freight?", options: o("The KAM", "Head of SCM", "Plant shift supervisor", "Customer buyer"), correct: { value: "b" }, explanation: "Premium-freight approval sits with the Head of SCM.", source: "Organisational Navigation and Knowledge Sources", ref: "Section 1, v1.2" },
  { code: "D10-GOV-03", stage: "DAY10_CHECK", type: "TRUE_FALSE", pillar: "GOVERNANCE", topic: "Approval authority", difficulty: "medium", question: "During onboarding, a KAM may indicate a verbal price to a customer if the cost model is ready.", options: [], correct: { value: false }, explanation: "No verbal price may be indicated before approval is recorded, and onboarding KAMs have no pricing authority.", source: "RFQ to Quotation SOP", ref: "Section 3.5, v4.1" },
  { code: "D10-PRC-04", stage: "DAY10_CHECK", type: "SHORT_ANSWER", pillar: "PROCESS", topic: "RFQ", difficulty: "medium", question: "In one or two sentences: what must happen after RFQ intake and before costing starts?", options: [], correct: { rubric: [{ label: "Feasibility review", keywords: ["feasibility"] }, { label: "Cross-functional (Engineering/Plant/SCM)", keywords: ["engineering", "plant", "scm", "cross-functional", "cross functional"] }, { label: "Go / no-go decision", keywords: ["go/no-go", "go / no-go", "no-go", "go no go", "decision"] }] }, explanation: "A cross-functional feasibility review (Engineering, Plant, SCM) ends in a documented go/no-go decision.", source: "RFQ to Quotation SOP", ref: "Section 3.2, v4.1" },
  { code: "D10-PRD-02", stage: "DAY10_CHECK", type: "MULTIPLE_CHOICE", pillar: "PRODUCT", topic: "Segments", difficulty: "easy", question: "Which vehicle segment is described as the fastest-growing?", options: o("Two-wheelers", "SUVs", "LCVs", "Sedans"), correct: { value: "b" }, explanation: "SUVs are the fastest-growing segment.", source: "Product Portfolio Guide", ref: "Section 4, v3.0" },

  // ── Day-15 readiness: GOVERNANCE ──────────────────────────────────
  { code: "GOV-001", stage: "DAY15_READINESS", type: "MULTIPLE_CHOICE", pillar: "GOVERNANCE", topic: "Approval authority", difficulty: "medium", question: "A quotation falls below the 15% margin floor. Who must approve it?", options: o("The KAM", "Head of Key Accounts alone", "CFO", "Customer purchasing"), correct: { value: "c" }, explanation: "Below-floor quotations require CFO approval (and the MD if strategic).", source: "Commercial Approval Authority Matrix", ref: "Section 2, v2.0" },
  { code: "GOV-002", stage: "DAY15_READINESS", type: "MULTIPLE_CHOICE", pillar: "GOVERNANCE", topic: "Payment terms", difficulty: "medium", question: "A customer asks to move from 60 to 75-day payment terms. Who approves?", options: o("Head of Key Accounts", "CFO", "KAM after certification", "No approval is needed for 15 days"), correct: { value: "b" }, explanation: "Any payment-term change requires CFO approval regardless of value.", source: "Commercial Approval Authority Matrix", ref: "Section 3, v2.0" },
  { code: "GOV-003", stage: "DAY15_READINESS", type: "TRUE_FALSE", pillar: "GOVERNANCE", topic: "Engineering change", difficulty: "medium", question: "A supplier-initiated process change can be implemented before customer approval if it improves quality.", options: [], correct: { value: false }, explanation: "No product/process change without customer approval, normally with PPAP resubmission.", source: "Customer Quality Governance Manual", ref: "Section 6, v5.2" },
  { code: "GOV-004", stage: "DAY15_READINESS", type: "MULTIPLE_CHOICE", pillar: "GOVERNANCE", topic: "Complaints", difficulty: "medium", question: "Within what time must containment start after a customer complaint?", options: o("24 hours", "7 days", "30 days", "When root cause is known"), correct: { value: "a" }, explanation: "Acknowledge and start containment within 24 hours.", source: "Customer Quality Governance Manual", ref: "Section 4, v5.2" },
  { code: "GOV-005", stage: "DAY15_READINESS", type: "MULTI_SELECT", pillar: "GOVERNANCE", topic: "Governance calendar", difficulty: "easy", question: "Which reviews are part of the KAM governance calendar?", options: o("Weekly internal account review", "Monthly customer operations review", "Quarterly business review", "Daily price review with the customer"), correct: { values: ["a", "b", "c"] }, explanation: "Weekly internal, monthly customer operations and quarterly business reviews.", source: "KAM Charter", ref: "Section 3, v1.4" },
  { code: "GOV-006", stage: "DAY15_READINESS", type: "CASE_STUDY", pillar: "GOVERNANCE", topic: "Escalation", difficulty: "hard", question: "Case: a function is two weeks late on a corrective action promised to the customer. Describe the escalation path you would follow.", options: [], correct: { rubric: [{ label: "Raise with function lead first", keywords: ["function lead", "function owner", "lead first"] }, { label: "Use weekly internal account review", keywords: ["weekly", "internal account review", "internal review"] }, { label: "Escalate to Head of Key Accounts", keywords: ["head of key accounts", "reporting boss", "level 2"] }, { label: "Record the escalation and action", keywords: ["record", "document", "log"] }] }, explanation: "Function lead → weekly internal review → Head of Key Accounts, recording the escalation and agreed action.", weight: 2, source: "Customer Escalation Playbook", ref: "Section 5, v2.3" },

  // ── PEOPLE ────────────────────────────────────────────────────────
  { code: "PPL-001", stage: "DAY15_READINESS", type: "MULTIPLE_CHOICE", pillar: "PEOPLE", topic: "Ownership map", difficulty: "easy", question: "Who leads APQP from nomination to SOP?", options: o("Finance", "NPD", "SCM", "The KAM"), correct: { value: "b" }, explanation: "NPD owns programme launch and APQP leadership.", source: "Organisational Navigation and Knowledge Sources", ref: "Section 1, v1.2" },
  { code: "PPL-002", stage: "DAY15_READINESS", type: "MULTIPLE_CHOICE", pillar: "PEOPLE", topic: "Ownership model", difficulty: "medium", question: "In the account ownership model, who owns the content of an 8D?", options: o("The KAM", "Quality", "Customer SQE", "Plant head"), correct: { value: "b" }, explanation: "Quality owns 8D content; the KAM owns customer communication.", source: "KAM Charter", ref: "Section 2, v1.4" },
  { code: "PPL-003", stage: "DAY15_READINESS", type: "TRUE_FALSE", pillar: "PEOPLE", topic: "Navigation", difficulty: "easy", question: "When navigating the organisation, start with the owner of the decision rather than the most senior person.", options: [], correct: { value: true }, explanation: "Go to the decision owner with facts and a clear ask.", source: "Organisational Navigation and Knowledge Sources", ref: "Section 2, v1.2" },
  { code: "PPL-004", stage: "DAY15_READINESS", type: "MULTIPLE_CHOICE", pillar: "PEOPLE", topic: "Customer organisation", difficulty: "medium", question: "At Northwind Motors, who handles FirstGear parts in purchasing?", options: o("The Head of EV Strategy", "The powertrain commodity buyer", "The site SQE", "The logistics planner"), correct: { value: "b" }, explanation: "Purchasing is organised by commodity; the powertrain commodity buyer handles FirstGear parts.", source: "Customer 360 — Northwind Motors", ref: "Section 1, v1.0" },
  { code: "PPL-005", stage: "DAY15_READINESS", type: "SHORT_ANSWER", pillar: "PEOPLE", topic: "Values", difficulty: "medium", question: "Name two company values and how one of them shows up in key account work.", options: [], correct: { rubric: [{ label: "Names a value", keywords: ["customer first", "integrity", "ownership", "safety", "continuous improvement"] }, { label: "Applies it to account work", keywords: ["bad news early", "early", "not committing", "never commit", "approved", "closure", "follow"] }] }, explanation: "Values: Customer first, Integrity, Ownership, Safety always, Continuous improvement — e.g. integrity means never committing what has not been approved.", source: "FirstGear Company Overview", ref: "Sections 3–4, v2026.1" },
  { code: "PPL-006", stage: "DAY15_READINESS", type: "MULTIPLE_CHOICE", pillar: "PEOPLE", topic: "Lessons learned", difficulty: "medium", question: "According to the Northwind lessons learned, what mainly damaged trust after the 2025 delivery miss?", options: o("The premium-freight cost", "Late communication", "The supplier fire itself", "The price-down"), correct: { value: "b" }, explanation: "Trust was damaged mainly because the miss was communicated late.", source: "Customer 360 — Northwind Motors", ref: "Section 8, v1.0" },

  // ── PROCESS ───────────────────────────────────────────────────────
  { code: "PROC-001", stage: "DAY15_READINESS", type: "MULTIPLE_CHOICE", pillar: "PROCESS", topic: "RFQ", difficulty: "medium", question: "What should happen after RFQ intake?", options: o("Send an indicative price", "Cross-functional feasibility review ending in go/no-go", "Start tooling design", "Request customer PO"), correct: { value: "b" }, explanation: "Feasibility review with Engineering, Plant and SCM, documented go/no-go.", source: "RFQ to Quotation SOP", ref: "Section 3.2, v4.1" },
  { code: "PROC-002", stage: "DAY15_READINESS", type: "MULTIPLE_CHOICE", pillar: "PROCESS", topic: "Quotation", difficulty: "easy", question: "What is the default validity of a quotation?", options: o("30 days", "60 days", "90 days", "1 year"), correct: { value: "c" }, explanation: "Quotations are valid for 90 days unless otherwise approved.", source: "RFQ to Quotation SOP", ref: "Section 3.4, v4.1" },
  { code: "PROC-003", stage: "DAY15_READINESS", type: "MULTIPLE_CHOICE", pillar: "PROCESS", topic: "Price change", difficulty: "medium", question: "How are raw-material index adjustments applied?", options: o("Monthly, upward only", "Quarterly with a three-month lag, both up and down", "Annually at the price-down", "Only on customer request"), correct: { value: "b" }, explanation: "Steel, aluminium and copper indices are reviewed quarterly with a three-month lag, both directions.", source: "Costing and Commercial Mechanics Guide", ref: "Section 4, v3.0" },
  { code: "PROC-004", stage: "DAY15_READINESS", type: "TRUE_FALSE", pillar: "PROCESS", topic: "Tooling", difficulty: "medium", question: "Amortising tooling into the piece price exposes the company to volume risk.", options: [], correct: { value: true }, explanation: "If volumes fall short, tooling is under-recovered.", source: "Costing and Commercial Mechanics Guide", ref: "Section 2, v3.0" },
  { code: "PROC-005", stage: "DAY15_READINESS", type: "MULTI_SELECT", pillar: "PROCESS", topic: "Negotiation", difficulty: "medium", question: "Which belong in a negotiation preparation brief?", options: o("Walk-away position", "Give-gets", "Approvals already obtained", "Competitor price information obtained informally"), correct: { values: ["a", "b", "c"] }, explanation: "Objective, walk-away, likely customer position, give-gets, evidence and approvals. Competitor pricing must never be discussed or used.", source: "Costing and Commercial Mechanics Guide", ref: "Section 6, v3.0" },
  { code: "PROC-006", stage: "DAY15_READINESS", type: "SCENARIO", pillar: "PROCESS", topic: "Delivery risk", difficulty: "hard", question: "Scenario: SCM tells you 40% of next week's Northwind shipment is at risk because of a machine breakdown. What do you do in the next 24 hours?", options: [], correct: { rubric: [{ label: "Confirm facts with SCM/Plant", keywords: ["confirm", "facts", "quantity", "scm", "plant"] }, { label: "Recovery plan with options", keywords: ["recovery", "overtime", "alternate line", "partial", "premium freight"] }, { label: "Inform the customer early", keywords: ["inform", "early", "proactive", "notify", "tell the customer"] }, { label: "No unconfirmed dates", keywords: ["confirmed", "in writing", "not promise", "no promise", "only dates"] }] }, explanation: "Confirm facts, build a recovery plan, inform the customer early with the plan, never promise unconfirmed dates.", weight: 2, source: "Customer Escalation Playbook", ref: "Section 2, v2.3" },
  { code: "PROC-007", stage: "DAY15_READINESS", type: "MULTIPLE_CHOICE", pillar: "PROCESS", topic: "Critical operations", difficulty: "medium", question: "Which is a critical operation in the manufacturing flow?", options: o("Washing", "Heat treatment", "Packing", "Incoming paperwork"), correct: { value: "b" }, explanation: "Heat treatment, finish machining of special characteristics and leak testing are critical.", source: "Manufacturing Process Overview", ref: "Section 2, v2.1" },

  // ── PRODUCT ───────────────────────────────────────────────────────
  { code: "PRD-001", stage: "DAY15_READINESS", type: "MULTIPLE_CHOICE", pillar: "PRODUCT", topic: "Hybrid", difficulty: "easy", question: "Which component belongs to the hybrid family?", options: o("Electric water-pump housing", "Battery cooling plate", "Rocker arm", "E-axle gear set"), correct: { value: "a" }, explanation: "Electric water-pump housings are hybrid components.", source: "Product Portfolio Guide", ref: "Section 2, v3.0" },
  { code: "PRD-002", stage: "DAY15_READINESS", type: "MULTIPLE_CHOICE", pillar: "PRODUCT", topic: "BEV", difficulty: "medium", question: "What does BEV gear manufacturing demand more than ICE?", options: o("Lower material cost", "Tighter NVH tolerances", "Fewer validation steps", "Larger batch sizes"), correct: { value: "b" }, explanation: "BEV gears need tighter noise-vibration tolerances; cooling plates must be leak-tight.", source: "Product Portfolio Guide", ref: "Section 3, v3.0" },
  { code: "PRD-003", stage: "DAY15_READINESS", type: "MULTIPLE_CHOICE", pillar: "PRODUCT", topic: "Programmes", difficulty: "medium", question: "Project Aster at Northwind is which programme?", options: o("ICE sedan transmission shafts", "BEV compact SUV e-axle gear sets", "Hybrid water-pump housings", "Two-wheeler valvetrain"), correct: { value: "b" }, explanation: "Project Aster — BEV compact SUV, e-axle gear sets, SOP April 2027.", source: "Customer 360 — Northwind Motors", ref: "Section 4, v1.0" },
  { code: "PRD-004", stage: "DAY15_READINESS", type: "TRUE_FALSE", pillar: "PRODUCT", topic: "ICE", difficulty: "easy", question: "ICE is currently the largest revenue family but is declining as OEMs electrify.", options: [], correct: { value: true }, explanation: "As stated in the portfolio guide.", source: "Product Portfolio Guide", ref: "Section 1, v3.0" },
  { code: "PRD-005", stage: "DAY15_READINESS", type: "SHORT_ANSWER", pillar: "PRODUCT", topic: "Applications", difficulty: "medium", question: "Name the three major application areas and one customer problem they solve.", options: [], correct: { rubric: [{ label: "Powertrain", keywords: ["powertrain", "transmission", "e-axle"] }, { label: "Engine", keywords: ["engine", "fuel", "valvetrain", "lubrication"] }, { label: "Thermal management", keywords: ["thermal", "cooling"] }, { label: "Customer problem", keywords: ["efficiency", "nvh", "noise", "durability", "thermal stability"] }] }, explanation: "Powertrain, engine and thermal management — solving efficiency, NVH, durability and thermal stability.", source: "Product Portfolio Guide", ref: "Section 5, v3.0" },
  { code: "PRD-006", stage: "DAY15_READINESS", type: "MULTIPLE_CHOICE", pillar: "PRODUCT", topic: "Pipeline", difficulty: "medium", question: "What is the open RFQ in the Northwind pipeline?", options: o("Fuel rails for ICE", "Battery cooling plates for next-gen BEV", "Rocker arms for two-wheelers", "Transmission shafts for LCV"), correct: { value: "b" }, explanation: "Battery cooling plates for the next-generation BEV platform, decision expected Q1 2027.", source: "Customer 360 — Northwind Motors", ref: "Section 5, v1.0" },

  // ── Practice ──────────────────────────────────────────────────────
  { code: "PRA-001", stage: "PRACTICE", type: "MULTIPLE_CHOICE", pillar: "GOVERNANCE", topic: "8D", difficulty: "easy", question: "Which 8D step is interim containment?", options: o("D2", "D3", "D4", "D5"), correct: { value: "b" }, explanation: "D3 is interim containment.", source: "Customer Quality Governance Manual", ref: "Section 5, v5.2" },
  { code: "PRA-002", stage: "PRACTICE", type: "MULTIPLE_CHOICE", pillar: "PROCESS", topic: "Logistics", difficulty: "easy", question: "What document accompanies shipments against customer schedules?", options: o("RFQ", "ASN", "ECN", "PPAP"), correct: { value: "b" }, explanation: "Plants ship against Advance Shipping Notices.", source: "Manufacturing Process Overview", ref: "Section 4, v2.1" },
];

export interface SeedScenario {
  code: string;
  title: string;
  category: string;
  pillar: Pillar;
  certification: boolean;
  situation: string;
  prompt: string;
  rubric: { id: string; criterion: string; description: string; weight: number; keywords: string[]; min_matches?: number }[];
  red_flags: { id: string; label: string; patterns: string[]; penalty: number }[];
  source: string;
}

const PRICE_FLAGS = [
  { id: "unapproved-price", label: "Commits to a price, discount or terms without recorded approval", patterns: ["i will give", "we will give", "i agree to", "we agree to reduce", "i can offer a", "i approve", "accept the reduction", "agree to the discount"], penalty: 25 },
];
const DATE_FLAGS = [
  { id: "unconfirmed-date", label: "Promises a date not confirmed by SCM/Plant", patterns: ["i promise", "guarantee delivery", "we guarantee", "definitely deliver"], penalty: 20 },
];

export const SCENARIOS: SeedScenario[] = [
  {
    code: "SCN-RFQ", title: "RFQ response", category: "RFQ", pillar: "PROCESS", certification: true,
    situation: "Northwind's powertrain buyer sends an RFQ for battery cooling plates on the next-gen BEV platform. Drawings are attached but annual volumes and the SOP date are missing. The buyer asks for 'a ballpark price by Friday'.",
    prompt: "Describe exactly how you respond to the buyer and what you do internally over the next five working days.",
    rubric: [
      { id: "log", criterion: "Log and acknowledge", description: "Logs the RFQ and acknowledges within two working days", weight: 15, keywords: ["log", "crm", "acknowledge", "rfq number"] },
      { id: "clarify", criterion: "Clarify missing inputs", description: "Requests missing volumes / SOP date in writing", weight: 20, keywords: ["volume", "sop date", "clarification", "missing", "clarify"] },
      { id: "feasibility", criterion: "Feasibility before price", description: "Runs a cross-functional feasibility review before any price", weight: 25, keywords: ["feasibility", "engineering", "plant", "scm", "go/no-go", "no-go"], min_matches: 2 },
      { id: "no-ballpark", criterion: "No verbal / ballpark price", description: "Declines to give a ballpark price before approval", weight: 25, keywords: ["no ballpark", "not give a ballpark", "cannot give a price", "can't give a price", "no indicative", "after approval", "not quote verbally", "won't give a price", "will not give a price"] },
      { id: "approval", criterion: "Approval chain", description: "Routes the quotation through the approval chain", weight: 15, keywords: ["approval", "head of key accounts", "cfo", "approve"] },
    ],
    red_flags: [{ id: "ballpark-given", label: "Gives a ballpark/verbal price", patterns: ["ballpark is", "roughly ₹", "around ₹", "approximately ₹", "price will be about"], penalty: 25 }],
    source: "RFQ to Quotation SOP",
  },
  {
    code: "SCN-COSTING", title: "Costing challenge", category: "Costing", pillar: "PROCESS", certification: false,
    situation: "In a mock RFQ review, the buyer says your conversion cost looks 15% too high compared with 'the market' and asks you to explain your cost build-up.",
    prompt: "How do you explain the cost build-up and respond to the challenge? (Knowledge practice — no live pricing.)",
    rubric: [
      { id: "elements", criterion: "Explains cost elements", description: "Material, conversion, overheads, logistics, margin", weight: 30, keywords: ["material", "conversion", "overhead", "logistics", "margin"], min_matches: 3 },
      { id: "evidence", criterion: "Uses documented inputs", description: "Cycle time / plant inputs / documented basis", weight: 25, keywords: ["cycle time", "documented", "input", "basis", "evidence"] },
      { id: "finance", criterion: "Involves Finance", description: "Analyses with Finance before responding", weight: 20, keywords: ["finance", "cost model"] },
      { id: "no-concession", criterion: "No concession in the room", description: "Takes the ask back rather than conceding", weight: 25, keywords: ["take back", "come back", "not concede", "no concession", "revert", "approval"] },
    ],
    red_flags: PRICE_FLAGS, source: "Costing and Commercial Mechanics Guide",
  },
  {
    code: "SCN-PRICE", title: "Price challenge", category: "Pricing", pillar: "PROCESS", certification: true,
    situation: "At the monthly review, Northwind's Head of Powertrain Purchasing demands an additional 4% price-down on transmission shafts, on top of the 2% annual reduction, citing supplier consolidation.",
    prompt: "How do you handle the demand in the meeting and afterwards?",
    rubric: [
      { id: "listen", criterion: "Capture the ask", description: "Listens, captures the ask in writing", weight: 15, keywords: ["listen", "capture", "in writing", "understand", "note"] },
      { id: "no-concede", criterion: "No concession in the meeting", description: "Does not concede in the room", weight: 25, keywords: ["not concede", "no concession", "cannot agree", "can't agree", "take it back", "come back", "revert"] },
      { id: "analysis", criterion: "Analyse with Finance", description: "Uses cost breakdown and index data", weight: 20, keywords: ["finance", "cost breakdown", "index", "analysis", "analyse", "analyze"] },
      { id: "givegets", criterion: "Position with give-gets", description: "Prepares a position with give-gets (volume, term, Project Aster)", weight: 20, keywords: ["give-get", "give get", "in return", "volume", "aster", "long-term", "position"] },
      { id: "approval", criterion: "Right approval level", description: "Beyond ±2% needs CFO approval", weight: 20, keywords: ["cfo", "approval", "approval matrix", "reporting boss", "head of key accounts"] },
    ],
    red_flags: PRICE_FLAGS, source: "Customer Escalation Playbook",
  },
  {
    code: "SCN-DELIVERY", title: "Delivery-risk escalation", category: "Delivery", pillar: "PROCESS", certification: true,
    situation: "A critical machine on the transmission-shaft line has failed. SCM estimates 40% of next week's Northwind shipment is at risk. The customer has not been told.",
    prompt: "What do you do in the next 24 hours?",
    rubric: [
      { id: "facts", criterion: "Confirm facts", description: "Quantity at risk, dates, cause with SCM/Plant", weight: 20, keywords: ["confirm", "facts", "quantity", "scm", "plant", "cause"], min_matches: 2 },
      { id: "recovery", criterion: "Recovery plan", description: "Options: overtime, alternate line, partial shipment, premium freight", weight: 25, keywords: ["recovery", "overtime", "alternate line", "partial", "premium freight"] },
      { id: "early", criterion: "Inform customer early", description: "Informs early with the plan and next update time", weight: 25, keywords: ["inform", "early", "proactive", "notify", "next update", "tell the customer"] },
      { id: "dates", criterion: "Only confirmed dates", description: "No unconfirmed dates", weight: 15, keywords: ["confirmed", "in writing", "not promise", "only dates"] },
      { id: "freight", criterion: "Premium-freight approval", description: "Head of SCM approves; cost owner agreed", weight: 15, keywords: ["head of scm", "freight approval", "cost owner", "who pays"] },
    ],
    red_flags: DATE_FLAGS, source: "Customer Escalation Playbook",
  },
  {
    code: "SCN-QUALITY", title: "Quality escalation", category: "Quality", pillar: "GOVERNANCE", certification: true,
    situation: "Northwind's SQE reports burrs on transmission shafts found on their assembly line and threatens a line stop.",
    prompt: "How do you respond and coordinate over the first 48 hours?",
    rubric: [
      { id: "ack", criterion: "Acknowledge within 24h", description: "Acknowledges immediately", weight: 15, keywords: ["acknowledge", "24 hours", "immediately", "respond"] },
      { id: "contain", criterion: "Containment first", description: "Sort stock at plant, in transit, at customer", weight: 30, keywords: ["contain", "containment", "sort", "in transit", "quarantine", "protect the line"] },
      { id: "quality", criterion: "Involve Quality / 8D", description: "Quality opens an 8D", weight: 25, keywords: ["quality", "8d", "d3", "root cause"] },
      { id: "comms", criterion: "Customer communication", description: "Regular updates; no speculation before root cause", weight: 20, keywords: ["update", "communicat", "no speculation", "not speculate", "status"] },
      { id: "traceability", criterion: "Use traceability", description: "Uses lot codes to scope suspect stock", weight: 10, keywords: ["lot", "traceability", "batch"] },
    ],
    red_flags: [{ id: "blame", label: "Speculates on root cause or blames before D4", patterns: ["it is the operator's fault", "root cause is obviously", "it's definitely", "their fault"], penalty: 15 }],
    source: "Customer Quality Governance Manual",
  },
  {
    code: "SCN-COMPLAINT", title: "Customer complaint", category: "Quality", pillar: "GOVERNANCE", certification: false,
    situation: "A customer sends an angry mail: a PPAP document was missing from a shipment and their receiving inspection blocked the lot.",
    prompt: "Draft your approach to resolve the complaint and prevent recurrence.",
    rubric: [
      { id: "ack", criterion: "Acknowledge quickly", description: "Within 24 hours", weight: 20, keywords: ["acknowledge", "24 hours", "immediately"] },
      { id: "fix", criterion: "Immediate fix", description: "Send missing document / release lot", weight: 25, keywords: ["send", "document", "release", "provide"] },
      { id: "root", criterion: "Root cause with Quality", description: "Why it was missed", weight: 25, keywords: ["root cause", "quality", "8d", "why"] },
      { id: "prevent", criterion: "Prevent recurrence", description: "Checklist / process change", weight: 30, keywords: ["prevent", "recurrence", "checklist", "process", "poka"] },
    ],
    red_flags: [], source: "Customer Quality Governance Manual",
  },
  {
    code: "SCN-INTERNAL", title: "Internal escalation", category: "Internal", pillar: "PEOPLE", certification: false,
    situation: "Engineering is two weeks late on a corrective action promised to the customer; the engineering lead says it is 'not a priority'.",
    prompt: "How do you get the action back on track?",
    rubric: [
      { id: "lead", criterion: "Function lead first", description: "Raise with the function lead with facts", weight: 30, keywords: ["engineering lead", "function lead", "facts", "impact"] },
      { id: "review", criterion: "Internal account review", description: "Use the weekly review", weight: 25, keywords: ["weekly", "internal review", "account review"] },
      { id: "escalate", criterion: "Escalate if needed", description: "Head of Key Accounts", weight: 25, keywords: ["head of key accounts", "reporting boss", "escalate"] },
      { id: "record", criterion: "Record and inform", description: "Record action; update customer", weight: 20, keywords: ["record", "document", "update the customer", "inform"] },
    ],
    red_flags: [], source: "Customer Escalation Playbook",
  },
  {
    code: "SCN-DELAY", title: "Programme delay", category: "Programme", pillar: "GOVERNANCE", certification: false,
    situation: "Tooling for Project Aster gear sets is three weeks late, putting the January PPAP submission at risk.",
    prompt: "How do you manage the delay with NPD and the customer?",
    rubric: [
      { id: "facts", criterion: "Impact assessment with NPD", description: "Confirm new timing and impact", weight: 30, keywords: ["npd", "impact", "timing", "confirm"] },
      { id: "plan", criterion: "Recovery plan", description: "Options to recover PPAP date", weight: 25, keywords: ["recovery", "plan", "options", "parallel"] },
      { id: "early", criterion: "Inform customer early", description: "Early, transparent communication", weight: 25, keywords: ["inform", "early", "customer", "transparent"] },
      { id: "governance", criterion: "Programme governance", description: "Track at reviews / escalate", weight: 20, keywords: ["review", "governance", "escalate", "track"] },
    ],
    red_flags: DATE_FLAGS, source: "Programme Governance — Nomination to SOP",
  },
  {
    code: "SCN-ECN", title: "Engineering change", category: "Engineering change", pillar: "GOVERNANCE", certification: false,
    situation: "Northwind requests a design change to the gear-set tooth profile after design freeze and asks you to 'just absorb it'.",
    prompt: "How do you handle the change request?",
    rubric: [
      { id: "process", criterion: "Formal change process", description: "ECR → impact → ECN", weight: 30, keywords: ["ecr", "ecn", "change request", "impact assessment"] },
      { id: "quote", criterion: "Quote price and timing", description: "Through RFQ process", weight: 30, keywords: ["quote", "price impact", "timing", "rfq"] },
      { id: "ppap", criterion: "PPAP implications", description: "Resubmission", weight: 20, keywords: ["ppap", "resubmission", "validation"] },
      { id: "no-absorb", criterion: "Does not absorb without approval", description: "No commitment without approval", weight: 20, keywords: ["approval", "not absorb", "cannot absorb", "can't absorb"] },
    ],
    red_flags: PRICE_FLAGS, source: "Customer Quality Governance Manual",
  },
  {
    code: "SCN-APQP", title: "APQP / PPAP issue", category: "Quality", pillar: "PROCESS", certification: false,
    situation: "The plant wants to ship Project Aster pre-series parts for a customer build before PPAP approval.",
    prompt: "What do you advise and what do you do?",
    rubric: [
      { id: "rule", criterion: "No shipment before PPAP", description: "Unless customer deviation", weight: 35, keywords: ["ppap approval", "before ppap", "not ship", "cannot ship", "deviation"] },
      { id: "deviation", criterion: "Seek customer deviation", description: "Documented deviation", weight: 25, keywords: ["deviation", "waiver", "customer approval"] },
      { id: "quality", criterion: "Involve Quality", description: "Quality owns submission", weight: 20, keywords: ["quality"] },
      { id: "comms", criterion: "Communicate", description: "Inform customer and plant", weight: 20, keywords: ["inform", "communicat", "customer"] },
    ],
    red_flags: [], source: "Customer Quality Governance Manual",
  },
];
