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

## 3. The reskin CSS — mostly not a risk any more

`plugins/platform-ui/src/styles.ts` sits on **stable hooks**: MUI global classes
(`.MuiButton-*`, `.MuiCard-*`, …), the BUI `--bui-*` variables with
`[data-variant]`, and `.react-flow__*`.

Backstage's own components used to be styled here too, by matching hashed
`makeStyles` prefixes like `[class*="BackstageHeader-title"]`. They are now
styled in `theme.tsx` through `createUnifiedTheme`'s `components` block, using
the override keys and slot names `@backstage/core-components` publishes:

```ts
components: {
  BackstageHeader: { styleOverrides: { header: {…}, title: {…} } },
  BackstageInfoCard: { styleOverrides: { header: {…} } },
  …
}
```

Those slot names are **typed**, so a rename fails `yarn tsc` instead of silently
rendering an unstyled page. The class hash — the thing that actually changes
between versions — no longer matters.

One caveat worth knowing: theme overrides apply at the component's own
specificity, so where Backstage sets a value inside a breakpoint it can still
win. `BackstageSidebarPage` needs `!important` for exactly that reason (it sets
its own 224px `padding-left`), and it is commented as such.

What remains `[FRAGILE]` is the catalog/dependency graph, which the
catalog-graph plugin styles privately with no published override key. That is
two rules, and it can still break silently on a rename — which is why the
upgrade checklist keeps a visual pass.

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
