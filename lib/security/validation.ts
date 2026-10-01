import { z } from "zod";
import { PILLARS } from "@/types/domain";

/** Input validation for every server action and API route. */

export const uuid = z.string().uuid();

export const TaskToggleSchema = z.object({
  employeeId: uuid,
  taskId: uuid,
  done: z.boolean(),
  evidence: z.string().max(2000).optional(),
});

export const TaskReviewSchema = z.object({
  employeeId: uuid,
  taskId: uuid,
  decision: z.enum(["APPROVE", "REJECT"]),
  comments: z.string().max(2000).optional(),
});

export const AnswerValueSchema = z.union([z.string().max(4000), z.array(z.string().max(20)).max(20), z.boolean(), z.null()]);

export const SubmitAttemptSchema = z.object({
  attemptId: uuid,
  answers: z.record(uuid, AnswerValueSchema),
  confidence: z.number().int().min(1).max(5),
});

export const ScenarioSubmitSchema = z.object({
  code: z.string().min(3).max(40),
  response: z.string().trim().min(40, "Please write at least a few sentences.").max(6000),
});

export const ScenarioReviewSchema = z.object({
  attemptId: uuid,
  reviewerScore: z.number().min(0).max(100),
  comments: z.string().max(3000).optional(),
});

export const SessionSchema = z.object({
  employeeId: uuid,
  title: z.string().trim().min(3).max(140),
  sessionType: z.string().min(2).max(60),
  scheduledAt: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid date/time"),
  durationMinutes: z.number().int().min(5).max(600),
  meetingLink: z.string().url().max(500).optional().or(z.literal("")),
  location: z.string().max(200).optional(),
  dayNumber: z.number().int().min(1).max(120).optional(),
  notes: z.string().max(2000).optional(),
});

export const BriefSchema = z.object({
  customer_name: z.string().trim().min(2).max(120),
  customer_organization: z.string().max(5000).optional().default(""),
  strategic_context: z.string().max(5000).optional().default(""),
  applications: z.string().max(5000).optional().default(""),
  supplied_parts: z.string().max(5000).optional().default(""),
  programmes: z.string().max(5000).optional().default(""),
  volumes: z.string().max(5000).optional().default(""),
  pipeline: z.string().max(5000).optional().default(""),
  pricing_history: z.string().max(5000).optional().default(""),
  commercial_history: z.string().max(5000).optional().default(""),
  open_commitments: z.string().max(5000).optional().default(""),
  past_issues: z.string().max(5000).optional().default(""),
  lessons_learned: z.string().max(5000).optional().default(""),
  source_notes: z.string().max(5000).optional().default(""),
});

export const StakeholderSchema = z.object({
  side: z.enum(["CUSTOMER", "INTERNAL"]),
  function: z.enum(["PURCHASING", "ENGINEERING", "QUALITY", "SCM", "PLANT", "FINANCE", "NPD", "PROGRAMME", "LEADERSHIP", "OTHER"]),
  name: z.string().trim().min(2).max(120),
  title: z.string().max(120).optional(),
  influence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  relationship_status: z.enum(["NEW", "DEVELOPING", "ESTABLISHED", "AT_RISK"]),
  notes: z.string().max(1000).optional(),
});

export const ChatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  sessionId: uuid.optional(),
  employeeId: uuid.optional(),
});

export const DocumentMetaSchema = z.object({
  document_key: z.string().trim().min(2).max(80).regex(/^[A-Z0-9][A-Z0-9_-]*$/, "Use UPPER-CASE letters, digits, - or _"),
  name: z.string().trim().min(3).max(160),
  category: z.enum(["Company", "Products", "Customers", "Sales", "Processes", "Training", "Policies", "Quality", "Governance", "Account"]),
  topic: z.string().max(80).optional(),
  version: z.string().trim().min(1).max(20),
  owner: z.string().max(120).optional(),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  source_url: z.string().url().optional().or(z.literal("")),
  approved: z.boolean(),
});

export const QuestionSchema = z.object({
  question_code: z.string().trim().min(3).max(40),
  assessment_stage: z.enum(["DAY10_CHECK", "DAY15_READINESS", "PRACTICE"]),
  question_type: z.enum(["MULTIPLE_CHOICE", "MULTI_SELECT", "TRUE_FALSE", "SHORT_ANSWER", "SCENARIO", "CASE_STUDY", "ROLE_PLAY"]),
  pillar: z.enum(PILLARS),
  topic: z.string().trim().min(2).max(80),
  difficulty: z.enum(["easy", "medium", "hard"]),
  question: z.string().trim().min(10).max(2000),
  options: z.array(z.object({ id: z.string().min(1).max(4), text: z.string().min(1).max(400) })).max(8),
  correct_answer: z.unknown(),
  explanation: z.string().max(2000).optional(),
  weight: z.number().positive().max(10),
  source_document: z.string().max(160).optional(),
  source_reference: z.string().max(160).optional(),
  is_active: z.boolean(),
});

export function firstError(e: z.ZodError): string {
  const i = e.issues[0];
  return i ? `${i.path.join(".") || "input"}: ${i.message}` : "Invalid input";
}
