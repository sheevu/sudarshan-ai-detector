
from scripts.fusion import FusionModel

def test_fusion():
    fusion = FusionModel()
    findings = [
        {"method": "perplexity", "ai_likelihood": 0.8, "available": True},
        {"method": "burstiness", "ai_likelihood": 0.7, "available": True},
        {"method": "stylometry", "ai_likelihood": 0.75, "available": True}
    ]
    result = fusion.fuse(findings)
    assert result["overall_classification"] in ["Likely AI", "Likely Human", "Mixed/Edited", "Inconclusive"]
    assert 0 <= result["ai_likelihood"] <= 1
    assert result["confidence"] >= 0

def test_fusion_disagreement():
    fusion = FusionModel()
    findings = [
        {"method": "perplexity", "ai_likelihood": 0.9, "available": True},
        {"method": "burstiness", "ai_likelihood": 0.1, "available": True}
    ]
    result = fusion.fuse(findings)
    # High disagreement => low confidence
    assert result["disagreement"] > 0.3
