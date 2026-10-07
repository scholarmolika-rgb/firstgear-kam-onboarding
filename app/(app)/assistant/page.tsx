import { kamSnapshot } from "@/lib/services/page";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, PageHeader, Notice } from "@/components/ui";
import { AssistantChat, type ChatMessage } from "@/components/assistant/AssistantChat";

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
      <Card><AssistantChat initial={initial} sessionId={sessionId} employeeId={snap.employee.id} prefill={q} firstName={snap.employee.full_name.split(" ")[0]} /></Card>
    </>
  );
}
