# Migration plan: align the app to RHDH 1.9 (Backstage 1.45.3)

**Target:** Red Hat Developer Hub **1.9**, which pins upstream Backstage **1.45.3**
([What's new in RHDH 1.9](https://developers.redhat.com/blog/2026/03/13/whats-new-red-hat-developer-hub-19)).

**Decision (updated):** **move dev to Backstage 1.45.3 too**, so the dev app and
RHDH run the *same* Backstage. There is no dual-version split — one version
everywhere. This makes local `yarn start` a trustworthy preview of the APIs RHDH
1.9 ships, and removes the whole class of version-skew surprises (API drift,
`/alpha` shape changes, config-schema differences) before they reach RHDH.

The migration happens on a dedicated branch off `main`. For per-plugin
feasibility and the RHDH best-practice rules, see the companion
[docs/RHDH-DYNAMIC-PLUGINS.md](RHDH-DYNAMIC-PLUGINS.md).

## What "same version" does and doesn't buy you

| | Local `yarn start` (after align) | RHDH 1.9 |
|---|---|---|
| Backstage libraries | **1.45.3 (same)** | 1.45.3 |
| Backend model | new backend system | new backend system (**same**) |
| Frontend **libraries** | 1.45.3 | 1.45.3 |
| Frontend **registration** | new frontend system (Blueprints) | **mount points** (Scalprum) |
| App shell | vanilla Backstage shell | **RHDH shell** (sidebar/theme/sign-in) |

Matching the version aligns everything *library-level* — that's the big win and
kills the drift bugs. Two things still differ by design: the **frontend
registration model** (Blueprints for `yarn start`, mount points for RHDH) and the
**RHDH shell**. So to see the *real* RHDH result, run RHDH locally with the
dynamic plugins loaded (Phase 4). Version-matching is what makes that local RHDH
preview faithful instead of a moving target.

## Strategy

1. **Downgrade the repo to Backstage 1.45.3 (Phase 0 — the big task).** Pin every
   `@backstage/*` to its version in the Backstage `v1.45.3` release manifest,
   reinstall, dedupe, and get `tsc` + tests + `config:check` green. This is a
   *downgrade* from 1.53, so the risk is code that uses post-1.45 APIs — those get
   rewritten to the 1.45 equivalent. Most of our code uses stable APIs, so the
   blast radius is the `/alpha` frontend registration and any recently-added
   helpers.

2. **Keep component code free of `@backstage/*/alpha` imports.** Confine every
   Blueprint / `/alpha` import to a single registration entry per frontend plugin
   (`src/alpha.tsx`). Pages, cards, `JsonTree`, `DynamicSelect`, `stateBadge`
   import only stable `@backstage/*` + MUI, so the same components back both the
   `yarn start` (Blueprint) registration and the RHDH (mount-points) registration.

3. **Package from the same lockfile.** Because dev is now on 1.45.3, there's no
   separate version context to maintain — `@red-hat-developer-hub/cli plugin
   export` per plugin builds against the same deps the app uses, then OCI images.

4. **Preview in real RHDH.** Run RHDH 1.9 locally (container) with the suite's
   dynamic plugins to see the actual shell + mount-points result.

## Phases

### Phase 0 — Align the app to Backstage 1.45.3 (biggest task; dev must stay green)
- Pin `@backstage/*` to the `v1.45.3` release manifest; `yarn install`,
  `yarn dedupe`.
- `yarn tsc` — fix anything using post-1.45 APIs (expect breakage concentrated in
  the `/alpha` frontend registration and newest helpers).
- Run the backend test suites; `yarn backstage-cli config:check --lax`.
- `yarn start` — smoke the full flow (request → approve → workflow → SUCCEEDED,
  edit/delete, the reskin, entity cards/tabs, sign-in + LDAP, DynamicSelect).
- Set `backstage.json` to `1.45.3`.
- **Exit:** the app builds, tests pass, and boots on Backstage 1.45.3.

### Phase 1 — Backend dynamic plugins (highest value, lowest risk)
For `platform-requests-backend`, `scaffolder-backend-module-platform-actions`,
`platform-builder-backend`, `permission-backend-module-platform-rbac`:
- `npx @red-hat-developer-hub/cli plugin export` per plugin → `dist-dynamic/`.
- Build + push OCI images; author `dynamic-plugins.yaml` entries with
  `pluginConfig` (see the [Configure RHDH how-to](../deploy/backstage/seed/catalog/platform-docs/docs/how-to/configure-rhdh.md)).
- **Exit:** requests/builder/RBAC/actions load in a running RHDH 1.9; a
  request → approve → workflow flow works via the API.

### Phase 2 — Scaffolder field + shared frontend bits
- Export `DynamicSelect` as a `scaffolderFieldExtensions` dynamic plugin.
- Bundle `JsonTree`, `stateBadge`, shadcn primitives as shared exports the cards
  import.
- **Exit:** the DynamicSelect field renders in an RHDH scaffolder form.

### Phase 3 — Frontend pages, cards, tabs, API (mount points)
- Add the mount-points registration (reusing the Phase-0 `/alpha`-free
  components): pages → `dynamicRoutes` (+ `menuItems`); Manage/Relations cards →
  `mountPoints` with `if: { isKind: resource }`; Resource Data → `entityTabs`;
  `requestsApi` → `apiFactories`. Package as Scalprum OCI.
- **Exit:** the request pages + Resource cards/tab appear in RHDH via config only.

### Phase 4 — Run real RHDH locally + adopt its shell
- Stand up RHDH 1.9 locally with the suite loaded — this is the faithful preview.
- Ship the accent via **RHDH theming/branding** config, not the global-CSS
  reskin; drop the custom nav (`menuItems`), app-root color picker, and custom
  sign-in (RHDH provides sign-in + OIDC). Keep the `.sc-*` content styling on our
  pages. Product decision — see §4 of the companion plan.
- **Exit:** the suite looks/behaves consistent inside RHDH's shell.

### Phase 5 — CI, registry, ConfigMap
- CI: multi-arch OCI builds per plugin, semver tags.
- Ship one `dynamic-plugins.yaml` (Operator/Helm ConfigMap) enabling the suite +
  the RHDH-provided plugins we depend on (LDAP, OIDC, permission, notifications,
  scaffolder, techdocs), with all `pluginConfig`.
- **Exit:** fresh RHDH 1.9 + this ConfigMap = the full platform, no app rebuild.

## What carries over unchanged
The pure logic — request state machine, Argo client + `<< token >>` resolver,
generator, resolvers, RBAC policy, `git-ops` workflow, all `platform.io/*`
conventions — is RHDH-agnostic and Backstage-version-agnostic; it moves as-is.

## Risk note
Downgrading 1.53 → 1.45.3 is the one genuinely risky step (you're removing eight
minor releases of API). If a post-1.45 API has no 1.45 equivalent, that feature's
registration gets rewritten, not just re-pinned. Do Phase 0 as its own reviewed
commit and don't start packaging until `yarn start` is green on 1.45.3.
