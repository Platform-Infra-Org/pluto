# Platform Plugin Suite

An internal developer platform, built as a suite of Backstage plugins. Developers
request resources from a self-service catalog; requests go through **approval**,
run an **Argo Workflow** that provisions the resource in **Git**, and are tracked
to completion — all in a modern shadcn UI, with identity and per-team access
control sourced from **LDAP**.

## What's here (Diátaxis)

This documentation is organised the [Diátaxis](https://diataxis.fr) way — pick by
what you're trying to do:

| If you want to… | Go to |
|---|---|
| **Learn** by doing, end to end | **[Tutorials](tutorials/provision-a-resource.md)** |
| **Accomplish a specific task** | **[How-to guides](how-to/author-a-template.md)** |
| **Look up** a fact (a config key, an annotation, a token) | **[Reference](reference/plugins.md)** |
| **Understand** how and why it works | **[Explanation](explanation/architecture.md)** |

## The suite at a glance

- **Request management** — a create/update/delete request with an approval state
  machine, per-team RBAC, notifications, and a live status view.
- **Argo provisioning** — every request submits an Argo Workflow; the request is
  only "done" once the workflow succeeds (completion gating). The workflow is the
  sole writer of the catalog Git repo.
- **Service / graph builder** — author a software template (and its workflow)
  from a form or a composable graph, published to Git + Argo.
- **Design system** — a shadcn reskin, custom nav, live colour picker, and a
  collapsible JSON viewer, all as one UI plugin.
- **Identity** — Keycloak (SSO) federates to LDAP; Backstage ingests LDAP users
  and groups, which drive per-team approvals.

See **[Architecture](explanation/architecture.md)** for the big picture and
**[Plugins](reference/plugins.md)** for the package-by-package breakdown.
