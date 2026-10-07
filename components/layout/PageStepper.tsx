"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { NAV } from "@/components/layout/SideNav";
import type { Role } from "@/types/domain";

/**
 * Previous / Next links at the foot of every page, following the role's
 * sidebar order. Detail pages (e.g. /knowledge/X) step relative to their
 * parent section. Journey day pages render their own Day N ± 1 pager.
 */
export function PageStepper({ role }: { role: Role }) {
  const path = usePathname();
  if (/^\/journey\/\d+/.test(path)) return null;
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
