import { requireRole } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { getConfig } from "@/lib/services/settings";
import { Card, PageHeader } from "@/components/ui";
import { QuestionBank, RubricEditor, type QuestionData, type ScenarioData } from "@/components/admin/AssessmentEditors";

export const metadata = { title: "Assessment management" };
export const dynamic = "force-dynamic";

export default async function AssessmentAdmin() {
  await requireRole(["HR_ADMIN"]);
  const db = await createServerSupabase();
  const cfg = await getConfig(db);
  const { data: qs } = await db.from("assessment_questions").select("*").order("assessment_stage").order("pillar").order("sort_order");
  const { data: sc } = await db.from("scenario_templates").select("id, code, title, is_certification, is_active, rubric").order("sort_order");
  const day15 = (qs ?? []).filter((q) => q.assessment_stage === "DAY15_READINESS" && q.is_active);
  const pillarCount = (p: string) => day15.filter((q) => q.pillar === p).length;
  return (
    <>
      <PageHeader title="Assessment management" subtitle={`Questions and rubrics live in Supabase — never in the front end. Day-15 bank: ${day15.length} active (Governance ${pillarCount("GOVERNANCE")} · People ${pillarCount("PEOPLE")} · Process ${pillarCount("PROCESS")} · Product ${pillarCount("PRODUCT")}). Pillar weights and thresholds are set in Programme configuration (currently ${cfg.weights.GOVERNANCE}/${cfg.weights.PEOPLE}/${cfg.weights.PROCESS}/${cfg.weights.PRODUCT}).`} />
      <div className="space-y-6">
        <Card title="Question bank" subtitle="Add, edit or deactivate questions. Deactivated questions are excluded from new attempts; past attempts keep their scores."><QuestionBank questions={(qs ?? []) as QuestionData[]} /></Card>
        <Card title="Scenario rubrics" subtitle="Rubric weights must total 100. Criteria are met by keyword rules; AI can only add partial credit."><RubricEditor scenarios={(sc ?? []) as ScenarioData[]} /></Card>
      </div>
    </>
  );
}
