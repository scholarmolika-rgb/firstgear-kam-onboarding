"use client";
import { useState } from "react";
import { Download, FileText, Printer, Loader2 } from "lucide-react";
import type { ProgressReport } from "@/lib/report/build";

/** PDF generated client-side from the same report object as the screen and CSV. */
async function toPdf(r: ProgressReport) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 48;
  const accent: [number, number, number] = [31, 78, 121];
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...accent).text("FIRSTGEAR · KAM ONBOARDING COMPASS", 40, y);
  y += 22;
  doc.setFontSize(17).setTextColor(31, 35, 40).text(`Progress Report — ${r.profile.name}`, 40, y);
  y += 16;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(100, 107, 116).text(`Generated ${new Date(r.generatedAt).toLocaleString("en-IN")} · audience ${r.audience.replace("_", " ")} · Day ${r.onboarding.currentDay} of ${r.onboarding.duration}`, 40, y);
  y += 18;
  doc.setFontSize(10).setTextColor(31, 35, 40);
  const summary = doc.splitTextToSize(r.executiveSummary, W - 80);
  doc.text(summary, 40, y);
  y += summary.length * 13 + 8;

  const table = (title: string, head: string[], body: (string | number)[][]) => {
    if (!body.length) return;
    autoTable(doc, {
      startY: y, head: [[{ content: title, colSpan: head.length, styles: { fillColor: [232, 238, 245], textColor: accent, fontStyle: "bold" } }], head], body: body.map((r) => r.map(String)),
      styles: { fontSize: 8.5, cellPadding: 4, textColor: [61, 67, 75] }, headStyles: { fillColor: [247, 247, 245], textColor: [100, 107, 116] }, margin: { left: 40, right: 40 }, theme: "grid",
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  };
  const p = r.profile;
  table("KAM profile", ["Field", "Value"], [["Employee", `${p.name} (${p.code})`], ["Role", p.role], ["Reporting Boss", p.manager], ["Mentor", p.mentor], ["HR", p.hr], ["Joining", `${p.joiningDate} · ${p.joiningType}`], ["Customer", p.assignedCustomer ?? "—"], ["Onboarding day", `${r.onboarding.currentDay} of ${r.onboarding.duration} (${r.onboarding.daysRemaining} remaining) · ${r.onboarding.phase}`]]);
  const s = r.scores;
  const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
  table("Scores & progress", ["Measure", "Value"], [["Overall readiness", pct(r.progress.overallReadiness)], ["Task completion", pct(r.progress.taskCompletionPct)], ["Learning completion", pct(r.progress.learningCompletionPct)], ["Governance", pct(s.governance)], ["People", pct(s.people)], ["Process", pct(s.process)], ["Product", pct(s.product)], ["Interim check", pct(s.day10)], ["Day-15 score", pct(s.day15)], ["Day-21 scenario score", pct(s.day21Scenario)], ["Readiness band", s.band ?? "—"], ["Reassessments", s.reassessments], ["Response quality", pct(r.responseQuality)], ["Knowledge source usage", `${r.knowledgeUsage.grounded}/${r.knowledgeUsage.questions} grounded answers · ${r.knowledgeUsage.distinctDocuments} documents`]]);
  table("Gates", ["Gate", "Day", "Status", "Score", "Next action"], r.gates.map((g) => [`${g.code} ${g.name}`, g.day, g.status.replace(/_/g, " "), g.score === null ? "—" : `${g.score}%`, g.nextAction]));
  table("Overdue items", ["Code", "Task", "Due"], r.overdueItems.map((o) => [o.code, o.title, `Day ${o.dueDay}`]));
  table("Weak pillars & recommended actions", ["#", "Item"], [...r.weakPillars.map((w) => ["Weak", w]), ...r.recommendedActions.map((a, i) => [String(i + 1), a])]);
  table("Assessment history", ["Assessment", "Attempt", "Score", "Band", "Date"], r.assessmentHistory.map((a) => [a.assessment, a.attempt, a.score === null ? "—" : `${a.score}%`, a.band ?? "—", a.date ?? "—"]));
  table("Scenario performance", ["Scenario", "Type", "Score", "Reviewed", "Date"], r.scenarioPerformance.map((x) => [x.scenario, x.certification ? "Certification" : "Practice", `${x.score}%`, x.reviewerScore === null ? "—" : `${x.reviewerScore}%`, x.date]));
  table("Sessions", ["Session", "Type", "When", "Status"], r.sessions.map((x) => [x.title, x.type, x.when, x.status]));
  table("Mentor feedback", ["Date", "Feedback"], r.mentorFeedback.map((f) => [f.date, f.text]));
  table("Reporting Boss feedback & decisions", ["Date", "Feedback"], r.bossFeedback.map((f) => [f.date, f.text]));
  table("Readiness status", ["Item", "Status"], [["Customer readiness", r.customerReadiness], ["Pricing readiness", r.pricingReadiness], ["Final Day-30 decision", r.finalDecision]]);
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5).setTextColor(139, 146, 154).text(`Learn first. Then earn access. · Readiness is a human-certified decision · Page ${i} of ${pages}`, 40, doc.internal.pageSize.getHeight() - 24);
  }
  doc.save(`progress-report-${r.profile.code}-${r.generatedAt.slice(0, 10)}.pdf`);
}

export function ReportExport({ report, employeeId }: { report: ProgressReport; employeeId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button className="btn-secondary" onClick={() => window.print()}><Printer size={15} />Print</button>
      <a className="btn-secondary" href={`/api/report?employeeId=${employeeId}&format=csv`}><FileText size={15} />Download CSV</a>
      <button className="btn-primary" disabled={busy} onClick={async () => { setBusy(true); try { await toPdf(report); } finally { setBusy(false); } }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}Download PDF</button>
    </>
  );
}
