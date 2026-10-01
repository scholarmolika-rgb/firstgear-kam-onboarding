"""
Export the fine-tuned model to ONNX (for Transformers.js / onnxruntime) and
optionally push it to the Hugging Face Hub for an Inference Endpoint.

    python export_onnx.py --model ../models/distilbert-intent --out ../models/distilbert-intent-onnx
    python export_onnx.py --model ../models/distilbert-intent --push your-org/firstgear-intent
"""
import argparse

from optimum.onnxruntime import ORTModelForSequenceClassification
from transformers import AutoTokenizer


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--out")
    ap.add_argument("--push")
    a = ap.parse_args()
    tok = AutoTokenizer.from_pretrained(a.model)
    if a.out:
        m = ORTModelForSequenceClassification.from_pretrained(a.model, export=True)
        m.save_pretrained(a.out)
        tok.save_pretrained(a.out)
        print(f"ONNX model written to {a.out}")
    if a.push:
        from transformers import AutoModelForSequenceClassification
        AutoModelForSequenceClassification.from_pretrained(a.model).push_to_hub(a.push, private=True)
        tok.push_to_hub(a.push, private=True)
        print(f"Pushed to https://huggingface.co/{a.push}")


if __name__ == "__main__":
    main()
