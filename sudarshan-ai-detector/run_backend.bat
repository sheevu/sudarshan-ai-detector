@echo off
title Sudarshan AI Detector - FastAPI Backend
echo ========================================================
echo   Starting Sudarshan AI Detector Backend Server
echo   URL: http://127.0.0.1:8000
echo   Docs: http://127.0.0.1:8000/docs
echo ========================================================

if exist "..\venv\Scripts\python.exe" (
    ..\venv\Scripts\python.exe -m uvicorn scripts.api:app --host 127.0.0.1 --port 8000 --reload
) else if exist "venv\Scripts\python.exe" (
    venv\Scripts\python.exe -m uvicorn scripts.api:app --host 127.0.0.1 --port 8000 --reload
) else (
    python -m uvicorn scripts.api:app --host 127.0.0.1 --port 8000 --reload
)

pause
