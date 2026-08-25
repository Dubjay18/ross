#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AGENT_PY="${ROOT}/apps/agent/.venv/bin/python"
case "${1:-}" in
  parallel)
    exec "$AGENT_PY" "${ROOT}/scripts/smoke-parallel.py"
    ;;
  gemini)
    exec "$AGENT_PY" "${ROOT}/scripts/smoke-gemini.py"
    ;;
  *)
    echo "usage: $0 parallel|gemini" >&2
    exit 2
    ;;
esac
