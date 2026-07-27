# Upgrading Backstage (with this customization)

Currently pinned to **Backstage 1.53.0** (`backstage.json`), CLI `0.36.4`. This
is the playbook for bumping to a newer release without breaking the platform
plugin suite.

## What our customization actually touches (the upgrade surface)

The suite is **native TypeScript on the new frontend + backend systems**, which
is the *most* upgrade-stable way to extend Backstage — we register through
public **Blueprints** and **extension points**, not by patching core. The pieces
an upgrade can affect, roughly in decreasing order of risk:

1. **`/alpha` imports (highest risk).** The new-system APIs are still
   stabilizing, so these can change signatures between minor releases:
   - `@backstage/plugin-catalog/alpha`, `@backstage/plugin-catalog-react/alpha`
     (`EntityCardBlueprint`, `EntityContentBlueprint`)
   - `@backstage/plugin-techdocs/alpha`
   - `@backstage/plugin-scaffolder-react/alpha`
   - `@backstage/plugin-permission-node/alpha` (`policyExtensionPoint`)
   Breakages here surface in `yarn tsc` first — always the first thing to check.

2. **Blueprints & extension points.** `PageBlueprint`, `ApiBlueprint`,
   `NavContentBlueprint`, `ThemeBlueprint`, `AppRootElementBlueprint`,
   `EntityCardBlueprint`, `EntityContentBlueprint`, `FormFieldBlueprint`,
   `SignInPageBlueprint`; backend `createBackendPlugin`/`createBackendModule`,
   `coreServices.*`, `scaffolderActionsExtensionPoint`,
   `catalogProcessingExtensionPoint`, `policyExtensionPoint`. Param shapes shift
   occasionally (we already hit `EntityContentBlueprint`'s `defaultPath`→`path`
   deprecation). tsc catches these.

3. **The shadcn reskin CSS — the single most fragile file:**
   `plugins/platform-ui/src/styles.ts` has **22 attribute-contains selectors**
   (`[class*="BackstageHeader-header"]`, `[class*="bui-Button"]`, …) that key on
   Backstage's **hashed makeStyles / BUI class names**. These are *not* a public
   API. They can silently break (no tsc/test failure) when Backstage renames a
   component, changes its class-name scheme, or **bumps MUI (v5→v6)**. This needs
   a **visual smoke test** on every upgrade — it won't fail the build.

4. **`theme.tsx`** uses `createUnifiedTheme` + `palettes`/`shapes` from
   `@backstage/theme`; a MUI major bump is the risk.

5. **Third-party backend modules we depend on** (version-locked to the core):
   `catalog-backend-module-ldap` (config under `catalog.providers.ldapOrg`),
   `auth-backend-module-oidc-provider`, `permission-backend`,
   `notifications-backend`, `scaffolder-backend`, `techdocs-backend`. Their
   **config schemas** can move between versions (as `ldap.providers` →
   `catalog.providers.ldapOrg` did) — re-check after a bump.

6. **Ours, and therefore stable:** the `<< token >>` submit resolver, the
   `platform.io/*` annotation conventions, the request state machine, the
   `git-ops` workflow, the RBAC config — none depend on Backstage internals, so
   they carry across untouched.

## The upgrade procedure

```bash
cd backstage
# 1. Bump all @backstage/* to the target release line, and run codemods.
yarn backstage-cli versions:bump          # add --release <version> to pin
yarn backstage-cli migrate                # applies available automated migrations
yarn install && yarn dedupe

# 2. Type-check FIRST — /alpha + Blueprint breakages show here.
yarn tsc

# 3. Run the regression gate (our suites).
CI=true yarn workspace @internal/backstage-plugin-platform-requests-backend test
CI=true yarn workspace @internal/backstage-plugin-platform-builder-backend test
CI=true yarn workspace @internal/backstage-plugin-permission-backend-module-platform-rbac test

# 4. Config schema still valid?
yarn backstage-cli config:check --lax

# 5. Boot + visual/functional smoke (see checklist).
yarn start
```

Do the work on a branch off `backstage-plugins`; keep upgrades as their own
commits so a regression is easy to bisect/revert.

## Post-bump verification checklist

Automated (fails the build):
- [ ] `yarn tsc` clean — fixes any `/alpha` / Blueprint signature changes.
- [ ] The three plugin test suites green (state machine, generator, RBAC).
- [ ] `config:check --lax` passes.

Manual smoke (the parts tests + tsc *cannot* catch):
- [ ] **The shadcn reskin still applies** — headers flat, sidebar nav, cards,
      the color picker recolors buttons/links/badges. If broken, the hashed
      `[class*="…"]` selectors in `styles.ts` need re-deriving against the new
      class names (inspect the DOM for the new hashed prefixes).
- [ ] **Entity tabs/cards** (alpha blueprints): Resource Data tab, Manage
      resource card, Relations graph render on a Resource page.
- [ ] **Custom sign-in page** + LDAP login work (SignInPageBlueprint).
- [ ] **DynamicSelect** scaffolder field renders (FormFieldBlueprint).
- [ ] **RBAC + requests** flow: request → approve → workflow → SUCCEEDED.
- [ ] **LDAP ingestion** logs "Read N LDAP users and M LDAP groups".

## How to reduce future upgrade cost

- **Prefer stable exports over `/alpha`** as each becomes non-alpha; track the
  Backstage changelog for the frontend/backend system graduating out of alpha
  and migrate off the alpha imports then.
- **Isolate the fragile CSS:** the hashed-class overrides are the only
  build-invisible risk. Where Backstage exposes CSS variables or `data-*`
  attributes (e.g. BUI's `[data-variant]`), prefer those over hashed
  `makeStyles` class fragments — they're far more stable across versions.
- **Keep the test suites as the contract** for the pure logic (generator, state
  machine, resolver, RBAC) — they're version-independent and catch real
  regressions the moment an upgrade changes behavior.
- **Pin third-party module versions** alongside the core bump and re-check their
  config schemas.
