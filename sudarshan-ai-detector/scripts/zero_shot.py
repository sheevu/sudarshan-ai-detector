from typing import Dict, List
import re
from collections import Counter
import numpy as np

MODERN_AI_MARKERS = [
    # Modern LLM corporate / analytical buzzwords
    "at a critical juncture", "critical juncture", "exponential growth", "game-changing",
    "comprehensive guide", "unprecedented opportunities", "fundamentally altered",
    "leveraging to achieve", "leveraging", "transformative potential", "paradigm shift",
    "in today's fast-paced", "in today's digital landscape", "ever-evolving landscape",
    "it is important to note", "it is worth noting", "it is crucial to", "crucial role",
    "pivotal role", "vital role", "rich tapestry", "tapestry of", "tapestry",
    "delve into", "delving into", "delve deeper", "testament to", "beacon of",
    "fostering innovation", "holistic approach", "seamless integration", "underscores the",
    "harnessing the power", "poised to", "embark on", "realm of", "multifaceted",
    "revolutionize", "revolutionary", "paramount importance", "navigate the complexities",
    "double-edged sword", "in conclusion", "furthermore", "moreover", "additionally",
    "overall,", "in summary", "to summarize", "spearheading",
    "unraveling", "catalyst for", "cornerstone of", "groundbreaking", "symbiotic relationship",
    "synergistic", "demystifying", "burgeoning", "profound impact", "significant milestone",
    "it is essential to", "serves as a reminder", "in essence", "meticulously crafted",
    # Hindi markers
    "महत्वपूर्ण भूमिका", "क्रांतिकारी परिवर्तन", "उल्लेखनीय है", "निष्कर्षतः",
    "इसके अतिरिक्त", "इसके अलावा", "सकारात्मक प्रभाव", "दृष्टिकोण"
]

class ZeroShotAnalyzer:
    def __init__(self, perplexity_analyzer=None):
        self.name = "zero_shot"
        self.perplexity_analyzer = perplexity_analyzer
    
    def analyze(self, text: str) -> Dict:
        words = text.split()
        if len(words) < 15:
            return {
                "method": self.name,
                "ai_likelihood": 0.5,
                "score": 0.5,
                "details": {"too_short": True},
                "available": False
            }
        
        lower_text = text.lower()
        lower_words = [w.lower().strip(".,!?\u0964:;()\"'") for w in words]
        
        # 1. Hapax legomena (words that appear exactly once)
        counts = Counter(lower_words)
        hapax = sum(1 for c in counts.values() if c == 1)
        hapax_ratio = hapax / max(1, len(counts))
        
        # 2. Sentence start diversity
        # Protect decimal numbers before splitting
        temp = re.sub(r'(\d+)\.(\d+)', r'\1<DOT>\2', text)
        raw_sents = re.split(r'[.!?\u0964]+|\n\s*\n', temp)
        sentences = [s.replace('<DOT>', '.').strip() for s in raw_sents if len(s.replace('<DOT>', '.').strip().split()) >= 3]
        starts = [s.split()[0].lower() for s in sentences if s.split()]
        start_diversity = len(set(starts)) / max(1, len(starts)) if starts else 0.5
        
        # 3. Modern AI marker matching
        matched_markers = [m for m in MODERN_AI_MARKERS if m in lower_text]
        marker_density = len(matched_markers) / max(1, len(words) / 100) # per 100 words
        
        # Compute AI likelihood
        ai_likelihood = 0.5
        
        # Vocabulary richness / hapax
        if hapax_ratio < 0.6:
            ai_likelihood += 0.15
        elif hapax_ratio > 0.88:
            ai_likelihood -= 0.15
            
        # Monotonous sentence openers
        if start_diversity < 0.7:
            ai_likelihood += 0.10
        elif start_diversity > 0.95 and len(starts) >= 4:
            ai_likelihood -= 0.10
            
        # AI Markers boost
        if len(matched_markers) >= 3:
            ai_likelihood += min(0.35, 0.15 + (len(matched_markers) - 3) * 0.05)
        elif len(matched_markers) >= 1:
            ai_likelihood += 0.10
            
        ai_likelihood = float(np.clip(ai_likelihood, 0.05, 0.95))
        
        return {
            "method": self.name,
            "score": float(np.clip(ai_likelihood, 0, 1)),
            "ai_likelihood": ai_likelihood,
            "details": {
                "hapax_ratio": round(hapax_ratio, 3),
                "start_diversity": round(start_diversity, 3),
                "matched_ai_markers": matched_markers[:8],
                "marker_count": len(matched_markers),
                "unique_words": len(counts),
                "total_words": len(lower_words)
            },
            "available": True
        }
