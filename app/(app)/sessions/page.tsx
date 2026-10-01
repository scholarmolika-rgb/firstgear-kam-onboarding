import { kamSnapshot } from "@/lib/services/page";
import { Card, PageHeader, Notice, Empty } from "@/components/ui";
import { ScheduleForm, SessionRow } from "@/components/kam/Sessions";

export const metadata = { title: "Sessions" };
export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const { snap, error } = await kamSnapshot();
  if (!snap) return <Notice tone="warn" title="Onboarding not available">{error}</Notice>;
  const now = Date.now() - 2 * 3_600_000;
  const upcoming = snap.sessions.filter((s) => Date.parse(s.scheduled_at) >= now && s.status !== "CANCELLED" && s.status !== "COMPLETED");
  const past = snap.sessions.filter((s) => !upcoming.includes(s)).reverse();
  return (
    <>
      <PageHeader title="Sessions" subtitle="HR orientation, mentor check-ins, training, plant walks, reviews, assessments and the readiness panel. Your mentor is notified when you schedule or reschedule." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Upcoming">{upcoming.length ? <ul className="-mx-5 -my-5 divide-y divide-line">{upcoming.map((s) => <SessionRow key={s.id} s={s} />)}</ul> : <Empty title="No upcoming sessions" />}</Card>
          <Card title="Past & cancelled">{past.length ? <ul className="-mx-5 -my-5 divide-y divide-line">{past.map((s) => <SessionRow key={s.id} s={s} />)}</ul> : <Empty title="Nothing yet" />}</Card>
        </div>
        <Card title="Schedule a session" subtitle="Stored in the Compass; calendar sync is pluggable (Microsoft / Google)">
          <ScheduleForm employeeId={snap.employee.id} sessionTypes={snap.config.sessionTypes} />
        </Card>
      </div>
    </>
  );
}
