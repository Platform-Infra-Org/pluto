# Implementation Epics

Detailed implementation plan for the Platform new-ui, decomposed from the design in
[`../`](../README.md) into **epics** — each an independently executable plan that produces working,
testable software on its own.

> **For agentic workers:** each epic uses `- [ ]` step syntax. Execute an epic task-by-task with
> `superpowers:subagent-driven-development` (fresh subagent per task + review) or
> `superpowers:executing-plans` (inline with checkpoints).

## Start here

**[00-inputs-and-environment.md](00-inputs-and-environment.md)** — the access, endpoints, secrets,
env vars, and policy decisions I need from you. Several epics are blocked until parts of it are
answered.

## Epics & sequencing

| Epic | Title | Depends on | Design source |
|------|-------|-----------|---------------|
| [E01](E01-foundations.md) | Foundations & scaffolding (SPA + FastAPI + Postgres + CI/deploy) | — | 01, 02 |
| [E02](E02-auth-rbac.md) | AuthN/AuthZ — OIDC/PKCE, JWT, `groups`→RBAC | E01 | 03 |
| [E03](E03-argo-service.md) | Argo integration service — submit / watch / failed-step | E01 | 06 |
| [E04](E04-catalog.md) | Resource catalog — Git sync, index, browse UI | E01, E02 | 04, 01 |
| [E05](E05-requests-approvals.md) | Requests & approvals — state machine, per-resource policy engine, bypass | E02, E04 | 05 |
| [E06](E06-execution.md) | Execution wiring — approval → Argo → Git → live status | E03, E05 | 06, 01 |
| [E07](E07-notifications.md) | In-app notifications — SSE, inbox, fan-out | E02, E05 | 07 |
| [E08](E08-service-builder.md) | Service Request Builder & onboarding + server-backed fields | E05, E06 | 10 |
| [E09](E09-hardening.md) | **Admin dashboard over everything** + hardening (audit, resilience, observability, a11y) | E05–E08 | 08 |

## Feature epics (built on E01–E09)

| Set | Title | Design |
|-----|-------|--------|
| [composable-builder/](composable-builder/README.md) | **Composable Service Builder** — graph editor that generates Argo WorkflowTemplates (CB01–CB05) | [11](../11-composable-service-builder.md) |

## Dependency graph

```
E01 ─┬─▶ E02 ─┬─▶ E04 ─▶ E05 ─┬─▶ E06 ─┐
     │        │               │        ├─▶ E08 ─▶ E09
     └─▶ E03 ─┘               └─▶ E07 ─┘
```

Critical path: **E01 → E02 → E04 → E05 → E06 → E08**. E03 parallels E02; E07 parallels E06.

## Conventions used in every epic

- **TDD:** each task is write-failing-test → run(fail) → implement → run(pass) → commit.
- **Stack (decided):** React+Vite+TS (headless: shadcn/ui + Tailwind + TanStack) SPA; Python/FastAPI
  BFF; Postgres; Keycloak; Argo; SSE. See [../02-tech-stack.md](../02-tech-stack.md).
- **Tags:** `[R]` research-backed, `[D]` design decision, `[decided]` locked with the user. Traceable
  to the design docs.
- **Definition of done (per epic):** all tasks' tests green, lint/type-check clean, deployed to dev,
  and the epic's "Exit" acceptance walkthrough passes.

## Global constraints (apply to all epics)

- **Git is read-only from the app.** The BFF/SPA never commit/push; the **Argo Workflow is the sole
  Git writer**. Any task that "writes a resource" means "submit a workflow that writes it."
- **Authorization is enforced server-side** in the BFF on every mutating call; the SPA's use of
  claims is display-only.
- **Secrets** come from env/K8s Secrets, never Git or the SPA bundle.
- **Approvals:** per-resource, data-driven policy — `SINGLE` / `N_OF_M(n)` / `RBAC` — set on the
  Service Definition, overridable per resource (types are dynamic, never hardcoded); `platform-admin`
  bypass is always audit-logged.
- **Two approval lanes** share one state machine, keyed by `Request.kind`
  (`RESOURCE_CHANGE` → owner team; `SERVICE_ONBOARDING` → admins).
