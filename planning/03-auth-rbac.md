# 03 — Auth & RBAC

This is the most research-backed area of the plan. Citations in [09](09-research-findings.md).

## Identity: Keycloak federating AD/LDAP

- **Keycloak is the single SSO integration point.** It acts as an OIDC/SAML identity broker — the
  portal integrates with Keycloak once, and Keycloak brokers any upstream IdP. **[R]**
- **AD/LDAP federation:** Keycloak's LDAP User Federation validates credentials against AD/LDAP **in
  real time at login** and keeps a **local cached user representation** (passwords are never
  imported). Use **READ_ONLY** edit mode — the portal never writes back to the directory. Full sync
  runs periodically / on demand. **[R]**
- **Group/role sync:** a **group-ldap-mapper** propagates AD group membership into Keycloak groups;
  a **role-ldap-mapper** can map directory groups directly to Keycloak roles. This is the mechanism
  that turns "AD group `TeamX-Owners`" into a portal permission. **[R]**

## Browser login flow

1. SPA redirects to Keycloak, **OAuth2 Authorization Code + PKCE** (no client secret in browser). **[D]**
2. Keycloak authenticates the user (against AD/LDAP), issues ID + access tokens.
3. SPA stores tokens (in-memory + refresh via Keycloak; avoid localStorage for the access token). **[D]**
4. Every BFF call carries the access token; **the BFF validates the JWT** (signature, issuer,
   audience, expiry) and reads claims. **[D]**

## RBAC model

Built on Keycloak's four primitives — **all verified** **[R]**:

| Primitive | Used for |
|-----------|----------|
| **Realm roles** (global) | Portal-wide roles: `platform-admin`, `requester`, `auditor`. |
| **Client roles** (namespaced to a client) | Per-service permissions when we want them scoped. |
| **Composite roles** | Hierarchy without duplication (e.g. `platform-admin` composes `requester` + `approver-*`). |
| **Groups with role mappings** | Service-owner **teams** — members inherit the team's role mappings. |

### The `groups` claim → backend authorization **[R]**

- Add a Keycloak **Group Membership mapper** so the OIDC token carries a **`groups` claim** (claim
  name is a convention, configurable). **[R — with the caveat that the exact `groups` string is not mandated]**
- The BFF reads the `groups` claim and matches group names to internal permissions, granting the
  **union** of all matched permissions (deny-takes-precedence for conflicts) — this is the proven
  **ArgoCD RBAC pattern**. **[R]**
- Authorization is **always enforced in the BFF**, never trusted from the client. The SPA uses the
  same claims only to show/hide UI; the server is the gate. **[D]**

### Portal roles (proposed) **[D]**

| Role | Can |
|------|-----|
| `requester` | Browse resources they have visibility to; submit create/update/delete requests. |
| `approver:<team>` | Approve/reject requests for resources owned by `<team>` (derived from group membership). |
| `platform-admin` | Everything: manage ownership map, templates, RBAC config, view all requests. |
| `auditor` | Read-only access to requests/approvals history. |

### Service-owner-team → approval authorization

- Each resource maps to an **owner team** (from resource JSON metadata or an ownership config; see
  [04](04-resource-catalog.md)). **[D]**
- A request for resource `R` may be approved only by users whose `groups` claim includes `R`'s owner
  team (or by `platform-admin`). This ties directly to [05 — Approvals](05-approvals.md). **[D + R for the group-claim mechanism]**

## What to configure in Keycloak (checklist)

- [ ] Realm for the portal; OIDC **public client** (PKCE) for the SPA; optional confidential client
      for the BFF if it needs its own service tokens.
- [ ] LDAP User Federation → AD, READ_ONLY, with group-ldap-mapper (+ role-ldap-mapper if mapping
      directly to roles).
- [ ] Realm roles (`platform-admin`, `requester`, `auditor`) and composite role wiring.
- [ ] Group Membership mapper emitting the `groups` claim on the SPA client's tokens.
- [ ] Owner-team groups aligned with AD groups so directory membership drives approver rights.

## Argo access is separate from user auth

The BFF authenticates to **Argo** with its own **ServiceAccount bearer token** (`--auth-mode
client`), independent of the end user's OIDC token. User authorization happens in the BFF *before*
it calls Argo. See [06](06-argo-integration.md). **[R]**
