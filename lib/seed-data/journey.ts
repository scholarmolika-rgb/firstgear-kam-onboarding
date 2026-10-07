/**
 * Default programme content — the single source of truth for the seeded
 * 30-day KAM journey. `scripts/generate-seed-sql.ts` renders this into
 * supabase/migrations/002_seed_onboarding.sql, and the journey simulation
 * tests run against the same data. Once seeded, HR edits it in the UI;
 * the app always reads from the database, never from this file.
 */
import type { Pillar, Role, TaskType, Exposure } from "@/types/domain";

export interface SeedDay {
  day: number;
  phase: 1 | 2;
  segment: string;
  title: string;
  pillars: Pillar[];
  objectives: string[];
  resources: { label: string; document_key: string }[];
  gate?: string;
}

export interface SeedTask {
  code: string;
  day: number;
  title: string;
  description: string;
  pillar: Pillar;
  type: TaskType;
  owner?: Role;
  due?: number;
  mandatory?: boolean;
  approval?: boolean;
  exposure?: Exposure;
  topic?: string;
  /** System-completed reference — the checkbox is driven by the linked action, not ticked by hand. */
  ref?: string;
  dependsOn?: string[];
}

export interface SeedGate {
  code: string;
  day: number;
  name: string;
  description: string;
  type: "TASKS" | "ASSESSMENT" | "SCENARIO" | "PANEL";
  approver: Role | null;
  unlocks: string[];
}

export const TEMPLATE = {
  code: "KAM-30",
  name: "KAM 30-Day Readiness Journey",
  description:
    "Guided, evidence-based onboarding for new or reassigned Key Account Managers. Days 1–15 learn the company; Days 16–30 guided ownership controlled by readiness gates.",
  duration: 30,
};

/** Segment windows: which gate a day's work counts toward. */
export const SEGMENTS: { gate: string; from: number; to: number }[] = [
  { gate: "G1", from: 1, to: 15 },
  { gate: "G2", from: 16, to: 21 },
  { gate: "G3", from: 22, to: 30 },
];

export const GATES: SeedGate[] = [
  { code: "G1", day: 15, name: "Day-15 gate — readiness score ≥ 80%", description: "Phase 1 (Days 1–15) learning across Governance, People, Process and Product complete, Day-10 interim check passed, Customer 360 and account brief reviewed by the Mentor, and a weighted four-pillar readiness score at or above the Green threshold (80%).", type: "ASSESSMENT", approver: "MENTOR", unlocks: ["PHASE_2"] },
  { code: "G2", day: 21, name: "Scenario test", description: "RFQ response, price challenge, delivery risk and quality escalation scenarios scored against the Day-15 baseline and certified by the Mentor.", type: "SCENARIO", approver: "MENTOR", unlocks: ["PRICING_ELIGIBLE", "CUSTOMER_ELIGIBLE"] },
  { code: "G3", day: 30, name: "Readiness panel sign-off", description: "Reporting Boss, Mentor and HR panel. The Reporting Boss records the final, human-certified readiness decision.", type: "PANEL", approver: "REPORTING_BOSS", unlocks: ["INDEPENDENT_HANDLING"] },
];

const r = (label: string, document_key: string) => ({ label, document_key });

