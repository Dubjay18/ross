#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3001}"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

echo "== health =="
curl -sf "${API_URL}/health" | tee /dev/stderr | grep -q '"ok":true' || fail "health check failed"

echo
echo "== create script =="
CREATE_RES=$(curl -sf -X POST "${API_URL}/scripts" \
  -H 'content-type: application/json' \
  -d '{"title":"Smoke Test Script","content":"INT. HOUSE - DAY\nJOHN enters.","format":"plaintext"}')
echo "$CREATE_RES"
SCRIPT_ID=$(echo "$CREATE_RES" | python3 -c 'import json,sys; print(json.load(sys.stdin)["script"]["id"])')
[ -n "$SCRIPT_ID" ] || fail "no script id returned"

echo
echo "== get script =="
curl -sf "${API_URL}/scripts/${SCRIPT_ID}" | grep -q "\"id\":\"${SCRIPT_ID}\"" || fail "get script failed"

echo
echo "== list issues (expect empty) =="
LIST_RES=$(curl -sf "${API_URL}/scripts/${SCRIPT_ID}/issues")
echo "$LIST_RES"
echo "$LIST_RES" | grep -q '"total":0' || fail "expected zero issues for fresh script"

echo
echo "== trigger analyze (stub job) =="
ANALYZE_RES=$(curl -sf -X POST "${API_URL}/scripts/${SCRIPT_ID}/analyze" \
  -H 'content-type: application/json' \
  -w '\n%{http_code}' \
  -d '{}')
echo "$ANALYZE_RES"
echo "$ANALYZE_RES" | tail -1 | grep -q '^202$' || fail "expected 202 from analyze"
JOB_ID=$(echo "$ANALYZE_RES" | head -1 | python3 -c 'import json,sys; print(json.load(sys.stdin)["jobId"])')
[ -n "$JOB_ID" ] || fail "no job id returned"

echo
echo "== poll job status =="
curl -sf "${API_URL}/jobs/${JOB_ID}" | grep -q '"status":"queued"' || fail "expected queued job status"

echo
echo "== 404 on unknown script =="
STATUS=$(curl -s -o /dev/null -w '%{http_code}' "${API_URL}/scripts/00000000-0000-0000-0000-000000000000")
[ "$STATUS" = "404" ] || fail "expected 404 for unknown script, got ${STATUS}"

echo
echo "ok: Module 2 API smoke test passed"
