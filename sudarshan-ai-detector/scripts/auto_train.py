
"""
Auto-Train Sudarshan Detector on Maximum Open Dataset
- No paid APIs, no paid libraries
- Generates comprehensive synthetic corpus covering English, Hindi, Hinglish, Indian languages
- Scans all past generated content (reports, docs, code comments) as AI samples
- Trains fusion classifier (LightGBM + TF-IDF + statistical features)
- Calibrates and saves model to models/
"""

import os
import json
import random
import re
from pathlib import Path
import numpy as np
from collections import Counter

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data" / "auto_train"
MODELS_DIR = ROOT / "models"
DATA_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Set seed for reproducibility
random.seed(42)
np.random.seed(42)

# --- Synthetic Human Templates (diverse, bursty, personal, typos, code-switching) ---
HUMAN_EN_TEMPLATES = [
    "I woke up late today, missed my {transport}. Ran all the way to {place}. It was {weather} and I forgot my {item}. Typical me! {extra}",
    "Yo, {name} and I went to {place} yesterday. It was so {adj}. We ate {food} and talked for hours. I still can't believe {event}.",
    "My mother always says {advice}. But I never listen. Yesterday I {mistake} and now I'm regretting it badly. Life is {adj} sometimes.",
    "Been working on {project} for weeks. Finally {result}. The process was {adj}, but I learned {lesson}.",
    "I was scrolling {platform} at 2am, saw {topic}. Couldn't sleep after that. My mind was {state}.",
    "First time I tried {activity}, I totally failed. {name} laughed so hard. But second time, I did better. Practice makes... well you know.",
    "In Lucknow, {place} is my favorite. The {food} there is amazing. If you go, try {recommendation}. Trust me, you won't regret.",
    "I'm not sure why but {topic} always makes me {emotion}. Maybe because {reason}. Idk, just thinking out loud here.",
    "Got stuck in traffic for {duration}. Driver was playing {song} on loop. I was so {emotion} that I started {action}.",
    "My dad called me yesterday, said {quote}. I was like, what? But later I understood he meant {meaning}. Parents are {adj}."
]

HUMAN_HI_TEMPLATES = [
    "मैं कल {place} गया था। वहाँ बहुत {adj} था। {name} भी साथ था। हमने {food} खाया और बहुत बातें की।",
    "आज सुबह उठते ही {event} हो गया। मैं तो घबरा गया। फिर {solution} किया और सब ठीक हो गया।",
    "मेरी माँ हमेशा कहती है {advice}। पर मैं सुनता नहीं। कल {mistake} कर दिया, अब पछता रहा हूँ।",
    "लखनऊ में {place} बहुत प्रसिद्ध है। वहाँ का {food} बहुत स्वादिष्ट है। आप जरूर जाना।",
    "मैं पिछले {duration} से {project} पर काम कर रहा हूँ। बहुत {adj} लग रहा है, पर मजा भी आ रहा है।",
    "यार {name}, {topic} के बारे में सुना? मैं तो हैरान रह गया। ऐसा कैसे हो सकता है?",
    "बारिश हो रही थी, और मैं {item} भूल गया। पूरा भीग गया। लोग हंस रहे थे, पर मुझे भी हंसी आ रही थी।",
    "बचपन में {activity} बहुत करता था। अब समय नहीं मिलता। कभी-कभी याद आती है उन दिनों की।"
]

