#!/usr/bin/env bash
# Create a local kind cluster and install Argo Workflows, then apply the seed
# WorkflowTemplates. Idempotent. Exposes argo-server (plain HTTP) on localhost:2746
# via a background port-forward (pid in .argo-pf.pid).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HERE="$REPO_ROOT/deploy/backstage"
KIND_VERSION="v0.23.0"
ARGO_VERSION="v3.5.11"
CLUSTER="platform"
BIN="$HOME/.local/bin"

install_kind() {
  command -v kind >/dev/null 2>&1 && return
  echo "  - installing kind $KIND_VERSION"
  local arch; arch="$(uname -m)"; [ "$arch" = "x86_64" ] && arch="amd64"; [ "$arch" = "arm64" ] && arch="arm64"
  local os; os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  mkdir -p "$BIN"
  curl -sSLo "$BIN/kind" "https://kind.sigs.k8s.io/dl/$KIND_VERSION/kind-$os-$arch"
  chmod +x "$BIN/kind"
}

install_kind
export PATH="$BIN:$PATH"

if kind get clusters 2>/dev/null | grep -qx "$CLUSTER"; then
  echo "  - kind cluster '$CLUSTER' already exists"
else
  echo "  - creating kind cluster '$CLUSTER'"
  kind create cluster --config "$HERE/kind-cluster.yaml" --wait 120s
fi
kubectl config use-context "kind-$CLUSTER" >/dev/null

echo "  - installing Argo Workflows $ARGO_VERSION"
kubectl get ns argo >/dev/null 2>&1 || kubectl create namespace argo
kubectl apply -n argo -f \
  "https://github.com/argoproj/argo-workflows/releases/download/$ARGO_VERSION/quick-start-minimal.yaml" >/dev/null

echo "  - patching argo-server to plain HTTP + server auth (local dev)"
kubectl -n argo patch deployment argo-server --type=json -p '[
  {"op":"replace","path":"/spec/template/spec/containers/0/args","value":["server","--auth-mode=server","--secure=false"]},
  {"op":"replace","path":"/spec/template/spec/containers/0/readinessProbe/httpGet/scheme","value":"HTTP"}
]' >/dev/null

echo "  - waiting for argo-server + controller"
kubectl -n argo rollout status deployment/argo-server --timeout=180s >/dev/null
kubectl -n argo rollout status deployment/workflow-controller --timeout=180s >/dev/null

echo "  - applying seed WorkflowTemplates"
kubectl apply -f "$HERE/argo/function-blocks.yaml" >/dev/null
kubectl apply -f "$HERE/argo/demo-resource.yaml" >/dev/null
kubectl apply -f "$HERE/argo/checkout-service.yaml" >/dev/null
kubectl apply -f "$HERE/argo/git-resource.yaml" >/dev/null
kubectl apply -f "$HERE/argo/provision-database.yaml" >/dev/null

echo "  - port-forwarding argo-server -> localhost:2746"
if [ -f "$REPO_ROOT/.argo-pf.pid" ] && kill -0 "$(cat "$REPO_ROOT/.argo-pf.pid")" 2>/dev/null; then
  echo "    already forwarding"
else
  nohup kubectl -n argo port-forward svc/argo-server 2746:2746 > "$REPO_ROOT/.argo-pf.log" 2>&1 &
  echo $! > "$REPO_ROOT/.argo-pf.pid"
  sleep 3
fi
echo "  - argo ready (server: http://localhost:2746)"
