-- ════════════════════════════════════════════════════════════════════
-- FirstGear KAM Onboarding Compass — 006 real company profile content
--
-- FirstGear now uses the publicly reported profile of an NSE/BSE-listed
-- mobility-technology company (name withheld). This migration brings an
-- existing project in line with the regenerated 002/003 seed:
--   • Day 1–2 learning tasks describe the real company and product lines
--   • journey days link the new KAM FAQ documents
--   • product/company quiz questions are replaced (old ones are deactivated,
--     not deleted, so past attempts keep their questions)
--   • scenario situations use real product lines (rubrics unchanged)
-- The knowledge documents themselves are ingested with
--   npx tsx scripts/ingest-knowledge.ts
-- Idempotent: safe to re-run; a no-op on a fresh install.
-- ════════════════════════════════════════════════════════════════════

-- Day 1–2 tasks (template rows; instance progress is untouched)
update public.tasks t set title = v.title, description = v.description, updated_at = now()
from (values
  ('D01-01', 'Company profile', 'Read the company profile: history, businesses, 12 plants, FY2022-23 to FY2025-26 financials, order book, markets and the four strategic priorities.'),
  ('D01-02', 'Company values', 'Review the values — Integrity, Vitality, Frugality, Agility — and how they show up in customer work.'),
  ('D02-01', 'Driveline and ICE products', 'Study differential bevel gears, differential assemblies and starter motors — the driveline and ICE core, and the company''s global market shares.'),
  ('D02-02', 'Hybrid products', 'Study micro-hybrid starter motors, belt starter generators and hybrid-platform differential assemblies, and where they differ from ICE.'),
  ('D02-03', 'BEV products', 'Study EV differential assemblies with final-drive gear, traction motors, controllers and active-suspension motor controllers, and why EV gears need tighter NVH.'),
  ('D02-04', 'Segments and end markets', 'Map products to passenger, commercial, off-highway, electric 2W/3W and railway segments, and to the India / Europe / North America / Asia revenue mix.'),
  ('D02-05', 'Sensors, railway and new verticals', 'Understand radar sensors, railway systems and robotics, and the customer problems each product line solves.')
) as v(code, title, description), public.onboarding_templates tpl
where tpl.code = 'KAM-30' and t.template_id = tpl.id and t.code = v.code;

-- Journey resources: link the FAQ documents
update public.onboarding_days d set resources = v.resources
from (values
  (1, '[{"label":"Company overview","document_key":"COMPANY-OVERVIEW"},{"label":"Code of conduct","document_key":"CODE-OF-CONDUCT"},{"label":"KAM charter","document_key":"KAM-CHARTER"},{"label":"FAQ — Company, products & markets","document_key":"FAQ-COMPANY-PRODUCTS"},{"label":"FAQ — Onboarding journey & app","document_key":"FAQ-ONBOARDING"}]'::jsonb),
  (2, '[{"label":"Product portfolio guide","document_key":"PRODUCT-PORTFOLIO"},{"label":"FAQ — Company, products & markets","document_key":"FAQ-COMPANY-PRODUCTS"}]'::jsonb),
  (3, '[{"label":"Manufacturing process overview","document_key":"MFG-PROCESS"},{"label":"FAQ — Quality, programmes, delivery & escalation","document_key":"FAQ-QUALITY-DELIVERY"}]'::jsonb),
  (5, '[{"label":"Ownership map & knowledge sources","document_key":"ORG-NAVIGATION"},{"label":"FAQ — Account ownership, governance & conduct","document_key":"FAQ-ACCOUNT-MANAGEMENT"}]'::jsonb),
  (8, '[{"label":"Costing & commercial mechanics","document_key":"COSTING-COMMERCIALS"},{"label":"FAQ — RFQs, costing, pricing & approvals","document_key":"FAQ-COMMERCIAL"}]'::jsonb),
  (15, '[{"label":"Assessment guide","document_key":"ASSESSMENT-GUIDE"},{"label":"FAQ — Onboarding journey & app","document_key":"FAQ-ONBOARDING"}]'::jsonb)
) as v(day_number, resources), public.onboarding_templates tpl
where tpl.code = 'KAM-30' and d.template_id = tpl.id and d.day_number = v.day_number;

-- Quiz bank: retire questions built on the old synthetic products, add the new ones
update public.assessment_questions set is_active = false
where question_code in ('D10-PRD-01', 'D10-PRD-02', 'PPL-005', 'PRD-001', 'PRD-003', 'PRD-004', 'PRD-005', 'PRD-006');
update public.assessment_questions
set explanation = 'With no engine noise to mask gear whine, EV gears and differentials need tighter noise-vibration (NVH) and precision requirements.',
    source_reference = 'Section 6, v4.0'
