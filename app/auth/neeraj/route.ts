import { NextResponse } from "next/server";
import { createAdminClient, createServerSupabase } from "@/lib/supabase/server";

/** Neeraj's KAM profile (FG 09) signs in directly, without a password. No other account can use this route. */
const NEERAJ_PROFILE_ID = "1a98ccec-2bf1-40c0-8004-641fb36a55a2";

export async function GET(req: Request) {
  const fail = () => NextResponse.redirect(new URL("/login?error=direct", req.url), { status: 303 });
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("email, role").eq("id", NEERAJ_PROFILE_ID).maybeSingle();
  if (!profile?.email || profile.role !== "KAM") return fail();
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: profile.email });
  if (error || !link.properties?.hashed_token) return fail();
  const db = await createServerSupabase();
  await db.auth.signOut();
  const { error: verifyError } = await db.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (verifyError) return fail();
  return NextResponse.redirect(new URL("/dashboard", req.url), { status: 303 });
}
