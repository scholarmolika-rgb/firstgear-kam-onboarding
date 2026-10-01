"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, X, Clock } from "lucide-react";
import { scheduleSessionAction, rescheduleSessionAction, cancelSessionAction, attendanceAction } from "@/app/actions/onboarding";
import { Field, StatusPill, fmtDate } from "@/components/ui";

export function ScheduleForm({ employeeId, sessionTypes, defaultDay }: { employeeId: string; sessionTypes: string[]; defaultDay?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [f, setF] = useState({ title: "", sessionType: sessionTypes[1] ?? sessionTypes[0] ?? "Mentor Check-in", when: "", duration: 45, link: "", location: "", notes: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: k === "duration" ? Number(e.target.value) : e.target.value });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const r = await scheduleSessionAction({ employeeId, title: f.title, sessionType: f.sessionType, scheduledAt: f.when ? new Date(f.when).toISOString() : "", durationMinutes: f.duration, meetingLink: f.link, location: f.location, notes: f.notes, dayNumber: defaultDay });
      if (r.ok) { setMsg({ ok: true, text: "Session scheduled — attendees notified." }); setF({ ...f, title: "", when: "", notes: "" }); router.refresh(); }
      else setMsg({ ok: false, text: r.error });
    });
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Title"><input className="input" required minLength={3} value={f.title} onChange={set("title")} placeholder="e.g. Mentor check-in: RFQ questions" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type"><select className="input" value={f.sessionType} onChange={set("sessionType")}>{sessionTypes.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Duration (min)"><input className="input" type="number" min={5} max={600} value={f.duration} onChange={set("duration")} /></Field>
      </div>
      <Field label="Date & time"><input className="input" type="datetime-local" required value={f.when} onChange={set("when")} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Meeting link (optional)"><input className="input" type="url" value={f.link} onChange={set("link")} placeholder="https://" /></Field>
        <Field label="Location (optional)"><input className="input" value={f.location} onChange={set("location")} /></Field>
      </div>
      <Field label="Notes (optional)"><textarea className="input" rows={2} value={f.notes} onChange={set("notes")} /></Field>
      {msg && <div role="status" className={msg.ok ? "text-xs text-ok" : "text-xs text-bad"}>{msg.text}</div>}
      <button className="btn-primary" disabled={pending}><CalendarPlus size={15} />{pending ? "Scheduling…" : "Schedule session"}</button>
    </form>
  );
}

export interface SessionItem { id: string; title: string; session_type: string; scheduled_at: string; duration_minutes: number; status: string; meeting_link: string | null; location: string | null; notes: string | null }

export function SessionRow({ s }: { s: SessionItem }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"none" | "reschedule" | "cancel">("none");
  const [when, setWhen] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const closed = s.status === "CANCELLED" || s.status === "COMPLETED";
  const go = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { setErr(null); const r = await fn(); if (!r.ok) setErr(r.error ?? "Failed"); else { setMode("none"); router.refresh(); } });
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{s.title}</span><StatusPill status={s.status} /></div>
          <div className="mt-0.5 text-xs text-ink-muted">{s.session_type} · {fmtDate(s.scheduled_at, true)} · {s.duration_minutes} min{s.location ? ` · ${s.location}` : ""}</div>
          {s.meeting_link && <a href={s.meeting_link} target="_blank" rel="noreferrer" className="link text-xs">Join link</a>}
          {s.notes && <div className="mt-1 whitespace-pre-wrap text-[11px] text-ink-faint">{s.notes}</div>}
        </div>
        {!closed && (
          <div className="flex flex-wrap gap-1.5">
            {s.status !== "CONFIRMED" && <button className="btn-secondary btn-sm" disabled={pending} onClick={() => go(() => attendanceAction(s.id, "CONFIRMED"))}><Check size={12} />Confirm</button>}
            <button className="btn-secondary btn-sm" disabled={pending} onClick={() => go(() => attendanceAction(s.id, "ATTENDED"))}>Mark attended</button>
            <button className="btn-ghost btn-sm" onClick={() => setMode(mode === "reschedule" ? "none" : "reschedule")}><Clock size={12} />Reschedule</button>
            <button className="btn-ghost btn-sm text-bad" onClick={() => setMode(mode === "cancel" ? "none" : "cancel")}><X size={12} />Cancel</button>
          </div>
        )}
      </div>
      {mode === "reschedule" && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field label="New date & time"><input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
          <Field label="Reason"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <button className="btn-primary btn-sm" disabled={pending || !when} onClick={() => go(() => rescheduleSessionAction(s.id, new Date(when).toISOString(), reason))}>Save</button>
        </div>
      )}
      {mode === "cancel" && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field label="Reason for cancelling"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <button className="btn-danger btn-sm" disabled={pending || !reason.trim()} onClick={() => go(() => cancelSessionAction(s.id, reason))}>Cancel session</button>
        </div>
      )}
      {err && <div role="alert" className="mt-2 text-xs text-bad">{err}</div>}
    </li>
  );
}
