@echo off
echo === Sudarshan AI Detector v0.2.0 - Python 3.14.7 Latest ===
echo No paid APIs, fully open-source
echo.

echo Checking Python...
python --version
if %errorlevel% neq 0 (
  echo Python not found. Install Python 3.14.7 from https://www.python.org/downloads/
  pause
  exit /b
)

echo Python found: 
python --version
pip --version

echo.
echo IMPORTANT: Do not run from C:\WINDOWS\System32
echo Current dir: %CD%
echo If you are in System32, close and open PowerShell in project folder
echo.

echo Creating venv with Python 3.14.7...
python -m venv venv --clear
call venv\Scripts\activate.bat

echo Upgrading pip (pip 26+ for Python 3.14)...
python -m pip install --upgrade pip

echo Installing for Python 3.14.7 Latest...
pip install -r requirements-py314.txt

echo Checking core libs...
python -c "import sklearn, numpy, scipy; print('sklearn', sklearn.__version__, 'numpy', numpy.__version__)"

echo.
echo Verifying models...
if exist models\fusion_model.pkl (
  echo Trained models found - skipping training
) else (
  echo No models found - auto-training on 2452 open samples...
  python scripts\auto_train.py
)

echo.
echo Running tests (11 core tests)...
python -m pytest tests/test_detection.py tests/test_multilingual.py tests/test_mixed.py tests/test_calibration.py -v

echo.
echo Quick test Python 3.14.7...
python -m scripts.cli --text "I woke up late today, missed my bus, ran all the way to college. It was raining and I forgot my umbrella. Typical me!"

python -m scripts.cli --text "In conclusion, it is important to note that artificial intelligence has significantly transformed modern society. Furthermore, the implications are far-reaching."

echo.
echo === Setup Complete for Python 3.14.7 ===
echo Usage:
echo   venv\Scripts\activate.bat
echo   python -m scripts.cli --text "Your text"
echo   python -m scripts.cli --file doc.txt --lang hi
echo   uvicorn scripts.api:app --port 8000
echo   python scripts/mcp_server.py --transport stdio
echo.
pause
