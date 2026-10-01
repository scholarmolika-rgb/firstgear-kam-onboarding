import { describe, it, expect } from "vitest";
import { canAccessEmployee, canTickTask, mayDecide, relationTo } from "@/lib/auth/access";
import { TaskToggleSchema, SubmitAttemptSchema, ScenarioSubmitSchema, SessionSchema, DocumentMetaSchema, ChatSchema, StakeholderSchema } from "@/lib/security/validation";
import { MemoryRateLimiter } from "@/lib/security/rate-limit";

const emp = { id: "e1", profile_id: "kam", mentor_id: "mentor", reporting_boss_id: "boss" };
const KAM = { id: "kam", role: "KAM" as const };
const OTHER = { id: "x", role: "KAM" as const };
const MENTOR = { id: "mentor", role: "MENTOR" as const };
const BOSS = { id: "boss", role: "REPORTING_BOSS" as const };
const OTHER_BOSS = { id: "b2", role: "REPORTING_BOSS" as const };
const HR = { id: "hr", role: "HR_ADMIN" as const };

describe("role access (mirrors RLS)", () => {
  it("scopes each role to its employees", () => {
    expect(canAccessEmployee(KAM, emp)).toBe(true);
    expect(canAccessEmployee(OTHER, emp)).toBe(false);
    expect(canAccessEmployee(MENTOR, emp)).toBe(true);
    expect(canAccessEmployee(BOSS, emp)).toBe(true);
    expect(canAccessEmployee(OTHER_BOSS, emp)).toBe(false);
    expect(canAccessEmployee(HR, emp)).toBe(true);
    expect(relationTo(MENTOR, emp)).toBe("MENTOR");
  });

  it("only the owner role ticks manual tasks; system-driven tasks are never ticked by hand", () => {
    expect(canTickTask(KAM, emp, { owner_role: "KAM", action_ref: null })).toBe(true);
    expect(canTickTask(MENTOR, emp, { owner_role: "KAM", action_ref: null })).toBe(false);
    expect(canTickTask(KAM, emp, { owner_role: "MENTOR", action_ref: null })).toBe(false);
    expect(canTickTask(MENTOR, emp, { owner_role: "MENTOR", action_ref: null })).toBe(true);
    expect(canTickTask(KAM, emp, { owner_role: "KAM", action_ref: "assessment:DAY15-READINESS" })).toBe(false);
    expect(canTickTask(HR, emp, { owner_role: "KAM", action_ref: null })).toBe(true);
  });

  it("reserves human decisions for the right role — never the KAM", () => {
    expect(mayDecide("DAY30_SIGNOFF", BOSS, emp)).toBe(true);
    expect(mayDecide("DAY30_SIGNOFF", MENTOR, emp)).toBe(false);
    expect(mayDecide("DAY30_SIGNOFF", HR, emp)).toBe(false);
    expect(mayDecide("PRICING_EXPOSURE", OTHER_BOSS, emp)).toBe(false);
    expect(mayDecide("G4_CERTIFICATION", MENTOR, emp)).toBe(true);
    expect(mayDecide("ACCOUNT_BRIEF_REVIEW", KAM, emp)).toBe(false);
    expect(mayDecide("PANEL_HR_INPUT", HR, emp)).toBe(true);
  });
});

describe("API validation", () => {
  const id = "3f1c2a8e-1b2c-4d5e-8f90-1234567890ab";
  it("accepts well-formed input and rejects malformed input", () => {
    expect(TaskToggleSchema.safeParse({ employeeId: id, taskId: id, done: true }).success).toBe(true);
    expect(TaskToggleSchema.safeParse({ employeeId: "x", taskId: id, done: true }).success).toBe(false);
    expect(TaskToggleSchema.safeParse({ employeeId: id, taskId: id, done: "yes" }).success).toBe(false);
    expect(SubmitAttemptSchema.safeParse({ attemptId: id, answers: { [id]: ["a", "b"] }, confidence: 4 }).success).toBe(true);
    expect(SubmitAttemptSchema.safeParse({ attemptId: id, answers: {}, confidence: 9 }).success).toBe(false);
    expect(ScenarioSubmitSchema.safeParse({ code: "SCN-RFQ", response: "too short" }).success).toBe(false);
    expect(SessionSchema.safeParse({ employeeId: id, title: "Mentor check-in", sessionType: "Mentor Check-in", scheduledAt: "2026-10-05T10:00", durationMinutes: 45 }).success).toBe(true);
    expect(SessionSchema.safeParse({ employeeId: id, title: "x", sessionType: "Mentor Check-in", scheduledAt: "soon", durationMinutes: 45 }).success).toBe(false);
    expect(ChatSchema.safeParse({ message: " " }).success).toBe(false);
    expect(ChatSchema.safeParse({ message: "x".repeat(2001) }).success).toBe(false);
    expect(StakeholderSchema.safeParse({ side: "CUSTOMER", function: "PURCHASING", name: "A. Buyer", influence: "HIGH", relationship_status: "NEW" }).success).toBe(true);
  });

  it("requires versioned, categorised document metadata", () => {
    const base = { document_key: "RFQ-SOP", name: "RFQ to Quotation SOP", category: "Processes", version: "4.2", approved: true };
    expect(DocumentMetaSchema.safeParse(base).success).toBe(true);
    expect(DocumentMetaSchema.safeParse({ ...base, version: "" }).success).toBe(false);
    expect(DocumentMetaSchema.safeParse({ ...base, category: "Random" }).success).toBe(false);
    expect(DocumentMetaSchema.safeParse({ ...base, document_key: "rfq sop" }).success).toBe(false);
  });
});

describe("rate limiting", () => {
  it("throttles bursts and refills", async () => {
    const rl = new MemoryRateLimiter(2, 1000);
    expect((await rl.take("u")).ok).toBe(true);
    expect((await rl.take("u")).ok).toBe(true);
    const third = await rl.take("u");
    expect(third.ok).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(0);
    expect((await rl.take("other")).ok).toBe(true);
  });
});
