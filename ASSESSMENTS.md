# Assessments, gates and scenarios

## Question bank
Stored in `assessment_questions` (never in front-end code). Every question has: `question_code`, `pillar`, `topic`, `difficulty`, `question`, `options`, `correct_answer`, `explanation`, `weight`, `source_document`, `source_reference`, `assessment_stage`, `is_active`. Seeded: 10 Day-10, 25 Day-15 (≥6 per pillar), 2 practice. HR manages them in **Assessment management** (add, edit, deactivate, assign pillar/weight/difficulty/source).

| Type | Scoring |
|---|---|
| Multiple choice / True-false | all or nothing |
| Multi-select | (correct picks − wrong picks) / correct, floored at 0 |
| Short answer / Scenario / Case study / Role play | share of rubric points whose keywords appear in the answer |

Correct answers are never sent to the browser before submission; RLS hides the table from KAMs.

## Day-15 weighted score
```
pillar% = marks earned / marks available in that pillar
overall = G% × 0.25 + People% × 0.20 + Process% × 0.30 + Product% × 0.25      (weights editable, must total 100)
```
A pillar with no questions scores 0 — it is never dropped. The weights and thresholds in force are snapshotted on each attempt.

| Band | Rule (default) | Effect |
|---|---|---|
| **Green** | ≥ 80 | Gate 1 (Day 15) passes once the Mentor approves Customer 360 + account brief → Phase 2 |
| **Amber** | 60–79 | Gate 1 `REQUIRES_REVIEW`; 3–5-day targeted refresh tasks for the weakest pillars; supervised shadowing allowed; certification and pricing blocked until a re-check reaches Green |
| **Red** | < 60 | Gate 1 `FAILED`; Phase 2 paused; remediation plan (1:1 coaching, repeat modules, extra mentor pairing, additional assessment); proposed extension for the Reporting Boss |

Stored per attempt: pillar scores (raw, weight, weighted), overall, band, attempt number, timestamps, assessor (system), evidence, feedback, confidence (1–5 self-rating), knowledge-source attribution.

## Gates

| Gate | Day | Passes when | Decided by |
|---|---|---|---|
| G1 Day-15 gate | 15 | All Phase-1 (Days 1–15) tasks done, Day-10 interim check ≥ 70 %, readiness score ≥ 80 % (Green) and mentor reviews complete | rules + Mentor; Reporting Boss may defer |
| G2 Scenario test | 21 | 4 certification scenarios, average ≥ 75 %, Days 16–20 done | Mentor (cannot certify below threshold) |
| G3 Readiness panel sign-off | 30 | Phase-2 work done; Mentor and HR inputs | **Reporting Boss** final decision |

The Day-10 interim knowledge check is a checkpoint inside Phase 1, not a gate: Days 1–15 stay open throughout, but the Day-15 assessment waits until the check has been passed.

Guided **pricing exposure** additionally needs a Green latest Day-15 result and Reporting Boss approval; guided **customer ownership** needs Reporting Boss approval. Thirty elapsed days never produce READY.

## Scenarios
Ten templates (RFQ response, costing challenge, price challenge, delivery-risk escalation, quality escalation, customer complaint, internal escalation, programme delay, engineering change, APQP/PPAP issue); four are Day-21 certification scenarios. Each has a rubric (criteria, description, weight, keywords, min matches — total 100) and red flags with penalties.

The engine: presents the situation → takes the KAM's response → scores against the rubric → lists missing considerations → applies red-flag penalties → stores the attempt → compares with the previous attempt and the Day-15 baseline → routes certification attempts to the mentor. AI may add partial credit for criteria the keyword rules missed; it never decides authorisation.

## Tests
`tests/unit/scoring.test.ts` (weighting, bands, partial credit, stripping answers), `tests/unit/rubric.test.ts` (rubric, red flags, AI partial-credit limits), `tests/integration/journey-simulation.test.ts` (every gate, Amber refresh → Green re-check, Red pause, deferral, certification threshold, exposure approvals, panel and sign-off).
