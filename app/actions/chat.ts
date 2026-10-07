"use server";
/**
 * Support chat actions (KAM ↔ Mentor ↔ HR). Validated, authorised in the
 * service, written through the user's RLS-scoped client.
 */
import { z } from "zod";
import { actionContext, run, type Result } from "@/lib/services/context";
import { sendChatMessage, markChatRead, type ChatMessage } from "@/lib/services/chat";

const SendSchema = z.object({
  employeeId: z.string().uuid(),
  body: z.string().trim().min(1, "Write a message first.").max(2000),
  contextRef: z.string().trim().max(40).nullable().optional(),
});

export async function sendChatAction(input: z.input<typeof SendSchema>): Promise<Result<ChatMessage>> {
  return run(async () => {
    const v = SendSchema.parse(input);
    const ctx = await actionContext();
    return sendChatMessage(ctx, v.employeeId, v.body, v.contextRef ?? null);
  });
}

export async function markChatReadAction(employeeId: string): Promise<Result<true>> {
  return run(async () => {
    const id = z.string().uuid().parse(employeeId);
    await markChatRead(await actionContext({ rateLimit: false }), id);
    return true as const;
  });
}
