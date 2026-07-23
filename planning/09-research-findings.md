# 09 — Research Findings (cited)

Basis for the plan. Produced by a fan-out deep-research pass: 5 search angles → 24 sources fetched →
103 claims extracted → 25 adversarially verified (3-vote, need 2/3 to kill) → **24 confirmed, 1
refuted**. Confidence reflects source quality: **high** = primary/official docs; **medium** =
corroborated secondary/blog.

## Confirmed findings

### Argo Workflows integration — HIGH
- Argo **ships a REST/HTTP API server** (default port **2746**, configurable auth). Submit:
  `POST /api/v1/workflows/{namespace}` (create) or `.../{namespace}/submit` (from template). Read:
  `GET /api/v1/workflows/{namespace}/{name}` returns spec + **`status` + `status.nodes`**, each node
  holding per-step phase/message → identifies the failed step. Stream live status:
  `GET /api/v1/workflow-events/{namespace}` (watch).
  - Sources: argoproj.github.io/argo-workflows/rest-api/ · argo-workflows.readthedocs.io/en/latest/rest-examples/ · github.com/argoproj-labs/argo-client-python
- The BFF authenticates with a **bearer token** when Argo runs with **`--auth-mode client`**
  (`Authorization: Bearer <token>`).
  - Source: argoproj.github.io/argo-workflows/rest-api/
- Caveats: submit body wraps the workflow under a top-level object (`{namespace, workflow:{…}}`); a
  pending workflow may omit `status.phase` until the controller first operates on it.

### Keycloak RBAC — HIGH
- Keycloak provides the RBAC primitives: **realm roles** (global), **client roles** (per-client
  namespace), **composite roles** (hierarchy), and **groups with role mappings** (members inherit).
  - Source: docs.redhat.com — Red Hat build of Keycloak, Server Admin Guide (roles & groups)

### Keycloak AD/LDAP federation — HIGH
- Keycloak **federates AD/LDAP**: validates credentials against the directory **in real time at
  login**, keeps a **local cached user representation** (no password import); **READ_ONLY /
  WRITABLE / UNSYNCED** edit modes; periodic/on-demand sync.
  - Sources: docs.redhat.com · docs.alauda.io/keycloak/26.4 · oneuptime.com · skycloak.io
- **AD/LDAP groups map to Keycloak roles/groups** (group-ldap-mapper / role-ldap-mapper) so
  directory-group membership confers portal permissions — fits service-owner-team modeling.
  - Sources: skycloak.io · docs.redhat.com

### Keycloak as identity broker — HIGH
- Keycloak brokers external IdPs over **OIDC and SAML 2.0** (SP to upstream IdP, IdP to its clients)
  — one SSO integration point for the portal.
  - Source: docs.alauda.io/keycloak/26.4

### SSO groups → RBAC — HIGH (one sub-claim MEDIUM)
- Add a Keycloak **Group Membership mapper** → OIDC **`groups` claim**; the backend matches group
  names to roles and grants the **union** of matched permissions (the **ArgoCD RBAC pattern**,
  deny-takes-precedence). The exact `groups` claim *name* is a **convention (configurable)**, not
  mandated — that sub-claim was the only split vote (2-1).
  - Source: oneuptime.com — ArgoCD map SSO groups to RBAC roles

### Real-time transport — HIGH
- For **live workflow status and the in-app notification feed, prefer SSE over WebSockets**: both
  are server-push, SSE is unidirectional (sufficient when the client only listens), HTTP-native,
  auto-reconnecting, ~half the code, no connection-state management. WebSockets remain the choice
  only if bidirectional interaction is later needed.
  - Source: docs.railway.com/guides/sse-vs-websockets (corroborated by WebSocket.org, MDN/WHATWG)

### GitOps catalog reference models — MEDIUM
- **Backstage** — self-hosted React+Node, catalog files discovered in Git, plugin-based RBAC,
  configurable OIDC/GitHub SSO, TypeScript plugin customization (150+ plugins); **heavy build (≈2–4
  FTE, 3–6 months)**.
- **Port** — API-first SaaS, JSON-schema blueprint catalog, built-in granular RBAC + SSO, low-code
  UI; **light build (≈2–4 weeks)**.
- Effort figures are soft (blog-quality, Port numbers partly vendor-affiliated); the qualitative
  catalog-model distinctions are corroborated by primary docs.
  - Sources: lucaberton.com/blog/backstage-vs-port-2026 · kubernetesguru.com/internal-developer-platform-tools-2026

## Refuted (dropped)
- "Backstage requires Scaffolder YAML while Port needs no code for self-service actions" — **refuted
  1-2**; the specific self-service-provisioning comparison did not hold up.

## Open questions the research did NOT settle
These drive the **[D]** (design-decision) tags across the plan — sound recommendations, not verified
findings:
1. **Frontend framework/component library** — no verified claim on React/Next/Vite/TanStack choice
   or data-dense component libraries. (See [02](02-tech-stack.md).)
2. **Approval-workflow modeling** — no verified claim on multi-team approval state/schema/routing.
   (See [05](05-approvals.md).)
3. **Kratix** — named as a comparison point but produced zero surviving claims.
4. **Notification architecture beyond SSE transport** — persistence, read/unread, fan-out, delivery
   guarantees not covered by verified claims. (See [07](07-notifications.md).)

## Method caveats
Primary-doc findings (Argo API, Keycloak RBAC/federation) are high-confidence. SSE-vs-WebSockets and
Keycloak-brokering lean on well-corroborated secondary docs. Backstage-vs-Port rests on 2026 blogs —
directionally reliable, exact numbers soft. Keycloak specifics reference 26.x (2026-current); Argo
API is stable on main.
