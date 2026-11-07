
from typing import Dict
import hashlib, math

class WatermarkAnalyzer:
    def __init__(self, gamma: float = 0.5, delta: float = 2.0):
        self.name = "watermark"
        self.gamma = gamma
        self.delta = delta
    
    def _green_list_test(self, text: str, key: str = "default") -> Dict:
        words = text.lower().split()
        if len(words) < 20:
            return {"detected": False, "reason": "too_short", "green_count": 0, "expected": 0, "z_score": 0}
        green_count = 0
        for i in range(1, len(words)):
            prev = words[i-1]
            curr = words[i]
            h = int(hashlib.sha256((prev+key).encode()).hexdigest(), 16)
            is_green = (h % 100) < (self.gamma*100)
            curr_h = int(hashlib.sha256(curr.encode()).hexdigest(), 16) % 100
            if curr_h < 50:
                if is_green:
                    green_count += 1
        expected_green = len(words) * self.gamma * 0.5
        z = (green_count - expected_green) / math.sqrt(len(words)*self.gamma*(1-self.gamma)+1e-6) if len(words)>0 else 0
        detected = z > 2.0
        return {"green_count": green_count, "expected": expected_green, "z_score": z, "detected": detected}
    
    def analyze(self, text: str, watermark_key: str = None) -> Dict:
        if len(text.split()) < 30:
            return {"method": self.name, "ai_likelihood": 0.5, "score": 0.5, "details": {"too_short": True}, "available": False}
        test = self._green_list_test(text, key=watermark_key or "default")
        ai_likelihood = 0.65 if test["detected"] else 0.45
        return {"method": self.name, "score": test["z_score"], "ai_likelihood": ai_likelihood, "details": {"green_count": test["green_count"], "expected_green": test["expected"], "z_score": test["z_score"], "detected": test["detected"], "note": "Without known watermark key, heuristic only, not proof.", "watermark_key_provided": watermark_key is not None}, "available": True, "requires_key": True}
