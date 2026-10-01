import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Alert } from "@/lib/engine/alerts";

/**
 * Notification service abstraction. The default implementation writes
 * in-app notification cards (deduplicated). Email / Teams / push channels can
 * be added by implementing `NotificationChannel` and registering it below.
 */
export interface NotificationMessage {
  recipientId: string;
  employeeId: string | null;
  type: string;
  severity: "INFO" | "ATTENTION" | "CRITICAL";
  title: string;
  body: string;
  link: string;
  dedupeKey: string;
}

export interface NotificationChannel {
  name: string;
  send(messages: NotificationMessage[]): Promise<void>;
}

export class InAppChannel implements NotificationChannel {
  name = "in-app";
  constructor(private admin: SupabaseClient) {}
  async send(messages: NotificationMessage[]) {
    if (!messages.length) return;
    const rows = messages.map((m) => ({
      recipient_id: m.recipientId, employee_id: m.employeeId, type: m.type, severity: m.severity,
      title: m.title, body: m.body, link: m.link, dedupe_key: m.dedupeKey,
    }));
    const { error } = await this.admin.from("notifications").upsert(rows, { onConflict: "recipient_id,dedupe_key", ignoreDuplicates: true });
    if (error) console.error(`[notifications] ${error.message}`);
  }
}

export function channels(admin: SupabaseClient): NotificationChannel[] {
  return [new InAppChannel(admin)];
  // e.g. if (process.env.SMTP_URL) list.push(new EmailChannel(...))
}

export async function dispatchAlerts(
  admin: SupabaseClient,
  employeeId: string,
  recipients: Partial<Record<"KAM" | "MENTOR" | "REPORTING_BOSS" | "HR_ADMIN", string | null>>,
  alerts: Alert[],
) {
  const msgs: NotificationMessage[] = [];
  for (const a of alerts) {
    for (const role of a.audience) {
      const rid = recipients[role];
      if (!rid) continue;
      const staffLink = role === "KAM" ? a.link : `/people/${employeeId}`;
      msgs.push({ recipientId: rid, employeeId, type: a.type, severity: a.severity, title: a.title, body: a.body, link: staffLink, dedupeKey: `${employeeId}:${a.dedupeKey}` });
    }
  }
  for (const ch of channels(admin)) await ch.send(msgs);
}

export async function notifyOne(admin: SupabaseClient, m: NotificationMessage) {
  for (const ch of channels(admin)) await ch.send([m]);
}
