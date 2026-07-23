# Platform new-ui — Planning

New frontend + BFF for an internal developer self-service portal over Argo Workflows.

Users browse resources/services (stored as JSON in a Git repo), submit create/update/delete
requests, those requests are approved by the owning team, and approval triggers an Argo Workflow
whose live status (including which step failed) is shown back to the user. Auth via Keycloak
(federating AD/LDAP), RBAC in the UI, and an in-app notification center.

## Read order

| Doc | What it covers |
|-----|----------------|
| [00-overview.md](00-overview.md) | Goals, personas, scope, key decisions at a glance |
| [01-architecture.md](01-architecture.md) | System components, data flow, read vs write model |
| [02-tech-stack.md](02-tech-stack.md) | Frontend + BFF stack, component library, data store |
| [03-auth-rbac.md](03-auth-rbac.md) | Keycloak + AD/LDAP, OIDC login, RBAC model |
| [04-resource-catalog.md](04-resource-catalog.md) | Git-backed catalog, browsing, CRUD requests |
| [05-approvals.md](05-approvals.md) | Request lifecycle, service-owner-team approval |
| [06-argo-integration.md](06-argo-integration.md) | Triggering workflows, live status, failed-step reporting |
| [07-notifications.md](07-notifications.md) | In-app notification center, delivery, events |
| [10-service-request-builder.md](10-service-request-builder.md) | Service owners build their own forms; admins approve onboarding |
| [08-roadmap.md](08-roadmap.md) | Phased delivery plan |
| [09-research-findings.md](09-research-findings.md) | Cited research the plan is grounded in |

## Legend

- **[R]** = backed by a verified research finding (see 09) with citation.
- **[D]** = a design decision made in this plan; sound but not independently researched. Open to change.

## Status

Draft — awaiting review. Frontend framework, backend language, and DB are recommendations, not
locked. Anything marked **[D]** is the first thing to confirm or override.
