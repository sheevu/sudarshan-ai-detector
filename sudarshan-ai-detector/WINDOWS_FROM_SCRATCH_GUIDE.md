# Windows Desktop - From Scratch Guide (Sudarshan AI Detector v0.2.0)

## 0. What you get
- Hybrid detector: perplexity, burstiness, stylometry, zero-shot, trained_fusion (TF-IDF + RandomForest), optional transformer/perturbation/watermark
- Multilingual: English, Hindi, Hinglish, Bengali, Tamil, Telugu, etc.
- Auto-trained on 2452 open samples + scanned past AI content
- No paid APIs, no paid libraries
- CLI, REST API, MCP server for ChatGPT

## 1. Prerequisites (5 min)

### 1.1 Install Python 3.9+
1. Go to https://www.python.org/downloads/
2. Download Python 3.11 (stable on Windows)
3. Run installer -> CHECK "Add python.exe to PATH" -> Install Now
4. Verify: Open PowerShell and run:
   ```
   python --version
   pip --version
   ```
   Should show Python 3.9+

If PowerShell blocks scripts:
   ```
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

### 1.2 Install Git (optional but recommended)
- https://git-scm.com/download/win
- Needed only if you want to clone, otherwise unzip works

### 1.3 Install Visual C++ Build Tools (only if LightGBM fails)
- Usually not needed because we use RandomForest by default
- If you want LightGBM: https://visualstudio.microsoft.com/visual-cpp-build-tools/

## 2. Get the Skill Package

Option A: Download trained zip (recommended, includes models)
- Use the file `sudarshan-ai-detector-v0.2.0-trained.zip` (495KB) from this chat
- Or lightweight `sudarshan-ai-detector.zip` (257KB) without .pkl models

Option B: Recreate from scratch (you already have structure)

Steps:
1. Create folder: `C:\SudarshanAI`
2. Extract zip inside so you have `C:\SudarshanAI\sudarshan-ai-detector\` with SKILL.md, scripts/, etc.

Structure should be:
```
C:\SudarshanAI\sudarshan-ai-detector\
  SKILL.md
  README.md
  requirements.txt
  setup_windows.bat
  setup_windows.ps1
  scripts/
  models/ (with .pkl if trained zip)
  data/
  assets/
  references/
  tests/
```

## 3. One-Click Setup (Recommended)

### Using PowerShell (best):
1. Right-click folder `sudarshan-ai-detector` -> Open in Terminal / Open PowerShell here
2. Run:
   ```
   .\setup_windows.ps1
   ```
   This will:
   - Create venv
   - Install all open-source deps
   - Auto-train on 2452 samples (2-3 min)
   - Run 11 tests
   - Test CLI

### Using CMD batch:
Double-click `setup_windows.bat` or run in CMD:
```
setup_windows.bat
```

## 4. Manual Setup (Step by Step)

If one-click fails, do manually:

### 4.1 Create virtual environment
Open PowerShell in project root:
```
python -m venv venv
.\venv\Scripts\Activate.ps1
```
For CMD:
```
venv\Scripts\activate.bat
```
You should see `(venv)` prefix.

### 4.2 Upgrade pip and install deps
```
python -m pip install --upgrade pip
pip install -r requirements.txt
```
This installs: numpy, scipy, pandas, scikit-learn, torch (CPU), transformers (optional), fastapi, pydantic, uvicorn, langdetect, pyyaml, python-dotenv, pytest

If torch fails (large), you can skip for now - detector has fallback heuristic for perplexity.

### 4.3 Copy env template
```
copy .env.example .env
```
Edit .env if needed (not required for basic use)

### 4.4 Auto-train (Maximum open dataset, no paid APIs)
```
python scripts/auto_train.py
```
What happens:
- Generates human EN/HI/Hinglish + AI EN/HI/Hinglish + paraphrased + mixed + scans all past MD/PY as AI
- Total 2452 samples -> saves to data/auto_train/
- Extracts TF-IDF + statistical features
- Trains RandomForest 200 trees + Logistic calibrator
- Saves to models/:
  - tfidf_vectorizer.pkl
  - fusion_model.pkl
  - calibrator.pkl
  - training_meta.json (AUROC 1.0 on synthetic)
  - final_training_report.json

Time: 1-3 min on normal Windows laptop, no GPU needed.

### 4.5 Verify installation
```
python -m pytest tests/test_detection.py tests/test_multilingual.py tests/test_mixed.py tests/test_calibration.py -v
```
Expected: 11 passed

### 4.6 Quick test
```
python -m scripts.cli --text "I woke up late today, missed my bus, ran all the way to college. It was raining and I forgot my umbrella. Typical me!"
```
Should output:
- Likely Human, AI likelihood ~0.15-0.22

```
python -m scripts.cli --text "In conclusion, it is important to note that artificial intelligence has significantly transformed modern society. Furthermore, the implications are far-reaching."
```
Should output:
- Likely AI, AI likelihood ~0.90+

Test Hindi:
```
python -m scripts.cli --text "मैं कल बाजार गया था, बहुत भीड़ थी। मेरी माँ ने कहा था जल्दी आ जाना।" --lang hi
```

## 5. How to Use Daily

### 5.1 Activate environment each time
Open PowerShell in project folder:
```
.\venv\Scripts\Activate.ps1
```

### 5.2 CLI - Single text
```
python -m scripts.cli --text "Your text to check here"
python -m scripts.cli --text "Your text" --json-out report.json
```

### 5.3 CLI - File
```
python -m scripts.cli --file C:\path\to\document.txt
python -m scripts.cli --file document.txt --lang hinglish --json-out report.json
```

### 5.4 Python library
Create `test_my.py`:
```python
from scripts.detector import SudarshanDetector

