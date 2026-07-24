#!/usr/bin/env bash
# Authenticated API smoke test against the live stack (dev-up.sh must be running).
# Gets real Keycloak tokens via password grant and asserts the BFF's authz + core
# flows end to end. Prints a PASS/FAIL summary and exits non-zero on any failure.
set -uo pipefail

KC=http://localhost:8080/realms/platform/protocol/openid-connect/token
BFF=http://localhost:8000
PASS=0
FAIL=0

log_pass() { echo "  PASS: $1"; PASS=$((PASS+1)); }
log_fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

# assert_status <name> <expected> <actual>
assert_status() {
  if [ "$2" = "$3" ]; then log_pass "$1 -> $3"; else log_fail "$1 -> got $3, want $2"; fi
}

token_for() { # username password  -> access_token on stdout
  curl -s -X POST "$KC" \
    -d grant_type=password -d client_id=platform-ui \
    -d "username=$1" -d "password=$2" -d scope=openid \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))"
}

# GET/POST returning HTTP status (body saved to /tmp/smoke_body.json)
call() { # method path token [json-body]
  local method=$1 path=$2 token=$3 data=${4:-}
  if [ -n "$data" ]; then
    curl -s -o /tmp/smoke_body.json -w "%{http_code}" -X "$method" "$BFF$path" \
      -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "$data"
  else
    curl -s -o /tmp/smoke_body.json -w "%{http_code}" -X "$method" "$BFF$path" \
      -H "Authorization: Bearer $token"
  fi
}

body_has() { python3 -c "import json,sys; d=json.load(open('/tmp/smoke_body.json')); sys.exit(0 if ($1) else 1)"; }

echo "== Acquiring tokens from Keycloak =="
ADMIN_TOKEN="$(token_for admin admin)"
REQUESTER_TOKEN="$(token_for requester requester)"
[ -n "$ADMIN_TOKEN" ] && log_pass "admin token acquired" || log_fail "admin token acquire"
[ -n "$REQUESTER_TOKEN" ] && log_pass "requester token acquired" || log_fail "requester token acquire"

echo "== Health =="
code=$(curl -s -o /tmp/smoke_body.json -w "%{http_code}" "$BFF/healthz")
assert_status "GET /healthz" 200 "$code"

echo "== /api/me (admin principal) =="
code=$(call GET /api/me "$ADMIN_TOKEN")
assert_status "GET /api/me (admin)" 200 "$code"
if body_has "'platform-admin' in d['roles']"; then log_pass "admin has role platform-admin"; else log_fail "admin role platform-admin"; fi
if body_has "'platform-admins' in d['groups']"; then log_pass "admin in group platform-admins"; else log_fail "admin group"; fi

echo "== /api/me (requester principal) =="
code=$(call GET /api/me "$REQUESTER_TOKEN")
assert_status "GET /api/me (requester)" 200 "$code"
if body_has "'payments' in d['teams']"; then log_pass "requester on team payments"; else log_fail "requester team payments"; fi

echo "== Admin-only endpoint enforcement =="
code=$(call GET /api/admin/overview "$ADMIN_TOKEN")
assert_status "GET /api/admin/overview (admin)" 200 "$code"
code=$(call GET /api/admin/overview "$REQUESTER_TOKEN")
assert_status "GET /api/admin/overview (requester, must be forbidden)" 403 "$code"

echo "== Resource catalog =="
code=$(call GET /api/resources "$ADMIN_TOKEN")
assert_status "GET /api/resources (admin)" 200 "$code"
if body_has "len(d['items']) >= 1"; then log_pass "catalog has indexed resources ($(python3 -c "import json;print(len(json.load(open('/tmp/smoke_body.json'))['items']))"))"; else log_fail "catalog is empty"; fi

echo "== Submit RESOURCE_CHANGE as requester -> owner-team approval queue =="
BODY='{"action":"CREATE","resource_type":"database","payload":{"metadata":{"ownerTeam":"payments"},"spec":{"engine":"postgres","size":"small"}}}'
code=$(call POST /api/requests "$REQUESTER_TOKEN" "$BODY")
assert_status "POST /api/requests (requester)" 201 "$code"
REQ_ID="$(python3 -c "import json;print(json.load(open('/tmp/smoke_body.json')).get('id',''))" 2>/dev/null || echo '')"
if body_has "d.get('owner_team')=='payments'"; then log_pass "request routed to owner_team payments"; else log_fail "request owner_team routing"; fi

# Admin sees it in the pending approval queue.
code=$(call GET "/api/requests?queue=1" "$ADMIN_TOKEN")
assert_status "GET /api/requests?queue=1 (admin)" 200 "$code"
if body_has "any(r['id']==int('${REQ_ID:-0}') for r in d['items'])"; then
  log_pass "submitted request #$REQ_ID appears in owner-team approval queue"
else
  log_fail "request #$REQ_ID not in approval queue"
fi

echo "== Notifications =="
code=$(call GET /api/notifications "$ADMIN_TOKEN")
assert_status "GET /api/notifications (admin)" 200 "$code"
code=$(call GET "/api/notifications?unread_only=1" "$REQUESTER_TOKEN")
assert_status "GET /api/notifications?unread_only=1 (requester)" 200 "$code"

echo
echo "==================== SMOKE SUMMARY ===================="
echo "  PASSED: $PASS"
echo "  FAILED: $FAIL"
echo "======================================================"
[ "$FAIL" -eq 0 ] && echo "RESULT: PASS" || echo "RESULT: FAIL"
exit "$FAIL"
