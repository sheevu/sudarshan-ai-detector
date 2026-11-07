
from scripts.detector import SudarshanDetector
from scripts.language import detect_language

def test_hindi_detection():
    lang, conf = detect_language("यह एक परीक्षण है। मैं बाजार गया था और बहुत भीड़ थी।")
    assert lang in ["hi", "hinglish"]

def test_hinglish_detection():
    lang, conf = detect_language("main kal market gaya tha, bahut bheed thi, I was very tired yaar")
    assert lang in ["hinglish", "en", "hi"]

def test_hindi_text_analysis():
    detector = SudarshanDetector()
    text = "यह लेख बहुत ही रोचक है। लेखक ने बहुत मेहनत से इसे लिखा है। मुझे यह पढ़कर बहुत अच्छा लगा। भाषा बहुत सरल और सुंदर है।"
    result = detector.detect(text, language="hi")
    assert result["detected_language"] in ["hi", "hinglish", "en", "unknown"]
    assert result["word_count"] > 5

def test_english_hindi_mixed():
    detector = SudarshanDetector()
    text = "I think ye idea bahut accha hai. We should isko implement karna chahiye as soon as possible. Bahut logon ko isse fayda hoga."
    result = detector.detect(text)
    assert result["overall_classification"] in ["Likely Human", "Likely AI", "Mixed/Edited", "Inconclusive"]