export const DAYS: SeedDay[] = [
  { day: 1, phase: 1, segment: "Learn about the company", title: "Governance & people", pillars: ["GOVERNANCE", "PEOPLE"], objectives: ["Understand the business, values and code of conduct", "Complete HR orientation and onboarding setup", "Understand the KAM charter and manager expectations"], resources: [r("Company overview", "COMPANY-OVERVIEW"), r("Code of conduct", "CODE-OF-CONDUCT"), r("KAM charter", "KAM-CHARTER"), r("FAQ — Company, products & markets", "FAQ-COMPANY-PRODUCTS"), r("FAQ — Onboarding journey & app", "FAQ-ONBOARDING")] },
  { day: 2, phase: 1, segment: "Learn about the company", title: "Products", pillars: ["PRODUCT"], objectives: ["Explain ICE, hybrid and BEV technology families", "Map products to vehicle segments and applications"], resources: [r("Product portfolio guide", "PRODUCT-PORTFOLIO"), r("FAQ — Company, products & markets", "FAQ-COMPANY-PRODUCTS")] },
  { day: 3, phase: 1, segment: "Learn about the company", title: "Processes & plant", pillars: ["PROCESS"], objectives: ["Walk the plant and follow the manufacturing flow", "Understand critical operations, traceability and logistics", "Adopt the safety and quality mindset"], resources: [r("Manufacturing process overview", "MFG-PROCESS"), r("FAQ — Quality, programmes, delivery & escalation", "FAQ-QUALITY-DELIVERY")] },
  { day: 4, phase: 1, segment: "Learn about the company", title: "Governance & quality", pillars: ["GOVERNANCE", "PROCESS"], objectives: ["Understand customer-specific quality expectations", "Explain APQP and PPAP at overview level", "Know complaint handling and engineering change control"], resources: [r("Quality governance manual", "QUALITY-GOVERNANCE")] },
  { day: 5, phase: 1, segment: "Learn about the company", title: "Organisational navigation", pillars: ["PEOPLE"], objectives: ["Know who owns what across Engineering, NPD, Quality, SCM, Plant and Finance", "Know where approved knowledge lives"], resources: [r("Ownership map & knowledge sources", "ORG-NAVIGATION"), r("FAQ — Account ownership, governance & conduct", "FAQ-ACCOUNT-MANAGEMENT")] },
  { day: 6, phase: 1, segment: "Learn about the company", title: "KAM charter", pillars: ["GOVERNANCE"], objectives: ["Understand the account ownership model", "Know the governance calendar, KPIs, approval authority and escalation map"], resources: [r("KAM charter", "KAM-CHARTER"), r("Approval authority matrix", "APPROVAL-MATRIX")] },
  { day: 7, phase: 1, segment: "Learn about the company", title: "RFQ → quotation", pillars: ["PROCESS"], objectives: ["Follow an RFQ from intake to approved quotation", "Know the cross-functional inputs and approval chain"], resources: [r("RFQ to quotation SOP", "RFQ-SOP")] },
  { day: 8, phase: 1, segment: "Learn about the company", title: "Costing & commercials (knowledge only)", pillars: ["PROCESS"], objectives: ["Explain cost build-up, tooling and margin logic", "Understand price-change and payment-term mechanics", "Prepare for negotiation — no live pricing decisions"], resources: [r("Costing & commercial mechanics", "COSTING-COMMERCIALS"), r("FAQ — RFQs, costing, pricing & approvals", "FAQ-COMMERCIAL")] },
  { day: 9, phase: 1, segment: "Learn about the company", title: "Programme governance", pillars: ["GOVERNANCE"], objectives: ["Understand nomination-to-SOP governance", "Know APQP/PPAP touchpoints, engineering changes and the 8D interface"], resources: [r("Programme governance guide", "PROGRAMME-GOVERNANCE"), r("Quality governance manual", "QUALITY-GOVERNANCE")] },
  { day: 10, phase: 1, segment: "Learn about the company", title: "Practice & check", pillars: ["PROCESS", "GOVERNANCE"], objectives: ["Run a mock RFQ and a pricing scenario", "Walk through a customer escalation", "Pass the interim knowledge check"], resources: [r("RFQ to quotation SOP", "RFQ-SOP"), r("Escalation playbook", "ESCALATION-PLAYBOOK")] },
  { day: 11, phase: 1, segment: "Customer & business context", title: "Customer 360 — organisation & strategy", pillars: ["PEOPLE", "PRODUCT"], objectives: ["Map the OEM organisation and strategic context", "Document supplied parts and applications"], resources: [r("Customer 360 — Northwind Motors", "C360-NORTHWIND")] },
  { day: 12, phase: 1, segment: "Customer & business context", title: "Customer 360 — programmes & pipeline", pillars: ["PRODUCT", "PROCESS"], objectives: ["Document programmes, volumes and pipeline"], resources: [r("Customer 360 — Northwind Motors", "C360-NORTHWIND")] },
  { day: 13, phase: 1, segment: "Stakeholders & history", title: "Stakeholder map", pillars: ["PEOPLE"], objectives: ["Identify purchasing, engineering, quality and SCM/plant contacts"], resources: [r("Customer 360 — Northwind Motors", "C360-NORTHWIND")] },
  { day: 14, phase: 1, segment: "Stakeholders & history", title: "Commercial history & lessons", pillars: ["GOVERNANCE", "PROCESS"], objectives: ["Understand pricing and commercial history", "Record past commitments and lessons learned", "Submit the account brief"], resources: [r("Customer 360 — Northwind Motors", "C360-NORTHWIND")] },
  { day: 15, phase: 1, segment: "Day-15 gate", title: "Day-15 gate — readiness assessment", pillars: ["GOVERNANCE", "PEOPLE", "PROCESS", "PRODUCT"], objectives: ["Complete the four-pillar assessment", "Customer 360 and account brief reviewed by Mentor", "Readiness score ≥ 80% (Green) opens Phase 2"], resources: [r("Assessment guide", "ASSESSMENT-GUIDE"), r("FAQ — Onboarding journey & app", "FAQ-ONBOARDING")], gate: "G1" },
  { day: 16, phase: 2, segment: "Shadow reviews", title: "Shadow customer & internal reviews", pillars: ["PEOPLE", "PROCESS"], objectives: ["Observe reviews and prepare minutes and action trackers"], resources: [r("Escalation playbook", "ESCALATION-PLAYBOOK")] },
  { day: 17, phase: 2, segment: "Shadow reviews", title: "Draft (unsent) customer responses", pillars: ["PROCESS"], objectives: ["Draft responses for mentor review — nothing is sent"], resources: [] },
  { day: 18, phase: 2, segment: "Own low-risk queries", title: "Routine customer queries", pillars: ["PROCESS", "PEOPLE"], objectives: ["Handle selected routine queries with mandatory pre-send review"], resources: [] },
  { day: 19, phase: 2, segment: "Own low-risk queries", title: "Coordinate cross-functional closure", pillars: ["PEOPLE"], objectives: ["Drive closure across Quality, SCM, Plant and Engineering"], resources: [] },
  { day: 20, phase: 2, segment: "Lead an internal review", title: "Lead account-action review", pillars: ["GOVERNANCE", "PROCESS"], objectives: ["Lead one review covering quality, delivery, commercial and programme topics — Mentor observes"], resources: [] },
  { day: 21, phase: 2, segment: "Scenario test (gate)", title: "Scenario test (gate)", pillars: ["PROCESS", "GOVERNANCE"], objectives: ["RFQ response, price challenge, delivery risk, quality escalation", "Score against Day-15 baseline"], resources: [r("Escalation playbook", "ESCALATION-PLAYBOOK"), r("RFQ to quotation SOP", "RFQ-SOP")], gate: "G2" },
  { day: 22, phase: 2, segment: "Guided pricing", title: "Prepare pricing position", pillars: ["PROCESS"], objectives: ["Prepare a commercial position for joint discussion"], resources: [r("Costing & commercial mechanics", "COSTING-COMMERCIALS"), r("Approval authority matrix", "APPROVAL-MATRIX")] },
  { day: 23, phase: 2, segment: "Guided pricing", title: "Reporting Boss reviews position", pillars: ["GOVERNANCE"], objectives: ["Reporting Boss reviews and challenges the position"], resources: [] },
  { day: 24, phase: 2, segment: "Guided pricing", title: "Joint commercial discussion", pillars: ["PROCESS", "PEOPLE"], objectives: ["Join a live commercial discussion with the Reporting Boss"], resources: [] },
  { day: 25, phase: 2, segment: "Guided pricing", title: "Draft negotiated position", pillars: ["PROCESS"], objectives: ["Draft the follow-up position for Reporting Boss approval"], resources: [] },
  { day: 26, phase: 2, segment: "Own the account", title: "Own agreed account scope", pillars: ["PEOPLE", "PROCESS"], objectives: ["Own the agreed scope with daily light-touch review"], resources: [] },
  { day: 27, phase: 2, segment: "Own the account", title: "Ownership — daily review", pillars: ["PROCESS"], objectives: ["Continue ownership; daily review"], resources: [] },
  { day: 28, phase: 2, segment: "Own the account", title: "Ownership — alternate-day review", pillars: ["PROCESS"], objectives: ["Review cadence moves to alternate days"], resources: [] },
  { day: 29, phase: 2, segment: "Own the account", title: "Prepare panel evidence", pillars: ["GOVERNANCE"], objectives: ["Assemble evidence of live-case performance and outputs"], resources: [] },
  { day: 30, phase: 2, segment: "Readiness panel sign-off", title: "Readiness panel sign-off", pillars: ["GOVERNANCE", "PEOPLE", "PROCESS", "PRODUCT"], objectives: ["Panel evaluates knowledge, response quality, dependency reduction, live cases, scenarios and account understanding", "Reporting Boss records the final human decision"], resources: [], gate: "G3" },
];

