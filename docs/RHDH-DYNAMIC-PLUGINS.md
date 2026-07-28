# Plan: convert the plugin suite to RHDH dynamic plugins

> **Targeting a specific release?** See [RHDH-1.9-MIGRATION.md](RHDH-1.9-MIGRATION.md)
> for the concrete **RHDH 1.9 / Backstage 1.45.3** plan and the keep-both-runnable
> (dev 1.53 + RHDH packaging) strategy. This doc is the general, version-agnostic
> per-plugin feasibility + best-practice reference.

Red Hat Developer Hub (RHDH) loads plugins **at runtime** — no rebuilding the app.
Backend plugins load via RHDH's backend plugin manager; frontend plugins load via
**Scalprum module federation**, wired by config (`dynamic-plugins.yaml`), not by
editing `App.tsx`. This changes how (and whether) each of our plugins converts.

## Feasibility at a glance

| Plugin | Kind | Convertibility | Effort |
|---|---|---|---|
| `platform-common` | shared lib | Bundled as a dependency (not a plugin itself) | trivial |
| `platform-requests-backend` | backend | **Clean** — new backend system → export-dynamic → OCI | low |
| `scaffolder-backend-module-platform-actions` | backend module | **Clean** | low |
| `platform-builder-backend` | backend | **Clean** | low |
| `permission-backend-module-platform-rbac` | permission module | **Clean** | low |
| `platform-requests` (pages, cards, tab, API) | frontend | **Adapt** — re-declare extensions as RHDH mount points | medium |
| `platform-builder` (builder UI) | frontend | **Adapt** — a dynamic route | medium |
| `platform-ui` — DynamicSelect field | frontend | **Clean** — `scaffolderFieldExtensions` | low |
| `platform-ui` — JsonTree / shared components | frontend | Bundled, imported by cards | low |
| `platform-ui` — theme/nav/color-picker/sign-in/global-CSS reskin | frontend shell | **Rethink** — RHDH owns the shell (see §4) | high / partial |

The backend converts almost for free (we're already on the new backend system).
The frontend converts with work. The **design-system shell is the hard part** —
RHDH manages the sidebar, header, theming, and sign-in, so a global-CSS reskin +
custom nav + app-root color picker + custom sign-in **fight the platform** and
break on RHDH upgrades. That's not RHDH-idiomatic; see §4.

## Two blocking constraints — read first

1. **Backstage version alignment.** RHDH pins a specific upstream Backstage
   version, and it **lags** current upstream. This repo is on Backstage **1.53**;
   the target RHDH release ships an older one. **You must align every `@backstage/*`
   dep to the target RHDH's Backstage version** and get `tsc` + tests green there
   *before* packaging. Treat this as Phase 0 — it's the biggest single task.

2. **Frontend extension model.** Our frontend uses the upstream **new frontend
   system** (Blueprints: `PageBlueprint`, `EntityCardBlueprint`, …). RHDH's GA
   dynamic-frontend model is **config-driven mount points** (`dynamicRoutes`,
   `mountPoints`, `entityTabs`, `apiFactories`, `scaffolderFieldExtensions`,
   `menuItems`), which is *not* the new frontend system. Newer RHDH is adding
   new-frontend-system support, but it's version-dependent. **Confirm what your
   target RHDH version supports.** The good news: the **React components are
   reusable** either way — only the *registration layer* changes.

## Red Hat best practices (the rules to follow)

- **New backend system** for all backend plugins/modules (✓ we comply).
- **Package with the RHDH CLI** (`@red-hat-developer-hub/cli`, formerly
  `@janus-idp/cli`): `plugin export` → `dist-dynamic/`, then package as **OCI
  images** — never ship local dirs.
- **Config via schema**: each plugin declares its config (`config.d.ts`) and ships
  a `dynamic-plugins.yaml` entry with its `pluginConfig`.
- **Don't patch the app; declare extensions in config** (mount points / routes /
  api factories). Register nav entries via `menuItems`, not a custom sidebar.
- **Use RHDH theming/branding config** for look-and-feel — not a global-CSS reskin
  or app-root injection.
- **Version + multi-arch**: semver the plugins, build multi-arch OCI images in CI,
  publish to a registry, and reference them from the `dynamic-plugins` ConfigMap
  (Helm chart / Operator).
