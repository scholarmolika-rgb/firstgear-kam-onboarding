"use client";
import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Field } from "@/components/ui";

export function PasswordForm() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 10) return setMsg({ ok: false, text: "Use at least 10 characters." });
    if (pw !== pw2) return setMsg({ ok: false, text: "Passwords do not match." });
    setBusy(true);
    const { error } = await getBrowserSupabase().auth.updateUser({ password: pw });
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "Password updated." });
    if (!error) { setPw(""); setPw2(""); }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="New password"><input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
      <Field label="Confirm"><input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
      <div className="flex items-center gap-3"><button className="btn-secondary" disabled={busy}>Update password</button>{msg && <span className={msg.ok ? "text-xs text-ok" : "text-xs text-bad"}>{msg.text}</span>}</div>
    </form>
  );
}
