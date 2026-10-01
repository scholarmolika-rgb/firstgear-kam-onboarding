"""
Separately deployable DistilBERT intent service (e.g. Hugging Face Spaces,
Render, Cloud Run). The Next.js app calls it via HF_MODEL_URL.

    MODEL_DIR=../models/distilbert-intent uvicorn server:app --host 0.0.0.0 --port 8000

Request:  POST /classify  {"inputs": "What should I do next?"}
Response: [{"label": "TASK_STATUS", "score": 0.97}, ...]   (HF text-classification shape)
"""
import os

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from transformers import pipeline

MODEL_DIR = os.environ.get("MODEL_DIR", "../models/distilbert-intent")
API_TOKEN = os.environ.get("API_TOKEN")  # optional bearer token; set HF_API_TOKEN to the same value in the app

clf = pipeline("text-classification", model=MODEL_DIR, tokenizer=MODEL_DIR, top_k=3)
app = FastAPI(title="FirstGear intent router")


class Req(BaseModel):
    inputs: str
    parameters: dict | None = None


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_DIR}


@app.post("/classify")
def classify(req: Req, authorization: str | None = Header(default=None)):
    if API_TOKEN and authorization != f"Bearer {API_TOKEN}":
        raise HTTPException(status_code=401, detail="unauthorised")
    text = req.inputs.strip()[:1000]
    if not text:
        raise HTTPException(status_code=400, detail="empty input")
    out = clf(text)
    return out[0] if out and isinstance(out[0], list) else out
