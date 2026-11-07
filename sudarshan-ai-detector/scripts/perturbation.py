
from typing import Dict, List
import random

class PerturbationAnalyzer:
    def __init__(self, perturbation_model: str = "t5-small", scorer_model: str = "distilgpt2", device: str = "auto", num_perturbations: int = 5):
        self.name = "perturbation"
        self.perturbation_model = perturbation_model
        self.scorer_model = scorer_model
        self.device = device
        self.num_perturbations = num_perturbations
        self._pert_tokenizer = None
        self._pert_model = None
        self._scorer_tokenizer = None
        self._scorer_model = None
        self._loaded = False
        self._error = None
    
    def _lazy_load(self):
        if self._loaded:
            return True
        try:
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, AutoModelForCausalLM
            import torch
            device = "cuda" if self.device=="auto" and torch.cuda.is_available() else self.device if self.device!="auto" else "cpu"
            self._pert_tokenizer = AutoTokenizer.from_pretrained(self.perturbation_model)
            self._pert_model = AutoModelForSeq2SeqLM.from_pretrained(self.perturbation_model).to(device)
            self._scorer_tokenizer = AutoTokenizer.from_pretrained(self.scorer_model)
            self._scorer_model = AutoModelForCausalLM.from_pretrained(self.scorer_model).to(device)
            self._device = device
            self._loaded = True
            return True
        except Exception as e:
            self._error = str(e)
            return False
    
    def _perturb_text(self, text: str) -> List[str]:
        words = text.split()
        perturbed = []
        for _ in range(self.num_perturbations):
            masked = words.copy()
            num_to_mask = max(1, int(len(words)*0.15))
            idxs = random.sample(range(len(words)), min(num_to_mask, len(words)))
            for i in idxs:
                masked[i] = "<extra_id_0>"
            perturbed_text = " ".join(masked)
            if self._loaded and self._pert_model:
                try:
                    import torch
                    inp = self._pert_tokenizer(perturbed_text, return_tensors="pt").to(self._device)
                    with torch.no_grad():
                        out = self._pert_model.generate(**inp, max_length=len(inp.input_ids[0])+20, do_sample=True)
                    decoded = self._pert_tokenizer.decode(out[0], skip_special_tokens=True)
                    perturbed.append(decoded)
                except Exception:
                    random.shuffle(masked)
                    perturbed.append(" ".join(masked))
            else:
                random.shuffle(masked)
                perturbed.append(" ".join(masked))
        return perturbed
    
    def _score(self, text: str) -> float:
        if self._loaded and self._scorer_model:
            try:
                import torch
                enc = self._scorer_tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(self._device)
                input_ids = enc.input_ids.to(self._device)
                with torch.no_grad():
                    outputs = self._scorer_model(input_ids, labels=input_ids)
                    return -outputs.loss.item()
            except Exception:
                return 0.0
        else:
            return -len(text.split()) * 0.01
    
    def analyze(self, text: str) -> Dict:
        if len(text.split()) < 50:
            return {"method": self.name, "ai_likelihood": 0.5, "score": 0.5, "details": {"too_short_for_perturbation": True}, "available": False}
        has_models = self._lazy_load()
        orig_score = self._score(text)
        perturbed_texts = self._perturb_text(text)
        pert_scores = [self._score(p) for p in perturbed_texts]
        if not pert_scores:
            return {"method": self.name, "ai_likelihood": 0.5, "score": 0.5, "details": {"no_perturbations": True}, "available": False}
        import numpy as np
        mean_pert = float(np.mean(pert_scores))
        std_pert = float(np.std(pert_scores) + 1e-6)
        curvature = orig_score - mean_pert
        z_score = curvature / std_pert
        ai_likelihood = 1.0 / (1.0 + np.exp(-z_score))
        ai_likelihood = float(np.clip(ai_likelihood, 0.05, 0.95))
        return {"method": self.name, "score": z_score, "curvature": curvature, "ai_likelihood": ai_likelihood, "details": {"original_log_prob": orig_score, "mean_perturbed_log_prob": mean_pert, "std_perturbed": std_pert, "num_perturbations": len(pert_scores), "models_loaded": has_models, "error": self._error if not has_models else None}, "available": True, "experimental": True}