const t = (code: string, day: number, title: string, pillar: Pillar, type: TaskType, description: string, extra: Partial<SeedTask> = {}): SeedTask =>
  ({ code, day, title, pillar, type, description, ...extra });

export const TASKS: SeedTask[] = [
  // Day 1 — Governance & people
  t("D01-01", 1, "Company profile", "GOVERNANCE", "LEARNING", "Read the company profile: history, businesses, 12 plants, FY2022-23 to FY2025-26 financials, order book, markets and the four strategic priorities.", { topic: "company" }),
  t("D01-02", 1, "Company values", "PEOPLE", "LEARNING", "Review the values — Integrity, Vitality, Frugality, Agility — and how they show up in customer work.", { topic: "values" }),
  t("D01-03", 1, "Code of conduct", "GOVERNANCE", "LEARNING", "Read and acknowledge the code of conduct, including gifts, hospitality and confidentiality.", { topic: "conduct" }),
  t("D01-04", 1, "HR orientation", "PEOPLE", "SESSION", "Attend HR orientation: policies, leave, benefits and ways of working."),
  t("D01-05", 1, "KAM charter introduction", "GOVERNANCE", "LEARNING", "Read the KAM charter introduction: purpose, scope and accountability.", { topic: "charter" }),
  t("D01-06", 1, "Manager expectations", "PEOPLE", "SESSION", "Meet the Reporting Boss to agree expectations for the first 30 days."),
  t("D01-07", 1, "Initial onboarding setup", "PEOPLE", "ACTIVITY", "Confirm your onboarding profile, mentor and session calendar in the Compass. (IT access is handled separately by IT.)"),
  // Day 2 — Products
  t("D02-01", 2, "Driveline and ICE products", "PRODUCT", "LEARNING", "Study differential bevel gears, differential assemblies and starter motors — the driveline and ICE core, and the company's global market shares.", { topic: "ICE" }),
  t("D02-02", 2, "Hybrid products", "PRODUCT", "LEARNING", "Study micro-hybrid starter motors, belt starter generators and hybrid-platform differential assemblies, and where they differ from ICE.", { topic: "hybrid" }),
  t("D02-03", 2, "BEV products", "PRODUCT", "LEARNING", "Study EV differential assemblies with final-drive gear, traction motors, controllers and active-suspension motor controllers, and why EV gears need tighter NVH.", { topic: "BEV" }),
  t("D02-04", 2, "Segments and end markets", "PRODUCT", "LEARNING", "Map products to passenger, commercial, off-highway, electric 2W/3W and railway segments, and to the India / Europe / North America / Asia revenue mix.", { topic: "segments" }),
  t("D02-05", 2, "Sensors, railway and new verticals", "PRODUCT", "LEARNING", "Understand radar sensors, railway systems and robotics, and the customer problems each product line solves.", { topic: "applications" }),
  // Day 3 — Processes
  t("D03-01", 3, "Plant walk", "PROCESS", "SESSION", "Walk the plant with the plant lead and follow one part from raw material to dispatch."),
  t("D03-02", 3, "Manufacturing process flow", "PROCESS", "LEARNING", "Learn the end-to-end manufacturing flow.", { topic: "process flow" }),
  t("D03-03", 3, "Critical operations", "PROCESS", "LEARNING", "Identify the critical operations and special characteristics.", { topic: "critical operations" }),
  t("D03-04", 3, "Traceability", "PROCESS", "LEARNING", "Understand lot traceability and how it supports containment.", { topic: "traceability" }),
  t("D03-05", 3, "Logistics", "PROCESS", "LEARNING", "Understand inbound and outbound logistics, packaging and schedules.", { topic: "logistics" }),
  t("D03-06", 3, "Safety mindset", "PROCESS", "LEARNING", "Complete the safety induction and understand plant safety rules."),
  t("D03-07", 3, "Quality mindset", "PROCESS", "LEARNING", "Understand the zero-defect mindset and the cost of poor quality."),
  // Day 4 — Governance / quality
  t("D04-01", 4, "Customer-specific quality mindset", "GOVERNANCE", "LEARNING", "Study customer-specific requirements (CSRs) for key OEMs.", { topic: "CSR" }),
  t("D04-02", 4, "APQP overview", "PROCESS", "LEARNING", "Learn the five APQP phases and the KAM's touchpoints.", { topic: "APQP" }),
  t("D04-03", 4, "PPAP overview", "PROCESS", "LEARNING", "Learn PPAP submission levels and elements.", { topic: "PPAP" }),
  t("D04-04", 4, "Complaint handling", "GOVERNANCE", "LEARNING", "Understand the complaint-handling process and response timelines.", { topic: "complaints" }),
  t("D04-05", 4, "Engineering change-control governance", "GOVERNANCE", "LEARNING", "Understand how engineering changes are requested, approved and communicated.", { topic: "engineering change" }),
  // Day 5 — People / organisational navigation
  t("D05-01", 5, "Meet Engineering", "PEOPLE", "SESSION", "Meet the engineering lead: responsibilities and hand-offs."),
  t("D05-02", 5, "Meet NPD", "PEOPLE", "SESSION", "Meet NPD: programme launch responsibilities."),
  t("D05-03", 5, "Meet Quality", "PEOPLE", "SESSION", "Meet Quality: customer quality, 8D and PPAP owners."),
  t("D05-04", 5, "Meet SCM", "PEOPLE", "SESSION", "Meet SCM: planning, schedules and supplier risk."),
  t("D05-05", 5, "Meet Plant", "PEOPLE", "SESSION", "Meet the plant head: capacity and delivery performance."),
  t("D05-06", 5, "Meet Finance", "PEOPLE", "SESSION", "Meet Finance: costing, margin and credit."),
  t("D05-07", 5, "Ownership mapping", "PEOPLE", "DELIVERABLE", "Build your internal ownership map: who owns which decision.", { dependsOn: ["D05-01", "D05-03", "D05-06"] }),
  t("D05-08", 5, "Knowledge-source walkthrough", "PEOPLE", "LEARNING", "Learn where approved SOPs, policies and customer data live — and use the Ask FirstGear assistant once.", { topic: "knowledge sources" }),
  // Day 6 — KAM charter
  t("D06-01", 6, "Account ownership model", "GOVERNANCE", "LEARNING", "Understand what the KAM owns versus what functions own.", { topic: "ownership model" }),
  t("D06-02", 6, "Governance calendar", "GOVERNANCE", "LEARNING", "Learn the account governance calendar: weekly, monthly and quarterly reviews."),
  t("D06-03", 6, "KAM KPIs", "GOVERNANCE", "LEARNING", "Learn the KAM KPIs and how they are measured.", { topic: "KPIs" }),
  t("D06-04", 6, "Approval authority", "GOVERNANCE", "LEARNING", "Study the approval authority matrix — who can approve prices, terms and commitments.", { topic: "approval authority" }),
  t("D06-05", 6, "Escalation map", "GOVERNANCE", "LEARNING", "Learn the escalation map and response timelines.", { topic: "escalation" }),
  // Day 7 — RFQ → quotation
  t("D07-01", 7, "RFQ intake", "PROCESS", "LEARNING", "Learn how RFQs are logged, scoped and acknowledged.", { topic: "RFQ" }),
  t("D07-02", 7, "Feasibility assessment", "PROCESS", "LEARNING", "Understand technical and capacity feasibility review.", { topic: "feasibility", dependsOn: ["D07-01"] }),
  t("D07-03", 7, "Cross-functional inputs", "PROCESS", "LEARNING", "Know which inputs Engineering, SCM, Plant and Finance provide.", { dependsOn: ["D07-02"] }),
  t("D07-04", 7, "Quotation workflow", "PROCESS", "LEARNING", "Follow the quotation workflow from cost model to submission.", { topic: "quotation", dependsOn: ["D07-03"] }),
  t("D07-05", 7, "Approval chain", "GOVERNANCE", "LEARNING", "Learn the quotation approval chain and thresholds.", { topic: "approval chain", dependsOn: ["D07-04"] }),
  // Day 8 — Costing & commercials (knowledge only)
  t("D08-01", 8, "Cost build-up", "PROCESS", "LEARNING", "Understand material, conversion, overhead and logistics cost build-up. Knowledge only.", { topic: "cost build-up" }),
  t("D08-02", 8, "Tooling & development cost", "PROCESS", "LEARNING", "Understand tooling and development cost recovery options.", { topic: "tooling" }),
  t("D08-03", 8, "Margin logic", "PROCESS", "LEARNING", "Understand margin targets and floor logic. Knowledge only — no live pricing.", { topic: "margin" }),
  t("D08-04", 8, "Price-change mechanics", "PROCESS", "LEARNING", "Understand index-linked adjustments, annual price-downs and claims.", { topic: "price change" }),
  t("D08-05", 8, "Payment-term mechanics", "PROCESS", "LEARNING", "Understand payment terms and their working-capital impact.", { topic: "payment terms" }),
  t("D08-06", 8, "Negotiation preparation", "PROCESS", "LEARNING", "Learn how to prepare a negotiation brief: BATNA, give-gets and approvals.", { topic: "negotiation" }),
  // Day 9 — Programme governance
  t("D09-01", 9, "Nomination-to-SOP governance", "GOVERNANCE", "LEARNING", "Understand programme governance from nomination to start of production.", { topic: "SOP" }),
  t("D09-02", 9, "APQP/PPAP touchpoints", "GOVERNANCE", "LEARNING", "Identify where the KAM is accountable in APQP and PPAP.", { topic: "APQP" }),
  t("D09-03", 9, "Engineering changes", "GOVERNANCE", "LEARNING", "Understand customer- and supplier-initiated change handling.", { topic: "engineering change" }),
  t("D09-04", 9, "Complaint / 8D interface", "GOVERNANCE", "LEARNING", "Understand the 8D discipline and the KAM's role in customer communication.", { topic: "8D" }),
  // Day 10 — Practice & check
  t("D10-01", 10, "Mock RFQ", "PROCESS", "ACTIVITY", "Complete a mock RFQ response pack with your mentor.", { dependsOn: ["D07-05"] }),
  t("D10-02", 10, "Pricing scenario (practice)", "PROCESS", "SCENARIO", "Attempt the costing-challenge practice scenario. Knowledge practice only.", { ref: "scenario:SCN-COSTING", dependsOn: ["D08-06"] }),
  t("D10-03", 10, "Customer escalation walkthrough", "GOVERNANCE", "SESSION", "Walk through a historic customer escalation with your mentor."),
  t("D10-04", 10, "Structured mentor feedback", "PEOPLE", "REVIEW", "Mentor records structured feedback on Days 1–10.", { owner: "MENTOR" }),
  t("D10-05", 10, "Interim knowledge check", "GOVERNANCE", "ASSESSMENT", "Take the Day-10 interim knowledge check.", { ref: "assessment:DAY10-CHECK", dependsOn: ["D10-01"] }),
  // Days 11–12 — Customer 360
  t("D11-01", 11, "OEM organisation", "PEOPLE", "DELIVERABLE", "Document the customer's organisation in Customer 360.", { topic: "customer organisation" }),
  t("D11-02", 11, "Strategic context", "GOVERNANCE", "DELIVERABLE", "Document the customer's strategy, electrification plans and supplier strategy.", { topic: "strategy" }),
  t("D11-03", 11, "Supplied parts & applications", "PRODUCT", "DELIVERABLE", "Document supplied parts and their applications.", { topic: "supplied parts" }),
  t("D12-01", 12, "Programmes", "PRODUCT", "DELIVERABLE", "Document active and upcoming programmes.", { topic: "programmes" }),
  t("D12-02", 12, "Volumes & pipeline", "PROCESS", "DELIVERABLE", "Document volumes and the opportunity pipeline.", { topic: "pipeline" }),
  t("D12-03", 12, "Customer 360 mentor check-in", "PEOPLE", "SESSION", "Review your Customer 360 draft with your mentor."),
  // Days 13–14 — Stakeholders & history
  t("D13-01", 13, "Purchasing contacts", "PEOPLE", "DELIVERABLE", "Add purchasing stakeholders to the stakeholder map."),
  t("D13-02", 13, "Engineering contacts", "PEOPLE", "DELIVERABLE", "Add engineering stakeholders."),
  t("D13-03", 13, "Quality contacts", "PEOPLE", "DELIVERABLE", "Add quality stakeholders."),
  t("D13-04", 13, "SCM / plant contacts", "PEOPLE", "DELIVERABLE", "Add SCM and plant stakeholders."),
  t("D14-01", 14, "Pricing history", "PROCESS", "DELIVERABLE", "Record pricing history from approved records only.", { topic: "pricing history" }),
  t("D14-02", 14, "Commercial history", "PROCESS", "DELIVERABLE", "Record commercial history: claims, terms, disputes."),
  t("D14-03", 14, "Past commitments", "GOVERNANCE", "DELIVERABLE", "Record open and past commitments with owners."),
  t("D14-04", 14, "Lessons learned & submit account brief", "GOVERNANCE", "DELIVERABLE", "Record lessons learned and submit the account brief for mentor review.", { ref: "brief:SUBMIT", dependsOn: ["D11-01", "D11-02", "D11-03", "D12-01", "D12-02", "D14-01", "D14-02", "D14-03"] }),
  // Day 15 — Readiness assessment
  t("D15-01", 15, "Four-pillar readiness assessment", "GOVERNANCE", "ASSESSMENT", "Take the Day-15 four-pillar assessment. Weighted: Governance 25%, People 20%, Process 30%, Product 25% (configurable).", { ref: "assessment:DAY15-READINESS" }),
  t("D15-02", 15, "Customer 360 review", "PEOPLE", "REVIEW", "Mentor reviews the Customer 360 and stakeholder map.", { ref: "review:CUSTOMER_360", owner: "MENTOR", dependsOn: ["D14-04"] }),
  t("D15-03", 15, "Account brief review", "GOVERNANCE", "REVIEW", "Mentor reviews and approves the account brief.", { ref: "review:ACCOUNT_BRIEF", owner: "MENTOR", dependsOn: ["D14-04"] }),
  // Days 16–17 — Shadow & prepare
  t("D16-01", 16, "Observe customer review", "PEOPLE", "ACTIVITY", "Join a customer review as an observer.", { exposure: "CUSTOMER" }),
  t("D16-02", 16, "Observe internal review", "PEOPLE", "ACTIVITY", "Join an internal account review as an observer."),
  t("D16-03", 16, "Prepare minutes", "PROCESS", "DELIVERABLE", "Prepare the minutes of the observed reviews."),
  t("D17-01", 17, "Prepare action tracker", "PROCESS", "DELIVERABLE", "Prepare the account action tracker with owners and dates."),
  t("D17-02", 17, "Draft unsent customer responses", "PROCESS", "DELIVERABLE", "Draft responses to live customer mails — submitted for mentor review, not sent.", { approval: true }),
  // Days 18–19 — Own low-risk actions
  t("D18-01", 18, "Handle routine customer queries", "PROCESS", "ACTIVITY", "Handle selected routine customer queries (schedules, documentation).", { exposure: "CUSTOMER", approval: true }),
  t("D18-02", 18, "Mandatory pre-send review", "GOVERNANCE", "REVIEW", "Mentor reviews every outgoing response before it is sent.", { owner: "MENTOR", dependsOn: ["D18-01"] }),
  t("D19-01", 19, "Coordinate cross-functional closure", "PEOPLE", "ACTIVITY", "Drive closure of open actions across Quality, SCM, Plant and Engineering."),
  // Day 20 — Lead internal review
  t("D20-01", 20, "Lead account-action review", "GOVERNANCE", "ACTIVITY", "Lead one internal review covering quality, delivery, commercial and programme topics.", { approval: true }),
  t("D20-02", 20, "Mentor observation notes", "PEOPLE", "REVIEW", "Mentor records observations of the internal review.", { owner: "MENTOR", dependsOn: ["D20-01"] }),
  // Day 21 — Scenario certification
  t("D21-01", 21, "Certification: RFQ response", "PROCESS", "SCENARIO", "Complete the RFQ-response certification scenario.", { ref: "scenario:SCN-RFQ" }),
  t("D21-02", 21, "Certification: price challenge", "PROCESS", "SCENARIO", "Complete the price-challenge certification scenario.", { ref: "scenario:SCN-PRICE" }),
  t("D21-03", 21, "Certification: delivery risk", "PROCESS", "SCENARIO", "Complete the delivery-risk certification scenario.", { ref: "scenario:SCN-DELIVERY" }),
  t("D21-04", 21, "Certification: quality escalation", "GOVERNANCE", "SCENARIO", "Complete the quality-escalation certification scenario.", { ref: "scenario:SCN-QUALITY" }),
  t("D21-05", 21, "Mentor certification review", "GOVERNANCE", "REVIEW", "Mentor reviews certification scenarios and decides the gate.", { ref: "gate:G2", owner: "MENTOR", dependsOn: ["D21-01", "D21-02", "D21-03", "D21-04"] }),
  // Days 22–25 — Guided pricing exposure
  t("D22-01", 22, "Prepare commercial position", "PROCESS", "DELIVERABLE", "Prepare a commercial position for joint discussion. No autonomous pricing.", { exposure: "PRICING", approval: true }),
  t("D23-01", 23, "Reporting Boss reviews position", "GOVERNANCE", "REVIEW", "Reporting Boss reviews and challenges the position.", { owner: "REPORTING_BOSS", exposure: "PRICING", dependsOn: ["D22-01"] }),
  t("D24-01", 24, "Joint live commercial discussion", "PEOPLE", "ACTIVITY", "Join a live commercial discussion jointly with the Reporting Boss.", { exposure: "PRICING", dependsOn: ["D23-01"] }),
  t("D25-01", 25, "Draft negotiated position", "PROCESS", "DELIVERABLE", "Draft the follow-up position for Reporting Boss approval.", { exposure: "PRICING", approval: true, dependsOn: ["D24-01"] }),
  // Days 26–29 — Guided customer ownership
  t("D26-01", 26, "Own agreed account scope", "PEOPLE", "ACTIVITY", "Own the agreed account scope; daily light-touch review.", { exposure: "CUSTOMER" }),
  t("D27-01", 27, "Daily review log", "PROCESS", "ACTIVITY", "Log daily review outcomes with your mentor.", { exposure: "CUSTOMER" }),
  t("D28-01", 28, "Alternate-day review log", "PROCESS", "ACTIVITY", "Review cadence moves to alternate days.", { exposure: "CUSTOMER" }),
  t("D29-01", 29, "Assemble panel evidence", "GOVERNANCE", "DELIVERABLE", "Assemble evidence: live cases, outputs, scenario results, dependency trend."),
  // Day 30 — Readiness panel
  t("D30-01", 30, "Mentor panel input", "PEOPLE", "REVIEW", "Mentor submits panel input.", { ref: "panel:MENTOR", owner: "MENTOR" }),
  t("D30-02", 30, "HR panel input", "PEOPLE", "REVIEW", "HR submits panel input.", { ref: "panel:HR", owner: "HR_ADMIN" }),
  t("D30-03", 30, "Reporting Boss final sign-off", "GOVERNANCE", "REVIEW", "Reporting Boss records the final readiness decision.", { ref: "panel:SIGNOFF", owner: "REPORTING_BOSS", dependsOn: ["D30-01", "D30-02"] }),
];

