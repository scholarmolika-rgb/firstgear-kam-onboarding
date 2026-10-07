import Link from "next/link";
import { kamSnapshot } from "@/lib/services/page";
import { Card, PageHeader, Notice, StatusPill } from "@/components/ui";
import { GateTimeline } from "@/components/charts";
import { JourneyStrip } from "@/components/kam/Widgets";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata = { title: "30-day journey" };
export const dynamic = "force-dynamic";

export default async function JourneyPage() {
  const { snap, error } = await kamSnapshot();
  if (!snap) return <Notice tone="warn" title="Onboarding not available">{error}</Notice>;
  const db = await createServerSupabase();
  const { data: days } = await db.from("onboarding_days").select("day_number, phase, segment, title, pillars").eq("template_id", snap.instance.template_id).order("day_number");
  const j = snap.journey;
  const segments = Array.from(new Map((days ?? []).map((d) => [d.segment, d])).values());

  return (
    <>
      <PageHeader eyebrow={`Day ${Math.max(snap.day, 0)} of ${snap.config.duration}`} title="30-day journey" subtitle="Phase 1 (Days 1–15) builds knowledge with no live pricing and no customer exposure. Phase 2 (Days 16–30) is practise, then own — unlocked by three gates: Day 15 readiness (≥ 80%), Day 21 scenario test and Day 30 panel sign-off. Customer access is earned by passing gates, not by days passing." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card title="Days"><JourneyStrip days={j.days.slice(0, snap.config.duration)} gateDays={j.gates.map((g) => g.day)} /></Card>
          <Card title="Journey map" subtitle="Click a day for objectives, tasks, resources, sessions and evidence">
            <div className="-mx-5 -my-5 divide-y divide-line">
              {segments.map((seg) => {
                const segDays = (days ?? []).filter((d) => d.segment === seg.segment);
                const segState = j.segments.find((s) => s.from <= segDays[0].day_number && s.to >= segDays[0].day_number);
                return (
                  <div key={seg.segment} className="px-5 py-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="label">Phase {seg.phase}</span>
                      <span className="text-sm font-semibold">{seg.segment}</span>
                      <span className="text-xs text-ink-muted">Days {segDays[0].day_number}{segDays.length > 1 ? `–${segDays.at(-1)!.day_number}` : ""}</span>
                      {segState && !segState.open && <StatusPill status={segState.blocked ? "BLOCKED" : "LOCKED"} />}
                    </div>
                    {segState?.reason && <p className="mb-2 text-xs text-ink-muted">{segState.reason}</p>}
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                      {segDays.map((d) => {
                        const dv = j.days.find((x) => x.day === d.day_number)!;
                        return (
                          <li key={d.day_number}>
                            <Link href={`/journey/${d.day_number}`} className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2 hover:bg-canvas">
                              <span className="min-w-0"><span className="text-xs font-semibold text-ink-muted">Day {d.day_number}</span> <span className="text-sm">{d.title}</span></span>
                              <span className="flex shrink-0 items-center gap-2"><span className="text-[11px] tabular-nums text-ink-faint">{dv.done}/{dv.total}</span><StatusPill status={dv.status} /></span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Readiness gates"><GateTimeline gates={j.gates} /></Card>
          <Card title="Exposure controls">
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between"><span className="text-ink-muted">Customer exposure</span><StatusPill status={j.exposure.customer} /></li>
              <li className="flex justify-between"><span className="text-ink-muted">Pricing exposure</span><StatusPill status={j.exposure.pricing} /></li>
            </ul>
            <p className="mt-3 text-xs text-ink-muted">Completing 30 calendar days never makes you ready by itself. Your Reporting Boss records the readiness decision at the Day-30 panel.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
