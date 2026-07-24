# Running the platform end-to-end (local integration stack)

Stands up the whole thing — Postgres, Keycloak (OIDC), MinIO (S3), the BFF, and
the SPA — so it can be API- and browser-verified. **Argo is intentionally not
wired** (no Kubernetes here), so the approval → Argo → execute path stays
mocked/deferred; everything up to `APPROVED` is live.

## Prerequisites
- Docker + Docker Compose
- `uv` (Python) and `pnpm` (Node) on the host
- Ports free on the host: `5432` (Postgres), `8080` (Keycloak), `9000/9001` (MinIO), `8000` (BFF), `5173` (SPA)

## Start / stop

```bash
scripts/dev-up.sh      # compose up db+keycloak+minio, wait for Keycloak,
                       # alembic upgrade head, index the seed catalog, start BFF on :8000
scripts/dev-down.sh    # stop the BFF and tear the compose stack down
```

`dev-up.sh` runs the **BFF on the host** (uvicorn), not in Docker, on purpose:
the OIDC token `iss` is `http://localhost:8080/realms/platform`, and running on
the host makes the issuer the BFF validates against match the issuer the browser
and tokens use.

Config lives in `.env.integration` (gitignored; throwaway dev creds). `dev-up.sh`
substitutes the repo path into it and sources it into the BFF/alembic process.

## URLs
- BFF API: `http://localhost:8000`  (health: `GET /healthz`, logs: `.bff.log`)
- Keycloak: `http://localhost:8080`  (admin console: `admin` / `admin`)
- MinIO: `http://localhost:9000`  (console `http://localhost:9001`, `minioadmin` / `minioadmin`)
- SPA: run `pnpm --dir apps/web dev` then open `http://localhost:5173`
  (SPA reads `apps/web/.env` — public dev OIDC/API config).

## Realm & test users (Keycloak realm `platform`)

Clients: `platform-ui` (public SPA, PKCE S256, direct access grants) and
`platform-bff` (confidential, secret `bff-dev-secret`). Tokens carry a `groups`
claim and include `platform-ui` in `aud` (both via client mappers).

| User | Password | Group | Resolves to |
|------|----------|-------|-------------|
| `admin` | `admin` | `platform-admins` | role `platform-admin` |
| `requester` | `requester` | `owners-payments` | team `payments` |
| `auditor` | `auditor` | `platform-auditors` | role `auditor` (read-only) |

Group `service-owner` also exists (→ role `service-owner`). The
`ROLE_GROUP_MAP` in `.env.integration` maps these groups → roles/teams.

Get a token by password grant (what the smoke test does):

```bash
curl -s -X POST http://localhost:8080/realms/platform/protocol/openid-connect/token \
  -d grant_type=password -d client_id=platform-ui \
  -d username=admin -d password=admin -d scope=openid
```

## Authenticated API smoke test

```bash
scripts/api-smoke.sh   # requires the stack to be up; prints PASS/FAIL summary
```

It acquires real Keycloak tokens and asserts: health, `/api/me` principal
mapping, admin-endpoint RBAC (200 admin / 403 requester), catalog listing,
RESOURCE_CHANGE submission routed to the owner-team approval queue, and
notifications.

## Browser login flow
Start the SPA (`pnpm --dir apps/web dev`), open `http://localhost:5173`, click
**Login** in the header → Keycloak → back through `/auth/callback` → the
principal loads from `/api/me`. Note: the access token is held in memory only,
so a hard page reload requires logging in again (acceptable for verification;
a BFF refresh-cookie endpoint would remove this).
