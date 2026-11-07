
from typing import Dict
import math

class PerplexityAnalyzer:
    def __init__(self, model_name: str = "distilgpt2", device: str = "auto"):
        self.name = "perplexity"
        self.model_name = model_name
        self.device = device
        self._model = None
        self._tokenizer = None
        self._loaded = False
        self._load_error = None
    
    def _lazy_load(self):
        if self._loaded:
            return True
        if self._load_error:
            return False
        import os
        allow_network = os.getenv("SUDARSHAN_ENABLE_HF_DOWNLOAD", "0").lower() in ("1", "true")
        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer
            import torch
            try:
                # Try cached local weights first
                self._tokenizer = AutoTokenizer.from_pretrained(self.model_name, local_files_only=True)
                self._model = AutoModelForCausalLM.from_pretrained(self.model_name, local_files_only=True)
            except Exception:
                if not allow_network:
                    self._load_error = "Local weights not cached, using statistical perplexity proxy"
                    self._loaded = False
                    return False
                self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
                self._model = AutoModelForCausalLM.from_pretrained(self.model_name)
            if self.device == "auto":
                device = "cuda" if torch.cuda.is_available() else "cpu"
            else:
                device = self.device
            self._model.to(device)
            self._model.eval()
            self._device = device
            self._loaded = True
            return True
        except Exception as e:
            self._load_error = str(e)
            self._loaded = False
            return False
    
    def analyze(self, text: str) -> Dict:
        if not self._lazy_load():
            words = text.split()
            if len(words) < 10:
                return {"method": self.name, "ai_likelihood": 0.5, "score": 0.5, "details": {"fallback": True, "error": self._load_error}, "available": False}
            avg_len = sum(len(w) for w in words)/len(words)
            ai_likelihood = 0.5
            if avg_len < 4.5:
                ai_likelihood += 0.1
            return {"method": self.name, "score": 50.0, "perplexity": 50.0, "ai_likelihood": ai_likelihood, "details": {"fallback": True, "avg_word_len": avg_len, "error": self._load_error}, "available": True, "fallback_used": True}
        try:
            import torch
            enc = self._tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
            input_ids = enc.input_ids.to(self._device)
            with torch.no_grad():
                outputs = self._model(input_ids, labels=input_ids)
                neg_log_likelihood = outputs.loss.item()
                ppl = math.exp(neg_log_likelihood)
            log_ppl = math.log(ppl + 1e-6)
            ai_likelihood = 1.0 / (1.0 + math.exp((log_ppl - 3.5)*1.5))
            import numpy as np
            ai_likelihood = float(np.clip(ai_likelihood, 0.05, 0.95))
            return {"method": self.name, "score": ppl, "perplexity": ppl, "nll": neg_log_likelihood, "ai_likelihood": ai_likelihood, "details": {"model": self.model_name, "log_ppl": log_ppl}, "available": True}
        except Exception as e:
            return {"method": self.name, "ai_likelihood": 0.5, "score": 0.5, "details": {"error": str(e)}, "available": False}
