-- ════════════════════════════════════════════════════════════════════
-- FirstGear KAM Onboarding Compass — 007 pillar-ordered Phase 1
--
-- Phase 1 now follows the pillars in order:
--   Governance (Days 1–4) → People (5–7) → Product (8–9) → Process (10–14)
--   → Day-15 gate. The interim knowledge check moves to Day 13.
-- Every template task keeps its id and code; only its day, due day and sort
-- order change, so existing completions are preserved. Generated from
-- lib/seed-data. Idempotent; a no-op on a fresh install.
-- ════════════════════════════════════════════════════════════════════

update public.tasks t set day_number = v.day, due_day = v.day, sort_order = v.ord, description = v.description, updated_at = now()
from (values
  ('D01-01', 1, 1, 'Read the company profile: history, businesses, 12 plants, FY2022-23 to FY2025-26 financials, order book, markets and the four strategic priorities.'),
  ('D01-03', 1, 2, 'Read and acknowledge the code of conduct, including gifts, hospitality and confidentiality.'),
  ('D01-05', 1, 3, 'Read the KAM charter introduction: purpose, scope and accountability.'),
  ('D06-01', 2, 4, 'Understand what the KAM owns versus what functions own.'),
  ('D06-02', 2, 5, 'Learn the account governance calendar: weekly, monthly and quarterly reviews.'),
  ('D06-03', 2, 6, 'Learn the KAM KPIs and how they are measured.'),
  ('D06-04', 2, 7, 'Study the approval authority matrix — who can approve prices, terms and commitments.'),
  ('D06-05', 2, 8, 'Learn the escalation map and response timelines.'),
  ('D04-01', 3, 9, 'Study customer-specific requirements (CSRs) for key OEMs.'),
  ('D04-04', 3, 10, 'Understand the complaint-handling process and response timelines.'),
  ('D04-05', 3, 11, 'Understand how engineering changes are requested, approved and communicated.'),
  ('D10-03', 3, 12, 'Walk through a historic customer escalation with your mentor.'),
  ('D09-01', 4, 13, 'Understand programme governance from nomination to start of production.'),
  ('D09-02', 4, 14, 'Identify where the KAM is accountable in APQP and PPAP.'),
  ('D09-03', 4, 15, 'Understand customer- and supplier-initiated change handling.'),
  ('D09-04', 4, 16, 'Understand the 8D discipline and the KAM''s role in customer communication.'),
  ('D11-02', 4, 17, 'Document the customer''s strategy, electrification plans and supplier strategy.'),
  ('D14-03', 4, 18, 'Record open and past commitments with owners.'),
  ('D01-02', 5, 19, 'Review the values — Integrity, Vitality, Frugality, Agility — and how they show up in customer work.'),
  ('D01-04', 5, 20, 'Attend HR orientation: policies, leave, benefits and ways of working.'),
  ('D01-06', 5, 21, 'Meet the Reporting Boss to agree expectations for the first 30 days.'),
  ('D01-07', 5, 22, 'Confirm your onboarding profile, mentor and session calendar in the Compass. (IT access is handled separately by IT.)'),
  ('D05-01', 6, 23, 'Meet the engineering lead: responsibilities and hand-offs.'),
  ('D05-02', 6, 24, 'Meet NPD: programme launch responsibilities.'),
  ('D05-03', 6, 25, 'Meet Quality: customer quality, 8D and PPAP owners.'),
  ('D05-04', 6, 26, 'Meet SCM: planning, schedules and supplier risk.'),
  ('D05-05', 6, 27, 'Meet the plant head: capacity and delivery performance.'),
  ('D05-06', 6, 28, 'Meet Finance: costing, margin and credit.'),
  ('D05-07', 7, 29, 'Build your internal ownership map: who owns which decision.'),
  ('D05-08', 7, 30, 'Learn where approved SOPs, policies and customer data live — and use the Ask FirstGear assistant once.'),
  ('D11-01', 7, 31, 'Document the customer''s organisation in Customer 360.'),
  ('D13-01', 7, 32, 'Add purchasing stakeholders to the stakeholder map.'),
  ('D13-02', 7, 33, 'Add engineering stakeholders.'),
  ('D13-03', 7, 34, 'Add quality stakeholders.'),
  ('D13-04', 7, 35, 'Add SCM and plant stakeholders.'),
  ('D12-03', 7, 36, 'Review your Customer 360 draft with your mentor.'),
  ('D02-01', 8, 37, 'Study differential bevel gears, differential assemblies and starter motors — the driveline and ICE core, and the company''s global market shares.'),
  ('D02-02', 8, 38, 'Study micro-hybrid starter motors, belt starter generators and hybrid-platform differential assemblies, and where they differ from ICE.'),
  ('D02-03', 8, 39, 'Study EV differential assemblies with final-drive gear, traction motors, controllers and active-suspension motor controllers, and why EV gears need tighter NVH.'),
  ('D02-04', 9, 40, 'Map products to passenger, commercial, off-highway, electric 2W/3W and railway segments, and to the India / Europe / North America / Asia revenue mix.'),
  ('D02-05', 9, 41, 'Understand radar sensors, railway systems and robotics, and the customer problems each product line solves.'),
  ('D11-03', 9, 42, 'Document supplied parts and their applications.'),
  ('D12-01', 9, 43, 'Document active and upcoming programmes.'),
  ('D03-01', 10, 44, 'Walk the plant with the plant lead and follow one part from raw material to dispatch.'),
  ('D03-02', 10, 45, 'Learn the end-to-end manufacturing flow.'),
  ('D03-03', 10, 46, 'Identify the critical operations and special characteristics.'),
  ('D03-04', 10, 47, 'Understand lot traceability and how it supports containment.'),
  ('D03-05', 10, 48, 'Understand inbound and outbound logistics, packaging and schedules.'),
  ('D03-06', 10, 49, 'Complete the safety induction and understand plant safety rules.'),
  ('D03-07', 10, 50, 'Understand the zero-defect mindset and the cost of poor quality.'),
  ('D04-02', 11, 51, 'Learn the five APQP phases and the KAM''s touchpoints.'),
  ('D04-03', 11, 52, 'Learn PPAP submission levels and elements.'),
  ('D07-01', 11, 53, 'Learn how RFQs are logged, scoped and acknowledged.'),
  ('D07-02', 11, 54, 'Understand technical and capacity feasibility review.'),
  ('D07-03', 11, 55, 'Know which inputs Engineering, SCM, Plant and Finance provide.'),
  ('D07-04', 11, 56, 'Follow the quotation workflow from cost model to submission.'),
  ('D07-05', 11, 57, 'Learn the quotation approval chain and thresholds.'),
  ('D08-01', 12, 58, 'Understand material, conversion, overhead and logistics cost build-up. Knowledge only.'),
  ('D08-02', 12, 59, 'Understand tooling and development cost recovery options.'),
  ('D08-03', 12, 60, 'Understand margin targets and floor logic. Knowledge only — no live pricing.'),
  ('D08-04', 12, 61, 'Understand index-linked adjustments, annual price-downs and claims.'),
  ('D08-05', 12, 62, 'Understand payment terms and their working-capital impact.'),
  ('D08-06', 12, 63, 'Learn how to prepare a negotiation brief: BATNA, give-gets and approvals.'),
  ('D10-01', 13, 64, 'Complete a mock RFQ response pack with your mentor.'),
  ('D10-02', 13, 65, 'Attempt the costing-challenge practice scenario. Knowledge practice only.'),
  ('D10-04', 13, 66, 'Mentor records structured feedback on Phase-1 learning so far.'),
  ('D10-05', 13, 67, 'Take the interim knowledge check on Governance, People, Product and Process.'),
  ('D12-02', 14, 68, 'Document volumes and the opportunity pipeline.'),
  ('D14-01', 14, 69, 'Record pricing history from approved records only.'),
  ('D14-02', 14, 70, 'Record commercial history: claims, terms, disputes.'),
  ('D14-04', 14, 71, 'Record lessons learned and submit the account brief for mentor review.'),
  ('D15-01', 15, 72, 'Take the Day-15 four-pillar assessment. Weighted: Governance 25%, People 20%, Process 30%, Product 25% (configurable).'),
  ('D15-02', 15, 73, 'Mentor reviews the Customer 360 and stakeholder map.'),
  ('D15-03', 15, 74, 'Mentor reviews and approves the account brief.')
) as v(code, day, ord, description), public.onboarding_templates tpl
where tpl.code = 'KAM-30' and t.template_id = tpl.id and t.code = v.code;

