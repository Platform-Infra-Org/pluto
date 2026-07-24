#!/usr/bin/env bash
# Tear down the integration stack started by dev-up.sh.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ -f .bff.pid ]; then
  PID="$(cat .bff.pid)"
  if kill "$PID" 2>/dev/null; then echo "==> stopped BFF (pid $PID)"; fi
  rm -f .bff.pid
fi

echo "==> docker compose down"
docker compose -f docker-compose.yml -f docker-compose.integration.yml down

echo "==> done"
