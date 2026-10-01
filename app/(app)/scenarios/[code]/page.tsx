import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { kamSnapshot } from "@/lib/services/page";
import { actionContext } from "@/lib/services/context";
import { listScenariosForKam } from "@/lib/services/scenarios";
import { Card, PageHeader, Notice, Badge, StatusPill, fmtDate } from "@/components/ui";
import { ScenarioRunner } from "@/components/kam/ScenarioRunner";

export const dynamic = "force-dynamic";

export default async function ScenarioPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { snap, error } = await kamSnapshot();
  if (!snap) return <Notice tone="warn" title="Onboarding not available">{error}</Notice>;
  const ctx = await actionContext({ rateLimit: false });
  const s = (await listScenariosForKam(ctx)).find((x) => x.code === code);
  if (!s) notFound();
  const history = snap.scenarioAttempts.filter((a) => a.scenario_code === code).reverse();
  return (
    <>
      <Link href="/scenarios" className="link mb-4 inline-flex items-center gap-1 text-sm"><ArrowLeft size={14} />Scenarios</Link>
      <PageHeader title={s.title} eyebrow={s.category} actions={s.is_certification ? <Badge tone="accent">Day-21 certification scenario</Badge> : undefined} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card title="Situation">
            <p className="text-sm leading-relaxed text-ink-soft">{s.situation}</p>
            <p className="mt-3 text-sm font-medium">{s.prompt}</p>
            {s.source_document && <p className="mt-3 text-[11px] text-ink-faint">Reference: {s.source_document}</p>}
          </Card>
          <Card><ScenarioRunner code={s.code} isCertificationScenario={s.is_certification} isCertificationWindow={snap.journey.certificationAvailable.available} /></Card>
        </div>
        <div className="space-y-6">
          <Card title="What good looks like" subtitle="Rubric criteria and their weight">
            <ul className="space-y-2 text-sm">{s.rubric.map((c) => <li key={c.id}><div className="flex justify-between gap-2"><span className="font-medium">{c.criterion}</span><span className="tabular-nums text-ink-muted">{c.weight}</span></div><div className="text-xs text-ink-muted">{c.description}</div></li>)}</ul>
            <p className="mt-3 text-[11px] text-ink-faint">Committing to prices, discounts or unconfirmed dates without approval triggers a deterministic penalty.</p>
          </Card>
          <Card title="Your attempts">
            {history.length ? <ul className="space-y-2 text-sm">{history.map((h) => <li key={h.id} className="flex items-center justify-between gap-2"><span>{fmtDate(h.created_at, true)}{h.is_certification ? " · cert" : ""}</span><span className="flex items-center gap-2"><span className="tabular-nums">{h.reviewer_score ?? h.score}%</span><StatusPill status={h.status} /></span></li>)}</ul> : <p className="text-sm text-ink-muted">No attempts yet.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
