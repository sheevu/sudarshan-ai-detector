@echo off
echo === Sudarshan AI Detector - Windows Setup (v0.2.0) ===
echo No paid APIs, fully open-source
echo.

REM Check Python
python --version
if %errorlevel% neq 0 (
  echo Python not found. Please install Python 3.9+ from https://www.python.org/downloads/
  pause
  exit /b
)

echo Creating virtual environment...
python -m venv venv
call venv\Scripts\activate.bat

echo Upgrading pip...
python -m pip install --upgrade pip

echo Installing requirements...
pip install -r requirements.txt

echo.
echo === Training on maximum open dataset (no paid APIs) ===
echo This will generate 2452 samples and train RandomForest + TF-IDF
python scripts\auto_train.py

echo.
echo === Running tests ===
python -m pytest tests/test_detection.py tests/test_multilingual.py tests/test_mixed.py tests/test_calibration.py -v

echo.
echo === Testing detector ===
python -m scripts.cli --text "I woke up late today, missed my bus, ran all the way to college. It was raining and I forgot my umbrella."

echo.
echo === Setup complete ===
echo To use:
echo   venv\Scripts\activate.bat
echo   python -m scripts.cli --text "Your text here"
echo   python -m scripts.cli --file document.txt --lang hi
echo   uvicorn scripts.api:app --port 8000
echo   python scripts/mcp_server.py --transport stdio
echo.
pause