detector = SudarshanDetector()  # auto-loads models/*.pkl

# English
res = detector.detect("I woke up late today, missed my bus...")
print(res['overall_classification'], res['ai_likelihood'])

# Hindi
res = detector.detect("यह लेख बहुत ही रोचक है।", language="hi")
print(res)

# Save JSON
print(detector.to_json(res))
```
Run:
```
python test_my.py
```

### 5.5 REST API (for your apps)
```
uvicorn scripts.api:app --host 0.0.0.0 --port 8000 --reload
```
Open browser: http://localhost:8000/docs
- Try POST /detect with {"text": "your text"}
- GET /health, /models

Test with curl in another PowerShell:
```
curl -X POST http://localhost:8000/detect -H "Content-Type: application/json" -d "{\"text\": \"I woke up late today...\"}"
```

### 5.6 MCP Server (for ChatGPT / Claude Desktop)

For Claude Desktop:
1. Find config file: `%APPDATA%\Claude\claude_desktop_config.json`
2. Add:
```json
{
  "mcpServers": {
    "sudarshan-detector": {
      "command": "C:\\SudarshanAI\\sudarshan-ai-detector\\venv\\Scripts\\python.exe",
      "args": ["C:\\SudarshanAI\\sudarshan-ai-detector\\scripts\\mcp_server.py", "--transport", "stdio"],
      "cwd": "C:\\SudarshanAI\\sudarshan-ai-detector"
    }
  }
}
```
3. Restart Claude Desktop, tools will appear: detect_ai_text, analyze_document, etc.

For ChatGPT (MCP compatible):
- Point to `scripts/mcp_server.py` with stdio transport
- See agents/chatgpt.json and assets/openapi.yaml

## 6. Folder Tour

- `scripts/detector.py` - main orchestrator
- `scripts/trained_fusion.py` - your auto-trained model (RandomForest)
- `scripts/auto_train.py` - generates dataset + trains
- `models/` - .pkl files after training
- `data/auto_train/` - generated JSONL datasets
- `references/` - METHODOLOGY, LIMITATIONS, CALIBRATION, DATASETS, BENCHMARKS
- `assets/config.yaml` - thresholds and weights
- `tests/` - automated tests

## 7. Retraining & Customization

To add your own data:
1. Edit `scripts/auto_train.py` -> add templates to HUMAN_EN_TEMPLATES etc.
2. Or add files to `data/auto_train/` as JSONL: {"text": "...", "label": 0 human 1 AI, "language": "en"}
3. Run again: `python scripts/auto_train.py`

To adjust sensitivity (low FPR):
- Edit `assets/config.yaml`: thresholds.ai=0.65 human=0.35
- Higher ai threshold = fewer false positives

## 8. Troubleshooting Windows

### Python not found
- Reinstall Python and check "Add to PATH"
- Try `py --version` instead of `python`

### venv activation blocked
PowerShell:
```
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\venv\Scripts\Activate.ps1
```

### pip install fails for torch
- Skip torch: detector has fallback. Or install CPU torch:
```
pip install torch --index-url https://download.pytorch.org/whl/cpu
```

### fastapi not found when testing API
```
pip install fastapi uvicorn
```

### Models not found error
Run `python scripts/auto_train.py` to generate models/*.pkl

### Hindi text shows boxes in CMD
- Use PowerShell or Windows Terminal (supports Unicode)
- Save files as UTF-8

### Antivirus blocking .pkl
- Add folder to exclusion, .pkl are scikit-learn models, safe

## 9. Next Steps

- Read `references/METHODOLOGY.md` for how each detector works
- Read `references/LIMITATIONS.md` - never claim proof, statistical signals only
- Check `FINAL_TRAINING_EVALUATION.json` for live performance
- Deploy API on your network: `uvicorn scripts.api:app --host 0.0.0.0 --port 8000`

## 10. Quick Checklist (From Scratch)

- [ ] Install Python 3.9+ with PATH
- [ ] Create C:\SudarshanAI and extract zip
- [ ] PowerShell -> .\setup_windows.ps1 (or manual venv + pip install)
- [ ] python scripts/auto_train.py (if using lightweight zip)
- [ ] pytest tests/
- [ ] python -m scripts.cli --text "test"
- [ ] Use daily with venv activation

You are ready. No paid APIs, fully offline after training.

For help, check BUILD_SUMMARY.md and README.md
