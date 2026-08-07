#!/usr/bin/env bash
# Tear down the Backstage stack: argo port-forward, kind cluster, docker services.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
export PATH="$HOME/.local/bin:$PATH"

echo "==> stopping argo-server port-forward"
if [ -f .argo-pf.pid ]; then kill "$(cat .argo-pf.pid)" 2>/dev/null || true; rm -f .argo-pf.pid .argo-pf.log; fi

echo "==> deleting kind cluster 'platform'"
kind delete cluster --name platform 2>/dev/null || true

echo "==> stopping docker services"
docker compose -p backstage -f deploy/dev/docker-compose.yml down -v

echo "Backstage stack torn down. (The backstage/ app itself is just a process — stop 'yarn start'.)"
