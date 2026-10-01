import "server-only";
import { requireRole } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadSnapshot, NoOnboardingError, type Snapshot } from "./snapshot";

/** Snapshot for the signed-in KAM's own pages, or a reason it can't be shown. */
export async function kamSnapshot(): Promise<{ snap: Snapshot; error: null } | { snap: null; error: string }> {
  const s = await requireRole(["KAM"]);
  if (!s.employeeId) return { snap: null, error: "Your account is not linked to an employee record yet. Contact HR." };
  try {
    const db = await createServerSupabase();
    return { snap: await loadSnapshot(db, s.employeeId), error: null };
  } catch (e) {
    if (e instanceof NoOnboardingError) return { snap: null, error: e.message };
    throw e;
  }
}
