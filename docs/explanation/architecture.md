# Explanation: architecture

The platform is a set of Backstage plugins over three external systems — an
identity provider (Keycloak → LDAP), a Git catalog (Gitea), and a workflow engine
(Argo). Backstage is the control plane; it never does provisioning itself.

```
        ┌─────────────────────────── Backstage ───────────────────────────┐
 user ─▶│  shadcn UI (platform-ui)   pages/cards (platform-requests)       │
        │  requests-backend: state machine · Argo client · resolvers ──────┼─▶ Argo Workflows
        │  scaffolder action · builder-backend · rbac policy               │      │
        └───────┬───────────────────────────────────┬──────────────────────┘      │
                │ OIDC                                │ catalog (Users/Groups/       ▼
                ▼                                     │ Resources/Templates)   writes Git
            Keycloak ──federates──▶ LDAP              └───────────────▶ Gitea ◀────┘
```

## Why this shape

- **Backstage is the control plane, not the data plane.** A request records
  *intent*; the Argo workflow is what actually changes the world (and writes Git).
  This keeps the UI/backend stateless about infrastructure and makes every change
  auditable as a request + a workflow run.
- **Git is the source of truth** for the catalog (resources, templates, docs).
  The workflow is the *only* writer at runtime — see
  **[Workflows own Git](workflows-and-git.md)**.
- **Identity is external.** Keycloak provides SSO; LDAP is the user/group store.
  Backstage ingests the same users/groups into its catalog, which drives RBAC —
  see **[Identity & LDAP](identity-and-ldap.md)**.

## The new frontend/backend systems

Everything is registered through Backstage's **Blueprints** and **extension
points** (not by patching core): `PageBlueprint`, `EntityCardBlueprint`,
`EntityContentBlueprint`, `FormFieldBlueprint`, `SignInPageBlueprint`,
`ThemeBlueprint`, `NavContentBlueprint` on the frontend; `createBackendPlugin` /
`createBackendModule` + `scaffolderActionsExtensionPoint`, `policyExtensionPoint`,
`catalogProcessingExtensionPoint` on the backend. This is what makes the suite
upgrade-stable — see **[Upgrade Backstage](../how-to/upgrade-backstage.md)**.

## Why the relations graph is bounded

Rooting the graph on one entity and following every relation reaches the
**whole catalog**, on any real instance. The chain is short and entirely
ordinary:

```
resource --ownedBy--> group --hasMember--> user --ownerOf--> every other resource
```

Ownership is what bridges unrelated parts of the estate, so an unbounded walk
from a single database ends up drawing the marketing site. The default depth is
therefore **2** — the entity, its neighbours, and one hop beyond, which is the
range where a relation still says something about the thing you started from.

This is invisible in development. A seeded catalog of a dozen entities looks
identical bounded or not; the failure only appears once there are enough
entities for the ownership bridge to matter, which is to say, in production.

Depth is a URL parameter (`maxDepth`), so a deeper or unbounded view is one
change in the filters — `∞` is still available, it is simply no longer what you
get by arriving from a resource page.

## Conventions that glue it together

- `platform.io/*` **[annotations](../reference/annotations.md)** on templates and
  resources (type, verb workflows, data ref).
- `<< token >>` **[submit tokens](../reference/tokens.md)** resolved by the backend.
- The **`git-ops`** workflow as the single create/update/delete Git writer.

These are *ours*, so they don't move when Backstage upgrades.
