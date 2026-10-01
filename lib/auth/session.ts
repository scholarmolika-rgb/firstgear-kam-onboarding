import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Role } from "@/types/domain";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  title: string | null;
}

export interface SessionContext {
  profile: Profile;
  /** The employee record of the signed-in KAM (null for staff). */
  employeeId: string | null;
}

/** Resolves the signed-in user's profile. Cached per request. */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const db = await createServerSupabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: profile } = await db.from("profiles").select("id, full_name, email, role, title").eq("id", user.id).maybeSingle();
  if (!profile) return null;
  let employeeId: string | null = null;
  if (profile.role === "KAM") {
    const { data: emp } = await db.from("employees").select("id").eq("profile_id", user.id).maybeSingle();
    employeeId = emp?.id ?? null;
  }
  return { profile: profile as Profile, employeeId };
});

export async function requireSession(): Promise<SessionContext> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireRole(roles: Role[]): Promise<SessionContext> {
  const s = await requireSession();
  if (!roles.includes(s.profile.role)) redirect(homeFor(s.profile.role));
  return s;
}

export function homeFor(role: Role): string {
  switch (role) {
    case "KAM": return "/dashboard";
    case "MENTOR": return "/mentor";
    case "REPORTING_BOSS": return "/manager";
    case "HR_ADMIN": return "/hr";
  }
}
