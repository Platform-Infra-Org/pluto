# 00 — Inputs & Environment (what I need from you)

This is the prerequisite checklist for executing the epics. Everything here is something **only you
can provide** — access, endpoints, credentials, or a policy decision. Grouped by system, with the
exact **environment variable** name the BFF/SPA will read. Secrets go in Kubernetes Secrets / a
vault, **never** in Git or the SPA bundle.

Legend: 🔑 secret · 🌐 endpoint/config · 🧭 decision · ⛳ nice-to-have.

## When each input is actually needed

- **🔑 secrets and 🌐 endpoints → deploy-time.** These are *values*, not shape. Scaffolding and all
  tests run against local fixtures / placeholders; you drop real values into a Kubernetes Secret /
  `.env` at the **end** (per environment) and nothing in the code changes. No need to gather them up
  front.
- **🧭 decisions and naming conventions → needed now.** These shape the code (RBAC mapping,
  approval policy, repo layout), so they can't be deferred. Answered in §7 (policy) and the
  convention 🧭 items in §1/§3.

So: **populate env-var values last.** Lock the 🧭 decisions first — that's what the questions below cover.

---

## 1. Keycloak / SSO / LDAP  → Epic **E02**

| Var | Type | What / example |
|-----|------|----------------|
| `OIDC_ISSUER_URL` | 🌐 | Keycloak realm issuer, e.g. `https://keycloak.corp/realms/platform` |
| `OIDC_CLIENT_ID_SPA` | 🌐 | Public client for the SPA (PKCE, no secret), e.g. `platform-ui` |
| `OIDC_CLIENT_ID_BFF` | 🌐 | Confidential client for the BFF (if the BFF calls Keycloak Admin API) |
| `OIDC_CLIENT_SECRET_BFF` | 🔑 | Secret for the BFF confidential client |
| `OIDC_GROUPS_CLAIM` | 🌐 | Claim name carrying group membership (default `groups`) |
| `KEYCLOAK_ADMIN_BASE_URL` | 🌐 | Admin REST base for the **groups picker** field, e.g. `https://keycloak.corp/admin/realms/platform` |

**Decisions I need from you:**
- 🧭 **Group → role mapping table.** Which AD/LDAP (or Keycloak) group names map to which portal
  roles: `platform-admin`, `service-owner`, `requester`, `auditor`. Give me the exact group
  strings as they appear in the `groups` claim.
- 🧭 **Owner-team group convention.** How a resource's `owner_team` string corresponds to a
  Keycloak/AD group (e.g. `owner_team: "payments"` ⇢ group `platform-owners-payments`). Approval
  routing depends on this.
- 🧭 **Groups-picker scope.** Default is "only groups the requester belongs to" / a base-DN prefix.
  Tell me the base DN or group prefix to expose, or confirm the default.

**LDAP/AD federation** is configured **inside Keycloak** (not the BFF), so I don't need bind
credentials — but I need confirmation that: federation is set up, the `groups` claim is emitted on
the SPA client's tokens, and READ_ONLY mode is used. If *you* want me to script the Keycloak realm
setup, I'll additionally need: LDAP host, bind DN + password 🔑, users/groups base DN.

---

## 2. Argo Workflows  → Epics **E03, E06**

| Var | Type | What / example |
|-----|------|----------------|
| `ARGO_SERVER_URL` | 🌐 | e.g. `https://argo-server.argo.svc:2746` (in-cluster) |
| `ARGO_NAMESPACE` | 🌐 | Namespace workflows run in, e.g. `platform-workflows` |
| `ARGO_AUTH_TOKEN` | 🔑 | Bearer token for `--auth-mode client` (from a ServiceAccount or `argo auth token`) |
| `ARGO_VERIFY_TLS` | 🌐 | `true`/`false` (self-signed in-cluster?) + CA bundle path if needed |

**Decisions / artifacts I need:**
- 🧭 **WorkflowTemplates.** For each resource action (create/update/delete), the name of the Argo
  `WorkflowTemplate` that performs it and **commits the resource JSON back to Git**. If these don't
  exist yet, I need one reference template to build against (E03 uses a deliberately-failing one to
  prove failed-step reporting).
- 🧭 **Parameter contract.** The parameter names each template expects (so the service-builder
  field→parameter mapping and the BFF submit payload line up).
- 🧭 Confirm the BFF's ServiceAccount is allowed to submit/watch workflows in `ARGO_NAMESPACE`
  (RBAC RoleBinding).

---

## 3. Git resource repo  → Epics **E04, E06, E08**

