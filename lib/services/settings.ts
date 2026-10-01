import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseConfig } from "@/lib/engine/config";
import type { ProgrammeConfig } from "@/types/domain";

export async function getConfig(db: SupabaseClient): Promise<ProgrammeConfig> {
  const { data, error } = await db.from("app_settings").select("key, value");
  if (error) throw new Error(`Could not load programme settings: ${error.message}`);
  return parseConfig(data ?? []);
}

/** Today's calendar date in the programme's time zone (default Asia/Kolkata). */
export function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: process.env.APP_TIMEZONE || "Asia/Kolkata" });
}
