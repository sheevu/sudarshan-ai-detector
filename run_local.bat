@echo off
title Advanced AI Detector - Local Runner
echo =======================================================
echo   Advanced AI Detector (Sudarshan AI Labs v0.2.0)
echo =======================================================
powershell -ExecutionPolicy Bypass -File "%~dp0run_local.ps1" -Mode all
pause