update public.onboarding_days d set segment = v.segment, title = v.title, pillars = v.pillars, objectives = v.objectives, resources = v.resources
from (values
  (1, 'Governance', 'Company, conduct & KAM charter', array['GOVERNANCE']::text[], array['Understand the company: history, footprint, financials and strategy','Know the code of conduct: gifts, anti-bribery, competition law, confidentiality','Understand the KAM charter: purpose, scope and accountability']::text[], '[{"label":"Company overview","document_key":"COMPANY-OVERVIEW"},{"label":"Code of conduct","document_key":"CODE-OF-CONDUCT"},{"label":"KAM charter","document_key":"KAM-CHARTER"},{"label":"FAQ — Company, products & markets","document_key":"FAQ-COMPANY-PRODUCTS"},{"label":"FAQ — Onboarding journey & app","document_key":"FAQ-ONBOARDING"}]'::jsonb),
  (2, 'Governance', 'KAM charter, KPIs & approval authority', array['GOVERNANCE']::text[], array['Understand the account ownership model','Know the governance calendar and KAM KPIs','Know the approval authority matrix and the escalation map']::text[], '[{"label":"KAM charter","document_key":"KAM-CHARTER"},{"label":"Approval authority matrix","document_key":"APPROVAL-MATRIX"},{"label":"Escalation playbook","document_key":"ESCALATION-PLAYBOOK"},{"label":"FAQ — Account ownership, governance & conduct","document_key":"FAQ-ACCOUNT-MANAGEMENT"}]'::jsonb),
  (3, 'Governance', 'Quality & change governance', array['GOVERNANCE']::text[], array['Understand customer-specific requirements (CSRs)','Know complaint-handling timelines and engineering change control','Walk through a historic customer escalation']::text[], '[{"label":"Quality governance manual","document_key":"QUALITY-GOVERNANCE"},{"label":"Escalation playbook","document_key":"ESCALATION-PLAYBOOK"},{"label":"FAQ — Quality, programmes, delivery & escalation","document_key":"FAQ-QUALITY-DELIVERY"}]'::jsonb),
  (4, 'Governance', 'Programme governance & customer commitments', array['GOVERNANCE']::text[], array['Understand nomination-to-SOP governance and KAM touchpoints','Know the APQP/PPAP, engineering-change and 8D interfaces','Record the customer''s strategic context and past commitments']::text[], '[{"label":"Programme governance guide","document_key":"PROGRAMME-GOVERNANCE"},{"label":"Quality governance manual","document_key":"QUALITY-GOVERNANCE"},{"label":"Customer 360 — Northwind Motors","document_key":"C360-NORTHWIND"}]'::jsonb),
  (5, 'People', 'Values, HR & your manager', array['PEOPLE']::text[], array['Live the values: Integrity, Vitality, Frugality, Agility','Complete HR orientation and onboarding setup','Agree 30-day expectations with the Reporting Boss']::text[], '[{"label":"Company overview","document_key":"COMPANY-OVERVIEW"},{"label":"FAQ — Onboarding journey & app","document_key":"FAQ-ONBOARDING"}]'::jsonb),
  (6, 'People', 'Meet the functions', array['PEOPLE']::text[], array['Know who owns what across Engineering, NPD, Quality, SCM, Plant and Finance','Know the hand-offs between each function and the KAM']::text[], '[{"label":"Ownership map & knowledge sources","document_key":"ORG-NAVIGATION"},{"label":"FAQ — Account ownership, governance & conduct","document_key":"FAQ-ACCOUNT-MANAGEMENT"}]'::jsonb),
  (7, 'People', 'Ownership map & customer stakeholders', array['PEOPLE']::text[], array['Build your internal ownership map','Know where approved knowledge lives','Map the customer organisation and stakeholders']::text[], '[{"label":"Ownership map & knowledge sources","document_key":"ORG-NAVIGATION"},{"label":"Customer 360 — Northwind Motors","document_key":"C360-NORTHWIND"},{"label":"FAQ — Account ownership, governance & conduct","document_key":"FAQ-ACCOUNT-MANAGEMENT"}]'::jsonb),
  (8, 'Product', 'Product portfolio', array['PRODUCT']::text[], array['Explain the driveline, motor, sensor and railway product lines','Map products to ICE, hybrid and BEV powertrains']::text[], '[{"label":"Product portfolio guide","document_key":"PRODUCT-PORTFOLIO"},{"label":"FAQ — Company, products & markets","document_key":"FAQ-COMPANY-PRODUCTS"}]'::jsonb),
  (9, 'Product', 'Markets & customer products', array['PRODUCT']::text[], array['Map products to segments and end markets','Record the customer''s supplied parts and programmes']::text[], '[{"label":"Product portfolio guide","document_key":"PRODUCT-PORTFOLIO"},{"label":"Customer 360 — Northwind Motors","document_key":"C360-NORTHWIND"}]'::jsonb),
  (10, 'Process', 'Plant & manufacturing', array['PROCESS']::text[], array['Walk the plant and follow the manufacturing flow','Understand critical operations, traceability and logistics','Adopt the safety and quality mindset']::text[], '[{"label":"Manufacturing process overview","document_key":"MFG-PROCESS"},{"label":"FAQ — Quality, programmes, delivery & escalation","document_key":"FAQ-QUALITY-DELIVERY"}]'::jsonb),
  (11, 'Process', 'APQP, PPAP & RFQ to quotation', array['PROCESS']::text[], array['Explain APQP phases and PPAP levels','Follow an RFQ from intake to approved quotation']::text[], '[{"label":"Quality governance manual","document_key":"QUALITY-GOVERNANCE"},{"label":"RFQ to quotation SOP","document_key":"RFQ-SOP"},{"label":"FAQ — RFQs, costing, pricing & approvals","document_key":"FAQ-COMMERCIAL"}]'::jsonb),
  (12, 'Process', 'Costing & commercials (knowledge only)', array['PROCESS']::text[], array['Explain cost build-up, tooling and margin logic','Understand price-change and payment-term mechanics','Prepare for negotiation — no live pricing decisions']::text[], '[{"label":"Costing & commercial mechanics","document_key":"COSTING-COMMERCIALS"},{"label":"FAQ — RFQs, costing, pricing & approvals","document_key":"FAQ-COMMERCIAL"}]'::jsonb),
  (13, 'Process', 'Practice & interim check', array['PROCESS','GOVERNANCE']::text[], array['Run a mock RFQ and a pricing scenario','Pass the interim knowledge check on all four pillars']::text[], '[{"label":"RFQ to quotation SOP","document_key":"RFQ-SOP"},{"label":"Costing & commercial mechanics","document_key":"COSTING-COMMERCIALS"},{"label":"Assessment guide","document_key":"ASSESSMENT-GUIDE"}]'::jsonb),
  (14, 'Process', 'Commercial history & account brief', array['PROCESS','GOVERNANCE']::text[], array['Record volumes, pipeline, pricing and commercial history from approved records','Submit the account brief for mentor review']::text[], '[{"label":"Customer 360 — Northwind Motors","document_key":"C360-NORTHWIND"},{"label":"Costing & commercial mechanics","document_key":"COSTING-COMMERCIALS"}]'::jsonb),
  (15, 'Day-15 gate', 'Day-15 gate — readiness assessment', array['GOVERNANCE','PEOPLE','PROCESS','PRODUCT']::text[], array['Complete the four-pillar assessment','Customer 360 and account brief reviewed by Mentor','Readiness score ≥ 80% (Green) opens Phase 2']::text[], '[{"label":"Assessment guide","document_key":"ASSESSMENT-GUIDE"},{"label":"FAQ — Onboarding journey & app","document_key":"FAQ-ONBOARDING"}]'::jsonb)
) as v(day_number, segment, title, pillars, objectives, resources), public.onboarding_templates tpl
where tpl.code = 'KAM-30' and d.template_id = tpl.id and d.day_number = v.day_number;

update public.assessments set title = 'Interim knowledge check (Day 13)', description = 'Interim check after the Governance, People, Product and Process blocks: governance, products, plant, quality, RFQ and costing knowledge.', available_from_day = 13
where code = 'DAY10-CHECK';

update public.app_settings set label = 'Interim knowledge check pass (%)', description = 'Minimum interim knowledge-check score required before the Day-15 assessment.'
where key = 'DAY10_PASS_THRESHOLD';
