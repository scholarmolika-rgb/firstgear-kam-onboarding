import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ServiceError, requireEmployeeAccess, type ActionContext } from "./context";
import { getConfig, todayIso } from "./settings";
import { onboardingDay, dateForDay } from "@/lib/engine/calendar";
import { relationTo } from "@/lib/auth/access";
import { notifyOne } from "@/lib/notifications/service";

/**
 * KAM support chat: one thread per KAM shared with their Mentor and HR.
 * Messages can be sent during the first SUPPORT_CHAT_DAYS of onboarding
 * (default 15); afterwards the thread is read-only. Reads and writes go
 * through the user's own client, so Row Level Security enforces who is a
 * participant; the service adds the window rule and notifications.
 */

export type ChatRole = "KAM" | "MENTOR" | "HR_ADMIN";

let enabledCache: { value: boolean; at: number } | null = null;

/**
 * True once migration 008 (chat tables) has been applied. Until then chat
 * entry points stay hidden and chat pages explain it is being enabled, so the
 * app can be deployed before the schema change. A positive result is cached
 * for the life of the server instance; a negative one is re-checked each minute.
 */
export async function chatEnabled(admin: SupabaseClient): Promise<boolean> {
  if (enabledCache && (enabledCache.value || Date.now() - enabledCache.at < 60_000)) return enabledCache.value;
  // A GET (not HEAD), so a missing table comes back with a real error body.
  const { error, status } = await admin.from("chat_threads").select("id").limit(1);
  const missing = !!error && (status === 404 || error.code === "42P01" || error.code === "PGRST205" || /does not exist|could not find the table|schema cache/i.test(error.message ?? ""));
  if (error && !missing) return enabledCache?.value ?? false; // transient error: keep the last known state
  enabledCache = { value: !missing, at: Date.now() };
  return enabledCache.value;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_role: ChatRole;
  body: string;
  context_ref: string | null;
  created_at: string;
}

export interface ChatWindow { open: boolean; day: number; lastDay: number; closesOn: string | null; reason: string | null }

export interface ThreadView {
  threadId: string;
  employeeId: string;
  kamName: string;
  names: Record<string, string>;
  messages: ChatMessage[];
  window: ChatWindow;
  lastReadAt: string | null;
}

function chatRole(ctx: ActionContext, emp: Parameters<typeof relationTo>[1]): ChatRole {
  const rel = relationTo(ctx.actor, emp);
  if (rel === "SELF") return "KAM";
  if (rel === "MENTOR") return "MENTOR";
  if (rel === "HR_ADMIN") return "HR_ADMIN";
  throw new ServiceError("The support chat is between the KAM, their Mentor and HR.");
}

