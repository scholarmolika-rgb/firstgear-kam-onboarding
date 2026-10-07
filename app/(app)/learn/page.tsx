import { redirect } from "next/navigation";
import { kamSnapshot } from "@/lib/services/page";
import { createServerSupabase } from "@/lib/supabase/server";
import { trainingPath, resumeStep } from "@/lib/engine/training";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

/** "Training" / "Continue training": jump to where the KAM left off. */
export default async function TrainingStart() {
  const { snap, error } = await kamSnapshot();
  if (!snap) return <Notice tone="warn" title="Training not available">{error}</Notice>;
  const db = await createServerSupabase();
  const { data: days } = await db.from("onboarding_days").select("day_number, phase, segment").eq("template_id", snap.instance.template_id);
  const step = resumeStep(trainingPath(snap.journey, days ?? []));
  redirect(step ? `/learn/${encodeURIComponent(step.code)}` : "/journey");
}
