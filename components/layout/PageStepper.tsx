"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, GraduationCap } from "lucide-react";
import { NAV } from "@/components/layout/SideNav";
import type { Role } from "@/types/domain";

/** The training step a page was opened from (`?t=<task code>`), if any. */
function useTrainingStep(): string | null {
  const params = useSearchParams();
  const path = usePathname();
  if (path.startsWith("/learn")) return null;
  return params.get("t");
}

/** Slim strip at the top of pages opened from a training step. */
export function TrainingBanner() {
  const step = useTrainingStep();
  if (!step) return null;
  const s = encodeURIComponent(step);
  return (
    <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-2 rounded-md border border-accent/30 bg-accent-soft px-4 py-2 text-sm">
      <span className="flex items-center gap-2 font-medium text-accent"><GraduationCap size={16} />Training mode</span>
      <span className="flex gap-2">
        <Link prefetch={false} href={`/learn/${s}`} className="btn-secondary btn-sm"><ArrowLeft size={13} />Back to step</Link>
        <Link prefetch={false} href={`/learn/${s}?advance=1`} className="btn-primary btn-sm">Continue training<ArrowRight size={13} /></Link>
      </span>
    </div>
  );
}

/**
 * Previous / Next links at the foot of every page. In training mode they
 * return to the training flow; otherwise they follow the role's sidebar
 * order. Detail pages step relative to their parent section. The training
 * player and journey day pages render their own navigation.
 */
export function PageStepper({ role }: { role: Role }) {
  const path = usePathname();
  const step = useTrainingStep();
  if (/^\/journey\/\d+/.test(path) || path.startsWith("/learn")) return null;

  if (step) {
    const s = encodeURIComponent(step);
    return (
      <nav aria-label="Training navigation" className="no-print mt-10 flex items-center justify-between gap-3 border-t border-line pt-5">
        <Link prefetch={false} href={`/learn/${s}`} className="btn-secondary btn-sm"><ArrowLeft size={13} />Back to training step</Link>
        <Link prefetch={false} href={`/learn/${s}?advance=1`} className="btn-primary btn-sm">Continue training<ArrowRight size={13} /></Link>
      </nav>
    );
  }

  const flow = NAV[role].flatMap((g) => g.items);
  let i = flow.findIndex((it) => path === it.href || path.startsWith(it.href + "/"));
  // A KAM's profile (/people/:id) is reached from the staff dashboard — step back to it.
  if (i < 0 && path.startsWith("/people/")) i = 0;
  if (i < 0) return null;
  const prev = flow[i - 1];
  const next = flow[i + 1];
  const isDetail = path !== flow[i].href;
  if (!prev && !next && !isDetail) return null;
  return (
    <nav aria-label="Page navigation" className="no-print mt-10 flex items-center justify-between gap-3 border-t border-line pt-5">
      {isDetail ? (
        <Link href={flow[i].href} className="btn-secondary btn-sm"><ArrowLeft size={13} />Back to {flow[i].label}</Link>
      ) : prev ? (
        <Link href={prev.href} className="btn-secondary btn-sm"><ArrowLeft size={13} /><span className="hidden sm:inline">Previous:</span> {prev.label}</Link>
      ) : <span />}
      {next && (
        <Link href={next.href} className="btn-primary btn-sm"><span className="hidden sm:inline">Next:</span> {next.label}<ArrowRight size={13} /></Link>
      )}
    </nav>
  );
}