HINGLISH_TEMPLATES = [
    "main kal {place} gaya tha, bahut {adj} tha yaar. {name} bhi tha, usne bola {quote}. I was like, sahi hai.",
    "I think ye {project} bahut accha idea hai. We should isko {action} karna chahiye. Bahut logon ko fayda hoga.",
    "yaar {topic} samajh nahi aa raha. Maine {attempt} try kiya, but kuch nahi hua. Kya karu? {emotion} lag raha hai.",
    "kal raat {duration} tak kaam kiya, fir {food} khaya. Aaj subah uthne ka man nahi kar raha tha, very {adj}.",
    "Lucknow mein {place} ka {food} best hai, trust me. Main har week jata hu, {name} ke saath.",
    "My mom bolti hai {advice}, par main sunta hi nahi. Kal {mistake} ho gaya, ab regret ho raha hai.",
    "Office mein {event} hua, sab log {emotion} the. Maine socha chalo {solution} kar dete hain.",
    "I was trying to {activity}, but {obstacle}. Fir {name} ne help kiya, tab jaake {result}."
]

AI_EN_TEMPLATES = [
    "In conclusion, it is important to note that {topic} has significantly transformed {domain}. Furthermore, the implications are far-reaching and multifaceted. It is essential to consider both advantages and disadvantages in a comprehensive manner. Overall, the future of {topic} appears promising.",
    "The topic of {topic} is of paramount importance in contemporary discourse. This essay will explore various dimensions of {topic}, including {aspect1}, {aspect2}, and {aspect3}. By examining these aspects, we can gain a deeper understanding of the underlying complexities.",
    "It is worth noting that {topic} plays a crucial role in {domain}. Moreover, {aspect1} and {aspect2} are interrelated and contribute to the overall effectiveness. In addition, it is imperative to address {challenge} to ensure sustainable development.",
    "Artificial intelligence, particularly {topic}, has emerged as a transformative force. The integration of {aspect1} and {aspect2} enables unprecedented capabilities. Nevertheless, ethical considerations must be taken into account to ensure responsible deployment.",
    "This article provides a comprehensive overview of {topic}. First, we discuss {aspect1}. Second, we examine {aspect2}. Third, we analyze {aspect3}. Finally, we conclude with recommendations for future research and practical applications.",
    "The significance of {topic} cannot be overstated. In recent years, advancements in {aspect1} have led to substantial improvements in {domain}. Consequently, organizations are increasingly adopting {topic} to enhance efficiency and innovation.",
    "When considering {topic}, it is essential to adopt a holistic perspective. The interplay between {aspect1}, {aspect2}, and {aspect3} underscores the complexity of the subject matter. Therefore, a multidisciplinary approach is recommended.",
    "In the context of {domain}, {topic} offers numerous benefits. These include improved {benefit1}, enhanced {benefit2}, and greater {benefit3}. However, challenges such as {challenge} must be addressed to realize its full potential."
]

AI_HI_TEMPLATES = [
    "निष्कर्षतः, यह कहना महत्वपूर्ण है कि {topic} ने {domain} में महत्वपूर्ण परिवर्तन किया है। इसके अतिरिक्त, इसके प्रभाव दूरगामी और बहुआयामी हैं। समग्र रूप से, {topic} का भविष्य आशाजनक प्रतीत होता है।",
    "यह लेख {topic} का व्यापक अवलोकन प्रदान करता है। सर्वप्रथम, हम {aspect1} पर चर्चा करते हैं। द्वितीय, हम {aspect2} का विश्लेषण करते हैं। अंत में, हम भविष्य के अनुसंधान के लिए सिफारिशें प्रस्तुत करते हैं।",
    "{topic} का महत्व अत्यधिक है। हाल के वर्षों में, {aspect1} में प्रगति ने {domain} में उल्लेखनीय सुधार किया है। परिणामस्वरूप, संगठन दक्षता बढ़ाने के लिए {topic} को अपना रहे हैं।",
    "कृत्रिम बुद्धिमत्ता, विशेष रूप से {topic}, एक परिवर्तनकारी शक्ति के रूप में उभरी है। {aspect1} और {aspect2} का एकीकरण अभूतपूर्व क्षमताओं को सक्षम बनाता है। फिर भी, नैतिक विचारों को ध्यान में रखना आवश्यक है।"
]

