import { requireRole } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { getConfig } from "@/lib/services/settings";
import { Card, PageHeader } from "@/components/ui";
import { ConfigForm, TaskEditor, type EditableTask } from "@/components/admin/ConfigEditors";

export const metadata = { title: "Programme configuration" };
export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  await requireRole(["HR_ADMIN"]);
  const db = await createServerSupabase();
  const config = await getConfig(db);
  const { data: tpl } = await db.from("onboarding_templates").select("id, name, version").eq("is_active", true).order("created_at").limit(1).single();
  const { data: tasks } = await db.from("tasks").select("*").eq("template_id", tpl!.id).order("day_number").order("sort_order");
  const { data: deps } = await db.from("task_dependencies").select("task_id, depends_on_task_id");
  const { data: gates } = await db.from("gate_definitions").select("code, day_number, name, description, approver_role, unlocks").eq("template_id", tpl!.id).order("sort_order");
  const codeById = new Map((tasks ?? []).map((t) => [t.id, t.code]));
  const editable: EditableTask[] = (tasks ?? []).map((t) => ({ ...t, description: t.description ?? "", depends_on: (deps ?? []).filter((d) => d.task_id === t.id).map((d) => codeById.get(d.depends_on_task_id)!).filter(Boolean) }));
  return (
    <>
      <PageHeader title="Programme configuration" subtitle="Everything here is stored in Supabase and read dynamically by the rules engine. Changes are validated (weights must total 100%, thresholds must be consistent) and audited." />
      <div className="space-y-6">
        <Card title="Settings, weights & thresholds"><ConfigForm initial={config} /></Card>
        <Card title="Readiness gates" subtitle="Gate rules are deterministic; thresholds above control them">
          <table className="table"><thead><tr><th>Gate</th><th>Day</th><th>Decision by</th><th>Unlocks</th></tr></thead><tbody>
            {(gates ?? []).map((g) => <tr key={g.code}><td><div className="font-medium">{g.code} — {g.name}</div><div className="text-xs text-ink-muted">{g.description}</div></td><td>{g.day_number}</td><td className="text-xs">{g.approver_role ? g.approver_role.replace("_", " ").toLowerCase() : "rules"}</td><td className="text-xs">{(g.unlocks as string[]).join(", ").toLowerCase().replace(/_/g, " ")}</td></tr>)}
          </tbody></table>
        </Card>
        <Card title={`Journey tasks — ${tpl!.name}`} subtitle="Edit names, descriptions, due days, owners, pillars, dependencies and mandatory/optional status. New tasks appear immediately for active KAMs."><TaskEditor templateId={tpl!.id} tasks={editable} /></Card>
      </div>
    </>
  );
}
