#!/usr/bin/env bash
# BehindTheMark One-Click System Verification Suite (POSIX Bash)
# Verifies Backend Tests, Frontend Build, Evaluation Harness, and Git Hygiene

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================================="
echo "   BehindTheMark (Team MMS) - Full System Verification"
echo "=========================================================="

FAILED=0

# Python executable detection
if [ -f "$ROOT/backend/.venv/bin/python" ]; then
    PY="$ROOT/backend/.venv/bin/python"
elif [ -f "$ROOT/backend/.venv/Scripts/python.exe" ]; then
    PY="$ROOT/backend/.venv/Scripts/python.exe"
else
    PY="python3"
fi

# 1. Backend Pytest Suite
echo ""
echo "[1/4] Running Backend Test Suite (Pytest)..."
START=$(date +%s)
if (cd "$ROOT/backend" && $PY -m pytest -o addopts= -q); then
    END=$(date +%s)
    echo "  -> Backend tests PASSED ($((END-START))s)"
else
    echo "  -> Backend tests FAILED"
    FAILED=1
fi

# 2. Frontend Production Build
echo ""
echo "[2/4] Running Frontend TypeScript & Vite Production Build..."
START=$(date +%s)
if (cd "$ROOT/frontend" && npm run build); then
    END=$(date +%s)
    echo "  -> Frontend build PASSED ($((END-START))s)"
else
    echo "  -> Frontend build FAILED"
    FAILED=1
fi

# 3. Offline Evaluation Benchmark
echo ""
echo "[3/4] Running Evaluation Benchmark Harness (--rule-only)..."
START=$(date +%s)
if $PY "$ROOT/eval/run_eval.py" --rule-only; then
    END=$(date +%s)
    echo "  -> Evaluation harness PASSED ($((END-START))s)"
else
    echo "  -> Evaluation harness FAILED"
    FAILED=1
fi

# 4. Security & Git Hygiene Scan
echo ""
echo "[4/4] Scanning Repository Hygiene & Forbidden Files..."
HYGIENE_OK=1

if git -C "$ROOT" ls-files "Build_Night_Judging_Criteria.pdf" | grep -q "Build_Night"; then
    echo "  CRITICAL: Build_Night_Judging_Criteria.pdf is tracked in git!"
    HYGIENE_OK=0
fi

if git -C "$ROOT" ls-files ".env" | grep -q "^\.env$"; then
    echo "  CRITICAL: .env is tracked in git!"
    HYGIENE_OK=0
fi

if git -C "$ROOT" ls-files "*.db" | grep -q "\.db$"; then
    echo "  WARNING: SQLite database files tracked in git!"
    HYGIENE_OK=0
fi

if [ $HYGIENE_OK -eq 1 ]; then
    echo "  -> Git hygiene scan PASSED (zero secrets/PDFs tracked)"
else
    echo "  -> Git hygiene scan FAILED"
    FAILED=1
fi

echo ""
echo "=========================================================="
if [ $FAILED -eq 0 ]; then
    echo "ALL CHECKS PASSED: System is ready for evaluation and deployment!"
    echo "=========================================================="
    exit 0
else
    echo "VERIFICATION FAILED: Address the issues above before submitting."
    echo "=========================================================="
    exit 1
fi
