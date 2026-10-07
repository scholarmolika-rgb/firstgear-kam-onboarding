import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { classify, matchKam, matchPlaybook, PLAYBOOK, SUGGESTIONS, type StaffRole } from "@/lib/ai/staff/guide";

const kams = [{ id: "a", full_name: "Riya Sharma" }, { id: "b", full_name: "Neeraj" }, { id: "c", full_name: "Pooja Sharma" }];

describe("Ask Compass — intent routing", () => {
  it("never makes decisions on the user's behalf", () => {
    for (const q of ["Can you approve Neeraj's brief for me?", "please certify Riya automatically", "could you sign off Pooja"]) {
      expect(classify(q, "MENTOR", true)).toBe("DECISION_GUARD");
    }
  });

  it("routes how-to questions to the role's playbook", () => {
    expect(classify("How do I certify the Day-21 scenario test?", "MENTOR", false)).toBe("HOW_TO");
    expect(matchPlaybook("How do I certify the Day-21 scenario test?", "MENTOR")!.id).toBe("certify");
    expect(matchPlaybook("how do I record the day-30 sign-off", "REPORTING_BOSS")!.id).toBe("signoff");
    expect(matchPlaybook("how do I add a new KAM", "HR_ADMIN")!.id).toBe("add-employee");
    expect(matchPlaybook("where do I change the pass marks", "HR_ADMIN")!.id).toBe("config");
  });

  it("only offers playbooks for things the role can actually do", () => {
    expect(matchPlaybook("how do I add a new KAM", "MENTOR")).toBeNull();
    expect(matchPlaybook("how do I certify", "REPORTING_BOSS")?.id).not.toBe("certify");
  });

  it("recognises support requests, status, pending, risk and summary questions", () => {
    expect(classify("How can I support Neeraj?", "MENTOR", true)).toBe("SUPPORT_KAM");
    expect(classify("Neeraj is struggling, what should I do?", "REPORTING_BOSS", true)).toBe("SUPPORT_KAM");
    expect(classify("Where is Riya Sharma now?", "HR_ADMIN", true)).toBe("KAM_STATUS");
    expect(classify("What needs my review today?", "MENTOR", false)).toBe("PENDING");
    expect(classify("Who is at risk or overdue?", "HR_ADMIN", false)).toBe("AT_RISK");
    expect(classify("Give me a cohort summary", "REPORTING_BOSS", false)).toBe("COHORT");
    expect(classify("Any unread messages?", "MENTOR", false)).toBe("MESSAGES");
    expect(classify("What is the margin floor?", "MENTOR", false)).toBe("KNOWLEDGE");
  });
});

describe("Ask Compass — KAM matching", () => {
  it("prefers full names and refuses ambiguous first names", () => {
    expect(matchKam("status of Riya Sharma", kams)?.id).toBe("a");
    expect(matchKam("how is neeraj doing", kams)?.id).toBe("b");
    expect(matchKam("how are the Sharmas doing", kams)).toBeNull();
    expect(matchKam("who is at risk", kams)).toBeNull();
  });
});

describe("Ask Compass — playbooks", () => {
  it("every playbook link points at a page that exists in the app", () => {
    const routes = new Set(["/mentor", "/manager", "/hr", "/messages", "/admin/employees", "/admin/config", "/admin/assessments", "/admin/knowledge", "/admin/audit", "/knowledge/ASSESSMENT-GUIDE"]);
    for (const p of PLAYBOOK) {
      const generic = p.link(null).href.split("?")[0];
      expect(routes.has(generic), `${p.id}: ${generic}`).toBe(true);
      expect(p.link("kam-1").href).toMatch(/^\/(people\/kam-1|messages\?kam=kam-1|admin\/|knowledge\/)/);
      const page = generic.startsWith("/knowledge/") ? "knowledge/[key]" : generic.slice(1);
      expect(existsSync(path.resolve(__dirname, "..", "..", "app", "(app)", page, "page.tsx")), page).toBe(true);
    }
  });

  it("each role gets suggestions it can act on", () => {
    for (const role of ["MENTOR", "REPORTING_BOSS", "HR_ADMIN"] as StaffRole[]) {
      for (const q of SUGGESTIONS[role]) expect(classify(q.replace("{kam}", "Neeraj"), role, q.includes("{kam}"))).not.toBe("KNOWLEDGE");
    }
  });
});
