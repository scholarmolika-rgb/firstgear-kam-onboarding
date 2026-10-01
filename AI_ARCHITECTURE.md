# AI architecture

## Principle
AI assists the KAM. **Rules** control progression. **Supabase** stores state. **RAG** provides verified knowledge. **Humans** decide pricing, customer ownership and readiness.

## Agentic loop (observe → reason → act → verify → report)

| Step | Where | What |
|---|---|---|
| Observe | `loadSnapshot` | day, tasks, gates, scores, sessions, pending approvals, support events |
| Reason | `evaluateJourney`, `nextActionFor`, `computeAlerts` | next action, blockers, weak pillars, whether a human must approve |
| Act | assistant actions, `planRemediation`, notifications | recommend/complete a task (user confirms), schedule, launch assessment/scenario, request mentor or manager review, create refresh/remediation tasks |
| Verify | services + engine | task ownership & availability, gate conditions, evidence recorded |
| Report | `syncEmployeeState`, report builder | gate results, progress snapshot, notifications, progress report |

The assistant never completes a task silently: "I finished the plant walk" produces a **Mark complete** button; the click goes through the same authorised checkbox path.

## Intent router (Layer 2)
`lib/ai/intent/router.ts`
1. **Guard** (regex, deterministic): IT account/access requests → `OUT_OF_SCOPE`; requests to approve/offer prices, discounts or terms → manager request + learning-only guidance.
2. **DistilBERT** at `HF_MODEL_URL` (17 intents), used when confidence ≥ `INTENT_MIN_CONFIDENCE`.
3. **Rules** fallback (82.5 % on the held-out split; see `ml/intent-router`).

Each intent maps to a grounding source: `KNOWLEDGE` (FAQ, KNOWLEDGE_SEARCH), `ACCOUNT` (CUSTOMER_360), `STATE` (progress, gates, readiness, assessments, scenarios, brief, feedback, help) or `ACTION` (complete, schedule, reschedule, mentor/manager request). Unknown future intents default to state-based general help.

## Response generation (Layer 5)
Mistral Large (`mistral-large-latest`, temperature 0.1) receives: system rules (`prompts/system.txt`), employee context, onboarding day, intent, retrieved passages tagged `[S1]…`, state summary, recent conversation.

Grounding guarantees:
- **Knowledge answers** need sufficient retrieval evidence (similarity ≥ `RAG_MIN_SIMILARITY` or strong term coverage). Otherwise: "not enough evidence" + Ask Mentor, logged as `AI_ESCALATION`. No LLM call is made on insufficient evidence.
- **Citations are validated**: only `[S#]` tags that map to retrieved passages survive; invented tags are stripped; an answer with no valid citation is replaced by an extractive answer quoting the passages.
- **State answers** are composed deterministically by the engine; Mistral may rephrase them only if every number in the facts survives, otherwise the deterministic text is used.
- **Customer 360** answers use only `Account`/`Customers` documents plus the KAM's **mentor-approved** brief.
- Without `MISTRAL_API_KEY`, all answers are deterministic or extractive — still sourced.

The assistant distinguishes and labels **company knowledge**, **employee state**, **general guidance**, **insufficient evidence** and **out of scope** on every message.

## Scenario evaluation
`lib/engine/rubric.ts` scores rubric criteria by keyword rules. Mistral (JSON mode, `prompts/scenario_judge.txt`) may judge only criteria the rules missed and can at most award **partial** credit. Red-flag penalties (unapproved price commitments, unconfirmed dates, blame before root cause) are deterministic and cannot be removed by AI. Certification attempts always require mentor review; the mentor cannot certify below the configured threshold.

## Models
| Purpose | Model | Serving |
|---|---|---|
| Intent | DistilBERT (fine-tuned) | HF Inference Endpoint / FastAPI service (`ml/intent-router/inference`) |
| Embeddings | sentence-transformers/all-MiniLM-L6-v2 (384-d) | HF Inference API (default) or in-process ONNX via `@huggingface/transformers` |
| Generation | Mistral Large | Mistral API |

All three are replaceable by configuration; no model behaviour is hard-coded in UI components.
