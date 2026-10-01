"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";

/**
 * Subscribes to Supabase Realtime for this employee's task completions and
 * gate results (and the user's notifications) and refreshes server data when
 * another device or a reviewer changes state. The database stays the source
 * of truth; this only triggers a re-read.
 */
export function RealtimeRefresher({ employeeId, userId }: { employeeId?: string | null; userId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const sb = getBrowserSupabase();
    const bump = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    };
    const ch = sb.channel(`compass-${employeeId ?? userId}`);
    if (employeeId) {
      ch.on("postgres_changes", { event: "*", schema: "public", table: "task_completions", filter: `employee_id=eq.${employeeId}` }, bump);
      ch.on("postgres_changes", { event: "*", schema: "public", table: "gate_results", filter: `employee_id=eq.${employeeId}` }, bump);
    }
    ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` }, bump);
    ch.subscribe();
    return () => { if (timer.current) clearTimeout(timer.current); void sb.removeChannel(ch); };
  }, [employeeId, userId, router]);
  return null;
}
