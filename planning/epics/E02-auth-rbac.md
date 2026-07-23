# E02 — AuthN/AuthZ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development / executing-plans. `- [ ]` steps.

**Goal:** A logged-in user reaches the portal via Keycloak (OIDC + PKCE), the BFF validates their
token, extracts the `groups` claim, maps it to portal roles, and enforces authorization server-side.

**Architecture:** SPA does Authorization Code + PKCE against Keycloak; tokens held in memory + a
BFF-signed httpOnly session cookie for refresh. BFF validates the JWT (JWKS), builds a `Principal`
(subject, groups, roles), and exposes `require_role(...)`/`require_any(...)` dependencies. RBAC is
the ArgoCD union pattern: role = union of permissions of all matched groups. **[R]**

**Tech Stack:** Keycloak (OIDC), `authlib`/`python-jose` for JWT+JWKS, FastAPI dependencies;
`@react-keycloak` or `oidc-client-ts` in the SPA.

## Global Constraints
Authorization enforced in the BFF on every mutating call; SPA claims are display-only. See README.

## File structure
- `apps/bff/app/auth/jwt.py` — JWKS fetch + validate → claims
- `apps/bff/app/auth/principal.py` — `Principal`, group→role mapping
- `apps/bff/app/auth/deps.py` — FastAPI deps: `current_principal`, `require_role`, `require_any`
- `apps/bff/app/api/me.py` — `GET /api/me`
- `apps/web/src/lib/auth.ts` — OIDC/PKCE login, token store
- `apps/web/src/app/guard.tsx` — route guard + role-based UI gating

---

### Task 1: JWT validation against Keycloak JWKS

**Files:** Create `app/auth/jwt.py`, `tests/auth/test_jwt.py`

**Interfaces:**
- Produces: `async verify_token(token: str) -> dict` (returns validated claims; raises `AuthError` on
  bad signature/issuer/audience/expiry). Reads `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID_SPA`.

- [ ] **Step 1: Failing test** — sign a token with a test RSA key served via a fake JWKS; assert
  `verify_token` returns claims for a valid token and raises `AuthError` for wrong issuer / expired.
```python
def test_verify_valid_token(fake_jwks, valid_token): 
    claims = anyio.run(verify_token, valid_token)
    assert claims["sub"] == "user-123"
def test_verify_rejects_expired(fake_jwks, expired_token):
    with pytest.raises(AuthError): anyio.run(verify_token, expired_token)
```
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** JWKS fetch+cache from `OIDC_ISSUER_URL/protocol/openid-connect/certs`,
  validate signature/`iss`/`aud`/`exp` with python-jose.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(auth): keycloak jwt validation`.

### Task 2: Principal + group→role mapping (RBAC core)

**Files:** Create `app/auth/principal.py`, `tests/auth/test_principal.py`

**Interfaces:**
- Consumes: claims from Task 1.
- Produces: `Principal(sub, username, groups: list[str], roles: set[str], teams: set[str])`;
  `build_principal(claims) -> Principal` using a **group→role map** from config
  (`ROLE_GROUP_MAP` — inputs §1 decision). Union of matched roles. **[R]**

- [ ] **Step 1: Failing test** — a user in groups `[platform-admins, owners-payments]` maps to roles
  `{platform-admin}` and teams `{payments}`; union semantics verified with two groups.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the mapping (config-driven), deny-takes-precedence for conflicts.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(auth): principal + group→role rbac`.

### Task 3: FastAPI auth dependencies

**Files:** Create `app/auth/deps.py`, `app/api/me.py`, `tests/auth/test_deps.py`

**Interfaces:**
- Produces: `current_principal` (dep, 401 if no/invalid token), `require_role("platform-admin")`,
  `require_any("service-owner","platform-admin")` (403 if missing). `GET /api/me` → principal JSON.

- [ ] **Step 1: Failing test** — protected route returns 401 without token, 403 with wrong role, 200
  with right role; `/api/me` returns roles/teams.
- [ ] **Step 2–4:** implement deps using Tasks 1–2; tests pass.
- [ ] **Step 5: Commit** `feat(auth): rbac fastapi dependencies + /api/me`.

### Task 4: SPA login (PKCE) + guard + role-gated UI

**Files:** Create `src/lib/auth.ts`, `src/app/guard.tsx`, tests

**Interfaces:**
- Produces: `login()`, `logout()`, `useAuth()` → `{principal, hasRole}`; `<RequireAuth>` route guard;
  helper `hasRole(r)` for show/hide (display only).

- [ ] **Step 1: Failing test** — guard redirects unauthenticated to login; `hasRole` hides an
  admin-only button for a requester.
- [ ] **Step 2–4:** implement OIDC/PKCE (oidc-client-ts) against `OIDC_ISSUER_URL`/
  `OIDC_CLIENT_ID_SPA`; store access token in memory, refresh via BFF session cookie; call `/api/me`.
- [ ] **Step 5: Commit** `feat(web): oidc pkce login, route guard, role gating`.

## Env vars used
`OIDC_ISSUER_URL`, `OIDC_CLIENT_ID_SPA`, `OIDC_CLIENT_ID_BFF`, `OIDC_CLIENT_SECRET_BFF`,
`OIDC_GROUPS_CLAIM`, `SESSION_SECRET`, `ROLE_GROUP_MAP` (inputs §1).

## Blocks on inputs
§1 group→role map, owner-team convention, `groups` claim confirmed on tokens.

## Exit / DoD
A real Keycloak user logs in, `/api/me` shows correct roles/teams derived from AD groups, a
protected endpoint enforces 401/403 correctly, and the SPA hides controls the user can't use.
