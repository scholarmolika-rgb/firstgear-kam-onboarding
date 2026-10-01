import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth/session";

export default async function Home() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/login");
  const s = await getSession();
  redirect(s ? homeFor(s.profile.role) : "/login");
}
