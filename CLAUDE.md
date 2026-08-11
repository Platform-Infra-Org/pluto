# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Backstage plugin suite for internal self-service resource provisioning:
templates file **requests**, requests need **approval**, approval submits an
**Argo Workflow**, and the workflow (not Backstage) writes Git and provisions.
Dressed in an 8-bit pixel design system.

`README.md` covers running the dev stack; `docs/` is the full Diátaxis site
(`mkdocs serve` at the repo root). Read `docs/explanation/*` before changing
lifecycle, RBAC, secrets, or design-system behaviour — they explain *why*, not
just what.

## Commands

All Node commands run from `backstage/` (Yarn 4 via corepack, Node 22).

```bash
bash scripts/backstage-up.sh    # (repo root) Postgres/Keycloak/LDAP/Gitea + kind/Argo + port-forward
bash scripts/backstage-down.sh  # (repo root) tear the containers + volumes down

cd backstage
yarn start                      # frontend :3000, backend :7007
yarn tsc                        # type check (CI runs this)
yarn lint:all                   # lint everything; `yarn lint` only diffs vs origin/main
yarn test                       # jest across the repo
yarn test plugins/platform-ui/src/flavour.test.ts   # one file (args pass through to jest)
yarn test -t 'is not truncated'                     # one test by name
yarn workspace @internal/plugin-platform-ui test    # one workspace
yarn test:e2e                   # playwright (packages/app/e2e-tests); boots app+backend itself
yarn build:all                  # compile every workspace + both bundles (CI runs this)
yarn fix                        # backstage-cli repo fix
```

CI (`.github/workflows/checks.yml`) = tsc → lint:all → test → build:all.

## Commits and releases

Conventional commits are enforced: with squash-merge the **PR title** is what
git-cliff parses, and `pr-title` in CI fails an invalid one. Merging to `main`
makes git-cliff bump the version, rewrite `CHANGELOG.md`, tag, and build the
image — do not hand-edit `CHANGELOG.md` or version fields.

## Architecture

Backstage is the **control plane only**. A request records intent; the Argo
workflow changes the world and is the only runtime writer of the catalog Git
repo. Three external systems: Keycloak→LDAP (identity), Gitea/Bitbucket
(catalog + templates), Argo (execution).

### Plugins (`backstage/plugins/`)

| Package (`@internal/…`) | Role |
|---|---|
| `plugin-platform-common` | shared types — `RequestState`, `ArgoSubmitSpec`, `SecretFieldSpec`, tokens contract |
| `backstage-plugin-platform-requests-backend` | store, state machine, Argo client, resolvers, secrets, retention, router |
| `plugin-platform-requests` | request pages, Resource entity cards/tab, workflow + relations graphs |
| `plugin-platform-ui` | design system, theme, scheme picker, nav, quickstart, DynamicSelect, catalog graph |
| `backstage-plugin-scaffolder-backend-module-platform-actions` | the `platform:request:submit` action |
| `backstage-plugin-permission-backend-module-platform-rbac` | RBAC permission policy |

One responsibility per file in the backend (`store.ts`, `stateMachine.ts`,
`argo.ts`, `suspend.ts`, `secretStore.ts`, `retention.ts`, `router.ts`), and
`applyDecision`/`policySatisfied` in `stateMachine.ts` are pure — keep them that
way, they are the cheapest thing to test.

### Request lifecycle (the core loop)

`PENDING_APPROVAL` → `APPROVED` → `IN_PROGRESS` → `SUCCEEDED`/`FAILED`, plus
`REJECTED`, `EXPIRED` (retention), and `AWAITING_INPUT` (mid-workflow gate).

- The only correlation key is the Argo label `platform.io/request-id=<id>`,
  injected on submit and always overriding a user-set label.
- A scheduled poll (every 5s, `plugin.ts`) mirrors the workflow phase back onto
  the request. Requests never show done before the workflow is done.
- **Argo has no "Suspended" phase.** A waiting gate is `type: Suspend` **and**
  `phase: Running`, on a workflow whose own phase is `Running`. Anything keying
  off phase alone will never see it. The transition is reversible in both
  directions (`suspend.ts`).
- `APPROVED`, `IN_PROGRESS` and `AWAITING_INPUT` are never expired or deleted,
  regardless of config — a live workflow references its request and the secret
  sweep reads `IN_PROGRESS` ids to decide which Secrets are orphaned.
- A bulk request that names an unresolvable resource is refused whole, before
  any workflow is submitted.

Full detail: `docs/explanation/request-lifecycle.md`.

### The conventions that survive Backstage upgrades

Everything is registered through Blueprints and extension points, never by
patching core (`packages/app/src/App.tsx`, `packages/backend/src/index.ts`).
The stable, *ours* layer is:

- `platform.io/*` annotations on Templates and Resources —
  `docs/reference/annotations.md`.
- `<< token >>` submit tokens resolved by the backend at submit time,
  deliberately distinct from Scaffolder's `${{ }}` so no escaping is needed —
  `docs/reference/tokens.md`.
- The `git-ops` WorkflowTemplate as the single create/update/delete Git writer.

Config lives under `platform:` in `app-config.yaml`, typed by each plugin's
`config.d.ts`.

## Design system gotchas

`docs/explanation/design-system.md` is the contract. The load-bearing parts:

- **Decoration may play, records may not.** Screen names can be reskinned
  (`app.branding.flavour`); state labels (`SUCCEEDED`, `FAILED`) never change —
  they are what the API, badge and audit trail all say.
- `plugins/platform-ui/src/styles.ts` is **one template literal**. A stray
  backtick truncates the whole stylesheet and a backslash before digits fails
  the app build while `tsc` stays silent. `styles.test.ts` guards both — do not
  weaken it.
- Style Backstage's own components through `theme.tsx` override keys (typed, so
  a rename fails the build), not hashed class names.
- All animation uses `steps()`, never `ease`, including third-party motion, and
  sits inside `prefers-reduced-motion: no-preference`. Nothing conveys state
  through motion alone.
- `.sc-dark` on the root must agree with the theme MUI is rendering; an unset
  theme follows the system preference live (treating it as light gives white on
  white).
- Status colours (experience bar) deliberately ignore the picked scheme.

## Deployment

`deploy/prod/helm/platform` is the only thing that ships. `deploy/dev/` is
laptop-only fixtures — its committed credentials have no production equivalent.
See `docs/how-to/prepare-for-production.md` before touching production paths.
