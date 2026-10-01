import Link from "next/link";
import { kamSnapshot } from "@/lib/services/page";
import { Card, PageHeader, Notice, cn } from "@/components/ui";
import { TaskList } from "@/components/kam/TaskList";
import type { TaskView } from "@/lib/engine/journey";

export const metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "overdue", label: "Overdue" },
  { key: "review", label: "Awaiting review" },
  { key: "locked", label: "Locked / blocked" },
  { key: "done", label: "Completed" },
  { key: "all", label: "All" },
] as const;

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter = "open" } = await searchParams;
  const { snap, error } = await kamSnapshot();
  if (!snap) return <Notice tone="warn" title="Onboarding not available">{error}</Notice>;
  const all = snap.journey.tasks;
  const pred: Record<string, (t: TaskView) => boolean> = {
    open: (t) => t.availability === "AVAILABLE" || t.availability === "WAITING",
    overdue: (t) => t.overdue,
    review: (t) => t.availability === "AWAITING_REVIEW",
    locked: (t) => t.availability === "LOCKED" || t.availability === "BLOCKED",
    done: (t) => t.availability === "DONE",
    all: () => true,
  };
  const list = all.filter(pred[filter] ?? pred.open);
  const count = (k: string) => all.filter(pred[k]).length;
  const byDay = new Map<number, TaskView[]>();
  for (const t of list) byDay.set(t.day_number, [...(byDay.get(t.day_number) ?? []), t]);

  return (
    <>
      <PageHeader title="Tasks" subtitle={`${snap.metrics.taskCompletionPct}% of mandatory tasks complete · ${snap.metrics.overdueCount} overdue`} />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/tasks?filter=${f.key}`} className={cn("rounded-full border px-3 py-1 text-xs font-medium", filter === f.key ? "border-accent bg-accent text-white" : "border-line-strong bg-white text-ink-soft hover:bg-canvas")}>
            {f.label} <span className="ml-1 tabular-nums opacity-75">{count(f.key)}</span>
          </Link>
        ))}
      </div>
      {list.length === 0 ? <Card><p className="text-sm text-ink-muted">No tasks in this view.</p></Card> : (
        <div className="space-y-4">
          {Array.from(byDay.entries()).map(([d, ts]) => (
            <Card key={d} title={<Link href={`/journey/${d}`} className="hover:underline">Day {d}</Link>}>
              <div className="-mx-5 -my-5"><TaskList tasks={ts} employeeId={snap.employee.id} viewerRole="KAM" relation="SELF" /></div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