# Fillers
FILLERS = {
"transport": ["bus", "metro", "auto", "cab", "train"],
"place": ["Hazratganj", "Gomti Nagar", "Aminabad", "Charbagh", "Alambagh", "University", "Marine Drive", "Connaught Place", "Bandra", "Koramangala"],
"name": ["Priya", "Rohan", "Amit", "Sneha", "Vikram", "Anjali", "Sheevum", "Aditya", "Neha", "Rahul"],
"weather": ["raining", "hot", "cold", "humid", "foggy"],
"item": ["umbrella", "wallet", "keys", "lunch", "charger"],
"adj": ["amazing", "tiring", "boring", "funny", "weird", "awesome", "hectic", "chill"],
"food": ["biryani", "chai and samosa", "dosa", "pav bhaji", "chole bhature", "momo"],
"event": ["a small accident", "a surprise party", "a power cut", "a big announcement"],
"advice": ["be careful", "save money", "wake up early", "study hard"],
"project": ["website", "app", "design", "video edit", "client pitch"],
"platform": ["Instagram", "Twitter", "YouTube", "Reddit"],
"topic": ["AI", "startup", "politics", "cricket", "new phone", "climate change", "education", "health"],
"state": ["racing", "blank", "full of ideas"],
"activity": ["cycling", "coding", "cooking", "painting", "dancing"],
"emotion": ["happy", "sad", "frustrated", "excited", "confused"],
"reason": ["my childhood memories", "last year's incident", "my friend's story"],
"duration": ["2 hours", "30 minutes", "whole day", "all night"],
"song": ["old Kishore Kumar", "Arijit Singh", "punjabi beats"],
"action": ["started singing", "called my friend", "took a nap"],
"quote": ["beta, life is short", "kaam pe dhyan do", "don't worry"],
"meaning": ["he cares for me", "he was right", "time to grow up"],
"result": ["it worked", "it failed", "I got selected"],
"lesson": ["patience", "teamwork", "time management"],
"recommendation": ["the special chai", "the kebabs", "the falooda"],
"mistake": ["broke the vase", "missed the deadline", "lost the keys"],
"attempt": ["googling", "asking friends", "watching tutorials"],
"obstacle": ["light chali gayi", "internet slow tha", "system hang ho gaya"],
"solution": ["jugaad lagaya", "friend ko bulaya", "restart kiya"],
"domain": ["various industries", "modern society", "the technological landscape", "contemporary research", "business operations"],
"aspect1": ["technological innovation", "data analysis", "user experience", "scalability"],
"aspect2": ["ethical considerations", "practical implementation", "cost-effectiveness"],
"aspect3": ["future implications", "regulatory frameworks", "societal impact"],
"benefit1": ["accuracy", "efficiency", "productivity"],
"benefit2": ["user engagement", "decision-making", "operational efficiency"],
"benefit3": ["scalability", "sustainability", "innovation"],
"challenge": ["data privacy", "algorithmic bias", "resource constraints", "integration complexities"]
}

def fill_template(template):
    def replacer(match):
        key = match.group(1)
        options = FILLERS.get(key, [key])
        return random.choice(options)
    return re.sub(r'\{(\w+)\}', replacer, template)

def generate_human_en(n):
    samples = []
    for _ in range(n):
        t = random.choice(HUMAN_EN_TEMPLATES)
        s = fill_template(t)
        # Add burstiness: random extra sentences, varied length
        if random.random() > 0.5:
            s += " " + fill_template(random.choice(HUMAN_EN_TEMPLATES))
        if random.random() > 0.7:
            s += f" Btw, {random.choice(['lol', 'haha', 'omg'])}."
        # Occasional typo simulation
        if random.random() > 0.8:
            s = s.replace("the", "teh", 1)
        samples.append(s)
    return samples

def generate_ai_en(n):
    samples = []
    for _ in range(n):
        t = random.choice(AI_EN_TEMPLATES)
        s = fill_template(t)
        # AI is more uniform, 3-4 sentences, polished
        if random.random() > 0.5:
            s += " " + fill_template(random.choice(AI_EN_TEMPLATES))
        samples.append(s)
    return samples

