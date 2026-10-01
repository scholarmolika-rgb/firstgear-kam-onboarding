import "server-only";
import { relationTo } from "@/lib/auth/access";
import { getCalendarProvider } from "@/lib/calendar/provider";
import { audit } from "./audit";
import { syncEmployeeState } from "./sync";
import { notifyOne } from "@/lib/notifications/service";
import { activeInstance, requireEmployeeAccess, ServiceError, type ActionContext } from "./context";

export interface SessionInput {
  employeeId: string; title: string; sessionType: string; scheduledAt: string; durationMinutes: number;
  meetingLink?: string; location?: string; dayNumber?: number; notes?: string;
}

async function attendeeEmails(ctx: ActionContext, employeeId: string) {
  const { data: e } = await ctx.admin.from("employees").select("email, mentor_id").eq("id", employeeId).single();
  const { data: m } = e?.mentor_id ? await ctx.admin.from("profiles").select("email").eq("id", e.mentor_id).single() : { data: null };
  return [e?.email, m?.email].filter(Boolean) as string[];
}

export async function scheduleSession(ctx: ActionContext, input: SessionInput) {
  const emp = await requireEmployeeAccess(ctx, input.employeeId);
  const inst = await activeInstance(ctx.admin, input.employeeId);
  const { data: s, error } = await ctx.db.from("sessions").insert({
    employee_id: input.employeeId, instance_id: inst.id, title: input.title, session_type: input.sessionType,
    owner_id: ctx.actor.role === "KAM" ? emp.mentor_id : ctx.actor.id, day_number: input.dayNumber ?? null,
    scheduled_at: new Date(input.scheduledAt).toISOString(), duration_minutes: input.durationMinutes,
    meeting_link: input.meetingLink || null, location: input.location || null, notes: input.notes || null,
    created_by: ctx.actor.id, calendar_provider: getCalendarProvider().name,
  }).select("id").single();
  if (error || !s) throw new ServiceError("Could not schedule the session.");
  const ext = await getCalendarProvider().create({ title: input.title, start: input.scheduledAt, durationMinutes: input.durationMinutes, location: input.location, meetingLink: input.meetingLink, attendees: await attendeeEmails(ctx, input.employeeId), notes: input.notes });
  if (ext.externalId) await ctx.admin.from("sessions").update({ external_event_id: ext.externalId }).eq("id", s.id);
  await ctx.admin.from("session_attendance").insert([
    ...(emp.profile_id ? [{ session_id: s.id, employee_id: input.employeeId, attendee_id: emp.profile_id, status: "INVITED" }] : []),
    ...(emp.mentor_id ? [{ session_id: s.id, employee_id: input.employeeId, attendee_id: emp.mentor_id, status: "INVITED" }] : []),
  ]);
  await audit(ctx.admin, { employeeId: input.employeeId, actor: ctx.actor, event: "SESSION_SCHEDULED", entityType: "session", entityId: s.id, next: { title: input.title, at: input.scheduledAt, type: input.sessionType } });
  const notifyId = relationTo(ctx.actor, emp) === "SELF" ? emp.mentor_id : emp.profile_id;
  if (notifyId) await notifyOne(ctx.admin, { recipientId: notifyId, employeeId: input.employeeId, type: "SESSION", severity: "INFO", title: `Session scheduled: ${input.title}`, body: new Date(input.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.APP_TIMEZONE || "Asia/Kolkata" }), link: "/sessions", dedupeKey: `${input.employeeId}:sess-new-${s.id}` });
  await syncEmployeeState(input.employeeId, ctx.actor);
  return s.id as string;
}

async function loadSession(ctx: ActionContext, id: string) {
  const { data } = await ctx.db.from("sessions").select("*").eq("id", id).maybeSingle();
  if (!data) throw new ServiceError("Session not found.");
  await requireEmployeeAccess(ctx, data.employee_id);
  return data;
}

export async function rescheduleSession(ctx: ActionContext, id: string, scheduledAt: string, reason?: string) {
  const s = await loadSession(ctx, id);
  if (["CANCELLED", "COMPLETED"].includes(s.status)) throw new ServiceError(`A ${s.status.toLowerCase()} session cannot be rescheduled.`);
  if (isNaN(Date.parse(scheduledAt))) throw new ServiceError("Invalid date/time.");
  const when = new Date(scheduledAt).toISOString();
  const { error } = await ctx.db.from("sessions").update({ scheduled_at: when, status: "RESCHEDULED", notes: reason ? `${s.notes ? s.notes + "\n" : ""}Rescheduled: ${reason}` : s.notes }).eq("id", id);
  if (error) throw new ServiceError("Could not reschedule.");
  if (s.external_event_id) await getCalendarProvider().update(s.external_event_id, { title: s.title, start: when, durationMinutes: s.duration_minutes, location: s.location, meetingLink: s.meeting_link, attendees: await attendeeEmails(ctx, s.employee_id) });
  await audit(ctx.admin, { employeeId: s.employee_id, actor: ctx.actor, event: "SESSION_RESCHEDULED", entityType: "session", entityId: id, previous: { at: s.scheduled_at }, next: { at: when, reason } });
  await syncEmployeeState(s.employee_id, ctx.actor);
}

export async function cancelSession(ctx: ActionContext, id: string, reason: string) {
  const s = await loadSession(ctx, id);
  if (s.status === "COMPLETED") throw new ServiceError("A completed session cannot be cancelled.");
  const { error } = await ctx.db.from("sessions").update({ status: "CANCELLED", notes: `${s.notes ? s.notes + "\n" : ""}Cancelled: ${reason}` }).eq("id", id);
  if (error) throw new ServiceError("Could not cancel.");
  if (s.external_event_id) await getCalendarProvider().cancel(s.external_event_id);
  await audit(ctx.admin, { employeeId: s.employee_id, actor: ctx.actor, event: "SESSION_CANCELLED", entityType: "session", entityId: id, previous: { status: s.status }, next: { status: "CANCELLED", reason } });
  await syncEmployeeState(s.employee_id, ctx.actor);
}

export async function confirmAttendance(ctx: ActionContext, id: string, status: "CONFIRMED" | "ATTENDED" | "ABSENT") {
  const s = await loadSession(ctx, id);
  const { error } = await ctx.db.from("session_attendance").upsert({ session_id: id, employee_id: s.employee_id, attendee_id: ctx.actor.id, status, confirmed_at: new Date().toISOString() }, { onConflict: "session_id,attendee_id" });
  if (error) throw new ServiceError("Could not record attendance.");
  if (status === "CONFIRMED" && s.status === "SCHEDULED") await ctx.db.from("sessions").update({ status: "CONFIRMED" }).eq("id", id);
  if (status === "ATTENDED") await ctx.db.from("sessions").update({ status: "COMPLETED" }).eq("id", id);
  await audit(ctx.admin, { employeeId: s.employee_id, actor: ctx.actor, event: "SESSION_ATTENDANCE", entityType: "session", entityId: id, next: { status } });
  await syncEmployeeState(s.employee_id, ctx.actor);
}
