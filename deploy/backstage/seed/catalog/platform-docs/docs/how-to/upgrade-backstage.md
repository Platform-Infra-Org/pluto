# How to upgrade Backstage

The customization uses the new frontend/backend systems (Blueprints + extension
points), so most of it is upgrade-stable. Full detail lives in the repo at
`docs/UPGRADING-BACKSTAGE.md`; this is the short recipe.

## Procedure

```bash
cd backstage
yarn backstage-cli versions:bump      # bump all @backstage/* + backstage.json
yarn backstage-cli migrate            # automated codemods
yarn install && yarn dedupe           # resolve; collapse duplicate @backstage/* copies

yarn tsc                              # FIRST — /alpha + Blueprint breakages surface here
CI=true yarn workspace @internal/backstage-plugin-platform-requests-backend test
CI=true yarn workspace @internal/backstage-plugin-platform-builder-backend test
CI=true yarn workspace @internal/backstage-plugin-permission-backend-module-platform-rbac test
yarn backstage-cli config:check --lax # catch config-schema drift

yarn start                            # boot + manual smoke
```

Do it on a branch off `backstage-plugins`, as an isolated commit.

## What to watch (the parts tsc/tests can't catch)

- **The shadcn reskin.** If a native page looks unstyled, `grep '[FRAGILE]'` in
  `plugins/platform-ui/src/styles.ts` and re-derive only the affected hashed
  class prefix from the new DOM. The MUI/BUI/react-flow selectors are stable.
- **Entity tabs/cards, sign-in + LDAP, DynamicSelect** (alpha/blueprint APIs).
- **The full flow:** request → approve → workflow → SUCCEEDED; edit/delete.

## Reduce future cost

- Migrate imports off `@backstage/*/alpha` to the stable path as each API
  graduates.
- Re-check third-party module config keys (e.g. the LDAP module reads
  `catalog.providers.ldapOrg`) after a bump.
