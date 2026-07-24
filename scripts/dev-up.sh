#!/usr/bin/env bash
# Bring up the full runnable integration stack and start the BFF.
#   Postgres + Keycloak + MinIO (docker), then alembic + catalog index + uvicorn.
# The BFF runs on the HOST (not docker) so token `iss` == http://localhost:8080/...
# matches OIDC_ISSUER_URL. Argo is intentionally not wired (no cluster here).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> docker compose up (postgres + keycloak + minio)"
docker compose -f docker-compose.yml -f docker-compose.integration.yml up -d

echo "==> waiting for Keycloak realm 'platform' ..."
for i in $(seq 1 90); do
  if curl -sf http://localhost:8080/realms/platform >/dev/null 2>&1; then
    echo "    Keycloak ready"
    break
  fi
  if [ "$i" -eq 90 ]; then echo "Keycloak did not become ready" >&2; exit 1; fi
  sleep 2
done

echo "==> building local seed catalog git repo (.catalog-seed)"
SEED="$REPO_ROOT/.catalog-seed"
rm -rf "$SEED"
mkdir -p "$SEED"
cp -R "$REPO_ROOT/deploy/seed-catalog/." "$SEED/"
git -C "$SEED" init -q -b main
git -C "$SEED" config user.email "seed@platform.dev"
git -C "$SEED" config user.name "Seed Bot"
git -C "$SEED" add -A
git -C "$SEED" commit -qm "seed catalog"

echo "==> loading environment (.env.integration)"
TMPENV="$(mktemp)"
sed "s#REPO_ROOT#${REPO_ROOT}#g" "$REPO_ROOT/.env.integration" > "$TMPENV"
set -a
# shellcheck disable=SC1090
source "$TMPENV"
set +a
rm -f "$TMPENV"
# Fresh clone each run so the seed repo's history is picked up cleanly.
rm -rf "$GIT_CACHE_DIR"

cd "$REPO_ROOT/apps/bff"

echo "==> alembic upgrade head"
uv run alembic upgrade head

echo "==> indexing seed catalog into the DB"
uv run python -c "import asyncio; from app.catalog.git_sync import sync_repo; print(asyncio.run(sync_repo()))"

echo "==> starting BFF (uvicorn :8000)"
nohup uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 > "$REPO_ROOT/.bff.log" 2>&1 &
echo $! > "$REPO_ROOT/.bff.pid"

for i in $(seq 1 30); do
  if curl -sf http://localhost:8000/healthz >/dev/null 2>&1; then
    echo "    BFF ready at http://localhost:8000"
    break
  fi
  if [ "$i" -eq 30 ]; then echo "BFF did not become ready (see .bff.log)" >&2; exit 1; fi
  sleep 1
done

echo
echo "Stack is up:"
echo "  BFF:        http://localhost:8000  (logs: .bff.log)"
echo "  Keycloak:   http://localhost:8080  (admin/admin)"
echo "  MinIO:      http://localhost:9000  (console :9001, minioadmin/minioadmin)"
echo "  SPA (dev):  pnpm --dir apps/web dev   then open http://localhost:5173"
echo "  Smoke test: scripts/api-smoke.sh"