export const SESSION_TYPES = [
  "HR Orientation", "Mentor Check-in", "Product Training", "Process Training", "Plant Walk",
  "Customer 360 Review", "Manager Review", "Assessment", "Scenario Certification", "Readiness Panel",
];

export const KNOWLEDGE_CATEGORIES = [
  "Company", "Products", "Customers", "Sales", "Processes", "Training", "Policies", "Quality", "Governance", "Account",
];

export interface SeedSetting {
  key: string; value: unknown; category: string; label: string; description: string;
  type: "number" | "boolean" | "string" | "json" | "date";
}

export const SETTINGS: SeedSetting[] = [
  { key: "PROGRAMME_NAME", value: "FirstGear KAM Onboarding Compass", category: "programme", label: "Programme name", description: "Displayed across the application.", type: "string" },
  { key: "PROGRAMME_DURATION", value: 30, category: "programme", label: "Programme duration (days)", description: "Length of the standard journey before any extension.", type: "number" },
  { key: "ONBOARDING_START_OFFSET_DAYS", value: 0, category: "programme", label: "Onboarding start day (offset from joining)", description: "Days after the joining date that Day 1 begins for new instances.", type: "number" },
  { key: "DAY_COUNTING", value: "CALENDAR", category: "programme", label: "Day counting", description: "CALENDAR or BUSINESS days for due/overdue calculation.", type: "string" },
  { key: "GOVERNANCE_WEIGHT", value: 25, category: "scoring", label: "Governance weight (%)", description: "Day-15 pillar weight. Pillar weights must total 100.", type: "number" },
  { key: "PEOPLE_WEIGHT", value: 20, category: "scoring", label: "People weight (%)", description: "Day-15 pillar weight.", type: "number" },
  { key: "PROCESS_WEIGHT", value: 30, category: "scoring", label: "Process weight (%)", description: "Day-15 pillar weight.", type: "number" },
  { key: "PRODUCT_WEIGHT", value: 25, category: "scoring", label: "Product weight (%)", description: "Day-15 pillar weight.", type: "number" },
  { key: "DAY15_GREEN_THRESHOLD", value: 80, category: "gates", label: "Day-15 Green threshold (%)", description: "Score at or above this is Green.", type: "number" },
  { key: "DAY15_AMBER_THRESHOLD", value: 60, category: "gates", label: "Day-15 Amber threshold (%)", description: "Score at or above this (and below Green) is Amber; below is Red.", type: "number" },
  { key: "DAY10_PASS_THRESHOLD", value: 70, category: "gates", label: "Day-10 knowledge check pass (%)", description: "Minimum interim knowledge-check score required before the Day-15 assessment.", type: "number" },
  { key: "DAY21_PASS_THRESHOLD", value: 75, category: "gates", label: "Day-21 scenario test pass (%)", description: "Minimum average certification score. Mentors cannot approve below this.", type: "number" },
  { key: "DAY21_REQUIRED", value: true, category: "gates", label: "Day-21 scenario test required", description: "Gate 2 (Day-21 scenario test) must pass before pricing or customer ownership.", type: "boolean" },
  { key: "PRICING_GATE_REQUIRED", value: true, category: "gates", label: "Pricing gate required", description: "Pricing exposure needs a Green Day-15 score and Reporting Boss approval.", type: "boolean" },
  { key: "CUSTOMER_OWNERSHIP_GATE_REQUIRED", value: true, category: "gates", label: "Customer-ownership gate required", description: "Guided customer ownership needs Reporting Boss approval.", type: "boolean" },
  { key: "AMBER_REFRESH_DAYS", value: 4, category: "remediation", label: "Amber refresh length (days)", description: "Targeted refresh length for Amber (3–5).", type: "number" },
  { key: "RED_EXTENSION_DAYS", value: 10, category: "remediation", label: "Red extension (days)", description: "Proposed onboarding extension for Red.", type: "number" },
  { key: "READINESS_WEIGHTS", value: { tasks: 30, knowledge: 30, scenario: 25, gates: 15 }, category: "scoring", label: "Overall readiness composition (%)", description: "How the dashboard 'overall readiness' combines task completion, knowledge score, scenario score and gate progress. Must total 100.", type: "json" },
  { key: "REMINDER_LEAD_DAYS", value: 1, category: "notifications", label: "Reminder lead time (days)", description: "How far ahead sessions, assessments and gates are flagged.", type: "number" },
  { key: "SESSION_TYPES", value: SESSION_TYPES, category: "sessions", label: "Session types", description: "Session types available when scheduling.", type: "json" },
  { key: "KNOWLEDGE_CATEGORIES", value: KNOWLEDGE_CATEGORIES, category: "knowledge", label: "Knowledge categories", description: "Categories available for knowledge documents.", type: "json" },
  { key: "RAG_TOP_K", value: 6, category: "knowledge", label: "Retrieved passages per answer", description: "Number of passages passed to the generator.", type: "number" },
  { key: "RAG_MIN_SIMILARITY", value: 0.35, category: "knowledge", label: "Minimum retrieval similarity", description: "Below this, the assistant says evidence is insufficient instead of answering.", type: "number" },
];
