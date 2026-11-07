
from fastapi.testclient import TestClient
from scripts.api import app

client = TestClient(app)

def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

def test_detect():
    resp = client.post("/detect", json={"text": "This is a simple human written sentence with some personal experience. I went to market yesterday."})
    assert resp.status_code == 200
    data = resp.json()
    assert "overall_classification" in data
    assert "ai_likelihood" in data

def test_models():
    resp = client.get("/models")
    assert resp.status_code == 200
