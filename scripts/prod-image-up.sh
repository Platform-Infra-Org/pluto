#!/usr/bin/env bash
# Build the production image and run it against the local dev stack on :7007.
#
# This is the production *build* — minified bundle, NODE_ENV=production, mangled
# MUI class names — talking to the containers `backstage-up.sh` started. It is
# what catches the bugs `yarn start` cannot: anything that depends on a hashed
# class name, a dev-only export, or a file the bundle does not carry.
#
# Requires the dev stack to be up (bash scripts/backstage-up.sh) — this replaces
# `yarn start`, not the stack. See docs/how-to/run-the-production-image.md.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

IMAGE="platform:local-prod"
NAME="platform-prod"
OVERLAY="$REPO_ROOT/deploy/dev/container-prod.yaml"
LOCAL_CONFIG="$REPO_ROOT/backstage/app-config.local.yaml"

if [ ! -f "$LOCAL_CONFIG" ]; then
  echo "$LOCAL_CONFIG not found — run 'bash scripts/backstage-up.sh' first." >&2
  exit 1
fi

# Postgres is the one dependency this container cannot start without: the
# backend exits on an unreachable database rather than degrading, so a stack
# that is down produces a container that dies at boot with a stack trace.
# Checking first turns that into one line.
if ! (echo >/dev/tcp/127.0.0.1/5433) 2>/dev/null; then
  echo "nothing listening on :5433 — is the dev stack up? (bash scripts/backstage-up.sh)" >&2
  exit 1
fi

echo "==> [1/4] building workspaces + backend bundle"
cd backstage
yarn build:all
cd "$REPO_ROOT"

echo "==> [2/4] building image $IMAGE"
# Context is backstage/, per packages/backend/Dockerfile: that is where
# yarn.lock, the skeleton and the bundle live.
if ! DOCKER_BUILDKIT=1 docker build -t "$IMAGE" -f backstage/packages/backend/Dockerfile backstage; then
  cat <<'EOF' >&2

  Build failed. If the error was ENOSPC / "no space left on device", the Docker
  VM's disk is full — the image is ~1.5GB and each rebuild leaves the previous
  one dangling. Reclaim and retry:

    docker image prune -f && docker builder prune -f

  Do NOT add --volumes: the dev stack's Postgres, Gitea and Keycloak state
  lives in Docker volumes. A full disk can also take Postgres down mid-write,
  so check `docker ps -a | grep postgres` before assuming the build is the only
  casualty.
EOF
  exit 1
fi

echo "==> [3/4] (re)starting container $NAME on :7007"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -p 7007:7007 \
  -v "$LOCAL_CONFIG":/etc/platform/app-config.local.yaml \
  -v "$OVERLAY":/etc/platform/container-prod.yaml \
  "$IMAGE" \
  node packages/backend \
  --config app-config.yaml \
  --config /etc/platform/app-config.local.yaml \
  --config /etc/platform/container-prod.yaml >/dev/null

echo "==> [4/4] waiting for http://localhost:7007"
for i in $(seq 1 60); do
  curl -sf -o /dev/null http://localhost:7007/ && { echo "    ready"; break; }
  if [ -z "$(docker ps -q -f name="^${NAME}$")" ]; then
    echo "    container exited — last lines:" >&2
    docker logs --tail 20 "$NAME" >&2
    exit 1
  fi
  [ "$i" -eq 60 ] && { echo "did not become ready; docker logs $NAME" >&2; exit 1; }
  sleep 2
done

cat <<EOF

  Production image live at http://localhost:7007  (frontend served by the backend)

    docker logs -f $NAME
    docker rm -f $NAME          # stop; the dev stack keeps running

  Secrets are off in this flow — the container has no cluster credentials.
  Use 'yarn start' to exercise them. See deploy/dev/container-prod.yaml.
EOF
