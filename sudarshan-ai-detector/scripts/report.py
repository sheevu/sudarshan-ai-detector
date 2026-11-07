
from typing import Dict, List
from datetime import datetime, timezone
import json

class ReportGenerator:
    def __init__(self):
        self.version = "0.1.0"
    
    def generate(self, text: str, language: str, findings: List[Dict], fusion: Dict, mixed: Dict = None, provenance: Dict = None, model_versions: Dict = None) -> Dict:
        words, tokens = self._count(text)
        ai_sections = []
        if mixed and mixed.get("sections"):
            for sec in mixed["sections"]:
                if sec["ai_likelihood"] > 0.65:
                    ai_sections.append({"index": sec["index"], "preview": sec["text_preview"][:200], "ai_likelihood": sec["ai_likelihood"], "label": sec["label"], "note": "Statistical signal, not definitive proof"})
        report = {
            "overall_classification": fusion.get("overall_classification", "Inconclusive"),
            "ai_likelihood": fusion.get("ai_likelihood", 0.5),
            "raw_likelihood": fusion.get("raw_likelihood", 0.5),
            "detected_language": language,
            "word_count": words,
            "token_count": tokens,
            "char_count": len(text),
            "detection_methods_used": [f.get("method") for f in findings if f.get("available")],
            "individual_findings": {f.get("method"): {"ai_likelihood": f.get("ai_likelihood"), "score": f.get("score"), "available": f.get("available"), "details": f.get("details", {}), "experimental": f.get("experimental", False), "requires_training": f.get("requires_training", False)} for f in findings},
            "mixed_authorship": {"is_mixed": mixed.get("is_mixed", False) if mixed else False, "sections": mixed.get("sections", []) if mixed else [], "variance": mixed.get("score", 0) if mixed else 0},
            "ai_like_sections": ai_sections,
            "uncertainty": {"confidence": fusion.get("confidence", 0), "disagreement": fusion.get("disagreement", 0), "reliability": "high" if fusion.get("confidence",0)>0.7 else "medium" if fusion.get("confidence",0)>0.4 else "low"},
            "provenance": provenance.get("details", {}) if provenance else {},
            "limitations": ["Statistical signals, not proof of authorship", "Short texts (<50 words) are inherently inconclusive", "Transformer classifier requires fine-tuned weights; if unavailable, statistical methods used", "Watermark detection requires known watermark key and compatible scheme", "Perturbation detection is experimental", "Non-native English and Hinglish may increase false positives - thresholds adjusted for low FPR", "No detector can identify specific LLM without watermark/provenance"],
            "model_versions": model_versions or {"sudarshan_detector": self.version, "perplexity_model": "distilgpt2 (surrogate)", "transformer": "xlm-roberta-base (requires fine-tuning)", "indicbert": "ai4bharat/indic-bert (requires fine-tuning)"},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "disclaimer": "Highlighted sections are statistical signals, not definitive proof of AI authorship. Never claim authorship certainty based solely on detector scores."
        }
        return report
    
    def _count(self, text: str):
        words = len(text.split())
        tokens = int(words * 1.33)
        return words, tokens
    
    def to_json(self, report: Dict) -> str:
        return json.dumps(report, indent=2, ensure_ascii=False)

    def to_text(self, report: Dict) -> str:
        lines = [
            "=" * 50,
            f"SUDARSHAN AI DETECTOR REPORT (v{self.version})",
            "=" * 50,
            f"Overall Verdict: {report.get('overall_classification', 'Inconclusive')}",
            f"AI Likelihood  : {report.get('ai_likelihood', 0.5):.1%}",
            f"Confidence     : {report.get('uncertainty', {}).get('confidence', 0.0):.1%}",
            f"Language       : {report.get('detected_language', 'unknown')}",
            f"Word Count     : {report.get('word_count', 0)} words",
            "-" * 50,
            "Individual Method Scores:"
        ]
        for method, finding in report.get("individual_findings", {}).items():
            if isinstance(finding, dict):
                score_str = f"{finding.get('ai_likelihood', 0.5):.1%}"
                lines.append(f"  • {method:18}: {score_str}")
        lines.append("=" * 50)
        return "\n".join(lines)