export async function chatWindow(admin: SupabaseClient, employeeId: string): Promise<ChatWindow> {
  const cfg = await getConfig(admin);
  const { data: inst } = await admin.from("onboarding_instances").select("start_date").eq("employee_id", employeeId)
    .in("status", ["ACTIVE", "EXTENDED", "NOT_STARTED"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!inst) return { open: false, day: 0, lastDay: cfg.supportChatDays, closesOn: null, reason: "No active onboarding." };
  const day = onboardingDay(inst.start_date, todayIso(), cfg.dayCounting);
  const lastDay = cfg.supportChatDays;
  const closesOn = lastDay > 0 ? dateForDay(inst.start_date, lastDay, cfg.dayCounting) : null;
  const open = lastDay > 0 && day <= lastDay;
  return { open, day, lastDay, closesOn, reason: open ? null : `The support chat is open for the first ${lastDay} days of onboarding; this KAM is on Day ${day}. The thread stays readable.` };
}

async function ensureThread(admin: SupabaseClient, employeeId: string): Promise<string> {
  const { data: found } = await admin.from("chat_threads").select("id").eq("employee_id", employeeId).maybeSingle();
  if (found) return found.id;
  const { data, error } = await admin.from("chat_threads").upsert({ employee_id: employeeId }, { onConflict: "employee_id" }).select("id").single();
  if (error || !data) throw new ServiceError("Could not open the chat.");
  return data.id;
}

export async function loadThread(ctx: ActionContext, employeeId: string): Promise<ThreadView> {
  const emp = await requireEmployeeAccess(ctx, employeeId);
  chatRole(ctx, emp);
  const threadId = await ensureThread(ctx.admin, employeeId);
  const [{ data: msgs }, window, { data: read }] = await Promise.all([
    ctx.db.from("chat_messages").select("id, sender_id, sender_role, body, context_ref, created_at").eq("thread_id", threadId).order("created_at").limit(300),
    chatWindow(ctx.admin, employeeId),
    ctx.db.from("chat_reads").select("last_read_at").eq("thread_id", threadId).eq("user_id", ctx.actor.id).maybeSingle(),
  ]);
  const ids = Array.from(new Set([emp.profile_id, emp.mentor_id, ...(msgs ?? []).map((m) => m.sender_id)].filter(Boolean) as string[]));
  const { data: people } = ids.length ? await ctx.admin.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  return {
    threadId, employeeId, kamName: emp.full_name,
    names: Object.fromEntries((people ?? []).map((p) => [p.id, p.full_name])),
    messages: (msgs ?? []) as ChatMessage[], window, lastReadAt: read?.last_read_at ?? null,
  };
}

export async function sendChatMessage(ctx: ActionContext, employeeId: string, body: string, contextRef: string | null): Promise<ChatMessage> {
  const emp = await requireEmployeeAccess(ctx, employeeId);
  const role = chatRole(ctx, emp);
  const text = body.trim();
  if (!text) throw new ServiceError("Write a message first.");
  if (text.length > 2000) throw new ServiceError("Keep messages under 2,000 characters.");
  const window = await chatWindow(ctx.admin, employeeId);
  if (!window.open) throw new ServiceError(window.reason ?? "The support chat is closed.");
  const threadId = await ensureThread(ctx.admin, employeeId);
  const { data, error } = await ctx.db.from("chat_messages").insert({
    thread_id: threadId, employee_id: employeeId, sender_id: ctx.actor.id, sender_role: role, body: text, context_ref: contextRef,
  }).select("id, sender_id, sender_role, body, context_ref, created_at").single();
  if (error || !data) throw new ServiceError("The message could not be sent.");
  await ctx.admin.from("chat_threads").update({ last_message_at: data.created_at }).eq("id", threadId);
  await ctx.db.from("chat_reads").upsert({ thread_id: threadId, user_id: ctx.actor.id, last_read_at: data.created_at }, { onConflict: "thread_id,user_id" });

  // Tell the other participants (one notification per sender per thread per hour).
  let recipients = [emp.profile_id, emp.mentor_id, emp.hr_owner_id].filter((x): x is string => !!x && x !== ctx.actor.id);
  if (!emp.hr_owner_id && role !== "HR_ADMIN") {
    const { data: hr } = await ctx.admin.from("profiles").select("id").eq("role", "HR_ADMIN").eq("is_active", true);
    recipients = [...recipients, ...(hr ?? []).map((h) => h.id).filter((id) => id !== ctx.actor.id)];
  }
  const hour = new Date().toISOString().slice(0, 13);
  for (const r of Array.from(new Set(recipients))) {
    await notifyOne(ctx.admin, {
      recipientId: r, employeeId, type: "CHAT_MESSAGE", severity: "INFO",
      title: `${ctx.actor.name} sent a message${role === "KAM" ? "" : ` about ${emp.full_name}`}`,
      body: text.length > 140 ? `${text.slice(0, 140)}…` : text,
      link: r === emp.profile_id ? "/chat" : `/messages?kam=${employeeId}`,
      dedupeKey: `chat:${threadId}:${ctx.actor.id}:${r}:${hour}`,
    });
  }
  return data as ChatMessage;
}

export async function markChatRead(ctx: ActionContext, employeeId: string): Promise<void> {
  const emp = await requireEmployeeAccess(ctx, employeeId);
  chatRole(ctx, emp);
  const threadId = await ensureThread(ctx.admin, employeeId);
  await ctx.db.from("chat_reads").upsert({ thread_id: threadId, user_id: ctx.actor.id, last_read_at: new Date().toISOString() }, { onConflict: "thread_id,user_id" });
}

export interface InboxRow { employeeId: string; name: string; code: string | null; lastMessage: ChatMessage | null; unread: number; window: ChatWindow }

/** Staff inbox: every KAM the Mentor / HR user can chat with, most recent first. */
export async function chatInbox(ctx: ActionContext): Promise<InboxRow[]> {
  if (ctx.actor.role !== "MENTOR" && ctx.actor.role !== "HR_ADMIN") throw new ServiceError("Messages are for Mentors and HR.");
  let q = ctx.db.from("employees").select("id, full_name, employee_code, mentor_id").eq("status", "ACTIVE").order("full_name");
  if (ctx.actor.role === "MENTOR") q = q.eq("mentor_id", ctx.actor.id);
  const { data: emps } = await q;
  const ids = (emps ?? []).map((e) => e.id);
  if (!ids.length) return [];
  const [{ data: threads }, { data: reads }] = await Promise.all([
    ctx.db.from("chat_threads").select("id, employee_id, last_message_at").in("employee_id", ids),
    ctx.db.from("chat_reads").select("thread_id, last_read_at").eq("user_id", ctx.actor.id),
  ]);
  const readAt = new Map((reads ?? []).map((r) => [r.thread_id, r.last_read_at]));
  const rows: InboxRow[] = [];
  for (const e of emps ?? []) {
    const t = (threads ?? []).find((x) => x.employee_id === e.id);
    let lastMessage: ChatMessage | null = null;
    let unread = 0;
    if (t) {
      const { data: last } = await ctx.db.from("chat_messages").select("id, sender_id, sender_role, body, context_ref, created_at").eq("thread_id", t.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      lastMessage = (last as ChatMessage) ?? null;
      let uq = ctx.db.from("chat_messages").select("id", { count: "exact", head: true }).eq("thread_id", t.id).neq("sender_id", ctx.actor.id);
      const since = readAt.get(t.id);
      if (since) uq = uq.gt("created_at", since);
      const { count } = await uq;
      unread = count ?? 0;
    }
    rows.push({ employeeId: e.id, name: e.full_name, code: e.employee_code, lastMessage, unread, window: await chatWindow(ctx.admin, e.id) });
  }
  return rows.sort((a, b) => (b.lastMessage?.created_at ?? "").localeCompare(a.lastMessage?.created_at ?? "") || a.name.localeCompare(b.name));
}
