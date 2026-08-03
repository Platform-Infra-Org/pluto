# Explanation: identity & LDAP

Users and groups live in **LDAP**. Two systems consume that directory, for two
different purposes.

```
LDAP user ──login──▶ Keycloak (SSO) ──federates──▶ OpenLDAP   ← the user store
                          │                              │
                    OIDC token (email)             users + groups
                          ▼                              │
                      Backstage  ◀──ingests Users+Groups─┘
                          │
              email local-part → catalog User(uid) → groups → RBAC
```

## Two consumers, two jobs

- **Keycloak federates to LDAP** for **authentication** — the LDAP bind checks the
  password. Backstage's SSO (OIDC) is unchanged; it just talks to Keycloak, which
  now delegates to LDAP.
- **Backstage ingests LDAP** (the `catalog-backend-module-ldap` provider, config
  under `catalog.providers.ldapOrg`) for **identity + groups** — it creates
  `User` and `Group` catalog entities with membership relations, on a schedule.

## Why both

Keycloak needs to know the users to authenticate them; Backstage needs them in its
*catalog* to resolve identity and RBAC (which read `ownershipEntityRefs`, i.e.
catalog group membership). LDAP is the single source both draw from.

## The join: email local-part == uid

The OIDC sign-in resolver is `emailLocalPartMatchingUserEntityName`. The LDAP
provider maps the catalog **User entity name = `uid`**, and the user's email is
`uid@…`. So a login as `sam@platform.dev` resolves to the catalog User `sam`,
whose `memberOf` groups (from LDAP `groupOfNames`) become the identity's
`ownershipEntityRefs` — which drive **[per-team RBAC](rbac.md)**. Confirm this
join (email local-part == uid) holds in your real directory, or switch to a
resolver keyed on a stable claim.

## Moving to a real directory

The demo uses a small OpenLDAP seeded from an LDIF. For production: repoint
`connectionUrl` (Keycloak federation) and `catalog.providers.ldapOrg.target`
(Backstage) at your directory, use **LDAPS**, and a real bind secret — the mapping
and resolver carry over unchanged.
