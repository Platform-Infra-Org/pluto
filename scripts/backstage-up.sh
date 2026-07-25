#!/usr/bin/env bash
# Bring up the self-contained Backstage stack: docker services (Postgres,
# Keycloak, Gitea, MinIO), seed Gitea repos, and a kind + Argo cluster.
# Coexists with the legacy stack (distinct ports). Then start Backstage with:
#   cd backstage && yarn start
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
COMPOSE="docker compose -p backstage -f deploy/backstage/docker-compose.yml"

echo "==> [1/3] docker services (postgres:5433, keycloak:8081, gitea:3001, minio:9002)"
$COMPOSE up -d

echo "==> waiting for Keycloak realm 'platform' (http://localhost:8081)"
for i in $(seq 1 90); do
  curl -sf http://localhost:8081/realms/platform >/dev/null 2>&1 && { echo "    Keycloak ready"; break; }
  [ "$i" -eq 90 ] && { echo "Keycloak did not become ready" >&2; exit 1; }
  sleep 2
done

echo "==> waiting for Gitea (http://localhost:3001)"
for i in $(seq 1 60); do
  curl -sf http://localhost:3001/api/v1/version >/dev/null 2>&1 && { echo "    Gitea ready"; break; }
  [ "$i" -eq 60 ] && { echo "Gitea did not become ready" >&2; exit 1; }
  sleep 2
done

echo "==> [2/3] seed Gitea repos"
bash deploy/backstage/gitea-seed.sh

echo "==> [3/3] kind cluster + Argo Workflows"
bash deploy/backstage/kind-argo-up.sh

cat <<'EOF'

  Stack ready. Now start Backstage:
    cd backstage && yarn start

  URLs:
    Backstage   http://localhost:3000   (backend :7007)
    Keycloak    http://localhost:8081    (admin/admin)
    Gitea       http://localhost:3001    (platform/platform)
    MinIO       http://localhost:9002    (console :9003, minioadmin/minioadmin)
    argo-server http://localhost:2746
EOF
