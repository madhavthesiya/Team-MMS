# BehindTheMark One-Click System Verification Suite (PowerShell)
# Verifies Backend Tests, Frontend Build, Evaluation Harness, and Git Hygiene

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
if (-not $Root) { $Root = Get-Location }

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   BehindTheMark (Team MMS) - Full System Verification" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$Results = @()
$OverallSuccess = $true

function Record-Check {
    param(
        [string]$Name,
        [bool]$Success,
        [string]$Details,
        [double]$DurationSeconds
    )
    $script:Results += [PSCustomObject]@{
        Check    = $Name
        Status   = if ($Success) { "PASS" } else { "FAIL" }
        Duration = "$([Math]::Round($DurationSeconds, 1))s"
        Details  = $Details
    }
    if (-not $Success) {
        $script:OverallSuccess = $false
    }
}

# 1. Backend Pytest Suite
Write-Host "`n[1/4] Running Backend Test Suite (Pytest)..." -ForegroundColor Yellow
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$pyExe = Join-Path $Root "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $pyExe)) { $pyExe = "python" }

$pytestOut = & $pyExe -m pytest "$Root\backend" -o addopts= -q 2>&1
$pytestExit = $LASTEXITCODE
$sw.Stop()

if ($pytestExit -eq 0) {
    Write-Host "  Backend tests passed!" -ForegroundColor Green
    Record-Check -Name "Backend Unit/Integration Tests" -Success $true -Details "$pytestOut" -DurationSeconds $sw.Elapsed.TotalSeconds
} else {
    Write-Host "  Backend tests failed!" -ForegroundColor Red
    Record-Check -Name "Backend Unit/Integration Tests" -Success $false -Details "Exit Code: $pytestExit" -DurationSeconds $sw.Elapsed.TotalSeconds
}

# 2. Frontend Production Build
Write-Host "`n[2/4] Running Frontend TypeScript & Vite Production Build..." -ForegroundColor Yellow
$sw = [System.Diagnostics.Stopwatch]::StartNew()
Push-Location "$Root\frontend"
$npmOut = & npm.cmd run build 2>&1
$npmExit = $LASTEXITCODE
Pop-Location
$sw.Stop()

if ($npmExit -eq 0) {
    Write-Host "  Frontend build passed cleanly!" -ForegroundColor Green
    Record-Check -Name "Frontend Build (tsc & vite)" -Success $true -Details "Clean production build" -DurationSeconds $sw.Elapsed.TotalSeconds
} else {
    Write-Host "  Frontend build failed!" -ForegroundColor Red
    Record-Check -Name "Frontend Build (tsc & vite)" -Success $false -Details "Build error (Exit $npmExit)" -DurationSeconds $sw.Elapsed.TotalSeconds
}

# 3. Offline Evaluation Benchmark
Write-Host "`n[3/4] Running Evaluation Benchmark Harness (--rule-only)..." -ForegroundColor Yellow
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$evalOut = & $pyExe "$Root\eval\run_eval.py" --rule-only 2>&1
$evalExit = $LASTEXITCODE
$sw.Stop()

if ($evalExit -eq 0) {
    Write-Host "  Evaluation harness completed!" -ForegroundColor Green
    Record-Check -Name "Evaluation Benchmark (51 cases)" -Success $true -Details "All 51 benchmark cases verified" -DurationSeconds $sw.Elapsed.TotalSeconds
} else {
    Write-Host "  Evaluation harness failed!" -ForegroundColor Red
    Record-Check -Name "Evaluation Benchmark (51 cases)" -Success $false -Details "Exit Code: $evalExit" -DurationSeconds $sw.Elapsed.TotalSeconds
}

# 4. Security & Git Hygiene Scan
Write-Host "`n[4/4] Scanning Repository Hygiene & Forbidden Files..." -ForegroundColor Yellow
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$trackedPdf = git -C "$Root" ls-files "Build_Night_Judging_Criteria.pdf"
$trackedEnv = git -C "$Root" ls-files ".env"
$trackedDb  = git -C "$Root" ls-files "*.db"
$trackedKey = git -C "$Root" grep -i "AIzaSy" -- ":!.env.example" 2>$null

$hygieneOk = $true
$hygieneMsgs = @()

if ($trackedPdf) {
    $hygieneOk = $false
    $hygieneMsgs += "CRITICAL: Build_Night_Judging_Criteria.pdf is tracked!"
}
if ($trackedEnv) {
    $hygieneOk = $false
    $hygieneMsgs += "CRITICAL: .env file is tracked in git!"
}
if ($trackedDb) {
    $hygieneOk = $false
    $hygieneMsgs += "WARNING: SQLite database files tracked in git!"
}
if ($trackedKey) {
    $hygieneOk = $false
    $hygieneMsgs += "CRITICAL: Live API key pattern detected in repository!"
}
$sw.Stop()

if ($hygieneOk) {
    Write-Host "  Hygiene check passed (0 sensitive files tracked)!" -ForegroundColor Green
    Record-Check -Name "Security & Git Hygiene Scan" -Success $true -Details "Clean; zero secrets/PDFs tracked" -DurationSeconds $sw.Elapsed.TotalSeconds
} else {
    Write-Host "  Hygiene issues detected!" -ForegroundColor Red
    Record-Check -Name "Security & Git Hygiene Scan" -Success $false -Details ($hygieneMsgs -join "; ") -DurationSeconds $sw.Elapsed.TotalSeconds
}

# Summary Table
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "                  VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
$Results | Format-Table -AutoSize Check, Status, Duration, Details

if ($OverallSuccess) {
    Write-Host "ALL CHECKS PASSED: System is ready for evaluation and deployment!`n" -ForegroundColor Green
    exit 0
} else {
    Write-Host "VERIFICATION FAILED: Address the issues above before submitting.`n" -ForegroundColor Red
    exit 1
}
