#!/usr/bin/env bash
# Usage: scripts/smoke.sh https://<app>.onrender.com
set -euo pipefail
BASE="${1:?pass the base URL}"
echo "health:"; curl -fsS "$BASE/api/health"; echo
echo "sample class:"; CLASS=$(curl -fsS -X POST "$BASE/api/classes/sample"); echo "$CLASS"
CODE=$(echo "$CLASS" | python -c "import sys,json; print(json.load(sys.stdin)['join_code'])")
echo "join:"; JOIN=$(curl -fsS -X POST "$BASE/api/join" -H 'Content-Type: application/json' -d "{\"join_code\":\"$CODE\",\"nickname\":\"smoke\"}")
TOKEN=$(echo "$JOIN" | python -c "import sys,json; print(json.load(sys.stdin)['student_token'])")
QID=$(echo "$JOIN" | python -c "import sys,json; print(json.load(sys.stdin)['quiz']['questions'][0]['question_id'])")
echo "submit:"; curl -fsS -X POST "$BASE/api/responses" -H 'Content-Type: application/json' -H "X-Student-Token: $TOKEN" \
  -d "{\"question_id\":$QID,\"answer\":\"3/4\",\"explanation\":\"1/2 is 2/4 so 2/4 + 1/4 = 3/4\",\"self_confidence\":\"sure\"}"; echo
echo "OK"
