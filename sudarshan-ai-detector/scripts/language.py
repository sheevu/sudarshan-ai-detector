
import re
from typing import Tuple

HINDI_CHARS = re.compile(r'[\u0900-\u097F]')
HINGLISH_MARKERS = [
    "hai", "hain", "nahi", "nahin", "kya", "aap", "main", "mein", "mera", "tera",
    "aur", "lekin", "bahut", "accha", "theek", "kar", "ho", "hoga", "chahiye",
    "tha", "thi", "the", "gaya", "gaye", "gayi", "yaar", "kal", "bhi", "kuch",
    "pe", "bhai", "arre", "chal", "raha", "rahi", "rahe", "wala", "wali"
]

def detect_language(text: str) -> Tuple[str, float]:
    if not text or len(text.strip()) < 10:
        return "unknown", 0.0
    hindi_char_count = len(HINDI_CHARS.findall(text))
    total_chars = max(1, len(re.findall(r'\w', text)))
    hindi_ratio = hindi_char_count / total_chars
    lower = text.lower()
    words = [re.sub(r'^[^\w]+|[^\w]+$', '', w) for w in lower.split()]
    hinglish_score = sum(1 for w in HINGLISH_MARKERS if w in words)
    
    # High confidence Hinglish check before generic langdetect
    if hinglish_score >= 2 and hindi_ratio < 0.25:
        return "hinglish", min(0.95, 0.5 + hinglish_score * 0.1)

    try:
        from langdetect import detect_langs
        langs = detect_langs(text[:1000])
        top = langs[0]
        lang = top.lang
        prob = top.prob
        if lang == 'hi' and hindi_ratio > 0.05:
            if hinglish_score >= 2 and hindi_ratio < 0.3:
                return "hinglish", 0.75
            return "hi", prob
        if lang in ('en', 'hi'):
            if hindi_ratio > 0.15 and hinglish_score >= 1:
                return "hinglish", 0.7
            if hindi_ratio > 0.2:
                return "hi", max(prob, hindi_ratio)
            if hinglish_score >= 2:
                return "hinglish", 0.65
            return lang, prob
        if lang in ['bn','ta','te','mr','gu','kn','ml','pa']:
            return lang, prob
        if hindi_ratio > 0.3:
            return "hi", hindi_ratio
        if hinglish_score >= 2:
            return "hinglish", 0.6
        # If langdetect returned an unrelated non-Indic/non-English code but chars are latin, default to en
        if all(ord(c) < 128 for c in text if c.isalpha()):
            return "en", 0.6
        return lang, prob
    except Exception:
        if hindi_ratio > 0.3:
            return "hi", hindi_ratio
        if hindi_ratio > 0.05 and hinglish_score >= 1:
            return "hinglish", 0.6
        if hinglish_score >= 2:
            return "hinglish", 0.6
        return "en", 0.5

def count_words_tokens(text: str):
    words = len(text.split())
    tokens = int(words * 1.33)
    return words, tokens
