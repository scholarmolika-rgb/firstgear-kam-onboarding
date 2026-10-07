import { kamSnapshot } from "@/lib/services/page";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, PageHeader, Notice } from "@/components/ui";
import { AssistantChat, type ChatMessage } from "@/components/assistant/AssistantChat";
import { AlertCards } from "@/components/kam/Widgets";

export const metadata = { title: "Ask FirstGear" };
export const dynamic = "force-dynamic";

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ q?: string; new?: string }> }) {
  const { q, new: fresh } = await searchParams;
  const { snap, error } = await kamSnapshot();
  if (!snap) return <Notice tone="warn" title="Onboarding not available">{error}</Notice>;
  const db = await createServerSupabase();
  let sessionId: string | null = null;
  let initial: ChatMessage[] = [];
  if (!fresh) {
    const { data: session } = await db.from("conversation_sessions").select("id").eq("employee_id", snap.employee.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (session) {
      sessionId = session.id;
      const { data: msgs } = await db.from("conversation_messages").select("id, role, content, citations, actions, grounding, intent, intent_source").eq("session_id", session.id).order("created_at").limit(60);
      initial = (msgs ?? []) as ChatMessage[];
    }
  }
  return (
    <>
      <PageHeader
        title="Ask FirstGear"
        subtitle="Your friendly onboarding guide. Ask about your training, products, processes or any company policy — answers come from approved documents with sources, and judgement calls go to your Mentor or Reporting Boss."
        actions={<a href="/assistant?new=1" className="btn-secondary">New conversation</a>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card><AssistantChat initial={initial} sessionId={sessionId} employeeId={snap.employee.id} prefill={q} firstName={snap.employee.full_name.split(" ")[0]} /></Card>
        <div className="space-y-6">
          <Card title="What I'm watching"><AlertCards alerts={snap.alerts.filter((a) => a.audience.includes("KAM"))} max={4} /></Card>
          <Card title="How answers work">
            <ul className="space-y-2 text-xs text-ink-muted">
              <li><strong className="text-ink-soft">Company knowledge</strong> — retrieved from approved, current documents; every answer shows document, section and version.</li>
              <li><strong className="text-ink-soft">Your progress</strong> — read from the database; the rules engine, not the AI, decides gates and scores.</li>
              <li><strong className="text-ink-soft">No evidence, no answer</strong> — if the sources don&apos;t cover it, I say so and offer to ask your Mentor.</li>
              <li><strong className="text-ink-soft">Out of scope</strong> — pricing approvals, readiness decisions and IT access are human or IT decisions.</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
