import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { SUGGESTIONS, type StaffRole } from "./guide";

/** Ask Compass suggestions, with a real KAM name from the user's own (RLS-scoped) cohort. */
export async function staffSuggestions(role: StaffRole): Promise<string[]> {
  const db = await createServerSupabase();
  const { data } = await db.from("employees").select("full_name").eq("status", "ACTIVE").order("full_name").limit(1);
  const first = data?.[0]?.full_name.split(" ")[0];
  return SUGGESTIONS[role].filter((s) => !s.includes("{kam}") || !!first).map((s) => s.replace("{kam}", first ?? ""));
}
