
from typing import Dict, Optional
import os

class TransformerAnalyzer:
    def __init__(self, model_path: Optional[str] = None, model_name: str = "xlm-roberta-base", device: str = "auto"):
        self.name = "transformer"
        self.model_path = model_path
        self.model_name = model_name
        self.device = device
        self._model = None
        self._tokenizer = None
        self._loaded = False
        self._error = None
    
    def _lazy_load(self):
        if self._loaded:
            return True
        path = self.model_path
        if path and not os.path.exists(path):
            self._error = f"Model path not found: {path}"
            return False
        try:
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
            import torch
            load_from = path if path and os.path.exists(path) else self.model_name
            self._tokenizer = AutoTokenizer.from_pretrained(load_from, trust_remote_code=True)
            self._model = AutoModelForSequenceClassification.from_pretrained(load_from, trust_remote_code=True, num_labels=2)
            device = "cuda" if (self.device=="auto" and torch.cuda.is_available()) else self.device if self.device!="auto" else "cpu"
            self._model.to(device)
            self._model.eval()
            self._device = device
            self._loaded = True
            return True
        except Exception as e:
            self._error = str(e)
            return False
    
    def analyze(self, text: str) -> Dict:
        if len(text.split()) < 10:
            return {"method": self.name, "ai_likelihood": 0.5, "score": 0.5, "details": {"too_short": True}, "available": False}
        if not self._lazy_load():
            return {"method": self.name, "ai_likelihood": 0.5, "score": 0.5, "details": {"error": self._error, "model_path": self.model_path, "note": "Fine-tuned weights required. Train via scripts/train.py"}, "available": False, "requires_training": True}
        try:
            import torch
            inputs = self._tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(self._device)
            with torch.no_grad():
                outputs = self._model(**inputs)
                probs = torch.softmax(outputs.logits, dim=-1)
                ai_prob = probs[0][1].item() if probs.shape[-1]>1 else probs[0][0].item()
            import numpy as np
            return {"method": self.name, "score": ai_prob, "ai_likelihood": float(np.clip(ai_prob, 0.05, 0.95)), "details": {"model": self.model_path or self.model_name, "device": self._device}, "available": True}
        except Exception as e:
            return {"method": self.name, "ai_likelihood": 0.5, "score": 0.5, "details": {"error": str(e)}, "available": False}
