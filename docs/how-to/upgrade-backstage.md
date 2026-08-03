# How-to: upgrade Backstage

Pinned to the version in `backstage/backstage.json`. This is the playbook for
bumping to a newer release without breaking the platform plugin suite.

For *what* a bump can break and why, read
**[what an upgrade can break](../explanation/upgrade-surface.md)** first — it
explains the manual checks below.

## Procedure

```bash
cd backstage

# 1. Bump all @backstage/* and run the codemods.
yarn backstage-cli versions:bump          # add --release <version> to pin
yarn backstage-cli migrate                # applies available automated migrations
yarn install && yarn dedupe               # collapse duplicate @backstage/* copies

# 2. Type-check FIRST — /alpha and Blueprint breakages surface here.
yarn tsc

# 3. The regression gate.
CI=true yarn test

# 4. Config schema still valid?
yarn backstage-cli config:check --lax

# 5. Boot and smoke-test.
yarn start
```

Keep the bump as its own commit on its own branch, so a regression is easy to
bisect and revert.

## Verification

Automated — these fail the build, and CI runs them on every PR:

- [ ] `yarn tsc` clean (fixes any `/alpha` or Blueprint signature changes)
- [ ] `yarn test` green across all suites
- [ ] `yarn lint:all` clean
- [ ] `config:check --lax` passes

Manual — the parts tests and the type checker **cannot** catch:

- [ ] **The shadcn reskin still applies.** Headers flat, sidebar nav, cards, and
      the colour picker recolouring buttons/links/badges. If a native page looks
      unstyled, grep `[FRAGILE]` in `plugins/platform-ui/src/styles.ts` and
      re-derive only the affected hashed class prefix from the new DOM — the
      MUI/BUI/react-flow selectors are stable.
- [ ] **Entity tabs and cards** render on a Resource page: Resource Data tab,
      Manage resource card, relations graph (alpha blueprints).
- [ ] **The custom sign-in page** and LDAP login work (`SignInPageBlueprint`).
- [ ] **DynamicSelect** renders in a scaffolder form (`FormFieldBlueprint`).
- [ ] **The full flow:** request → approve → workflow → `SUCCEEDED`, then edit
      and delete.
- [ ] **LDAP ingestion** logs `Read N LDAP users and M LDAP groups`.
