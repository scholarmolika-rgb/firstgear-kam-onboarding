import type { TaskView } from "@/lib/engine/journey";
import { TaskRow, type TaskRowData } from "./TaskRow";
import { Empty } from "@/components/ui";
import type { Role } from "@/types/domain";

export function toRow(t: TaskView): TaskRowData {
  return {
    id: t.id, code: t.code, title: t.title, description: t.description ?? null, day_number: t.day_number, due_day: t.due_day,
    pillar: t.pillar, task_type: t.task_type, owner_role: t.owner_role, availability: t.availability, reason: t.reason,
    overdue: t.overdue, systemDriven: t.systemDriven, requires_approval: t.requires_approval, action_ref: t.action_ref,
    exposure: t.exposure, is_mandatory: t.is_mandatory,
  };
}

/** Renders tasks; `viewerRole` + `relation` decide which checkboxes are live (mirrors server authorisation). */
export function TaskList({ tasks, employeeId, viewerRole, relation, empty = "No tasks." }: { tasks: TaskView[]; employeeId: string; viewerRole: Role; relation: "SELF" | "MENTOR" | "REPORTING_BOSS" | "HR_ADMIN"; empty?: string }) {
  if (!tasks.length) return <Empty title={empty} />;
  const can = (t: TaskView) => {
    if (t.systemDriven) return false;
    if (relation === "HR_ADMIN") return true;
    if (relation === "SELF") return t.owner_role === "KAM";
    return t.owner_role === relation;
  };
  return (
    <ul className="divide-y divide-line">
      {tasks.map((t) => <TaskRow key={t.id} task={toRow(t)} employeeId={employeeId} canTick={can(t)} viewer={viewerRole} learnHref={relation === "SELF" && t.owner_role === "KAM" && t.is_mandatory ? `/learn/${encodeURIComponent(t.code)}` : undefined} />)}
    </ul>
  );
}
