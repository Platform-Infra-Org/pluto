# 00 — Overview

## Problem

The platform team runs backend workflows (Argo Workflows) that create, update, and delete
infrastructure resources and services. Today there is no self-service surface: users cannot see
what resources exist, cannot request changes safely, and there is no structured approval or
feedback loop. The new UI is that surface.

## Goals

1. **Visibility** — a user sees the resources/services relevant to them, sourced from the Git repo
   that stores each resource as a JSON file.
2. **Self-service change** — a user submits create / update / delete requests through forms, not by
   hand-editing Git.
3. **Governed approval** — every request routes to the owning team (each resource/service has a
   service-owner team); nothing executes without approval.
4. **Execution + feedback** — an approved request triggers an Argo Workflow; the user sees live
   progress and, on failure, exactly which step failed and why.
5. **Enterprise auth** — login via Keycloak/SSO, with identities federated from AD/LDAP, and RBAC
   controlling what each user can see and do.
6. **Notifications** — an in-app notification center tells users when their request needs approval,
   was approved/rejected, or finished (success/error).
7. **Self-service onboarding** — service owners define the request form for their own service/
   resource type in a **Service Request Builder**; platform admins approve the service before it
   becomes requestable. (See [10](10-service-request-builder.md).)

## Non-goals (initial)

- Replacing Git as the source of truth — the repo stays authoritative for resource state, and the
  **Argo Workflow is the sole writer to it; the UI only reads from Git**. **[decided]**
- Building a general workflow authoring UI — Argo templates are authored by the platform team, not
  end users. **[D]**
- Multi-channel notifications (email/Slack) — in-app first; other channels are a later add-on that
  the notification design leaves room for. **[D]**
- Editing resources directly in Git through the UI without a request+approval — all writes go
  through the request lifecycle.

## Personas

| Persona | Needs |
|---------|-------|
| **Requester** (developer) | Find their resources, submit change requests, track outcome. |
| **Service owner** | Approve change-requests for services their team owns; **author the request form for their service type** in the builder and submit it for onboarding. |
| **Platform admin** | Manage RBAC, service→team ownership, workflow templates; **approve service-onboarding requests**; a single **admin dashboard** over everything (requests, services, workflows, RBAC, audit). |
| **Auditor** (read-only) | Review request history and who approved what. **[D]** |

## Key decisions at a glance

| Area | Decision | Tag |
|------|----------|-----|
| Architecture | Web SPA + a Backend-for-Frontend (BFF); Git repo is the read source, Postgres holds requests/notifications/RBAC-cache | [D] |
| Frontend | React + TypeScript + Vite, TanStack Query/Router, **headless** components (shadcn/ui + Tailwind) + TanStack Table for data-dense views | [decided] |
| Service builder | Visual form builder → **JSON Schema** Service Definitions; onboarding approved by admins ([10](10-service-request-builder.md)) | [decided] |
| Backend | **Python/FastAPI BFF** (platform team is Python-first; Hera/K8s clients, OpenAPI→TS types) — Go only if high streaming concurrency ever demands it | [decided] |
| Auth | Keycloak as OIDC provider, federating AD/LDAP; Authorization Code + PKCE in the browser | [R] |
| RBAC | Keycloak realm roles (portal-wide) + client roles / groups (per-service); `groups` claim → backend authorization, union-of-permissions | [R] |
| Approvals | **Per-resource policy** — `SINGLE` / `N_OF_M(n)` / `RBAC` — set on the Service Definition, overridable per resource (dynamic types, not hardcoded); `platform-admin` bypass, audit-logged | [decided] |
| Admin dashboard | Single console over everything — all requests/approvals, services & onboarding, workflow runs, RBAC/ownership, option-source health, audit ([E09](epics/E09-hardening.md)) | [decided] |
| Git writes | **Argo Workflow is the sole writer to Git; UI only reads** | [decided] |
| Execution | Argo Workflows REST API — submit on approval, watch `/workflow-events`, read `status.nodes` for failed step | [R] |
| Real-time | Server-Sent Events (SSE) for both workflow status and the notification feed | [R] |
| Catalog model | Build our own thin catalog over the Git JSON (Backstage/Port studied as reference, not adopted) | [R]/[D] |

See [02-tech-stack.md](02-tech-stack.md) for rationale, [09-research-findings.md](09-research-findings.md) for citations.