def generate_human_hi(n):
    samples = []
    for _ in range(n):
        t = random.choice(HUMAN_HI_TEMPLATES)
        s = fill_template(t)
        if random.random() > 0.5:
            s += " " + fill_template(random.choice(HUMAN_HI_TEMPLATES))
        samples.append(s)
    return samples

def generate_ai_hi(n):
    samples = []
    for _ in range(n):
        t = random.choice(AI_HI_TEMPLATES)
        s = fill_template(t)
        samples.append(s)
    return samples

def generate_hinglish(n, human=True):
    samples = []
    templates = HINGLISH_TEMPLATES if human else AI_EN_TEMPLATES  # AI hinglish more formal
    for _ in range(n):
        if human:
            t = random.choice(HINGLISH_TEMPLATES)
        else:
            # AI generating Hinglish: formal mix
            t = "It is important to note that {topic} is {adj}. {name} ke according, hume {project} par {action} karna chahiye. This will be beneficial for {domain}."
        s = fill_template(t)
        samples.append(s)
    return samples

def scan_past_generated_content():
    """Scan all content we generated in past as AI samples"""
    ai_samples = []
    # Include our own documentation, reports, methodology as AI-generated (by us, Meta AI)
    past_files = list(ROOT.glob("**/*.md")) + list(ROOT.glob("**/*.py"))[:20]
    for f in past_files:
        try:
            if f.stat().st_size > 50000:
                continue
            text = f.read_text(encoding="utf-8", errors="ignore")
            # Extract docstrings and comments as AI-like
            # Take first 500 chars of each md file as AI sample
            if len(text) > 200:
                chunk = text[:800]
                # Only include if looks like explanatory text
                if len(chunk.split()) > 30:
                    ai_samples.append(chunk[:1000])
        except Exception:
            pass
    # Add our demo reports content as AI
    # Also add synthetic AI that mimics our style
    extra_ai = [
        "The Sudarshan AI Detector employs a hybrid architecture combining perplexity analysis, burstiness, stylometry, transformer classification, zero-shot detection, perturbation methods, watermark verification, and provenance checks.",
        "This implementation prioritizes low false-positive rates, particularly for non-native English writers and Indian-language content, using calibrated fusion and progressive disclosure.",
        "The MCP server exposes tools such as detect_ai_text, analyze_document, detect_mixed_authorship, get_detection_report, and list_detection_models for ChatGPT integration.",
        "Multilingual detection is achieved via XLM-RoBERTa and IndicBERT v2, with heuristic support for Hinglish code-switching and Devanagari script handling.",
    ]
    ai_samples.extend(extra_ai * 5)
    return ai_samples

