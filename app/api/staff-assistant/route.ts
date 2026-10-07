import { NextResponse } from "next/server";
import { z } from "zod";
import { actionContext, ServiceError } from "@/lib/services/context";
import { handleStaffMessage } from "@/lib/ai/staff/assistant";

export const runtime = "nodejs";

const Body = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) })).max(12).default([]),
});

export async function POST(req: Request) {
  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const v = Body.safeParse(raw);
  if (!v.success) return NextResponse.json({ error: "Write a question (up to 2,000 characters)." }, { status: 400 });
  try {
    const ctx = await actionContext({ rateLimit: false });
    return NextResponse.json(await handleStaffMessage(ctx, v.data.message, v.data.history));
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[staff-assistant]", (e as Error).message);
    return NextResponse.json({ error: "Ask Compass is unavailable right now." }, { status: 500 });
  }
}
