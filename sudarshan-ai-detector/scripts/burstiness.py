import re
import numpy as np
from typing import Dict, List

def clean_prose_for_sentences(text: str) -> str:
    """Strips markdown headers and bullet prefixes so they don't skew sentence metrics."""
    cleaned = re.sub(r'^\s*#{1,6}\s+.*$', '', text, flags=re.MULTILINE)
    cleaned = re.sub(r'^\s*[-*•]\s+', '', cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r'^\s*\d+\.\s+', '', cleaned, flags=re.MULTILINE)
    return cleaned

def split_sentences(text: str) -> List[str]:
    cleaned = clean_prose_for_sentences(text)
    # Protect decimal numbers (e.g. 63.4, 3.14, 2025-26) from being split
    temp = re.sub(r'(\d+)\.(\d+)', r'\1<DOT>\2', cleaned)
    # Split on sentence terminals: period, exclamation, question mark, purna viram, or paragraph break
    raw_sents = re.split(r'[.!?\u0964]+|\n\s*\n', temp)
    sentences = [
        s.replace('<DOT>', '.').strip()
        for s in raw_sents
        if len(s.replace('<DOT>', '.').strip().split()) >= 3
    ]
    return sentences

def lexical_diversity(text: str) -> float:
    words = text.lower().split()
    if not words:
        return 0.0
    return len(set(words)) / len(words)

class BurstinessAnalyzer:
    def __init__(self):
        self.name = "burstiness"
    
    def analyze(self, text: str) -> Dict:
        sentences = split_sentences(text)
        if len(sentences) < 2:
            return {
                "method": self.name,
                "score": 0.5,
                "ai_likelihood": 0.5,
                "details": {"reason": "too few sentences", "sentence_count": len(sentences)},
                "available": False
            }
        lengths = [len(s.split()) for s in sentences]
        mean_len = float(np.mean(lengths))
        std_len = float(np.std(lengths))
        cv = std_len / (mean_len + 1e-6)
        
        ttrs = [len(set(s.lower().split())) / max(1, len(s.split())) for s in sentences]
        ttr_var = float(np.var(ttrs))
        
        # Human writing has high burstiness (varying short and long sentences: high CV).
        # AI writing typically produces uniform, balanced, medium-to-long sentences (low CV).
        # Standard threshold: CV > 0.65 suggests natural human burstiness.
        burstiness_score = min(1.0, cv / 0.75)
        ai_likelihood = 1.0 - burstiness_score
        
        # Uniform clause/sentence length penalty
        if cv < 0.35:
            ai_likelihood = min(0.95, ai_likelihood + 0.20)
        elif cv > 0.60:
            ai_likelihood = max(0.08, ai_likelihood - 0.15)
            
        if ttr_var < 0.015:
            ai_likelihood = min(0.95, ai_likelihood + 0.10)
            
        return {
            "method": self.name,
            "score": float(np.clip(burstiness_score, 0, 1)),
            "ai_likelihood": float(np.clip(ai_likelihood, 0, 1)),
            "details": {
                "sentence_count": len(sentences),
                "mean_sentence_length": round(mean_len, 2),
                "std_sentence_length": round(std_len, 2),
                "cv": round(cv, 3),
                "ttr_variance": round(ttr_var, 4)
            },
            "available": True
        }
