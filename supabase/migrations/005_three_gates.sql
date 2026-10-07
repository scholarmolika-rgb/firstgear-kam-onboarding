-- ════════════════════════════════════════════════════════════════════
-- FirstGear KAM Onboarding Compass — 005 three readiness gates
--
-- Upgrades a project seeded with the original five gates
-- (Day 5 · Day 10 · Day 15 · Day 21 · Day 30) to the three-gate plan:
--   G1 — Day 15: Phase-1 learning complete + readiness score ≥ 80 %
--   G2 — Day 21: scenario test
--   G3 — Day 30: readiness panel sign-off
--
-- Gate rows are renumbered in place so their ids — and the mentor
-- decisions / gate results that reference them — are preserved. The old
-- Day-5 and Day-10 gates are removed (their gate_results cascade).
-- Idempotent: safe to re-run, and a no-op on a fresh install (002 already
-- seeds three gates). Same steps as scripts/apply-three-gates.ts.
-- ════════════════════════════════════════════════════════════════════

do $$
declare tpl uuid;
begin
  select id into tpl from public.onboarding_templates where code = 'KAM-30';
  if tpl is null then return; end if;

  if exists (select 1 from public.gate_definitions where template_id = tpl and code = 'G5') then
    delete from public.gate_definitions where template_id = tpl and code in ('G1', 'G2');
    update public.gate_definitions set code = 'G1' where template_id = tpl and code = 'G3';
    update public.gate_definitions set code = 'G2' where template_id = tpl and code = 'G4';
    update public.gate_definitions set code = 'G3' where template_id = tpl and code = 'G5';
  end if;

  update public.gate_definitions g set day_number = v.day_number, name = v.name, description = v.description,
         gate_type = v.gate_type, approver_role = v.approver_role, unlocks = v.unlocks, sort_order = v.sort_order
  from (values
    ('G1', 15, 'Day-15 gate — readiness score ≥ 80%', 'Phase 1 (Days 1–15) learning across Governance, People, Process and Product complete, Day-10 interim check passed, Customer 360 and account brief reviewed by the Mentor, and a weighted four-pillar readiness score at or above the Green threshold (80%).', 'ASSESSMENT', 'MENTOR', array['PHASE_2']::text[], 1),
    ('G2', 21, 'Scenario test', 'RFQ response, price challenge, delivery risk and quality escalation scenarios scored against the Day-15 baseline and certified by the Mentor.', 'SCENARIO', 'MENTOR', array['PRICING_ELIGIBLE','CUSTOMER_ELIGIBLE']::text[], 2),
    ('G3', 30, 'Readiness panel sign-off', 'Reporting Boss, Mentor and HR panel. The Reporting Boss records the final, human-certified readiness decision.', 'PANEL', 'REPORTING_BOSS', array['INDEPENDENT_HANDLING']::text[], 3)
  ) as v(code, day_number, name, description, gate_type, approver_role, unlocks, sort_order)
  where g.template_id = tpl and g.code = v.code;

  -- Template and instance tasks: gate follows the day window (1–15 · 16–21 · 22–30+).
  update public.tasks set gate_code = case when day_number <= 15 then 'G1' when day_number <= 21 then 'G2' else 'G3' end
  where gate_code is not null
    and (template_id = tpl or instance_id in (select id from public.onboarding_instances where template_id = tpl));
  update public.tasks set action_ref = 'gate:G2' where action_ref = 'gate:G4';

  -- Days: drop the Day-5 / Day-10 gate markers and align labels with the plan.
  update public.onboarding_days set gate_code = case day_number when 15 then 'G1' when 21 then 'G2' when 30 then 'G3' else null end
  where template_id = tpl;
  update public.onboarding_days set segment = 'Learn about the company' where template_id = tpl and segment = 'Learn the company';
  update public.onboarding_days set segment = 'Day-15 gate', title = 'Day-15 gate — readiness assessment',
         objectives = array['Complete the four-pillar assessment','Customer 360 and account brief reviewed by Mentor','Readiness score ≥ 80% (Green) opens Phase 2']::text[]
  where template_id = tpl and day_number = 15;
  update public.onboarding_days set segment = 'Shadow reviews' where template_id = tpl and day_number in (16, 17);
  update public.onboarding_days set segment = 'Own low-risk queries' where template_id = tpl and day_number in (18, 19);
  update public.onboarding_days set segment = 'Lead an internal review' where template_id = tpl and day_number = 20;
  update public.onboarding_days set segment = 'Scenario test (gate)', title = 'Scenario test (gate)' where template_id = tpl and day_number = 21;
  update public.onboarding_days set segment = 'Guided pricing' where template_id = tpl and day_number between 22 and 25;
  update public.onboarding_days set segment = 'Own the account' where template_id = tpl and day_number between 26 and 29;
  update public.onboarding_days set segment = 'Readiness panel sign-off', title = 'Readiness panel sign-off' where template_id = tpl and day_number = 30;
end $$;

update public.assessments set gate_code = 'G1' where code in ('DAY10-CHECK', 'DAY15-READINESS');

update public.app_settings set description = 'Minimum interim knowledge-check score required before the Day-15 assessment.'
where key = 'DAY10_PASS_THRESHOLD';
update public.app_settings set label = 'Day-21 scenario test pass (%)' where key = 'DAY21_PASS_THRESHOLD';
update public.app_settings set label = 'Day-21 scenario test required', description = 'Gate 2 (Day-21 scenario test) must pass before pricing or customer ownership.'
where key = 'DAY21_REQUIRED';
