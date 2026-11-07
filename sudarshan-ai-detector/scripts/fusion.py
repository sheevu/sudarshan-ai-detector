from typing import Dict, List
import numpy as np

class FusionModel:
    def __init__(self, weights: Dict[str, float] = None, ai_threshold: float = 0.60, human_threshold: float = 0.40):
        default_weights = {
            "perplexity": 0.10,
            "burstiness": 0.15,
            "stylometry": 0.15,
            "transformer": 0.15,
            "zero_shot": 0.15,
            "perturbation": 0.05,
            "watermark": 0.02,
            "trained_fusion": 0.45
        }
        self.weights = weights or default_weights
        self.ai_threshold = ai_threshold
        self.human_threshold = human_threshold
    
    def fuse(self, findings: List[Dict]) -> Dict:
        available = [f for f in findings if f.get("available", False) and not f.get("is_provenance", False)]
        if not available:
            return {
                "overall_classification": "Inconclusive",
                "ai_likelihood": 0.5,
                "confidence": 0.0,
                "disagreement": 0.0,
                "details": {"reason": "no detectors available"}
            }
        
        trained = next((f for f in available if f.get("method") == "trained_fusion"), None)
        
        weighted_sum = 0.0
        weight_total = 0.0
        scores = []
        for f in available:
            method = f.get("method", "unknown")
            w = self.weights.get(method, 0.1)
            if method == "trained_fusion":
                w = 0.45
            ai_like = f.get("ai_likelihood", 0.5)
            weighted_sum += ai_like * w
            weight_total += w
            scores.append(ai_like)
        
        raw_likelihood = weighted_sum / weight_total if weight_total else 0.5
        disagreement = float(np.std(scores)) if len(scores) > 1 else 0.0
        confidence = float(np.clip(1.0 - (disagreement * 1.2), 0.2, 0.98))
        
        # Boost based on trained_fusion confidence
        ai_likelihood = raw_likelihood
        if trained:
            tf_score = trained.get("ai_likelihood", 0.5)
            if tf_score < 0.25 or tf_score > 0.75:
                ai_likelihood = 0.65 * tf_score + 0.35 * raw_likelihood
                confidence = min(0.98, confidence + 0.15)
        
        # Smooth calibration: maintain directional momentum while reflecting confidence
        calibrated = 0.5 + (ai_likelihood - 0.5) * (0.6 + 0.4 * confidence)
        
        # Classification
        if calibrated >= self.ai_threshold and confidence > 0.30:
            if trained and trained.get("ai_likelihood", 0) < 0.40 and disagreement > 0.35:
                classification = "Mixed/Edited"
            else:
                classification = "Likely AI"
        elif calibrated <= self.human_threshold and confidence > 0.30:
            if trained and trained.get("ai_likelihood", 0) > 0.65 and disagreement > 0.35:
                classification = "Mixed/Edited"
            else:
                classification = "Likely Human"
        elif len(scores) >= 2 and (max(scores) - min(scores) > 0.45):
            classification = "Mixed/Edited"
        else:
            classification = "Inconclusive"
        
        if confidence < 0.25:
            classification = "Inconclusive"
        
        # Low-FPR override: if trained model has extreme confidence with low disagreement
        if trained and trained.get("ai_likelihood", 0.5) < 0.15 and disagreement < 0.25:
            classification = "Likely Human"
            calibrated = min(calibrated, trained.get("ai_likelihood", 0.5) + 0.10)
            confidence = max(confidence, 0.75)
        elif trained and trained.get("ai_likelihood", 0.5) > 0.85:
            classification = "Likely AI"
            calibrated = max(calibrated, trained.get("ai_likelihood", 0.5) - 0.05)
            confidence = max(confidence, 0.80)
        
        return {
            "overall_classification": classification,
            "ai_likelihood": float(np.clip(calibrated, 0, 1)),
            "raw_likelihood": float(ai_likelihood),
            "confidence": float(confidence),
            "disagreement": float(disagreement),
            "weight_total": weight_total,
            "num_detectors": len(available),
            "details": {
                "scores": scores,
                "methods": [f.get("method") for f in available],
                "trained_fusion_boosted": trained is not None,
                "trained_score": trained.get("ai_likelihood") if trained else None
            }
        }