where question_code = 'PRD-002';

insert into public.assessment_questions (question_code, assessment_stage, question_type, pillar, topic, difficulty, question,
  options, correct_answer, explanation, weight, source_document, source_reference, sort_order) values
  ('D10-PRD-03', 'DAY10_CHECK', 'MULTIPLE_CHOICE', 'PRODUCT', 'BEV', 'easy', 'Which FirstGear product belongs to the BEV technology family?',
   '[{"id":"a","text":"Conventional starter motor"},{"id":"b","text":"Micro-hybrid starter motor"},{"id":"c","text":"EV differential assembly with final-drive gear"},{"id":"d","text":"Railway coupler"}]'::jsonb, '{"value":"c"}'::jsonb, 'EV differential assemblies with final-drive gear are BEV products; conventional starters are ICE, micro-hybrid starters are hybrid, couplers are railway.', 1, 'Product Portfolio Guide', 'Section 6, v4.0', 2),
  ('D10-PRD-04', 'DAY10_CHECK', 'MULTIPLE_CHOICE', 'PRODUCT', 'Markets', 'easy', 'Which was FirstGear''s largest end market in FY 2025-26?',
   '[{"id":"a","text":"North America"},{"id":"b","text":"Europe"},{"id":"c","text":"India"},{"id":"d","text":"China"}]'::jsonb, '{"value":"c"}'::jsonb, 'India became the largest end market at 51% of revenue (29% in FY 2024-25).', 1, 'Product Portfolio Guide', 'Section 7, v4.0', 10),
  ('PPL-008', 'DAY15_READINESS', 'SHORT_ANSWER', 'PEOPLE', 'Values', 'medium', 'Name two company values and how one of them shows up in key account work.',
   '[]'::jsonb, '{"rubric":[{"label":"Names a value","keywords":["integrity","vitality","frugality","agility"]},{"label":"Applies it to account work","keywords":["bad news early","early","not committing","never commit","approved","cost","margin","faster","fast","better solution","better product"]}]}'::jsonb, 'Values: Integrity, Vitality, Frugality, Agility — e.g. integrity means never committing what has not been approved; frugality means challenging cost before conceding price.', 1, 'FirstGear Company Overview', 'Sections 3–4, v2026.2', 21),
  ('PRD-007', 'DAY15_READINESS', 'MULTIPLE_CHOICE', 'PRODUCT', 'Hybrid', 'easy', 'Which FirstGear product belongs to the hybrid family?',
   '[{"id":"a","text":"Micro-hybrid starter motor"},{"id":"b","text":"Railway brake system"},{"id":"c","text":"In-cabin radar sensor"},{"id":"d","text":"Portal-axle gear"}]'::jsonb, '{"value":"a"}'::jsonb, 'Micro-hybrid starter motors (with BSG systems) serve hybrid powertrains.', 1, 'Product Portfolio Guide', 'Section 6, v4.0', 30),
  ('PRD-008', 'DAY15_READINESS', 'MULTIPLE_CHOICE', 'PRODUCT', 'Programmes', 'medium', 'Project Aster at Northwind is which programme?',
   '[{"id":"a","text":"ICE SUV differential assemblies"},{"id":"b","text":"BEV compact SUV — EV differential assembly with final-drive gear"},{"id":"c","text":"Hybrid sedan micro-hybrid starter motors"},{"id":"d","text":"Electric three-wheeler traction motors"}]'::jsonb, '{"value":"b"}'::jsonb, 'Project Aster — BEV compact SUV, EV differential assembly with final-drive gear, SOP April 2027.', 1, 'Customer 360 — Northwind Motors', 'Section 4, v1.1', 32),
  ('PRD-009', 'DAY15_READINESS', 'TRUE_FALSE', 'PRODUCT', 'BEV share', 'easy', 'BEV products made up about 35% of FirstGear''s automotive product revenue in FY 2025-26.',
   '[]'::jsonb, '{"value":true}'::jsonb, 'BEV revenue was INR 11,542 mn — 35% of automotive product revenue (44% in Q1 FY 2026-27).', 1, 'Product Portfolio Guide', 'Section 6, v4.0', 33),
  ('PRD-010', 'DAY15_READINESS', 'SHORT_ANSWER', 'PRODUCT', 'Product lines', 'medium', 'Name three FirstGear product lines and one customer problem they solve.',
   '[]'::jsonb, '{"rubric":[{"label":"Driveline","keywords":["driveline","differential","gear"]},{"label":"Motors / controllers","keywords":["motor","starter","traction","controller"]},{"label":"Sensors or railway","keywords":["sensor","radar","railway","brake","coupler"]},{"label":"Customer problem","keywords":["efficiency","nvh","noise","durability","safety","comfort","propulsion","start-stop","fuel"]}]}'::jsonb, 'Driveline (quiet, durable torque transfer), motors and controllers (starting, start-stop, EV propulsion, ride comfort), sensors (safety/ADAS) and railway (safe braking, comfort).', 1, 'Product Portfolio Guide', 'Section 8, v4.0', 34),
  ('PRD-011', 'DAY15_READINESS', 'MULTIPLE_CHOICE', 'PRODUCT', 'Pipeline', 'medium', 'What is the open RFQ in the Northwind pipeline?',
   '[{"id":"a","text":"Differential bevel gears for ICE"},{"id":"b","text":"Integrated motor controller modules for active suspension on the next-gen BEV"},{"id":"c","text":"Railway couplers"},{"id":"d","text":"Starter motors for two-wheelers"}]'::jsonb, '{"value":"b"}'::jsonb, 'Integrated motor controller modules for active suspension on the next-generation BEV platform, decision expected Q1 2027.', 1, 'Customer 360 — Northwind Motors', 'Section 5, v1.1', 35),
  ('PRD-012', 'DAY15_READINESS', 'MULTIPLE_CHOICE', 'PRODUCT', 'Market share', 'medium', 'What was FirstGear''s global market share in differential gears in calendar 2025?',
   '[{"id":"a","text":"4.2%"},{"id":"b","text":"8.7%"},{"id":"c","text":"15%"},{"id":"d","text":"35%"}]'::jsonb, '{"value":"b"}'::jsonb, '8.7% in differential gears; 4.2% is the starter-motor share; 35% is the FY 2025-26 BEV share of automotive revenue.', 1, 'Product Portfolio Guide', 'Section 1, v4.0', 36),
  ('GOV-011', 'DAY15_READINESS', 'MULTIPLE_CHOICE', 'GOVERNANCE', 'Order book', 'medium', 'What was FirstGear''s net order book at 31 March 2026, and roughly what share came from EV programmes?',
   '[{"id":"a","text":"INR 57 bn, 35% EV"},{"id":"b","text":"INR 237 bn, about 70% EV"},{"id":"c","text":"INR 447 bn, about 44% EV"},{"id":"d","text":"INR 2.5 bn, about 70% EV"}]'::jsonb, '{"value":"b"}'::jsonb, 'INR 237 bn (about USD 2.5 bn), around 70% from EV programmes; INR 57 bn was the order intake in the year.', 1, 'FirstGear Company Overview', 'Section 7, v2026.2', 37)
