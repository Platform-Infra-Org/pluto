# 02 — Tech Stack

The research verified backend/auth/transport choices but flagged that **frontend framework and
component-library specifics were not covered by surviving verified claims** (see
[09](09-research-findings.md), open questions). So this doc separates the well-grounded picks from
the reasoned recommendations.

## Frontend

**Recommendation: React + TypeScript + Vite (SPA).** **[D]**

- This is an authenticated internal tool. There's no SEO or public-page SSR need, so a Next.js
  server runtime adds ops surface for little gain. A Vite SPA served as static assets + the BFF is
  simpler to build, deploy, and reason about. (TanStack Start — full-stack React on Vite, hit RC in
  early 2026 — is a credible alternative if we later want server functions/streaming SSR.)
- **Routing + data:** TanStack Router (type-safe) + **TanStack Query** for server-state
  (caching, background refetch, mutations). TanStack Query pairs naturally with the request/approval
  mutation model.
- **Real-time:** native `EventSource` (SSE) for workflow status and notifications — no extra client
  library, built-in auto-reconnect. **[R]**

### Component library — two viable routes **[D]**

**Decision: headless — shadcn/ui (Radix primitives) + Tailwind + TanStack Table.** **[decided]**

The trade is **control vs. speed**. *Batteries-included* ships fully-styled components — fastest to
a working UI, but every screen looks like the library and custom behavior means fighting its API.
*Headless* ships behavior + accessibility but no styling: you render it, you own the look — more
work per component, but it scales cleanly to the custom, data-dense views this app is mostly made of
(JSON diffs, workflow step trees, approval queues, and the **service-request form builder** — see
[10](10-service-request-builder.md)). Chosen **headless** for that reason: invest early, control
forever.

| Route | Pick | Status |
|-------|------|--------|
| **Headless + own design** | shadcn/ui (Radix primitives) + Tailwind + **TanStack Table** for data grids | **Chosen** — full control, no vendor lock, accessible primitives. |
| Batteries-included | Mantine (or Ant Design) | Not chosen — faster start, but uniform look and edge-case friction. |

For the data-dense views (resource lists, request queues, workflow node trees), **TanStack Table**
(headless) is the default; escalate to **AG Grid** only if we hit enterprise-grid needs (pivot,
huge virtualized datasets). **[D]**

## Backend (BFF)

**Decision: Python (FastAPI).** **[decided]**

The BFF is a long-lived operational service the **platform team owns and maintains**, and that team
is Python-first. For a service its owners maintain, their language fluency is the dominant factor —
it outweighs the marginal native-client edge of Go. Every technical gap has a solid Python answer:

- **Argo access:** [Hera](https://github.com/argoproj-labs/hera) (argoproj-labs, actively
  maintained) to build/submit workflows, or the official generated `argo-workflows` Python client;
  the official **Kubernetes Python client** for in-cluster ServiceAccount auth. **[R — Argo ships
  the REST API these clients wrap]** *(Avoid the archived `argo-client-python` repo; use Hera / the
  current `argo-workflows` package.)*
- **Shared types — actually easier here:** FastAPI auto-generates the **OpenAPI spec**, so the SPA
  generates TypeScript types from it for free. Pydantic validates request payloads (schema-driven
  forms).
- **SSE + async:** FastAPI is async; `sse-starlette` serves the long-lived workflow-status and
  notification streams. Git read-side pulls via GitPython/pygit2; OIDC via Authlib.
- **The one real trade-off — Python's lower per-process throughput under many concurrent long-lived
  connections (GIL/async overhead) — does not bite here.** An internal portal is tens-to-low-hundreds
  of users, far below where that matters; scale with a few replicas (the notification fan-out
  already assumes multiple replicas).

**Fallbacks if this is ever revisited (not chosen):**
- **Go** — only if the portal later faces genuinely high streaming concurrency or wants the most
  native Argo/K8s tooling (`argo-workflows` Go client + `client-go`, `go-git`) and the team accepts
  maintaining Go. A real but marginal edge at this scale.
- **Node/TypeScript (NestJS)** — viable (Argo is plain REST) but third: no team-fluency argument
  once the owners are Python-first.

## Data store

**Postgres.** **[D]** Holds:
- `requests` (+ state history / audit),
- `notifications` (+ read state),
- catalog **index** (materialized from Git for query/filter/search),
- cached RBAC / service→owner-team ownership (Keycloak stays the identity source).

Postgres covers relational queries, JSON columns for resource payloads (`jsonb`), and
`LISTEN/NOTIFY` if we want an easy multi-replica SSE fan-out (see [07](07-notifications.md)). No
second datastore needed initially — YAGNI on Redis/Elasticsearch until search/scale demands it. **[D]**

## Identity & real-time — grounded picks

| Concern | Choice | Basis |
|---------|--------|-------|
| SSO / IdP | Keycloak (OIDC), federating AD/LDAP | [R] |
| Browser login | OAuth2 Authorization Code + PKCE | [D] standard for SPAs |
| Server push (status + notifications) | **SSE**, not WebSockets (unidirectional server→client is sufficient) | [R] |
| Argo access | REST API, `--auth-mode client` bearer token | [R] |

## Summary stack

```
Frontend:  React + TypeScript + Vite · TanStack Router/Query/Table · shadcn/ui + Tailwind (headless) · EventSource
BFF:       Python/FastAPI (Hera/argo-workflows, k8s client, sse-starlette, pydantic, Authlib)  [alt: Go, then Node/NestJS]
Data:      Postgres (requests, notifications, catalog index, rbac cache)
Auth:      Keycloak + AD/LDAP federation, OIDC/PKCE
Realtime:  SSE
Runtime:   Kubernetes, alongside Argo Workflows
```
