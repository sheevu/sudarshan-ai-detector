from typing import List, Dict
import re
import numpy as np
from .burstiness import split_sentences, clean_prose_for_sentences
from .zero_shot import MODERN_AI_MARKERS

class MixedAuthorshipAnalyzer:
    def __init__(self, window_size: int = 3):
        self.name = "mixed_authorship"
        self.window_size = window_size
    
    def score_sentence(self, sent: str) -> Dict:
        lower = sent.lower()
        matched = [m for m in MODERN_AI_MARKERS if m in lower]
        words = sent.split()
        word_count = len(words)
        
        # Base likelihood
        score = 0.5
        indicators = []
        
        if matched:
            score += min(0.40, len(matched) * 0.15)
            indicators.append(f"AI markers: {', '.join(matched[:3])}")
            
        # Balanced length heuristic: AI sentences are typically 18-35 words with complex subclauses
        if 18 <= word_count <= 35 and any(w in lower for w in [",", "which", "that", "while", "as", "by", "with"]):
            score += 0.08
            
        # Short conversational statements are typically human
        if word_count < 8 and not matched:
            score -= 0.15
            indicators.append("Short conversational flow")
            
        score = float(np.clip(score, 0.05, 0.95))
        label = "likely_ai" if score >= 0.65 else "likely_human" if score <= 0.35 else "uncertain"
        
        return {
            "text": sent,
            "ai_likelihood": round(score, 3),
            "label": label,
            "word_count": word_count,
            "indicators": indicators
        }
    
    def analyze(self, text: str, section_scores: List[Dict] = None) -> Dict:
        raw_paras = [p.strip() for p in text.split("\n\n") if p.strip()]
        body_paras = [p for p in raw_paras if not re.match(r'^\s*#{1,6}\s+', p)]
        
        # Extract individual sentences for fine-grained heatmap
        sentences = split_sentences(text)
        sentence_results = [self.score_sentence(s) for s in sentences]
        
        if len(body_paras) < 2 and len(sentences) >= 2:
            body_paras = [" ".join(sentences[i:i+3]) for i in range(0, len(sentences), 3) if " ".join(sentences[i:i+3]).strip()]
            
        if not body_paras:
            return {
                "method": self.name,
                "ai_likelihood": 0.5,
                "score": 0.5,
                "sections": [],
                "sentences": sentence_results,
                "details": {"reason": "single section"},
                "available": False
            }
        
        from .burstiness import BurstinessAnalyzer
        from .stylometry import StylometryAnalyzer
        burst = BurstinessAnalyzer()
        stylo = StylometryAnalyzer()
        
        section_results = []
        for idx, para in enumerate(body_paras):
            b = burst.analyze(para)
            s = stylo.analyze(para)
            b_like = b.get("ai_likelihood", 0.5)
            s_like = s.get("ai_likelihood", 0.5)
            ai_like = (b_like + s_like) / 2
            label = "likely_ai" if ai_like >= 0.65 else "likely_human" if ai_like <= 0.35 else "uncertain"
            section_results.append({
                "index": idx,
                "text_preview": para[:180] + ("..." if len(para) > 180 else ""),
                "word_count": len(para.split()),
                "ai_likelihood": round(ai_like, 3),
                "label": label,
                "burstiness": round(b_like, 3),
                "stylometry": round(s_like, 3)
            })
            
        scores = [r["ai_likelihood"] for r in section_results]
        variance = float(np.var(scores)) if len(scores) > 1 else 0.0
        score_range = float(max(scores) - min(scores)) if scores else 0.0
        is_mixed = variance > 0.05 and score_range > 0.30
        overall_ai = float(np.mean(scores)) if scores else 0.5
        
        return {
            "method": self.name,
            "score": variance,
            "ai_likelihood": overall_ai,
            "is_mixed": is_mixed,
            "sections": section_results,
            "sentences": sentence_results,
            "details": {
                "section_count": len(body_paras),
                "sentence_count": len(sentences),
                "score_variance": round(variance, 4),
                "score_range": round(score_range, 3),
                "mixed_threshold": 0.30
            },
            "available": True
        }
