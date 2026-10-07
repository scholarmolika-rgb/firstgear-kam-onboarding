/** Account-brief sections — shared by the KAM form (client) and staff views (server). */
export const BRIEF_SECTIONS: { key: string; label: string; hint: string; required?: boolean }[] = [
  { key: "customer_organization", label: "Customer organisation", hint: "Purchasing structure, plants, decision makers", required: true },
  { key: "strategic_context", label: "Strategic context", hint: "Strategy, electrification, supplier consolidation", required: true },
  { key: "applications", label: "Applications", hint: "Where our parts are used" },
  { key: "supplied_parts", label: "Supplied parts", hint: "Part families and platforms", required: true },
  { key: "programmes", label: "Programmes", hint: "Active and upcoming programmes, SOP dates", required: true },
  { key: "volumes", label: "Volumes", hint: "Annual volumes per programme" },
  { key: "pipeline", label: "Pipeline", hint: "Open RFQs and opportunities" },
  { key: "pricing_history", label: "Pricing history", hint: "From approved records only — price-downs, index adjustments", required: true },
  { key: "commercial_history", label: "Commercial history", hint: "Terms, claims, disputes" },
  { key: "open_commitments", label: "Open commitments", hint: "What we owe, owner, due date", required: true },
  { key: "past_issues", label: "Past issues", hint: "Quality / delivery incidents" },
  { key: "lessons_learned", label: "Lessons learned", hint: "What to do differently", required: true },
  { key: "source_notes", label: "Sources", hint: "Which approved documents / records you used" },
];
