Write-Host "=== Sudarshan AI Detector v0.2.0 - Python 3.14.7 Latest ===" -ForegroundColor Cyan
Write-Host "No paid APIs, fully open-source" -ForegroundColor Green

# Check location - warn if System32
$currentDir = Get-Location
if ($currentDir -like "*System32*") {
  Write-Host "ERROR: You are in C:\WINDOWS\System32 - DO NOT work here!" -ForegroundColor Red
  Write-Host "Close this window and open PowerShell in C:\SudarshanAI\sudarshan-ai-detector" -ForegroundColor Yellow
  Write-Host "Right-click folder -> Open in Terminal" -ForegroundColor Yellow
  pause
  exit 1
}

Write-Host "`nCurrent folder: $currentDir" -ForegroundColor Gray

# Check Python
try {
  $pyVersion = python --version 2>&1
  $pipVersion = pip --version 2>&1
  Write-Host "Found: $pyVersion" -ForegroundColor Green
  Write-Host "Found: $pipVersion" -ForegroundColor Green
  
  # Check if Python 3.14
  if ($pyVersion -like "*3.14*") {
    Write-Host "Python 3.14.7 detected - using latest model" -ForegroundColor Cyan
  } else {
    Write-Host "You have $pyVersion but guide is for 3.14.7 latest. Will still work." -ForegroundColor Yellow
  }
} catch {
  Write-Host "Python not found. Install Python 3.14.7 from https://www.python.org/downloads/" -ForegroundColor Red
  Write-Host "Check 'Add python.exe to PATH'" -ForegroundColor Yellow
  exit 1
}

Write-Host "`nCreating venv with Python 3.14.7..." -ForegroundColor Yellow
if (Test-Path venv) { Remove-Item -Recurse -Force venv }
python -m venv venv

Write-Host "Activating venv..." -ForegroundColor Yellow
.\venv\Scripts\Activate.ps1

Write-Host "Upgrading pip to latest (pip 26+ for 3.14)..." -ForegroundColor Yellow
python -m pip install --upgrade pip

Write-Host "Installing requirements-py314.txt..." -ForegroundColor Yellow
pip install -r requirements-py314.txt

Write-Host "`nVerifying core libraries..." -ForegroundColor Yellow
python -c "import sklearn, numpy, scipy; print(f'sklearn {sklearn.__version__} numpy {numpy.__version__} scipy {scipy.__version__}')"

# Check models
if (Test-Path "models/fusion_model.pkl") {
  Write-Host "Trained models found - skipping training (models already in zip)" -ForegroundColor Green
} else {
  Write-Host "`nTraining on 2452 open samples (no paid APIs)..." -ForegroundColor Cyan
  python scripts/auto_train.py
}

Write-Host "`nRunning 11 core tests..." -ForegroundColor Yellow
python -m pytest tests/test_detection.py tests/test_multilingual.py tests/test_mixed.py tests/test_calibration.py -v

Write-Host "`n=== Quick Tests Python 3.14.7 ===" -ForegroundColor Cyan
python -m scripts.cli --text "I woke up late today, missed my bus, ran all the way to college. It was raining and I forgot my umbrella. Typical me!"
python -m scripts.cli --text "In conclusion, it is important to note that artificial intelligence has significantly transformed modern society. Furthermore, the implications are far-reaching and multifaceted."

Write-Host "`n=== Setup Complete for Python 3.14.7 Latest ===" -ForegroundColor Green
Write-Host "Your Python: $pyVersion" -ForegroundColor Cyan
Write-Host "To use later:" -ForegroundColor White
Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor Yellow
Write-Host "  python -m scripts.cli --text 'Your text here'" -ForegroundColor White
Write-Host "  python -m scripts.cli --file document.txt --lang hi" -ForegroundColor White
Write-Host "  uvicorn scripts.api:app --port 8000" -ForegroundColor White
Write-Host "  python scripts/mcp_server.py --transport stdio" -ForegroundColor White
Write-Host "`nDashboard: open assets and run html" -ForegroundColor Gray
