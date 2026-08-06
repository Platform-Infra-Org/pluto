#!/usr/bin/env bash
# Seed the Gitea instance: create an admin user + token, create the `catalog` and
# `software-templates` repos, and push the seed trees from deploy/dev/seed/.
# Idempotent: re-running force-pushes the current seed content.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SEED="$REPO_ROOT/deploy/dev/seed"
GITEA_HTTP="http://localhost:3001"
GITEA_CONTAINER="backstage-gitea-1"
USER="platform"
PASS="platform"
EMAIL="platform@local"

echo "  - ensuring gitea admin user '$USER'"
docker exec -u git "$GITEA_CONTAINER" gitea admin user create \
  --username "$USER" --password "$PASS" --email "$EMAIL" \
  --admin --must-change-password=false 2>/dev/null \
  && echo "    created" || echo "    already exists"

echo "  - minting API token"
# Delete any prior token of this name, then create fresh (basic-auth to the API).
curl -s -X DELETE -u "$USER:$PASS" "$GITEA_HTTP/api/v1/users/$USER/tokens/seed" >/dev/null 2>&1 || true
TOKEN=$(curl -s -X POST -u "$USER:$PASS" -H "Content-Type: application/json" \
  -d '{"name":"seed","scopes":["write:repository","write:user"]}' \
  "$GITEA_HTTP/api/v1/users/$USER/tokens" | python3 -c "import sys,json;print(json.load(sys.stdin)['sha1'])")
[ -n "$TOKEN" ] || { echo "failed to mint token" >&2; exit 1; }

push_repo() { # <repo-name> <seed-subdir>
  local repo="$1" dir="$SEED/$2"
  echo "  - repo '$repo'"
  curl -s -o /dev/null -X POST -u "$USER:$PASS" -H "Content-Type: application/json" \
    -d "{\"name\":\"$repo\",\"auto_init\":false,\"private\":false}" \
    "$GITEA_HTTP/api/v1/user/repos" || true
  local tmp; tmp="$(mktemp -d)"
  cp -R "$dir/." "$tmp/"
  git -C "$tmp" init -q
  git -C "$tmp" checkout -q -b main
  git -C "$tmp" config user.email "$EMAIL"
  git -C "$tmp" config user.name "Seed Bot"
  git -C "$tmp" add -A
  git -C "$tmp" commit -qm "seed $repo"
  git -C "$tmp" push -q --force "http://$USER:$TOKEN@localhost:3001/$USER/$repo.git" main
  rm -rf "$tmp"
  echo "    pushed"
}

push_repo catalog catalog
push_repo software-templates software-templates

echo "  - gitea seeded (repos: $USER/catalog, $USER/software-templates)"
