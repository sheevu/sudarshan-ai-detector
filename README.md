# Advanced AI Detector (Sudarshan AI Labs)

Production-ready, multi-signal, multilingual AI text detection platform with open-source ensemble modeling, FastAPI REST service, Model Context Protocol (MCP) server, and modern glassmorphic web dashboard ready for Vercel deployment.

---

## Architecture Overview

```
sudarshan-ai-detector-py314-latest/
├── frontend/                         # Vite + React + TypeScript + Tailwind CSS Web UI
│   ├── src/
│   │   ├── App.tsx                   # Interactive detection dashboard, gauges, metrics
│   │   ├── index.css                 # Glassmorphic themes & animations
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts                # Auto-proxies /api to FastAPI backend
│   └── vercel.json                   # One-click deployment config for Vercel
│
├── sudarshan-ai-detector/            # Python 3.14.7 Core Engine & Backend
│   ├── agents/                       # Agent configurations (chatgpt.json, config.yaml)
│   ├── assets/                       # Configuration, fusion weights, OpenAPI schema
│   ├── data/auto_train/              # Multilingual dataset splits (EN, HI, Hinglish, Mixed)
│   ├── models/                       # Trained native models (RandomForest, TF-IDF, Logistic)
│   ├── references/                   # Methodology, benchmarks, calibration, limitations
│   ├── scripts/                      # Core detection analyzers & servers
│   │   ├── detector.py               # Main detector facade
│   │   ├── api.py                    # FastAPI server (CORS-enabled REST API)
│   │   ├── mcp_server.py             # Model Context Protocol stdio/JSON-RPC server
│   │   ├── cli.py                    # Command-line interface
│   │   ├── auto_train.py             # Open dataset training pipeline
│   │   ├── burstiness.py             # Sentence length variance & rhythm analysis
│   │   ├── stylometry.py             # Lexical diversity (TTR) & n-gram frequency
│   │   ├── perplexity.py             # Perplexity estimator with graceful offline proxy
│   │   ├── zero_shot.py              # Hapax legomena & start diversity
│   │   ├── trained_fusion.py         # Calibrated ML classifier over TF-IDF + stats
│   │   ├── language.py               # Multilingual language & Hinglish detector
│   │   └── fusion.py                 # Extreme-confidence ensemble weighting
│   ├── tests/                        # 14/14 passing pytest test suite
│   ├── pyproject.toml
│   └── requirements.txt
│
├── venv/                             # Python 3.14 virtual environment
├── run_local.ps1                     # One-click local runner (all / backend / frontend / test / cli)
└── run_local.bat                     # Double-clickable Windows launcher
```

---

## 🚀 Quick Start (Local Run)

### 1. Launch All Services (Web Dashboard + Backend API)
```powershell
.\run_local.ps1
```
Or double-click `run_local.bat`.

- **Web Dashboard**: [http://127.0.0.1:3000](http://127.0.0.1:3000)
- **FastAPI Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **API Health**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

---

### 2. Run Tests
Verify all 14 unit and integration tests:
```powershell
.\venv\Scripts\python.exe -m pytest sudarshan-ai-detector\tests -v
```
*(All 14/14 tests pass with 100% success rate)*

---

### 3. Run CLI
Analyze text directly from PowerShell / CMD:
```powershell
cd sudarshan-ai-detector
..\venv\Scripts\python.exe -m scripts.cli --text "In conclusion, it is important to note that artificial intelligence is transforming various industries."
```

---

### 4. Run MCP Server (Claude Desktop / Cursor / ChatGPT)
```powershell
cd sudarshan-ai-detector
..\venv\Scripts\python.exe scripts/mcp_server.py
```

---

## 🌐 Deploying to Vercel

The frontend is fully configured for Vercel deployment:

1. **Deploy via Vercel CLI**:
   ```bash
   cd frontend
   vercel
   ```
2. **Deploy via GitHub / Git**:
   - Push this repository to GitHub.
   - Import the project into Vercel.
   - Set the Root Directory to `frontend` (or `Sudarshan+Ai+Detector+Vercel`).
   - Framework preset: `Vite`. Build command: `npm run build`. Output directory: `dist`.
   - Hit **Deploy**!

The web UI contains full client-side analysis and offline `localStorage` persistence, functioning both standalone on Vercel Edge and in hybrid mode when connected to the backend API.
