import { NextResponse } from "next/server";
import { actionContext, ServiceError } from "@/lib/services/context";
import { handleAssistantMessage } from "@/lib/ai/assistant";
import { ChatSchema, firstError } from "@/lib/security/validation";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const v = ChatSchema.safeParse(body);
  if (!v.success) return NextResponse.json({ error: firstError(v.error) }, { status: 400 });
  try {
    const ctx = await actionContext({ rateLimit: false });
    const reply = await handleAssistantMessage(ctx, v.data.message, v.data.sessionId);
    return NextResponse.json(reply);
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[assistant]", (e as Error).message);
    return NextResponse.json({ error: "The assistant is unavailable right now." }, { status: 500 });
  }
}

/** The KAM's latest assistant conversation — used by the Ask FirstGear dock when it opens. */
export async function GET() {
  try {
    const ctx = await actionContext({ rateLimit: false });
    if (ctx.actor.role !== "KAM" || !ctx.employeeId) return NextResponse.json({ sessionId: null, messages: [] });
    const { data: session } = await ctx.db.from("conversation_sessions").select("id").eq("employee_id", ctx.employeeId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (!session) return NextResponse.json({ sessionId: null, messages: [] });
    const { data: msgs } = await ctx.db.from("conversation_messages").select("id, role, content, citations, actions, grounding, intent, intent_source")
      .eq("session_id", session.id).order("created_at", { ascending: false }).limit(40);
    return NextResponse.json({ sessionId: session.id, messages: (msgs ?? []).reverse() });
  } catch (e) {
    console.error("[assistant:history]", (e as Error).message);
    return NextResponse.json({ sessionId: null, messages: [] });
  }
}
