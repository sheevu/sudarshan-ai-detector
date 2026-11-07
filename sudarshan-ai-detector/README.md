# Sudarshan AI Detector — Backend & MCP Server
Production-ready, privacy-first multilingual AI text detection engine by [Sudarshan AI Labs](https://sudarshan-ai.com/).

Supports **English, Hindi, Hinglish, and modern LLM structures** without requiring any paid APIs.

---

## Features
- **FastAPI REST API**: High-performance HTTP server with `/detect`, `/detect_mixed`, `/health`, and `/models`.
- **Model Context Protocol (MCP) Server**: Exposes detection tools (`detect_ai_text`, `detect_mixed_authorship`, `get_detection_report`, `list_detection_models`) to Claude Desktop, Cursor, and Antigravity.
- **Multilingual Support**: High-accuracy detection for English, Devanagari Hindi, and Romanized Hinglish.
- **Explainable Insights**: Sentence-level heatmaps, phrase triggers, vocabulary stylometry (TTR), and rhythm burstiness (CV).
- **Zero Paid Dependencies**: Runs 100% offline using Scikit-Learn native models, open statistical heuristics, and optional Hugging Face transformers.

---

## 1. Quick Start (REST API)

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start the FastAPI server
uvicorn scripts.api:app --host 0.0.0.0 --port 8000
```
- Interactive Swagger Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- OpenAPI Specification: [http://127.0.0.1:8000/.well-known/openapi.yaml](http://127.0.0.1:8000/.well-known/openapi.yaml)

### Sample API Request
```bash
curl -X POST "http://127.0.0.1:8000/detect" \
  -H "Content-Type: application/json" \
  -d '{"text": "In conclusion, it is important to note that artificial intelligence offers unprecedented opportunities for exponential growth."}'
```

---

## 2. Model Context Protocol (MCP) Server Setup

This repository implements the official [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) specification.

### Running MCP Server via stdio
```bash
python -m scripts.mcp_server --transport stdio
```

### Connect to Claude Desktop (`claude_desktop_config.json`)
Add the following to your Claude Desktop configuration file:
```json
{
  "mcpServers": {
    "sudarshan-ai-detector": {
      "command": "python",
      "args": ["-m", "scripts.mcp_server", "--transport", "stdio"],
      "cwd": "/path/to/sudarshan-ai-detector"
    }
  }
}
```

### Available MCP Tools
* `detect_ai_text`: Detects AI likelihood, classification, confidence, and linguistic evidence.
* `detect_mixed_authorship`: Analyzes multi-paragraph documents to find mixed human/AI sections.
* `get_detection_report`: Returns a full JSON diagnostic report.
* `list_detection_models`: Displays model weights, status, and licenses.

---

## 3. Docker Deployment
```bash
# Build Docker image
docker build -t sudarshan-ai-backend .

# Run container
docker run -p 8000:8000 sudarshan-ai-backend
```

---

## 4. Architecture & Models
The engine ensembles 5 distinct detection signals:
1. **Trained Random Forest Fusion**: 200 trees trained on 2,452 multilingual samples with Platt calibration.
2. **Decimal-Safe Burstiness**: Sentence length variation (CV) with markdown header isolation.
3. **Stylometry**: Type-Token Ratio (TTR) and paragraph uniformity.
4. **Modern AI Phrasal Clichés**: 120+ corporate and marketing LLM markers.
5. **Perplexity / Predictability**: N-gram entropy and function-word ratio.

---

## 5. Automated Tests
```bash
pytest tests/ -v
```

## License
Apache-2.0 • [Sudarshan AI Labs](https://sudarshan-ai.com/)
