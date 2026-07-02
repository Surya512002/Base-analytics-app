#!/usr/bin/env bash
# Trigger on-chain prediction market keeper (open / close / resolve).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

BASE_URL="${1:-http://localhost:3000}"
SECRET="${PREDICTIONS_KEEPER_SECRET:-}"

if [[ -z "$SECRET" ]]; then
  echo "ERROR: Set PREDICTIONS_KEEPER_SECRET in .env.local"
  exit 1
fi

curl -sS -X POST "${BASE_URL%/}/api/predictions/keeper" \
  -H "Authorization: Bearer ${SECRET}" \
  -H "Content-Type: application/json" | jq .