- **Test in RHDH**, not just upstream Backstage — the dynamic loader + shell
  behave differently.

## The phased plan

### Phase 0 — Align to the target RHDH's Backstage version
- Pick the target RHDH release; look up its Backstage version.
- `versions:bump --release <that version>`, fix `tsc`, run the test suites,
  `config:check`. Confirm whether that RHDH supports new-frontend-system dynamic
  plugins or only mount points (drives Phase 3).
- **Exit:** the suite builds + tests green on the RHDH-pinned Backstage version.

### Phase 1 — Backend dynamic plugins (highest value, lowest risk)
For `platform-requests-backend`, `scaffolder-backend-module-platform-actions`,
`platform-builder-backend`, `permission-backend-module-platform-rbac`:
- Verify `package.json` `backstage.role` and `config.d.ts`.
- `npx @red-hat-developer-hub/cli plugin export` in each → `dist-dynamic/`.
- Package as OCI images; author `dynamic-plugins.yaml` entries with `pluginConfig`
  (the `platform.*`, `catalog.providers.ldapOrg`, `proxy.endpoints` config).
- Note: LDAP, OIDC, permission-backend, notifications, scaffolder, techdocs are
  **RHDH-provided** dynamic plugins — enable them in `dynamic-plugins.yaml` rather
  than shipping our own.
- **Exit:** requests/builder/RBAC/actions load in a running RHDH; a request →
  approve → workflow flow works headlessly (API).

### Phase 2 — Scaffolder field + shared frontend bits
- Expose `DynamicSelect` as a dynamic **`scaffolderFieldExtensions`** plugin.
- Bundle `JsonTree`, `stateBadge`, and the shadcn primitives as shared exports the
  entity cards import.
- **Exit:** the DynamicSelect field renders in an RHDH scaffolder form.

### Phase 3 — Frontend pages, cards, tabs, API
Re-declare `platform-requests` / `platform-builder` extensions for RHDH:
- Pages (`/requests`, `/home`, builder) → **`dynamicRoutes`** (+ `menuItems` for
  nav entries).
- Resource **Manage** card, **Relations** graph, **Resource Data** → **`mountPoints`**
  (`entity.page.overview/cards`) and **`entityTabs`**, with `if: { isKind: resource }`.
- `requestsApi` → **`apiFactories`**.
- Package the frontend as a Scalprum dynamic plugin → OCI.
- **Exit:** the request pages + Resource cards/tab appear in RHDH via config only.

### Phase 4 — Design system: adopt RHDH's shell (scope decision)
RHDH owns the shell. Recommended, RHDH-idiomatic path:
- Ship the accent/theme through **RHDH theming/branding** config (a MUI theme),
  not the global-CSS `[class*="…"]` reskin.
- **Drop** the custom nav (use `menuItems`), the app-root color picker, and the
  custom sign-in (RHDH provides sign-in + guest/OIDC). Keep the *content* styling
  (our `.sc-*` component classes on our own pages) — that's fine; it's the
  shell-level overrides that fight RHDH.
- This is a product decision: how much bespoke look to keep vs. adopt RHDH's UX.
- **Exit:** the suite looks consistent *within* RHDH's shell, no shell hacks.

### Phase 5 — Packaging, CI, catalog
- CI: multi-arch OCI builds per plugin, semver tags, push to your registry.
- Ship a `dynamic-plugins.yaml` (Operator/Helm ConfigMap) enabling the suite +
  the RHDH-provided plugins (LDAP, OIDC, permission, notifications, scaffolder,
  techdocs), with all `pluginConfig`.
- **Exit:** a fresh RHDH + this ConfigMap = the full platform, no app rebuild.

## What carries over unchanged
The **pure logic** — the request state machine, the Argo client + `<< token >>`
resolver, the generator, the resolvers, the RBAC policy, the `git-ops` workflow,
and all the `platform.io/*` conventions — is RHDH-agnostic and moves as-is. The
work is packaging (Phase 1/5) and re-registering the frontend (Phase 3/4).

## Effort summary
Low: backend plugins, scaffolder field. Medium: frontend pages/cards/tabs.
High: version alignment (Phase 0) and reconciling the design-system shell with
RHDH (Phase 4). Do Phases 0→1 first for the fastest working slice.
