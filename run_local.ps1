param (
    [string]$Mode = "all" # all, backend, frontend, cli, test
)

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  Advanced AI Detector (Sudarshan AI Labs v0.2.0)     " -ForegroundColor Yellow
Write-Host "=======================================================" -ForegroundColor Cyan

$root = $PSScriptRoot
$backendDir = Join-Path $root "sudarshan-ai-detector"
$frontendDir = Join-Path $root "frontend"
$pyExe = Join-Path $root "venv\Scripts\python.exe"

if (-not (Test-Path $pyExe)) {
    Write-Host "[!] Virtual environment not found at $pyExe. Please install requirements first." -ForegroundColor Red
    exit 1
}

if ($Mode -eq "test") {
    Write-Host "[*] Running pytest suite..." -ForegroundColor Cyan
    & $pyExe -m pytest "$backendDir\tests" -v
    exit 0
}

if ($Mode -eq "cli") {
    Write-Host "[*] Running CLI interactive detection test..." -ForegroundColor Cyan
    Push-Location $backendDir
    & $pyExe -m scripts.cli --text "In conclusion, it is important to note that artificial intelligence is transforming various industries. Furthermore, the integration of AI technologies offers significant advantages."
    Pop-Location
    exit 0
}

if ($Mode -eq "backend" -or $Mode -eq "all") {
    Write-Host "[*] Starting FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Green
    $backendJob = Start-Process -FilePath $pyExe -ArgumentList "-m uvicorn scripts.api:app --host 127.0.0.1 --port 8000" -WorkingDirectory $backendDir -PassThru
    Write-Host "    Backend PID: $($backendJob.Id)" -ForegroundColor Gray
}

if ($Mode -eq "frontend" -or $Mode -eq "all") {
    Write-Host "[*] Starting Vite Frontend on http://127.0.0.1:3000..." -ForegroundColor Green
    $frontendJob = Start-Process -FilePath "npm" -ArgumentList "--prefix frontend run dev -- --host 127.0.0.1 --port 3000" -WorkingDirectory $root -PassThru
    Write-Host "    Frontend PID: $($frontendJob.Id)" -ForegroundColor Gray
}

if ($Mode -eq "all") {
    Start-Sleep -Seconds 2
    Write-Host "`n[+] Both Backend & Frontend are running!" -ForegroundColor Cyan
    Write-Host "    Web Dashboard: http://127.0.0.1:3000" -ForegroundColor White
    Write-Host "    API & Docs:    http://127.0.0.1:8000/docs" -ForegroundColor White
    Write-Host "    Press Ctrl+C or close this window to exit.`n" -ForegroundColor Yellow
    Start-Process "http://127.0.0.1:3000"
}
