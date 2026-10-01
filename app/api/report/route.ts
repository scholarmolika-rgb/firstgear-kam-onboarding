import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadSnapshot, NoOnboardingError } from "@/lib/services/snapshot";
import { buildReport, reportToCsv } from "@/lib/report/build";
import { audit } from "@/lib/services/audit";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** GET /api/report?employeeId=…&format=csv|json — access enforced by RLS on every read. */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const url = new URL(req.url);
  const employeeId = url.searchParams.get("employeeId") ?? s.employeeId;
  if (!employeeId || !/^[0-9a-f-]{36}$/i.test(employeeId)) return NextResponse.json({ error: "employeeId required" }, { status: 400 });
  try {
    const db = await createServerSupabase();
    const snap = await loadSnapshot(db, employeeId);
    const report = buildReport(snap, s.profile.role);
    await audit(createAdminClient(), { employeeId, actor: { id: s.profile.id, role: s.profile.role }, event: "REPORT_EXPORTED", entityType: "progress_report", next: { exported: url.searchParams.get("format") ?? "json" } }).catch(() => undefined);
    if (url.searchParams.get("format") === "csv") {
      const name = `progress-report-${snap.employee.employee_code}-${snap.todayDate}.csv`;
      return new NextResponse(reportToCsv(report), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
    }
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof NoOnboardingError) return NextResponse.json({ error: e.message }, { status: 404 });
    console.error("[report]", (e as Error).message);
    return NextResponse.json({ error: "Could not build the report" }, { status: 500 });
  }
}
