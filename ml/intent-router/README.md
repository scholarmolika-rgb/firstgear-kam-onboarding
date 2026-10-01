# Intent router — DistilBERT

Classifies each assistant message into one of 17 intents so the assistant knows whether to answer from **approved knowledge** (RAG), from **employee state** (rules engine), or to **act** (complete a task, schedule, escalate).

```
FAQ  TASK_STATUS  TASK_COMPLETE  SCHEDULE  RESCHEDULE  PROGRESS  ASSESSMENT  SCENARIO
KNOWLEDGE_SEARCH  CUSTOMER_360  ACCOUNT_BRIEF  MENTOR_REQUEST  MANAGER_REQUEST
GATE_STATUS  READINESS  FEEDBACK  GENERAL_HELP
```

Transfer learning only — `distilbert-base-uncased` is fine-tuned; nothing is trained from scratch.

## Folder

| Path | Purpose |
|---|---|
| `data/intents.jsonl` | All labelled examples `{"text","label"}` (generated, editable) |
| `data/train|validation|test.jsonl` | Stratified 80/10/10 split |
| `data/labels.json` | Label order (must match `lib/ai/intent/intents.ts`) |
| `training/train.py` | Fine-tune + report held-out accuracy & macro-F1 |
| `training/export_onnx.py` | ONNX export / push to Hugging Face Hub |
| `inference/server.py` | FastAPI service returning HF text-classification JSON |

## 1. Build / extend the dataset

```powershell
npx tsx scripts/generate-intent-dataset.ts
```

The seed set has **399 synthetic examples** (≈23 per intent). For the project target of 600–1,200, add real, anonymised questions from pilot users to `data/intents.jsonl` (one JSON object per line) and re-split, or extend the templates in `scripts/generate-intent-dataset.ts`. To add a new intent: add it to `lib/ai/intent/intents.ts`, give it examples, retrain — the app falls back to `GENERAL_HELP` handling for intents it doesn't special-case.

Baseline to beat: the deterministic fallback router scores **82.5 % (33/40)** on the held-out test split (`tests/unit/intent-baseline.test.ts`).

## 2. Train (Colab / Kaggle free GPU, ~5 min)

```bash
pip install -r ml/intent-router/requirements.txt
cd ml/intent-router/training
python train.py --epochs 6
# prints the classification report and: HELD-OUT TEST accuracy=… macro_f1=…
# writes ../models/distilbert-intent/{model files,test_metrics.json,classification_report.txt}
```

Record the printed test accuracy in your project report.

## 3. Deploy (pick one)

**A. Hugging Face Inference Endpoint / Space (recommended for Vercel)**
```bash
python export_onnx.py --model ../models/distilbert-intent --push your-org/firstgear-intent
```
Create an Inference Endpoint (or a Space running `inference/server.py`) and set in Vercel:
```
HF_MODEL_URL=https://<endpoint-url>          # or https://<space>.hf.space/classify
HF_API_TOKEN=hf_...                           # if the endpoint is private
```

**B. Self-host the FastAPI service** (Render, Cloud Run, a VM):
```bash
MODEL_DIR=../models/distilbert-intent API_TOKEN=change-me uvicorn server:app --host 0.0.0.0 --port 8000
```

## How the app uses it

`lib/ai/intent/router.ts`:
1. **Policy guard first** (deterministic): IT access provisioning → declined; requests to authorise prices/terms → routed to the Reporting Boss. No model can override this.
2. **DistilBERT** via `HF_MODEL_URL` if configured and confidence ≥ `INTENT_MIN_CONFIDENCE` (default 0.55).
3. **Rule-based fallback** otherwise (and whenever the endpoint is down).

The production web app never depends on a local Python process; replacing the model is a URL change.
