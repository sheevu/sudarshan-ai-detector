# Sudarshan AI Detector
Production-ready multilingual AI detection Skill by Sudarshan AI Labs.

## Quick Start
pip install -r requirements.txt
python -m scripts.cli --text "Your text here"
uvicorn scripts.api:app --port 8000
python scripts/mcp_server.py

See SKILL.md for architecture and references/ for methodology.


## Auto-Training (v0.2.0) - Maximum Open Dataset, No Paid APIs

The detector has been auto-trained on maximum open synthetic dataset + scanned past AI content.

### Dataset (2452 samples, fully open)
- 500 human EN (informal, bursty, typos, personal anecdotes)
- 500 AI EN (formal, uniform, transition words, conclusion patterns)
- 300 human HI (Devanagari informal)
- 300 AI HI (formal Hindi)
- 400 human Hinglish (code-switching informal)
- 200 AI Hinglish (formal mix)
- 100 paraphrased AI (hard negatives)
- 100 mixed edited
- + scanned past AI content: all MD/PY files generated earlier as AI samples

No paid libraries, no AI APIs. Uses only open-source: scikit-learn, numpy, scipy, transformers (optional).

### Training Pipeline
```bash
python scripts/auto_train.py
```
Generates:
- data/auto_train/full_dataset.jsonl (2452 samples)
- data/auto_train/train.jsonl, val.jsonl, test.jsonl
- models/tfidf_vectorizer.pkl (2000 TF-IDF 1-2grams)
- models/fusion_model.pkl (RandomForest 200 trees, max_depth 15)
- models/calibrator.pkl (Logistic Platt scaling)
- models/training_meta.json, final_training_report.json

### Performance (on synthetic held-out)
- Validation: AUROC 1.0, FPR 0.0, FNR 0.0
- Test (367 samples, includes paraphrased): AUROC 1.0, FPR 0.0, FNR 0.005 @0.65 threshold
- Real-world expected lower, but separation strong:
  - Human samples: AI likelihood ~0.05-0.16
  - AI samples: ~0.82-0.95
  - Low FPR prioritized

### New Analyzer: trained_fusion
Weight 0.55 in fusion, boosted to 0.75 when extreme (<0.2 or >0.8). Overrides final classification when confident:
- tf <0.15 => Likely Human
- tf >0.85 => Likely AI

### Usage with trained model
```python
from scripts.detector import SudarshanDetector
detector = SudarshanDetector() # auto-loads models/models/*.pkl if present
result = detector.detect("Your text here")
print(result['overall_classification'], result['ai_likelihood'])
```
