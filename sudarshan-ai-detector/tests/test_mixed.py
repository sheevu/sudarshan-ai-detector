
from scripts.detector import SudarshanDetector

def test_mixed_authorship():
    detector = SudarshanDetector()
    human_para = "I woke up late today, missed my bus, ran all the way to college. It was raining and I forgot my umbrella. Typical me!"
    ai_para = "In summary, the aforementioned points illustrate the multifaceted nature of the topic under consideration. It is imperative to analyze various perspectives in a systematic manner to arrive at a comprehensive understanding."
    mixed = human_para + "\n\n" + ai_para + "\n\n" + "Anyway, after college I met Priya and we had chai, it was nice. She told me about her project, very cool stuff."
    result = detector.detect(mixed)
    assert "mixed_authorship" in result
    # Mixed detection may trigger
    assert result["mixed_authorship"]["sections"] is not None