| Var | Type | What / example |
|-----|------|----------------|
| `GIT_REPO_URL` | 🌐 | The repo of resource JSONs, e.g. `https://git.corp/platform/resources.git` |
| `GIT_BRANCH` | 🌐 | Branch treated as source of truth, e.g. `main` |
| `GIT_READ_TOKEN` | 🔑 | Read-only token / deploy key for the BFF to pull & index |
| `GIT_WEBHOOK_SECRET` | 🔑 | Shared secret to verify push webhooks hitting the BFF |

**Decisions I need:**
- 🧭 **Repo layout.** Path convention for resources vs service definitions, e.g.
  `resources/<type>/<name>.json` and `definitions/<type>.json`. Give me the actual layout (or let me
  propose one).
- 🧭 **Owner-team source.** Is `owner_team` a field inside each resource JSON (`metadata.ownerTeam`),
  or a separate ownership map? (Plan defaults to in-JSON, else a config map.)
- 🧭 **Commit identity.** The bot name/email the **workflow** commits as (the workflow writes Git,
  not the BFF). Confirm the workflow has its own write credential (separate from `GIT_READ_TOKEN`).
- 🧭 Webhook wiring: can you add a push webhook on the repo pointing at `POST /api/git/webhook`?

---

## 4. Object store / Argo artifact repository  → Epic **E08 (file upload)**

Reused Argo artifact repo (decided — no separate bucket).

| Var | Type | What / example |
|-----|------|----------------|
| `ARTIFACT_S3_ENDPOINT` | 🌐 | e.g. `https://minio.platform.svc:9000` |
| `ARTIFACT_S3_BUCKET` | 🌐 | e.g. `platform-artifacts` |
| `ARTIFACT_S3_ACCESS_KEY` | 🔑 | |
| `ARTIFACT_S3_SECRET_KEY` | 🔑 | |
| `ARTIFACT_MAX_UPLOAD_MB` | 🌐 | Upload size cap, e.g. `25` |

- 🧭 Confirm the BFF may write to the same bucket Argo reads artifacts from, and the key prefix to
  use (e.g. `uploads/`).

---

## 5. Postgres  → all epics

| Var | Type | What / example |
|-----|------|----------------|
| `DATABASE_URL` | 🔑 | `postgresql://user:pass@host:5432/platform` |
| `DATABASE_POOL_SIZE` | 🌐 | e.g. `10` |

- 🧭 Provide a managed/HA Postgres, or should I include one in the deploy manifests for dev?

---

## 6. App runtime / deploy  → Epic **E01**

| Var | Type | What / example |
|-----|------|----------------|
| `APP_BASE_URL` | 🌐 | Public URL of the portal, e.g. `https://platform.corp` |
| `BFF_BASE_URL` | 🌐 | If SPA and BFF are on different hosts (else same-origin) |
| `CORS_ALLOWED_ORIGINS` | 🌐 | Comma-separated; usually just `APP_BASE_URL` |
| `SESSION_SECRET` | 🔑 | Signs the BFF session cookie holding the refresh token |
| `LOG_LEVEL` | 🌐 | `info` / `debug` |

**Decisions I need:**
- 🧭 **Deploy target.** Which cluster/namespace, ingress class, and TLS setup (cert-manager?).
- 🧭 **Container registry** to push SPA + BFF images to.
- 🧭 **CI system** (GitHub Actions / GitLab CI / other) so E01 wires the right pipeline.

---

## 7. Policy decisions — RESOLVED

| # | Decision | Answer | Epic |
|---|----------|--------|------|
| P1 | Approval quorum | **Per-resource, data-driven** — `SINGLE` / `N_OF_M(n)` / `RBAC`, set on the Service Definition, overridable per resource; **types are dynamic, not hardcoded** | E05/E08 |
| P2 | Retire a type with live resources | **Block until removed** | E08 |
| P3 | Admin emergency bypass in prod | **Enabled, audit-logged** | E05 |
| P4 | Auditor role in v1 | **Include (read-only)** | E05/E09 |

**One follow-up (non-blocking):** in `RBAC` mode, may a permitted requester **auto-approve their
own** request (default assumed), or must a *different* RBAC-permitted principal approve?

---

## 8. Access I need to actually build/test

- ⛳ A **dev/staging** Keycloak realm, Argo instance, and Git repo I can point the app at end-to-end
  (or docker-compose fixtures for each — I can stand these up locally if you prefer, but LDAP
  federation needs a reachable directory or a test LDAP).
- ⛳ Sample resource JSONs (2–3 real examples) so the catalog schemas and forms match reality.
- ⛳ One example external API for a **dynamic-choice** field, to test the poller against something real.

---

## How to hand this back

Fastest path: fill the env-var values into a `.env` / Kubernetes Secret and answer the 🧭 decisions
inline in this file (or in a reply). The epics are written so that **E01–E03 can start as soon as
sections 1, 2, 5, and 6 are answered**; catalog/approvals/etc. need section 3 too. I can begin
scaffolding (E01) with placeholders and swap real values in as they arrive.