on conflict (question_code) do nothing;

-- Scenario situations (rubrics and red flags unchanged)
update public.scenario_templates s set situation = v.situation
from (values
  ('SCN-RFQ', 'Northwind''s powertrain buyer sends an RFQ for EV differential assemblies with final-drive gear on the next-gen BEV platform. Drawings are attached but annual volumes and the SOP date are missing. The buyer asks for ''a ballpark price by Friday''.'),
  ('SCN-COSTING', 'In a mock RFQ review, the buyer says your conversion cost looks 15% too high compared with ''the market'' and asks you to explain your cost build-up.'),
  ('SCN-PRICE', 'At the monthly review, Northwind''s Head of Powertrain Purchasing demands an additional 4% price-down on differential assemblies, on top of the 2% annual reduction, citing supplier consolidation.'),
  ('SCN-DELIVERY', 'A critical forging press on the differential-gear line has failed. SCM estimates 40% of next week''s Northwind shipment is at risk. The customer has not been told.'),
  ('SCN-QUALITY', 'Northwind''s SQE reports burrs on differential bevel gears found on their assembly line and threatens a line stop.'),
  ('SCN-COMPLAINT', 'A customer sends an angry mail: a PPAP document was missing from a shipment and their receiving inspection blocked the lot.'),
  ('SCN-INTERNAL', 'Engineering is two weeks late on a corrective action promised to the customer; the engineering lead says it is ''not a priority''.'),
  ('SCN-DELAY', 'Tooling for Project Aster gear sets is three weeks late, putting the January PPAP submission at risk.'),
  ('SCN-ECN', 'Northwind requests a design change to the gear-set tooth profile after design freeze and asks you to ''just absorb it''.'),
  ('SCN-APQP', 'The plant wants to ship Project Aster pre-series parts for a customer build before PPAP approval.')
) as v(code, situation)
where s.code = v.code;
