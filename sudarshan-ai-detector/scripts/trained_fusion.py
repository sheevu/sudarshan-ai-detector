
"""
Trained Fusion Analyzer - Uses auto-trained model from data/auto_train
No paid APIs, fully open-source (scikit-learn + optional LightGBM)
"""
from typing import Dict
import os
import pickle
from pathlib import Path
import numpy as np

class TrainedFusionAnalyzer:
    def __init__(self, models_dir: str = "models"):
        self.name = "trained_fusion"
        self.models_dir = Path(models_dir)
        self.vectorizer = None
        self.model = None
        self.calibrator = None
        self.meta = None
        self._loaded = False
        self._error = None
        self._lazy_load()
    
    def _lazy_load(self):
        if self._loaded:
            return True
        try:
            vec_path = self.models_dir / "tfidf_vectorizer.pkl"
            model_path = self.models_dir / "fusion_model.pkl"
            cal_path = self.models_dir / "calibrator.pkl"
            meta_path = self.models_dir / "training_meta.json"
            
            if not vec_path.exists() or not model_path.exists():
                self._error = f"Trained models not found in {self.models_dir}. Run scripts/auto_train.py first"
                return False
            
            with open(vec_path, "rb") as f:
                self.vectorizer = pickle.load(f)
            with open(model_path, "rb") as f:
                self.model = pickle.load(f)
            if cal_path.exists():
                with open(cal_path, "rb") as f:
                    self.calibrator = pickle.load(f)
            if meta_path.exists():
                import json
                with open(meta_path) as f:
                    self.meta = json.load(f)
            
            self._loaded = True
            return True
        except Exception as e:
            self._error = str(e)
            return False
    
    def _extract_stats(self, text: str):
        # Reuse existing analyzers
        try:
            from .burstiness import BurstinessAnalyzer
            from .stylometry import StylometryAnalyzer
            from .zero_shot import ZeroShotAnalyzer
            from .language import detect_language
        except ImportError:
            import sys
            sys.path.insert(0, str(Path(__file__).parent.parent))
            from scripts.burstiness import BurstinessAnalyzer
            from scripts.stylometry import StylometryAnalyzer
            from scripts.zero_shot import ZeroShotAnalyzer
            from scripts.language import detect_language
        
        burst = BurstinessAnalyzer()
        stylo = StylometryAnalyzer()
        zero = ZeroShotAnalyzer()
        b = burst.analyze(text)
        s = stylo.analyze(text)
        z = zero.analyze(text)
        lang, _ = detect_language(text)
        
        feat = [
            b.get("ai_likelihood", 0.5),
            b.get("score", 0.5),
            b.get("details", {}).get("cv", 0.5),
            s.get("ai_likelihood", 0.5),
            s.get("details", {}).get("ttr", 0.5),
            s.get("details", {}).get("repetition_ratio", 0.1),
            s.get("details", {}).get("para_cv", 0.5),
            z.get("ai_likelihood", 0.5),
            z.get("details", {}).get("hapax_ratio", 0.5),
            len(text.split()) / 100.0,
            len(text) / 1000.0,
            1.0 if lang=="en" else 0.0,
            1.0 if lang=="hi" else 0.0,
            1.0 if lang=="hinglish" else 0.0,
        ]
        return np.array(feat).reshape(1, -1)
    
    def analyze(self, text: str) -> Dict:
        if len(text.split()) < 10:
            return {"method": self.name, "ai_likelihood": 0.5, "score": 0.5, "details": {"too_short": True}, "available": False}
        
        if not self._lazy_load():
            return {"method": self.name, "ai_likelihood": 0.5, "score": 0.5, "details": {"error": self._error, "note": "Run scripts/auto_train.py to train"}, "available": False, "requires_training": True}
        
        try:
            from scipy.sparse import hstack, csr_matrix
            X_tfidf = self.vectorizer.transform([text])
            X_stats = self._extract_stats(text)
            X_combined = hstack([X_tfidf, csr_matrix(X_stats)])
            
            if hasattr(self.model, "predict_proba"):
                prob = self.model.predict_proba(X_combined)[0,1]
            else:
                prob = float(self.model.predict(X_combined)[0])
            
            # Calibrate
            if self.calibrator is not None:
                prob_cal = self.calibrator.predict_proba(np.array([[prob]]))[0,1]
            else:
                prob_cal = prob
            
            prob_cal = float(np.clip(prob_cal, 0.05, 0.95))
            
            return {
                "method": self.name,
                "score": float(prob),
                "ai_likelihood": prob_cal,
                "raw_score": float(prob),
                "details": {
                    "model_type": self.meta.get("model_type") if self.meta else "unknown",
                    "training_auroc": self.meta.get("auroc") if self.meta else None,
                    "training_fpr": self.meta.get("fpr") if self.meta else None,
                    "num_train": self.meta.get("num_train") if self.meta else None,
                    "calibrated": self.calibrator is not None,
                    "note": "Trained on maximum open synthetic dataset + scanned past AI content, no paid APIs"
                },
                "available": True
            }
        except Exception as e:
            return {"method": self.name, "ai_likelihood": 0.5, "score": 0.5, "details": {"error": str(e)}, "available": False}
