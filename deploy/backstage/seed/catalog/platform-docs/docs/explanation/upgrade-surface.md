# Explanation: what an upgrade can break

The suite is native TypeScript on the new frontend + backend systems, registered
through public **Blueprints** and **extension points** rather than by patching
core. That is the most upgrade-stable way to extend Backstage — but not a free
one. This is what a version bump can actually touch, in decreasing order of risk.

The procedure itself is a task: **[Upgrade Backstage](../how-to/upgrade-backstage.md)**.

## 1. `/alpha` imports — highest risk

The new-system APIs are still stabilising, so their signatures can change
between minor releases:

- `@backstage/plugin-catalog/alpha`, `@backstage/plugin-catalog-react/alpha`
  (`EntityCardBlueprint`, `EntityContentBlueprint`)
- `@backstage/plugin-techdocs/alpha`
- `@backstage/plugin-scaffolder-react/alpha`
- `@backstage/plugin-permission-node/alpha` (`policyExtensionPoint`)

Breakages here surface in `yarn tsc` first, which is why the type check runs
before anything else.

## 2. Blueprints and extension points

`PageBlueprint`, `ApiBlueprint`, `NavContentBlueprint`, `ThemeBlueprint`,
`AppRootElementBlueprint`, `EntityCardBlueprint`, `EntityContentBlueprint`,
`FormFieldBlueprint`, `SignInPageBlueprint`; on the backend
`createBackendPlugin` / `createBackendModule`, `coreServices.*`,
`scaffolderActionsExtensionPoint`, `catalogProcessingExtensionPoint`,
`policyExtensionPoint`.

Param shapes shift occasionally — `EntityContentBlueprint`'s `defaultPath` →
`path` deprecation already caught us once. The type checker catches these too.

## 3. The shadcn reskin CSS — the only build-invisible risk

`plugins/platform-ui/src/styles.ts` is mostly on **stable hooks**: MUI global
classes (`.MuiButton-*`, `.MuiCard-*`, …), the BUI `--bui-*` variables with
`[data-variant]`, and `.react-flow__*`.

The residual risk is Backstage's own **hashed `makeStyles` components**, which
expose no stable hook. Every one of those is tagged **`[FRAGILE]`** in the file,
matched by the stable class *prefix* with the hash ignored, and paired where
possible with a stable companion so it degrades gracefully rather than
disappearing.

A `[FRAGILE]` selector can break **silently** — no type error, no failing test —
on a component rename or an MUI major bump. That is the whole reason the upgrade
checklist keeps a manual visual pass. The fix is scoped, though: grep
`[FRAGILE]`, re-derive only the affected prefix from the new DOM.

## 4. The theme

`theme.tsx` builds on `createUnifiedTheme` with `palettes` / `shapes` from
`@backstage/theme`. A MUI major version bump is the risk here.

## 5. Third-party backend modules

Version-locked to core, and their **config schemas move**:
`catalog-backend-module-ldap` (which is why LDAP config lives under
`catalog.providers.ldapOrg` — it moved there from `ldap.providers`),
`auth-backend-module-oidc-provider`, `permission-backend`,
`notifications-backend`, `scaffolder-backend`, `techdocs-backend`. Re-check
their keys after a bump; `config:check` catches most of it.

## 6. Ours, and therefore stable

The `<< token >>` submit resolver, the `platform.io/*` annotation conventions,
the request state machine, the `git-ops` workflow and the RBAC config depend on
no Backstage internals, so they carry across untouched.

## Reducing the cost over time

- **Prefer stable exports over `/alpha`** as each API graduates — track the
  Backstage changelog for the frontend/backend systems leaving alpha.
- **Prefer CSS variables and `data-*` attributes** over hashed `makeStyles`
  fragments wherever Backstage exposes them; they survive versions.
- **Keep the test suites as the contract** for pure logic (state machine,
  resolvers, RBAC, crypto). They're version-independent and catch behavioural
  regressions the moment a bump changes something.
- **Pin third-party module versions** alongside the core bump.