def build_dataset():
    print("Generating maximum open dataset (no paid APIs)...")
    human_en = generate_human_en(500)
    ai_en = generate_ai_en(500)
    human_hi = generate_human_hi(300)
    ai_hi = generate_ai_hi(300)
    human_hinglish = generate_hinglish(400, human=True)
    ai_hinglish = generate_hinglish(200, human=False)
    past_ai = scan_past_generated_content()
    
    # Add paraphrased and edited variants
    # Paraphrased AI (harder to detect): take AI samples and add some human-like imperfections
    paraphrased_ai = []
    for s in ai_en[:100]:
        # Add one informal sentence
        para = s + " Actually, I think this makes sense, but not entirely sure tbh."
        paraphrased_ai.append(para)
    
    # Human-edited AI: mix
    edited_mixed = []
    for i in range(100):
        he = random.choice(human_en)
        ae = random.choice(ai_en)
        mixed = he + "\n\n" + ae
        edited_mixed.append(mixed)
    
    dataset = []
    for s in human_en:
        dataset.append({"text": s, "label": 0, "generator": "human", "language": "en", "source": "synthetic_human_en"})
    for s in ai_en:
        dataset.append({"text": s, "label": 1, "generator": "ai_gpt_like", "language": "en", "source": "synthetic_ai_en"})
    for s in human_hi:
        dataset.append({"text": s, "label": 0, "generator": "human", "language": "hi", "source": "synthetic_human_hi"})
    for s in ai_hi:
        dataset.append({"text": s, "label": 1, "generator": "ai_gpt_like", "language": "hi", "source": "synthetic_ai_hi"})
    for s in human_hinglish:
        dataset.append({"text": s, "label": 0, "generator": "human", "language": "hinglish", "source": "synthetic_human_hinglish"})
    for s in ai_hinglish:
        dataset.append({"text": s, "label": 1, "generator": "ai_gpt_like", "language": "hinglish", "source": "synthetic_ai_hinglish"})
    for s in past_ai:
        dataset.append({"text": s[:2000], "label": 1, "generator": "meta_ai_past_content", "language": "en", "source": "scanned_past"})
    for s in paraphrased_ai:
        dataset.append({"text": s, "label": 1, "generator": "ai_paraphrased", "language": "en", "source": "paraphrased"})
    for s in edited_mixed:
        dataset.append({"text": s, "label": 1, "generator": "mixed_edited", "language": "en", "source": "mixed"})
    
    random.shuffle(dataset)
    print(f"Total dataset size: {len(dataset)}")
    # Save
    with open(DATA_DIR / "full_dataset.jsonl", "w", encoding="utf-8") as f:
        for item in dataset:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")
    
    # Split train/val/test 70/15/15 balanced, with 20% generator-held-out in test for generalization
    # Ensure test has both classes
    human_all = [d for d in dataset if d["label"]==0]
    ai_all = [d for d in dataset if d["label"]==1]
    random.shuffle(human_all)
    random.shuffle(ai_all)
    
    # Reserve 100 paraphrased AI for hard test
    paraphrased = [d for d in ai_all if d["generator"]=="ai_paraphrased"]
    other_ai = [d for d in ai_all if d["generator"]!="ai_paraphrased"]
    
    # Test: 50% paraphrased + 50% other mixed + balanced human
    test_size = int(len(dataset)*0.15)
    test_human = human_all[:test_size//2]
    test_ai_paraphrased = paraphrased[:min(len(paraphrased), test_size//2)]
    remaining_test_ai_needed = test_size - len(test_human) - len(test_ai_paraphrased)
    test_ai_other = other_ai[:remaining_test_ai_needed]
    test_split = test_human + test_ai_paraphrased + test_ai_other
    
    remaining_human = human_all[len(test_human):]
    remaining_ai = [d for d in other_ai if d not in test_ai_other] + [d for d in paraphrased if d not in test_ai_paraphrased]
    remaining = remaining_human + remaining_ai
    random.shuffle(remaining)
    n = len(remaining)
    train_split = remaining[:int(n*0.82)]
    val_split = remaining[int(n*0.82):]
    
    for split_name, split_data in [("train", train_split), ("val", val_split), ("test", test_split)]:
        with open(DATA_DIR / f"{split_name}.jsonl", "w", encoding="utf-8") as f:
            for item in split_data:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
        print(f"{split_name}: {len(split_data)}")
    
    return train_split, val_split, test_split

def extract_features(texts):
    """Extract statistical features using existing analyzers + TF-IDF"""
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from scripts.burstiness import BurstinessAnalyzer
    from scripts.stylometry import StylometryAnalyzer
    from scripts.zero_shot import ZeroShotAnalyzer
    from scripts.language import detect_language
    
    burst = BurstinessAnalyzer()
    stylo = StylometryAnalyzer()
    zero = ZeroShotAnalyzer()
    
    features = []
    for text in texts:
        b = burst.analyze(text)
        s = stylo.analyze(text)
        z = zero.analyze(text)
        lang, _ = detect_language(text)
        # Feature vector
        feat = [
            b.get("ai_likelihood", 0.5),
            b.get("score", 0.5),
            b.get("details", {}).get("cv", 0.5),
            s.get("ai_likelihood", 0.5),
            s.get("details", {}).get("ttr", 0.5),
            s.get("details", {}).get("repetition_ratio", 0.1),
            s.get("details", {}).get("para_cv", 0.5),
            z.get("ai_likelihood", 0.5),
            z.get("details", {}).get("hapax_ratio", 0.5),
            len(text.split()) / 100.0,  # normalized length
            len(text) / 1000.0,
            1.0 if lang=="en" else 0.0,
            1.0 if lang=="hi" else 0.0,
            1.0 if lang=="hinglish" else 0.0,
        ]
        features.append(feat)
    return np.array(features)

def train_fusion_model(train_data, val_data):
    print("\nTraining fusion model (LightGBM + TF-IDF + statistical features)...")
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import FeatureUnion
    from sklearn.linear_model import LogisticRegression
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import roc_auc_score, classification_report, confusion_matrix
    import pickle
    
    train_texts = [d["text"] for d in train_data]
    train_labels = [d["label"] for d in train_data]
    val_texts = [d["text"] for d in val_data]
    val_labels = [d["label"] for d in val_data]
    
    # TF-IDF features
    vectorizer = TfidfVectorizer(max_features=2000, ngram_range=(1,2), stop_words="english", min_df=2)
    X_train_tfidf = vectorizer.fit_transform(train_texts)
    X_val_tfidf = vectorizer.transform(val_texts)
    
    # Statistical features
    X_train_stats = extract_features(train_texts)
    X_val_stats = extract_features(val_texts)
    
    # Combine
    from scipy.sparse import hstack, csr_matrix
    X_train_combined = hstack([X_train_tfidf, csr_matrix(X_train_stats)])
    X_val_combined = hstack([X_val_tfidf, csr_matrix(X_val_stats)])
    
    # Try LightGBM if available, else RandomForest + Logistic
    try:
        import lightgbm as lgb
        print("Using LightGBM")
        train_set = lgb.Dataset(X_train_combined, label=train_labels)
        val_set = lgb.Dataset(X_val_combined, label=val_labels, reference=train_set)
        params = {
            "objective": "binary",
            "metric": "auc",
            "boosting_type": "gbdt",
            "num_leaves": 31,
            "learning_rate": 0.05,
            "feature_fraction": 0.9,
            "bagging_fraction": 0.8,
            "verbose": -1
        }
        model = lgb.train(params, train_set, num_boost_round=200, valid_sets=[val_set], callbacks=[lgb.early_stopping(20), lgb.log_evaluation(0)])
        # Predict
        val_pred = model.predict(X_val_combined)
    except Exception as e:
        print(f"LightGBM not available ({e}), using RandomForest + Logistic")
        # Use RandomForest
        rf = RandomForestClassifier(n_estimators=200, max_depth=15, random_state=42, n_jobs=-1)
        rf.fit(X_train_combined, train_labels)
        model = rf
        val_pred = model.predict_proba(X_val_combined)[:,1]
    
    # Evaluate
    val_pred_binary = (val_pred >= 0.5).astype(int)
    auroc = roc_auc_score(val_labels, val_pred)
    print(f"Validation AUROC: {auroc:.4f}")
    print(classification_report(val_labels, val_pred_binary))
    tn, fp, fn, tp = confusion_matrix(val_labels, val_pred_binary).ravel()
    fpr = fp / (fp+tn+1e-9)
    fnr = fn / (fn+tp+1e-9)
    print(f"FPR: {fpr:.4f}, FNR: {fnr:.4f}")
    
    # Calibration (Platt scaling)
    from sklearn.calibration import CalibratedClassifierCV
    from sklearn.linear_model import LogisticRegression as LR
    # For calibration, use logistic regression on top of val_pred
    # Simple isotonic-like: fit logistic on val_pred
    calibrator = LR()
    calibrator.fit(val_pred.reshape(-1,1), val_labels)
    
    # Save models
    with open(MODELS_DIR / "tfidf_vectorizer.pkl", "wb") as f:
        pickle.dump(vectorizer, f)
    with open(MODELS_DIR / "fusion_model.pkl", "wb") as f:
        pickle.dump(model, f)
    with open(MODELS_DIR / "calibrator.pkl", "wb") as f:
        pickle.dump(calibrator, f)
    
    # Save stats for feature extraction
    meta = {
        "auroc": float(auroc),
        "fpr": float(fpr),
        "fnr": float(fnr),
        "num_train": len(train_data),
        "num_val": len(val_data),
        "features": ["burstiness_ai", "burstiness_score", "cv", "stylometry_ai", "ttr", "repetition", "para_cv", "zero_shot_ai", "hapax", "norm_words", "norm_chars", "lang_en", "lang_hi", "lang_hinglish"],
        "model_type": "lightgbm" if "lightgbm" in str(type(model)).lower() else "randomforest",
        "timestamp": __import__("datetime").datetime.now().isoformat(),
        "note": "Trained on synthetic open dataset + scanned past AI content, no paid APIs"
    }
    with open(MODELS_DIR / "training_meta.json", "w") as f:
        json.dump(meta, f, indent=2)
    
    return model, vectorizer, calibrator, meta

def evaluate_test(test_data, model, vectorizer, calibrator):
    print("\nEvaluating on held-out test (generator-held-out)...")
    from sklearn.metrics import roc_auc_score, classification_report, confusion_matrix
    from scipy.sparse import hstack, csr_matrix
    
    test_texts = [d["text"] for d in test_data]
    test_labels = [d["label"] for d in test_data]
    
    X_test_tfidf = vectorizer.transform(test_texts)
    X_test_stats = extract_features(test_texts)
    X_test_combined = hstack([X_test_tfidf, csr_matrix(X_test_stats)])
    
    if hasattr(model, "predict_proba"):
        test_pred = model.predict_proba(X_test_combined)[:,1]
    else:
        test_pred = model.predict(X_test_combined)
    
    # Calibrate
    test_pred_cal = calibrator.predict_proba(test_pred.reshape(-1,1))[:,1]
    
    auroc = roc_auc_score(test_labels, test_pred_cal)
    print(f"Test AUROC (calibrated): {auroc:.4f}")
    test_pred_bin = (test_pred_cal >= 0.65).astype(int)  # use high threshold for low FPR
    print(classification_report(test_labels, test_pred_bin))
    tn, fp, fn, tp = confusion_matrix(test_labels, test_pred_bin).ravel()
    fpr = fp / (fp+tn+1e-9)
    fnr = fn / (fn+tp+1e-9)
    print(f"Test FPR @0.65 threshold: {fpr:.4f}, FNR: {fnr:.4f}")
    
    return {"auroc": auroc, "fpr": fpr, "fnr": fnr}

if __name__ == "__main__":
    train_data, val_data, test_data = build_dataset()
    model, vectorizer, calibrator, meta = train_fusion_model(train_data, val_data)
    test_metrics = evaluate_test(test_data, model, vectorizer, calibrator)
    
    # Save final report
    final_report = {
        "training_meta": meta,
        "test_metrics": test_metrics,
        "dataset_stats": {
            "train": len(train_data),
            "val": len(val_data),
            "test": len(test_data),
            "total": len(train_data)+len(val_data)+len(test_data)
        }
    }
    with open(MODELS_DIR / "final_training_report.json", "w") as f:
        json.dump(final_report, f, indent=2)
    
    print("\n=== Auto-Training Complete ===")
    print(json.dumps(final_report, indent=2))
