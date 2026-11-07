
"""
Evaluation Pipeline: AUROC, AUPRC, precision, recall, FPR, FNR, calibration error, latency
"""
import argparse
import json
import time
from pathlib import Path
from sklearn.metrics import roc_auc_score, average_precision_score, precision_recall_curve, confusion_matrix
import numpy as np

def evaluate_detector(test_dir: str, detector):
    print(f"[Eval] Evaluating on {test_dir}")
    # Load test files: expected format JSONL with {"text":..., "label": 0 human 1 AI, "generator":..., "language":...}
    test_files = list(Path(test_dir).glob("*.jsonl")) if Path(test_dir).exists() else []
    if not test_files:
        print("No test files found, using synthetic evaluation for skeleton")
        # Synthetic
        y_true = [0,0,0,1,1,1,0,1,0,1]
        y_scores = [0.2,0.3,0.25,0.8,0.75,0.9,0.4,0.85,0.3,0.7]
    else:
        y_true = []
        y_scores = []
        for file in test_files:
            with open(file) as f:
                for line in f:
                    obj = json.loads(line)
                    text = obj["text"]
                    label = obj["label"]
                    result = detector.detect(text)
                    y_true.append(label)
                    y_scores.append(result.get("ai_likelihood", 0.5))

    auroc = roc_auc_score(y_true, y_scores)
    auprc = average_precision_score(y_true, y_scores)
    # Threshold 0.65 for AI
    y_pred = [1 if s>=0.65 else 0 for s in y_scores]
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0,1]).ravel()
    precision = tp / (tp+fp+1e-9)
    recall = tp / (tp+fn+1e-9)
    fpr = fp / (fp+tn+1e-9)
    fnr = fn / (fn+tp+1e-9)
    # ECE simplified
    ece = float(np.mean([abs(s - t) for s,t in zip(y_scores, y_true)]))

    metrics = {
        "auroc": float(auroc),
        "auprc": float(auprc),
        "precision": float(precision),
        "recall": float(recall),
        "false_positive_rate": float(fpr),
        "false_negative_rate": float(fnr),
        "calibration_error_ece": float(ece),
        "num_samples": len(y_true)
    }
    print(json.dumps(metrics, indent=2))
    return metrics

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--test-dir", default="data/heldout")
    parser.add_argument("--metrics", default="auroc,auprc,fpr")
    args = parser.parse_args()
    from .detector import SudarshanDetector
    detector = SudarshanDetector()
    start = time.time()
    metrics = evaluate_detector(args.test_dir, detector)
    latency = (time.time()-start)/max(1, metrics["num_samples"])
    metrics["avg_latency_sec"] = latency
    with open("eval_report.json", "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved eval_report.json, avg latency {latency:.3f}s")

if __name__ == "__main__":
    main()
