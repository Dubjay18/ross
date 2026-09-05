#!/usr/bin/env bash
# Uploads the planted-error demo script into a running stack and kicks off a
# full analysis, then prints the script id for opening in the web UI.
set -euo pipefail

API_URL="${API_URL:-http://localhost:3001}"
SEED_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/seed/demo-script.fountain"

echo "== waiting for API =="
for _ in $(seq 1 30); do
  if curl -sf "${API_URL}/health" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -sf "${API_URL}/health" | grep -q '"ok":true' || { echo "API not reachable at ${API_URL}"; exit 1; }

echo "== uploading seed script =="
UPLOAD_RES=$(curl -sf -X POST "${API_URL}/scripts" -F "file=@${SEED_FILE}" -F "title=The Long Way Home (Demo)")
SCRIPT_ID=$(echo "$UPLOAD_RES" | python3 -c 'import json,sys; print(json.load(sys.stdin)["script"]["id"])')
echo "script id: ${SCRIPT_ID}"

echo "== triggering full analysis =="
ANALYZE_RES=$(curl -sf -X POST "${API_URL}/scripts/${SCRIPT_ID}/analyze" -H 'content-type: application/json' -d '{"mode":"full"}')
JOB_ID=$(echo "$ANALYZE_RES" | python3 -c 'import json,sys; print(json.load(sys.stdin)["jobId"])')
echo "job id: ${JOB_ID}"

echo "== polling job (up to 90s) =="
for _ in $(seq 1 30); do
  STATUS_RES=$(curl -sf "${API_URL}/jobs/${JOB_ID}")
  STATUS=$(echo "$STATUS_RES" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')
  echo "  status: ${STATUS}"
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then break; fi
  sleep 3
done
echo "$STATUS_RES"

echo
echo "Demo script id: ${SCRIPT_ID}"
echo "Open the web UI, upload scripts/seed/demo-script.fountain again (or paste this id"
echo "into your own script viewer) to walk through the planted issues."
