@echo off
title Sudarshan AI Detector - MCP Server
echo ========================================================
echo   Starting Sudarshan AI MCP Server (stdio transport)
echo   Listening for Claude Desktop / Cursor / Antigravity
echo ========================================================

if exist "..\venv\Scripts\python.exe" (
    ..\venv\Scripts\python.exe -m scripts.mcp_server --transport stdio
) else if exist "venv\Scripts\python.exe" (
    venv\Scripts\python.exe -m scripts.mcp_server --transport stdio
) else (
    python -m scripts.mcp_server --transport stdio
)
