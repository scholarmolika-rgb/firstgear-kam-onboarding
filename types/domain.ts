/** Core domain vocabulary shared by engines, services and UI. */

export const PILLARS = ["GOVERNANCE", "PEOPLE", "PROCESS", "PRODUCT"] as const;
export type Pillar = (typeof PILLARS)[number];

export const ROLES = ["KAM", "MENTOR", "REPORTING_BOSS", "HR_ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export type TaskType =
  | "LEARNING" | "ACTIVITY" | "SESSION" | "ASSESSMENT" | "SCENARIO"
  | "REVIEW" | "DELIVERABLE" | "REFRESH" | "REMEDIATION";

export type Exposure = "NONE" | "CUSTOMER" | "PRICING";
export type CompletionStatus = "PENDING" | "IN_PROGRESS" | "SUBMITTED" | "COMPLETED" | "REJECTED";
export type Band = "GREEN" | "AMBER" | "RED";

export const GATE_STATUSES = [
  "NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "PASSED", "FAILED",
  "BLOCKED", "REQUIRES_REVIEW", "APPROVED", "EXTENDED",
] as const;
export type GateStatus = (typeof GATE_STATUSES)[number];
export type GateCode = "G1" | "G2" | "G3";

export type QuestionType =
  | "MULTIPLE_CHOICE" | "MULTI_SELECT" | "TRUE_FALSE" | "SHORT_ANSWER"
  | "SCENARIO" | "CASE_STUDY" | "ROLE_PLAY";

export type AssessmentStage = "DAY10_CHECK" | "DAY15_READINESS" | "PRACTICE";

export const ROLE_LABEL: Record<Role, string> = {
  KAM: "Key Account Manager",
  MENTOR: "Mentor",
  REPORTING_BOSS: "Reporting Boss",
  HR_ADMIN: "HR / Admin",
};

export const PILLAR_LABEL: Record<Pillar, string> = {
  GOVERNANCE: "Governance",
  PEOPLE: "People",
  PROCESS: "Process",
  PRODUCT: "Product",
};

/* ── Engine input shapes (deliberately DB-agnostic) ───────────────── */

export interface TaskDef {
  id: string;
  code: string;
  day_number: number;
  due_day: number;
  title: string;
  description?: string | null;
  pillar: Pillar;
  task_type: TaskType;
  owner_role: Role;
  is_mandatory: boolean;
  requires_approval: boolean;
  exposure: Exposure;
  gate_code: string | null;
  action_ref: string | null;
  knowledge_topic?: string | null;
  is_active: boolean;
  instance_id?: string | null;
  sort_order?: number;
}

export interface TaskState {
  task_id: string;
  status: CompletionStatus;
  completed_at: string | null;
  completed_by?: string | null;
}

export interface GateDef {
  id: string;
  code: GateCode;
  day_number: number;
  name: string;
  gate_type: "TASKS" | "ASSESSMENT" | "SCENARIO" | "PANEL";
  approver_role: Role | null;
}

export interface GateResultState {
  gate_id: string;
  code: GateCode;
  status: GateStatus;
  score: number | null;
  band: Band | null;
  decision?: string | null;
  comments?: string | null;
  next_action?: string | null;
  assessor_id?: string | null;
  decided_at?: string | null;
}

export interface ProgrammeConfig {
  programmeName: string;
  duration: number;
  startOffsetDays: number;
  dayCounting: "CALENDAR" | "BUSINESS";
  weights: Record<Pillar, number>;
  greenThreshold: number;
  amberThreshold: number;
  day10PassThreshold: number;
  day21PassThreshold: number;
  day21Required: boolean;
  pricingGateRequired: boolean;
  customerOwnershipGateRequired: boolean;
  amberRefreshDays: number;
  redExtensionDays: number;
  readinessWeights: { tasks: number; knowledge: number; scenario: number; gates: number };
  reminderLeadDays: number;
  supportChatDays: number;
  sessionTypes: string[];
  knowledgeCategories: string[];
  ragTopK: number;
  ragMinSimilarity: number;
}

export interface ManagerDecisionState {
  review_type: string;
  decision: string;
  created_at: string;
}

export interface MentorReviewState {
  review_type: string;
  decision: string;
  rating: number | null;
  created_at: string;
}

export interface SupportEvent {
  event_type: "MENTOR_HELP" | "COLLEAGUE_HELP" | "ESCALATION" | "AI_ESCALATION" | "INDEPENDENT_RESOLUTION";
  day_number: number;
}
