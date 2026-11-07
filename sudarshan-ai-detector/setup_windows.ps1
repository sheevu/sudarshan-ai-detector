Write-Host "=== Sudarshan AI Detector - Windows Setup (v0.2.0) ===" -ForegroundColor Cyan
Write-Host "No paid APIs, fully open-source" -ForegroundColor Green

# Check Python
try {
  $pyVersion = python --version 2>&1
  Write-Host "Found $pyVersion" -ForegroundColor Green
} catch {
  Write-Host "Python not found. Install Python 3.9+ from https://www.python.org/downloads/" -ForegroundColor Red
  Write-Host "Make sure to check 'Add Python to PATH' during install"
  exit 1
}

Write-Host "`nCreating virtual environment..." -ForegroundColor Yellow
python -m venv venv
.\venv\Scripts\Activate.ps1

Write-Host "Upgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip

Write-Host "Installing requirements..." -ForegroundColor Yellow
pip install -r requirements.txt

Write-Host "`n=== Training on maximum open dataset ===" -ForegroundColor Cyan
Write-Host "Generating 2452 samples + scanning past AI content..." -ForegroundColor Gray
python scripts/auto_train.py

Write-Host "`n=== Running tests ===" -ForegroundColor Yellow
python -m pytest tests/test_detection.py tests/test_multilingual.py tests/test_mixed.py tests/test_calibration.py -v

Write-Host "`n=== Testing detector ===" -ForegroundColor Yellow
python -m scripts.cli --text "I woke up late today, missed my bus, ran all the way to college. It was raining and I forgot my umbrella. Typical me!"

Write-Host "`n=== Setup Complete ===" -ForegroundColor Green
Write-Host "To activate later: .\venv\Scripts\Activate.ps1" -ForegroundColor Cyan
Write-Host "CLI: python -m scripts.cli --text 'Your text'" -ForegroundColor White
Write-Host "File: python -m scripts.cli --file doc.txt --lang hi" -ForegroundColor White
Write-Host "API: uvicorn scripts.api:app --port 8000" -ForegroundColor White
Write-Host "MCP: python scripts/mcp_server.py --transport stdio" -ForegroundColor White
Write-Host "Docs: Open assets and references folders" -ForegroundColor White
