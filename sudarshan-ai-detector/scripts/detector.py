
import os
from typing import Dict, List, Optional
from datetime import datetime

from .language import detect_language
from .perplexity import PerplexityAnalyzer
from .burstiness import BurstinessAnalyzer
from .stylometry import StylometryAnalyzer
from .zero_shot import ZeroShotAnalyzer
from .mixed_authorship import MixedAuthorshipAnalyzer
from .provenance import ProvenanceAnalyzer
from .trained_fusion import TrainedFusionAnalyzer
from .watermark import WatermarkAnalyzer
from .transformer_classifier import TransformerAnalyzer
from .perturbation import PerturbationAnalyzer
from .fusion import FusionModel
from .report import ReportGenerator

class SudarshanDetector:
    def __init__(self, use_transformer: bool = False, use_perturbation: bool = False, use_watermark: bool = False, transformer_path: Optional[str] = None, perplexity_model: str = "distilgpt2", device: str = "auto"):
        self.language_detector = detect_language
        self.perplexity = PerplexityAnalyzer(model_name=perplexity_model, device=device)
        self.burstiness = BurstinessAnalyzer()
        self.stylometry = StylometryAnalyzer()
        self.zero_shot = ZeroShotAnalyzer()
        self.mixed = MixedAuthorshipAnalyzer()
        self.provenance = ProvenanceAnalyzer()
        self.watermark = WatermarkAnalyzer() if use_watermark else None
        self.transformer = TransformerAnalyzer(model_path=transformer_path, device=device) if use_transformer else None
        self.perturbation = PerturbationAnalyzer(device=device) if use_perturbation else None
        try:
            from pathlib import Path as _P
            _models_dir = _P(__file__).parent.parent / "models"
            self.trained_fusion = TrainedFusionAnalyzer(models_dir=str(_models_dir))
        except Exception:
            self.trained_fusion = None
        self.fusion = FusionModel()
        self.report_gen = ReportGenerator()

    def detect(self, text: str, language: str = "auto", metadata: Optional[Dict] = None, watermark_key: Optional[str] = None) -> Dict:
        char_count = len(text)
        word_count = len(text.split())
        token_count = max(1, char_count // 4)

        if not text or not text.strip() or word_count < 10:
            lang = "unknown"
            return {
                "overall_classification": "Inconclusive",
                "ai_likelihood": 0.5,
                "detected_language": lang,
                "word_count": word_count,
                "token_count": token_count,
                "char_count": char_count,
                "detection_methods_used": [],
                "individual_findings": {},
                "ai_like_sections": [],
                "mixed_authorship": {"is_mixed": False, "sections": []},
                "uncertainty": {"confidence": 0.0, "disagreement": 0.0},
                "limitations": ["Text too short (<10 words) for reliable detection."],
                "model_versions": {"fusion": "0.2.0-py314"},
                "timestamp": datetime.now().isoformat()
            }

        detected_lang, lang_conf = self.language_detector(text) if language == "auto" else (language, 1.0)

        if word_count < 50:
            short_note = f"Short text ({word_count} words) - inherently low confidence."
        else:
            short_note = None

        findings = []
        findings.append(self.burstiness.analyze(text))
        findings.append(self.stylometry.analyze(text))
        findings.append(self.perplexity.analyze(text))
        findings.append(self.zero_shot.analyze(text))
        if self.transformer:
            findings.append(self.transformer.analyze(text))
        if self.perturbation:
            findings.append(self.perturbation.analyze(text))
        if self.watermark:
            findings.append(self.watermark.analyze(text, watermark_key=watermark_key))
        if self.trained_fusion:
            tf_res = self.trained_fusion.analyze(text)
            if tf_res.get("available"):
                findings.append(tf_res)

        fusion_result = self.fusion.fuse(findings)

        if short_note and fusion_result["confidence"] < 0.6:
            fusion_result["overall_classification"] = "Inconclusive"

        mixed_result = self.mixed.analyze(text)
        provenance_result = self.provenance.analyze(text, metadata=metadata)

        ai_like_sections = []
        for sec in mixed_result.get("sections", []):
            if sec.get("label") == "likely_ai":
                ai_like_sections.append(sec)

        limitations = [
            "Statistical signals, not cryptographic proof. Never claim certainty.",
            "Short text (<50 words) inherently inconclusive.",
            "Perplexity uses surrogate model (distilgpt2) not true generator model.",
            "Non-native and Hinglish may have higher false positives - low FPR prioritized.",
            "Paraphrased or human-edited AI reduces detection.",
            "Transformer detector requires fine-tuned weights - uses fallback if missing.",
            "Trained fusion model trained on synthetic open dataset + scanned past AI content, no paid APIs, Python 3.14 compatible."
        ]
        if short_note:
            limitations.insert(0, short_note)

        report = {
            "overall_classification": fusion_result["overall_classification"],
            "ai_likelihood": fusion_result["ai_likelihood"],
            "raw_likelihood": fusion_result.get("raw_likelihood", fusion_result["ai_likelihood"]),
            "detected_language": detected_lang,
            "language_confidence": lang_conf,
            "word_count": word_count,
            "token_count": token_count,
            "char_count": char_count,
            "detection_methods_used": [f.get("method") for f in findings if f.get("available")],
            "individual_findings": {f.get("method"): f for f in findings},
            "ai_like_sections": ai_like_sections,
            "sentence_breakdown": mixed_result.get("sentences", []),
            "mixed_authorship": mixed_result,
            "provenance": provenance_result,
            "uncertainty": {"confidence": fusion_result["confidence"], "disagreement": fusion_result["disagreement"]},
            "limitations": limitations,
            "model_versions": {"perplexity": "distilgpt2", "fusion": "0.2.0-py314-trained", "trained_fusion": "randomforest-sklearn1.5-py314"},
            "timestamp": datetime.now().isoformat(),
            "_fusion_details": fusion_result["details"]
        }
        return report

    def to_json(self, result: Dict) -> str:
        return self.report_gen.to_json(result)

    def to_report(self, result: Dict) -> str:
        return self.report_gen.to_text(result)
