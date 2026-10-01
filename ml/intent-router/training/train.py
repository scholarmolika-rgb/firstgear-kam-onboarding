"""
Fine-tune DistilBERT (distilbert-base-uncased) for FirstGear intent routing.

    python train.py --data ../data --out ../models/distilbert-intent --epochs 6

Runs on a free Colab/Kaggle GPU in a few minutes (CPU works, slower).
Reports accuracy and macro-F1 on the held-out TEST split — the number goes
in your write-up, not just "it runs".
"""
import argparse
import json
import os

import numpy as np
from datasets import load_dataset
from sklearn.metrics import accuracy_score, classification_report, f1_score
from transformers import (AutoModelForSequenceClassification, AutoTokenizer, DataCollatorWithPadding,
                          Trainer, TrainingArguments)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=os.path.join(os.path.dirname(__file__), "..", "data"))
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "models", "distilbert-intent"))
    ap.add_argument("--base", default="distilbert-base-uncased")
    ap.add_argument("--epochs", type=float, default=6)
    ap.add_argument("--lr", type=float, default=5e-5)
    ap.add_argument("--batch", type=int, default=16)
    args = ap.parse_args()

    labels = json.load(open(os.path.join(args.data, "labels.json")))
    label2id = {l: i for i, l in enumerate(labels)}
    id2label = {i: l for l, i in label2id.items()}

    ds = load_dataset("json", data_files={s: os.path.join(args.data, f"{s}.jsonl") for s in ["train", "validation", "test"]})
    tok = AutoTokenizer.from_pretrained(args.base)

    def prep(batch):
        enc = tok(batch["text"], truncation=True, max_length=64)
        enc["labels"] = [label2id[l] for l in batch["label"]]
        return enc

    ds = ds.map(prep, batched=True, remove_columns=["text", "label"])
    model = AutoModelForSequenceClassification.from_pretrained(args.base, num_labels=len(labels), id2label=id2label, label2id=label2id)

    def metrics(p):
        preds = np.argmax(p.predictions, axis=-1)
        return {"accuracy": accuracy_score(p.label_ids, preds), "macro_f1": f1_score(p.label_ids, preds, average="macro")}

    trainer = Trainer(
        model=model,
        args=TrainingArguments(output_dir=args.out, num_train_epochs=args.epochs, learning_rate=args.lr,
                               per_device_train_batch_size=args.batch, per_device_eval_batch_size=64,
                               eval_strategy="epoch", save_strategy="epoch", load_best_model_at_end=True,
                               metric_for_best_model="macro_f1", weight_decay=0.01, warmup_ratio=0.1, logging_steps=20, report_to=[]),
        train_dataset=ds["train"], eval_dataset=ds["validation"], tokenizer=tok,
        data_collator=DataCollatorWithPadding(tok), compute_metrics=metrics,
    )
    trainer.train()

    pred = trainer.predict(ds["test"])
    y_pred = np.argmax(pred.predictions, axis=-1)
    acc = accuracy_score(pred.label_ids, y_pred)
    f1 = f1_score(pred.label_ids, y_pred, average="macro")
    report = classification_report(pred.label_ids, y_pred, target_names=labels, zero_division=0)
    print(report)
    print(f"HELD-OUT TEST accuracy={acc:.4f} macro_f1={f1:.4f}")

    trainer.save_model(args.out)
    tok.save_pretrained(args.out)
    with open(os.path.join(args.out, "test_metrics.json"), "w") as f:
        json.dump({"accuracy": acc, "macro_f1": f1, "n_test": int(len(y_pred))}, f, indent=2)
    with open(os.path.join(args.out, "classification_report.txt"), "w") as f:
        f.write(report)


if __name__ == "__main__":
    main()
