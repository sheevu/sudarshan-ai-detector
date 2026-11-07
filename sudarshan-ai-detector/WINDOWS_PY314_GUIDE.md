# Windows + Python 3.14.7 Latest - From Scratch Guide (Sudarshan AI Detector v0.2.0)

## Your Current Setup
You have:
- Python 3.14.7 (latest, Nov 2026)
- pip 26.0.1 from C:\Users\sheev\AppData\Roaming\Python\Python314\site-packages\pip
- You were in C:\WINDOWS\System32 (WRONG - never work there)

## Fix: Move to Project Folder

### 1. Close System32 CMD

Close `C:\WINDOWS\System32>` window. Never use pip there.

### 2. Create correct folder structure

Open File Explorer:
1. Go to C:\
2. Create folder `SudarshanAI`
3. Inside it, extract `sudarshan-ai-detector-py314-latest.zip` so you get:
   `C:\SudarshanAI\sudarshan-ai-detector\`

### 3. Open PowerShell in correct location

- Go to `C:\SudarshanAI\sudarshan-ai-detector\`
- Click address bar, type `powershell` and press Enter
- OR Shift+Right-click → Open in Terminal → PowerShell

You should see:
```
PS C:\SudarshanAI\sudarshan-ai-detector>
```
NOT `C:\WINDOWS\System32>`

### 4. Verify Python 3.14.7

In that correct PowerShell:
```powershell
python --version
# Expected: Python 3.14.7

pip --version
# Expected: pip 26.0.1 from ...Python314...

py -0p
# Lists all Pythons
```

### 5. One-Click Setup for Python 3.14.7 Latest

```powershell
.\setup_windows_py314.ps1
```

If blocked:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\setup_windows_py314.ps1
```

What it does:
- Creates venv with Python 3.14.7 (clears old)
- Upgrades pip to 26+
- Installs requirements-py314.txt (numpy, scipy, sklearn 1.5+, pandas, fastapi, etc.)
- Skips torch if no wheel for 3.14, uses fallback (detector works without torch)
- Checks models/ (already includes trained fusion model)
- Runs 11 tests
- Quick CLI demo

### 6. Manual Setup for Python 3.14.7 (if one-click fails)

```powershell
# Ensure you are in C:\SudarshanAI\sudarshan-ai-detector
# NOT System32

# Clear old venv if exists
Remove-Item -Recurse -Force venv -ErrorAction SilentlyContinue

# Create venv with 3.14.7
python -m venv venv

# Activate
.\venv\Scripts\Activate.ps1
# You should see (venv) prefix

# Upgrade pip for 3.14
python -m pip install --upgrade pip
# Should upgrade to pip 26+

# Install core (3.14 compatible)
pip install -r requirements-py314.txt

# Verify
python -c "import sklearn; print(sklearn.__version__)"
python -c "import numpy; print(numpy.__version__)"

# If torch fails on 3.14, it's OK - detector has fallback
# Try optional:
pip install torch --index-url https://download.pytorch.org/whl/cpu
# If fails, ignore - perplexity will use heuristic fallback

# Test models exist
dir models# Should show fusion_model.pkl etc.

# If no models, train (2-3 min, no paid APIs)
python scripts/auto_train.py

# Run tests
python -m pytest tests/test_detection.py tests/test_multilingual.py tests/test_mixed.py tests/test_calibration.py -v
# 11 passed expected

# Quick detection tests
python -m scripts.cli --text "I woke up late today, missed my bus, ran all the way to college. It was raining and I forgot my umbrella. Typical me!"

python -m scripts.cli --text "In conclusion, it is important to note that artificial intelligence has significantly transformed modern society. Furthermore, the implications are far-reaching and multifaceted."
```

### 7. Python 3.14.7 Specific Notes

- **pip 26.0.1** is correct for Python 3.14
- **User site-packages** `AppData\Roaming\Python\Python314` is OK but venv isolates it
- **Torch**: As of late 2025, torch 2.4+ has cp314 wheels. If `pip install torch` fails, detector still works with heuristic fallback for perplexity
- **scikit-learn 1.5+**: Fully supports Python 3.14, our RandomForest model works
- **numpy 1.26.4 / 2.x**: Both support 3.14
- **No paid APIs**: Training uses only synthetic data + scanned past MD/PY files

### 8. Daily Usage with Python 3.14.7

```powershell
# Always start here
cd C:\SudarshanAI\sudarshan-ai-detector
.\venv\Scripts\Activate.ps1

# CLI
python -m scripts.cli --text "Your text here"
python -m scripts.cli --file C:\path\to\doc.txt --lang hi --json-out report.json

# Python lib
python
>>> from scripts.detector import SudarshanDetector
>>> d = SudarshanDetector()
>>> d.detect("I woke up late today...")
{'overall_classification': 'Likely Human', 'ai_likelihood': 0.15, ...}

# API
uvicorn scripts.api:app --port 8000 --reload
# Open http://localhost:8000/docs

# MCP
python scripts/mcp_server.py --transport stdio
```

### 9. Troubleshooting Python 3.14.7

**You are still in System32?**
Close window. Open File Explorer → C:\SudarshanAI\sudarshan-ai-detector → type powershell in address bar.

**pip install fails with "no matching distribution"?**
- For torch: skip, detector works without it
- For other: try `pip install --upgrade pip` then retry
- Try `pip install scikit-learn==1.5.0` explicitly

**Models fail to load with pickle error?**
- Retrain: `python scripts/auto_train.py` will regenerate pkls with your sklearn version (1.5+ for 3.14)

**Hindi boxes in CMD?**
Use Windows Terminal or PowerShell 7, not old CMD. It supports Devanagari.

**Want to use Python 3.11 instead for more stability?**
```powershell
py -3.11 -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements-py314.txt
```

### 10. Final Checklist Python 3.14.7 Latest

- [ ] NOT in System32, in C:\SudarshanAI\sudarshan-ai-detector
- [ ] python --version = 3.14.7
- [ ] pip --version = 26.0.1
- [ ] venv created and activated (see (venv))
- [ ] pip install -r requirements-py314.txt succeeded (torch optional)
- [ ] models/*.pkl exists
- [ ] pytest 11 passed
- [ ] CLI test: human ~0.15, AI ~0.90

Ready for Python 3.14.7 latest model.
