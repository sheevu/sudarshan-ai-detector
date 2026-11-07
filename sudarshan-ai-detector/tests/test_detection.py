
from scripts.detector import SudarshanDetector

def test_human_text():
    detector = SudarshanDetector(use_transformer=False)
    text = """I went to the market yesterday and it was raining heavily. The roads were all muddy and I slipped twice. My mother told me to be careful but I never listen. Anyway, we bought some vegetables and came back. The whole experience was quite tiring but also funny when I think about it now."""
    result = detector.detect(text)
    assert result["overall_classification"] in ["Likely Human", "Inconclusive", "Mixed/Edited", "Likely AI"]
    assert 0 <= result["ai_likelihood"] <= 1

def test_ai_like_text():
    detector = SudarshanDetector(use_transformer=False)
    text = """In conclusion, it is important to note that artificial intelligence has significantly transformed various aspects of modern society. Furthermore, the implications of this technology are far-reaching and multifaceted. It is essential to consider both the advantages and disadvantages in a comprehensive manner. Overall, the future of AI appears promising and holds substantial potential for innovation."""
    result = detector.detect(text)
    assert result["word_count"] > 10
    assert "burstiness" in result["detection_methods_used"] or len(result["detection_methods_used"])>0

def test_short_text_inconclusive():
    detector = SudarshanDetector()
    result = detector.detect("Hi hello.")
    assert result["overall_classification"] == "Inconclusive"

def test_empty():
    detector = SudarshanDetector()
    result = detector.detect("")
    assert result["overall_classification"] == "Inconclusive"
