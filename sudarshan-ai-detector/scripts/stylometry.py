import re
from collections import Counter
from typing import Dict
import numpy as np

FUNCTION_WORDS_EN = set([
    "the","and","is","are","was","were","be","to","of","a","in","that","it",
    "for","on","with","as","this","by","at","from","or","an","have","has",
    "had","but","not","they","you","we","he","she","i"
])
FUNCTION_WORDS_HI = set([
    "है","हैं","और","का","के","की","को","में","से","पर","यह","वह","जो",
    "तो","भी","नहीं","हो","था","थी","थे","कर","लिए"
])

class StylometryAnalyzer:
    def __init__(self):
        self.name = "stylometry"
    
    def analyze(self, text: str) -> Dict:
        words = text.split()
        if len(words) < 20:
            return {"method": self.name, "ai_likelihood": 0.5, "score": 0.5, "details": {"reason": "too short"}, "available": False}
        
        lower_words = [w.lower().strip(".,!?\u0964:;()\"'") for w in words]
        ttr = len(set(lower_words)) / max(1, len(lower_words))
        
        bigrams = list(zip(lower_words, lower_words[1:]))
        bigram_counts = Counter(bigrams)
        repeated_bigrams = sum(1 for c in bigram_counts.values() if c > 1)
        repetition_ratio = repeated_bigrams / max(1, len(bigrams))
        
        func_count = sum(1 for w in lower_words if w in FUNCTION_WORDS_EN or w in FUNCTION_WORDS_HI)
        func_ratio = func_count / max(1, len(lower_words))
        avg_word_len = float(np.mean([len(w) for w in lower_words if w]))
        
        # Filter out standalone markdown headers (# Header) when calculating body paragraphs
        raw_paras = [p.strip() for p in text.split("\n\n") if p.strip()]
        body_paras = [p for p in raw_paras if not re.match(r'^\s*#{1,6}\s+', p)]
        
        has_markdown_headers = len(raw_paras) > len(body_paras)
        has_bullet_points = bool(re.search(r'^\s*[-*•]\s+', text, re.MULTILINE))
        has_intro_colons = bool(re.search(r':\s*$', text, re.MULTILINE))
        
        para_lens = [len(p.split()) for p in body_paras] if body_paras else [len(words)]
        para_cv = float(np.std(para_lens) / (np.mean(para_lens) + 1e-6)) if len(para_lens) > 1 else 0.0
        
        ai_score = 0.5
        
        # High vocabulary diversity in structured text often signals LLM output
        if ttr > 0.75 and para_cv < 0.40:
            ai_score += 0.15
        if repetition_ratio < 0.06:
            ai_score += 0.10
        if 0.35 < func_ratio < 0.55:
            ai_score += 0.05
        if para_cv < 0.25 and len(body_paras) >= 2:
            ai_score += 0.15
            
        # AI structural cues: Markdown hierarchy, colon lead-ins, bullet formatting
        if has_markdown_headers:
            ai_score += 0.10
        if has_intro_colons:
            ai_score += 0.08
        if has_bullet_points:
            ai_score += 0.08
            
        # Human naturalness signals
        if ttr < 0.55:
            ai_score -= 0.15
        if para_cv > 0.85 and not has_markdown_headers:
            ai_score -= 0.15
        if repetition_ratio > 0.18:
            ai_score -= 0.15
            
        ai_likelihood = float(np.clip(ai_score, 0.05, 0.95))
        return {
            "method": self.name,
            "score": float(1.0 - ai_likelihood),
            "ai_likelihood": ai_likelihood,
            "details": {
                "ttr": round(ttr, 3),
                "repetition_ratio": round(repetition_ratio, 3),
                "function_word_ratio": round(func_ratio, 3),
                "avg_word_length": round(avg_word_len, 2),
                "para_count": len(body_paras),
                "para_cv": round(para_cv, 3),
                "has_structural_formatting": has_markdown_headers or has_bullet_points or has_intro_colons,
                "top_bigrams": [" ".join(bg) for bg, cnt in bigram_counts.most_common(5) if cnt > 1]
            },
            "available": True
        }
