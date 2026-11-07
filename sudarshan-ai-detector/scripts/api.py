
"""
FastAPI REST API for Sudarshan AI Detector
Optional integration, no mandatory paid services.
"""
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
import os
from dotenv import load_dotenv
load_dotenv()

from .detector import SudarshanDetector

app = FastAPI(
    title="Sudarshan AI Detector API",
    description="Production-ready multilingual AI text detection",
    version="0.2.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for local dev and frontend deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global detector singleton (lightweight by default)
detector_instance = None

def get_detector():
    global detector_instance
    if detector_instance is None:
        use_transformer = os.getenv("ENABLE_TRANSFORMER", "false").lower() == "true"
        model_path = os.getenv("TRANSFORMER_MODEL_PATH")
        detector_instance = SudarshanDetector(use_transformer=use_transformer, transformer_path=model_path)
    return detector_instance

class DetectRequest(BaseModel):
    text: str = Field(..., description="Text to analyze", max_length=20000)
    language: str = Field(default="auto", description="Language code or auto")
    metadata: Optional[Dict] = Field(default=None, description="Optional provenance metadata")
    watermark_key: Optional[str] = Field(default=None, description="Optional watermark key")

class DetectResponse(BaseModel):
    overall_classification: str
    ai_likelihood: float
    detected_language: str
    word_count: int
    token_count: int
    detection_methods_used: List[str]
    individual_findings: Dict
    ai_like_sections: List[Dict]
    sentence_breakdown: Optional[List[Dict]] = None
    uncertainty: Dict
    limitations: List[str]
    timestamp: str

@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0", "detectors": ["perplexity","burstiness","stylometry","zero_shot","transformer","perturbation","watermark"]}

@app.get("/models")
@app.get("/api/models")
def list_models():
    return {
        "models": [
            {"name": "perplexity", "model": "distilgpt2", "status": "available", "license": "MIT"},
            {"name": "transformer", "model": "xlm-roberta-base", "status": "requires fine-tuning", "license": "MIT"},
            {"name": "indicbert", "model": "ai4bharat/indic-bert", "status": "requires fine-tuning", "license": "MIT"},
            {"name": "perturbation", "model": "t5-small", "status": "optional", "license": "Apache-2.0"}
        ]
    }

@app.post("/detect", response_model=DetectResponse)
@app.post("/api/detect", response_model=DetectResponse)
def detect_text(req: DetectRequest, detector: SudarshanDetector = Depends(get_detector)):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")
    if len(req.text) > 20000:
        raise HTTPException(status_code=400, detail="Text too long, max 20000 chars")
    result = detector.detect(req.text, language=req.language, metadata=req.metadata, watermark_key=req.watermark_key)
    # Remove internal
    clean = {k:v for k,v in result.items() if not k.startswith("_")}
    return clean

@app.post("/detect_mixed")
@app.post("/api/detect_mixed")
def detect_mixed(req: DetectRequest, detector: SudarshanDetector = Depends(get_detector)):
    result = detector.detect(req.text, language=req.language)
    return {"is_mixed": result.get("mixed_authorship", {}).get("is_mixed"), "sections": result.get("mixed_authorship", {}).get("sections"), "overall": result.get("overall_classification")}

# For MCP compatibility, expose OpenAPI schema
@app.get("/.well-known/openapi.yaml")
def openapi_yaml():
    import yaml
    from fastapi.openapi.utils import get_openapi
    openapi_schema = get_openapi(title=app.title, version=app.version, routes=app.routes)
    return openapi_schema
