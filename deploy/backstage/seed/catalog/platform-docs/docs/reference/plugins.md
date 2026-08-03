# Reference: plugins

The suite is eight `@internal/*` workspace packages under `backstage/plugins/`.

| Package | Role | Responsibility |
|---|---|---|
| `plugin-platform-common` | common library | Shared types: `Request`, `ArgoSubmitSpec`, `ApprovalPolicy`, states, permission ids. Imported by all others. |
| `backstage-plugin-platform-requests-backend` | backend plugin | The core: request store + migrations, approval **state machine**, **Argo client**, completion-gating poll loop, notifications, resolvers (owner / verb-config / resource-data), REST router. |
| `plugin-platform-requests` | frontend plugin | Pages (Home, Requests, Request detail), the Resource entity **cards/tab** (relations graph, manage, resource data), the requests API client. |
| `plugin-platform-ui` | web library | The shadcn design system: injected CSS, colour picker, custom nav, themes, the `DynamicSelect` scaffolder field, the `JsonTree` viewer, the custom sign-in. |
| `backstage-plugin-scaffolder-backend-module-platform-actions` | scaffolder module | The `platform:request:submit` action. |
| `backstage-plugin-permission-backend-module-platform-rbac` | permission module | The coarse permission policy (auditors read-only; admin/auditor groups configurable). |

**Dependency order:** `platform-common` first (everyone depends on it);
`platform-ui` is depended on by `platform-requests` (frontend).

## Wiring

- Frontend features are registered in `packages/app/src/App.tsx`.
- Backend plugins/modules in `packages/backend/src/index.ts`.
- See **[Architecture](../explanation/architecture.md)** for how they fit together
  and **[Configuration](configuration.md)** for the config keys they read.
