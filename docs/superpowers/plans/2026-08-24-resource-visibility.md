# Resource Visibility and Bulk-Delete Gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Only admins, a resource's **owner** (its entity's `spec.owner`) and its
**service-owner** (the owning Template's `spec.owner`, carried on requests as
`ownerGroup`) may see a platform Resource — and the same three may select it for
bulk deletion. One rule, applied to both.

**Architecture:** Visibility is enforced by the **catalog**, via a conditional
decision on `catalog.entity.read` in the existing `PlatformPermissionPolicy`.
That filters every read at once — home page, `MultiEntityPicker`, entity pages,
search — because they all query the catalog directly rather than going through
our backend. **`MultiEntityPicker` therefore needs no change**: it calls
`catalogApi.getEntities()` with the user's own credentials
(`MultiEntityPicker.esm.js:48`), so it offers exactly what the catalog will
return. Bulk delete is additionally checked at `POST /requests`, the same choke
point the maintenance gate uses, refusing a mixed selection whole — because a
stale tab or a hand-written call skips the picker entirely.

**Tech Stack:** TypeScript, Backstage permission framework (conditional
decisions, `catalogConditions`), Knex-backed requests store, Jest.

**Spec:** `docs/superpowers/specs/2026-08-24-resource-visibility-design.md`

## Global Constraints

- All Node commands run from `backstage/`. Jest MUST have `CI=1` or
  `backstage-cli repo test` sits in interactive watch mode and prints nothing.
- Before EVERY commit all three clean: `yarn tsc` (silent); `yarn lint:all` —
  report the **ERROR count**, must be **0**; the task's test files. Full gate at
  the end: `CI=1 yarn test`. Baseline is **951 passing across 86 suites**.
- **The two owners are different things and must not be conflated.** `spec.owner`
  on the Resource entity is the *owner*. `ownerGroup` on a request — from the
  owning **Template**'s `spec.owner` — is the *service-owner*. A change that
  makes one stand in for the other is a defect even if every test passes.
- **The requester on `POST /requests` is the resolved `requester` string, not
  the credential.** The Scaffolder posts as a **service** and names the human in
  the body. A check keyed on the credential refuses everyone or no one — see
  `adminLookup` in `plugin.ts` for the shape that works. Do not derive
  admin-ness a third way.
- **Only `kind: Resource` entities carrying `platform.io/resource-type` narrow.**
  Templates, Groups, Users, Components and everything else keep today's
  behaviour. Widening this silently breaks the scaffolder and the org sidebar.
- Conditional decisions must use catalog-supplied rules so the catalog turns
  them into its own query. Post-filtering a page of results breaks pagination
  and counts.
- Do not add a dependency to any `package.json` without saying so and why.
- Never hand-edit `CHANGELOG.md` or a version field. Conventional commits.
- Never add `as any`, `as unknown` or `@ts-ignore` to make something compile. If
  the types object, the seam is wrong — stop and report.

---

### Task 1: Resolve which resource-types a user service-owns

**Files:**
- Create: `backstage/plugins/platform-requests-backend/src/resourceOwnership.ts`
- Create: `backstage/plugins/platform-requests-backend/src/resourceOwnership.test.ts`

**Interfaces:**
- Consumes: nothing. Pure functions over data the caller supplies.
- Produces:
  ```ts
  /** resourceType -> the owning Template's spec.owner. */
  export type ServiceOwnerMap = Map<string, string>;
  export function serviceOwnerMap(templates: Entity[]): ServiceOwnerMap;
  export function serviceOwnedTypes(map: ServiceOwnerMap, groups: string[]): string[];
  ```
  Tasks 2 and 3 both consume these.

The point of putting this here, pure, is that both the permission policy and the
bulk-delete gate need the same mapping, and a second copy would drift.

- [ ] **Step 1: Write the failing tests**

Create `resourceOwnership.test.ts`. Read an existing seeded Template first —
`deploy/dev/seed/software-templates/templates/git-resource/template.yaml` — to
get the real annotation and owner shape, then:

```ts
import { serviceOwnerMap, serviceOwnedTypes } from './resourceOwnership';

const tpl = (type: string | undefined, owner: string | undefined) => ({
  apiVersion: 'scaffolder.backstage.io/v1beta3',
  kind: 'Template',
  metadata: {
    name: `t-${type ?? 'none'}`,
    ...(type ? { annotations: { 'platform.io/resource-type': type } } : {}),
  },
  spec: { ...(owner ? { owner } : {}) },
}) as never;

describe('serviceOwnerMap', () => {
  it('maps a resource-type to its template owner', () => {
    const m = serviceOwnerMap([tpl('git-resource', 'group:default/checkout')]);
    expect(m.get('git-resource')).toBe('group:default/checkout');
  });

  it('ignores a template that claims no resource-type', () => {
    // bulk-delete-resources deliberately carries no platform.io/resource-type,
    // so that it cannot shadow the real owner of git-resource.
    expect(serviceOwnerMap([tpl(undefined, 'group:default/checkout')]).size).toBe(0);
  });

  it('ignores a template with no owner', () => {
    expect(serviceOwnerMap([tpl('db', undefined)]).size).toBe(0);
  });

  it('keeps the first template when two claim the same type', () => {
    // Two templates claiming one type is a misconfiguration the backend already
    // warns about elsewhere; picking deterministically beats picking at random.
    const m = serviceOwnerMap([
      tpl('db', 'group:default/a'),
      tpl('db', 'group:default/b'),
    ]);
    expect(m.get('db')).toBe('group:default/a');
  });
});

describe('serviceOwnedTypes', () => {
  const map = new Map([
    ['git-resource', 'group:default/checkout'],
    ['database', 'group:default/payments'],
  ]);

  it('lists the types a group service-owns', () => {
    expect(serviceOwnedTypes(map, ['group:default/checkout'])).toEqual(['git-resource']);
  });

  it('lists every type across several groups', () => {
    expect(
      serviceOwnedTypes(map, ['group:default/checkout', 'group:default/payments']).sort(),
    ).toEqual(['database', 'git-resource']);
  });

  it('is empty for a group that owns nothing', () => {
    expect(serviceOwnedTypes(map, ['group:default/nobody'])).toEqual([]);
  });

  it('compares refs exactly, as every other admin check does', () => {
    expect(serviceOwnedTypes(map, ['group:default/Checkout'])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backstage && CI=1 yarn test plugins/platform-requests-backend/src/resourceOwnership.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement**

Create `resourceOwnership.ts`. Match this repo's comment density — explain
*why*:

```ts
import type { Entity } from '@backstage/catalog-model';

/** resourceType -> the owning Template's `spec.owner` (the service-owner). */
export type ServiceOwnerMap = Map<string, string>;

/**
 * Which team approves changes to each resource type.
 *
 * This is the same lookup `ownerResolver` makes — a Template's
 * `platform.io/resource-type` annotation naming the type it owns — lifted into
 * a pure function because two callers now need it: the permission policy that
 * decides what a user may see, and the gate that decides who may bulk-delete.
 * Two copies of an authorization rule is how they drift.
 *
 * A Template with no annotation is skipped deliberately, not defensively:
 * `bulk-delete-resources` carries none precisely so it cannot shadow the real
 * owner of `git-resource`.
 */
export function serviceOwnerMap(templates: Entity[]): ServiceOwnerMap {
  const map: ServiceOwnerMap = new Map();
  for (const t of templates) {
    const type = t.metadata.annotations?.['platform.io/resource-type'];
    const owner = (t.spec as { owner?: string } | undefined)?.owner;
    // First wins. Two templates claiming one type is a misconfiguration; a
    // deterministic answer beats one that changes with catalog ordering.
    if (type && owner && !map.has(type)) map.set(type, owner);
  }
  return map;
}

/**
 * The resource types these groups service-own.
 *
 * Exact ref comparison, matching the permission policy and `isAdminRef` — the
 * checks must not disagree about which group a ref names.
 */
export function serviceOwnedTypes(
  map: ServiceOwnerMap,
  groups: string[],
): string[] {
  const owned = new Set(groups);
  return [...map.entries()].filter(([, o]) => owned.has(o)).map(([t]) => t);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backstage && CI=1 yarn test plugins/platform-requests-backend/src/resourceOwnership.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd backstage && yarn tsc && yarn lint:all
git add backstage/plugins/platform-requests-backend/src/resourceOwnership.ts \
        backstage/plugins/platform-requests-backend/src/resourceOwnership.test.ts
git commit -m "feat: resolve which resource types a group service-owns"
```

---

### Task 2: Narrow `catalog.entity.read` to admins, owners and service-owners

**Files:**
- Modify: `backstage/plugins/permission-backend-module-platform-rbac/src/module.ts`
- Test: `backstage/plugins/permission-backend-module-platform-rbac/src/module.test.ts`
- Modify: `backstage/plugins/permission-backend-module-platform-rbac/package.json` (see Step 1)

**Interfaces:**
- Consumes: `serviceOwnerMap`, `serviceOwnedTypes` (Task 1); `catalogServiceRef`
  from `@backstage/plugin-catalog-node`; `catalogConditions` and
  `createCatalogConditionalDecision` from `@backstage/plugin-catalog-backend/alpha`.
- Produces: a conditional decision on `catalog.entity.read`. Task 3 does not
  consume it.

**Verified before planning:** `permission.enabled: true` is set
(`app-config.yaml:265`); `catalogEntityReadPermission` is a
`ResourcePermission<"catalog-entity">`, so conditionals are legal on it; and
`catalogServiceRef` is a plugin-scoped service injectable into any backend
module.

- [ ] **Step 1: Add the two dependencies and say why**

This module currently depends on neither the catalog nor its permission rules.
It needs both:

```
@backstage/plugin-catalog-backend   — catalogConditions, createCatalogConditionalDecision
@backstage/plugin-catalog-node      — catalogServiceRef
@backstage/catalog-model            — Entity type (may already be present)
```

Use the versions already resolved elsewhere in this repo — check another
plugin's `package.json` and match, rather than picking `latest`. Run
`yarn install --mode=update-lockfile` and include the lockfile change in the
commit. **This is the one dependency addition this plan authorises; anything
else, stop and report.**

- [ ] **Step 2: Write the failing tests**

Read the existing `module.test.ts` first and follow its harness. Add:

```ts
describe('catalog.entity.read', () => {
  const READ = { permission: catalogEntityReadPermission } as never;

  it('lets an admin read everything', async () => {
    const policy = makePolicy({ admin: true });
    await expect(policy.handle(READ, userWith(['group:default/platform-admins'])))
      .resolves.toEqual({ result: AuthorizeResult.ALLOW });
  });

  it('gives a non-admin a conditional decision, never a bare ALLOW', async () => {
    // A bare ALLOW here is the bug this whole task exists to prevent.
    const d = await makePolicy({}).handle(READ, userWith(['group:default/payments']));
    expect(d.result).toBe(AuthorizeResult.CONDITIONAL);
  });

  it('lets an owner through by entity ownership', async () => {
    const d: any = await makePolicy({}).handle(READ, userWith(['group:default/payments']));
    expect(JSON.stringify(d.conditions)).toContain('IS_ENTITY_OWNER');
  });

  it('lets a service-owner through by resource-type annotation', async () => {
    // checkout owns the git-resource template, so it must see every
    // git-resource even when it owns none of them directly.
    const d: any = await makePolicy({
      templates: [tpl('git-resource', 'group:default/checkout')],
    }).handle(READ, userWith(['group:default/checkout']));
    const json = JSON.stringify(d.conditions);
    expect(json).toContain('platform.io/resource-type');
    expect(json).toContain('git-resource');
  });

  it('does not narrow anything that is not a platform Resource', async () => {
    // Templates, Groups, Users and Components must keep today's behaviour, or
    // the scaffolder and the org sidebar break.
    const d: any = await makePolicy({}).handle(READ, userWith(['group:default/nobody']));
    expect(JSON.stringify(d.conditions)).toContain('platform.io/resource-type');
  });

  it('still ALLOWs non-catalog permissions', async () => {
    const d = await makePolicy({}).handle(
      { permission: { name: 'something.else' } } as never,
      userWith([]),
    );
    expect(d.result).toBe(AuthorizeResult.ALLOW);
  });
});
```

`makePolicy`, `userWith` and `tpl` are placeholders for the file's real harness
plus whatever you need to inject templates — read the file and extend it
minimally. If the policy needs a catalog to resolve templates, inject a stub
rather than a live catalog.

- [ ] **Step 3: Run to verify they fail**

Run: `cd backstage && CI=1 yarn test plugins/permission-backend-module-platform-rbac`
Expected: FAIL — today every read returns a bare `ALLOW`.

- [ ] **Step 4: Implement**

In `module.ts`, replace the catch-all's treatment of `catalog.entity.read`. The
shape:

```ts
    if (isResourcePermission(request.permission, RESOURCE_TYPE_CATALOG_ENTITY)) {
      if (isAdmin) return { result: AuthorizeResult.ALLOW };

      const types = serviceOwnedTypes(await this.serviceOwners(), [...refs]);

      // anyOf, because the three classes are a union and the first clause is
      // what keeps this a gate on platform Resources rather than a catalog
      // lockdown: anything without the annotation is simply not ours to hide.
      return createCatalogConditionalDecision(request.permission, {
        anyOf: [
          { not: catalogConditions.hasAnnotation({ annotation: 'platform.io/resource-type' }) },
          catalogConditions.isEntityOwner({ claims: [...refs] }),
          ...types.map(t =>
            catalogConditions.hasAnnotation({
              annotation: 'platform.io/resource-type',
              value: t,
            }),
          ),
        ],
      });
    }
```

Check `hasAnnotation`'s real parameter shape and whether a `not` combinator
exists in this version before relying on either — read
`node_modules/@backstage/plugin-catalog-backend/dist/alpha.d.ts` and the
permission-node conditional types. **If `not` is unavailable, stop and report
rather than inverting the logic by hand** — an inverted clause that reads
plausibly and filters wrongly is exactly the failure this branch keeps
producing.

`serviceOwners()` fetches Templates through `catalogServiceRef` and builds the
map with `serviceOwnerMap`. **Cache it** with a short TTL — this runs on every
catalog read, and an uncached catalog query per read would be a performance
regression far worse than the bug being fixed. Say in your report what TTL you
chose and why.

- [ ] **Step 5: Run to verify they pass**

Run: `cd backstage && CI=1 yarn test plugins/permission-backend-module-platform-rbac`
Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 6: Commit**

```bash
cd backstage && yarn tsc && yarn lint:all
git add backstage/plugins/permission-backend-module-platform-rbac/ backstage/yarn.lock
git commit -m "feat: show a platform resource only to admins, owners and service-owners"
```

---

### Task 3: Refuse a bulk delete naming resources you may not see

**Files:**
- Modify: `backstage/plugins/platform-requests-backend/src/plugin.ts`
- Modify: `backstage/plugins/platform-requests-backend/src/router.ts`
- Test: `backstage/plugins/platform-requests-backend/src/router.test.ts`

**Interfaces:**
- Consumes: `serviceOwnerMap`/`serviceOwnedTypes` (Task 1); `adminLookup` and
  the `requester` resolution already in `router.ts`.
- Produces: a `mayDeleteLookup(userRef, resourceType, resourceNames)` router
  option, defaulting to **deny**, exactly as `adminLookup` does. It answers the
  same union the permission policy uses: admin, owner, or service-owner.

**Do not write a second copy of the ownership rule.** The policy in Task 2 and
this gate must agree, and the way they stay agreeing is by both calling Task 1's
functions. If you find yourself re-deriving "is an owner" here, stop.

- [ ] **Step 1: Write the failing tests**

`router.test.ts` builds its app with `makeApp({ result, principalResolver, … })`
and varies the caller with `mockCredentials` header values via
`.set('Authorization', …)`. Extend `makeApp`'s options with the new lookup and
add:

```ts
describe('bulk delete ownership', () => {
  // 'boss' is an admin; 'dev' service-owns git-resource; 'owner' directly owns
  // the named resources; 'other' is none of the three.
  const adminLookup = async (ref: string) => ref === 'boss';
  const mayDeleteLookup = async (ref: string, type: string) =>
    (ref === 'dev' && type === 'git-resource') || ref === 'owner';

  it('accepts a bulk delete where every name is service-owned', async () => {
    const { app } = await makeApp({ result: AuthorizeResult.ALLOW, adminLookup, mayDeleteLookup });
    const res = await request(app)
      .post('/requests')
      .set('Authorization', mockCredentials.service.header())
      .send({ ...BULK_DELETE_BODY, requester: 'dev' });
    expect(res.status).toBe(201);
  });

  it('accepts a bulk delete from a direct owner', async () => {
    // Owners may bulk delete, same as service-owners — one rule for seeing and
    // selecting, so there is no asymmetry to explain.
    const { app } = await makeApp({ result: AuthorizeResult.ALLOW, adminLookup, mayDeleteLookup });
    const res = await request(app)
      .post('/requests')
      .set('Authorization', mockCredentials.service.header())
      .send({ ...BULK_DELETE_BODY, requester: 'owner' });
    expect(res.status).toBe(201);
  });

  it('refuses the whole request when one name is not service-owned', async () => {
    // Partial success on a Git-writing destructive action is the outcome that
    // is hardest to notice and hardest to undo.
    const { app, store } = await makeApp({ result: AuthorizeResult.ALLOW, adminLookup, mayDeleteLookup });
    const res = await request(app)
      .post('/requests')
      .set('Authorization', mockCredentials.service.header())
      .send({ ...BULK_DELETE_BODY, requester: 'other' });
    expect(res.status).toBe(403);
    expect(await store.list()).toHaveLength(0);   // nothing submitted
  });

  it('names the offending resources in the refusal', async () => {
    const { app } = await makeApp({ result: AuthorizeResult.ALLOW, adminLookup, mayDeleteLookup });
    const res = await request(app)
      .post('/requests')
      .set('Authorization', mockCredentials.service.header())
      .send({ ...BULK_DELETE_BODY, requester: 'other' });
    // A user who ticked five boxes needs to know which one stopped it.
    expect(JSON.stringify(res.body)).toMatch(/git-resource|not permitted/i);
  });

  it('lets an admin bulk delete regardless of service ownership', async () => {
    const { app } = await makeApp({ result: AuthorizeResult.ALLOW, adminLookup, mayDeleteLookup });
    const res = await request(app)
      .post('/requests')
      .set('Authorization', mockCredentials.service.header())
      .send({ ...BULK_DELETE_BODY, requester: 'boss' });
    expect(res.status).toBe(201);
  });

  it('leaves a single-resource DELETE alone', async () => {
    // This plan does not change who may delete one resource.
    const { app } = await makeApp({ result: AuthorizeResult.ALLOW, adminLookup, mayDeleteLookup });
    const res = await request(app)
      .post('/requests')
      .set('Authorization', mockCredentials.service.header())
      .send({ ...SINGLE_DELETE_BODY, requester: 'other' });
    expect(res.status).toBe(201);
  });
});
```

`BULK_DELETE_BODY` and `SINGLE_DELETE_BODY` are placeholders — read the file's
existing creation tests and reuse their body shape, with `resourceNames` (an
array) for the bulk case and `resourceName` for the single one. Hoist shared
constants rather than repeating literals five times. If `store.list()` is not
the real method name, use whatever the file already calls.

- [ ] **Step 2: Run to verify they fail**

Run: `cd backstage && CI=1 yarn test plugins/platform-requests-backend/src/router.test.ts`
Expected: FAIL — nothing refuses anything yet.

- [ ] **Step 3: Implement the gate**

In `router.ts`'s `POST /requests`, after `requester` is resolved and beside the
maintenance gate — **before** any write or encryption:

```ts
    // Bulk delete answers the same union the permission policy uses: admin,
    // owner, or service-owner. Whoever may see a resource may select it, so
    // there is no asymmetry for a user to discover the hard way.
    //
    // The picker already narrows what is easy to click — it reads the same
    // filtered catalog. This exists for what the picker cannot cover: a stale
    // tab, or a call that skips the form.
    //
    // Refused whole rather than partially: a user who ticks five boxes, sees
    // success and finds three gone has no way to tell which half happened, on
    // an action that submits a Git-writing workflow. This matches the existing
    // rule that a bulk request naming an unresolvable resource is refused
    // whole, before any workflow is submitted.
    //
    // Keyed on `requester`, not the credential — the Scaffolder posts as a
    // service and names the human in the body.
    if (data.kind === 'DELETE' && data.resourceNames?.length) {
      if (!(await adminLookup(requester))) {
        if (!(await mayDeleteLookup(requester, data.resourceType, data.resourceNames))) {
          res.status(403).json({
            error:
              `Not permitted to delete one or more of those ${data.resourceType} ` +
              `resources — that requires an admin, the resource's owner, or the ` +
              `owning service team.`,
          });
          return;
        }
      }
    }
```

Note the batch shares one `resourceType` (the template comment says so
explicitly), so one check covers every name. **Verify that is still true** — if
`resourceNames` can span types, the check must run per name and the message
must name the offenders individually. Say which you found.

Add `mayDeleteLookup` to `RouterOptions` with a default of `async () => false`,
matching `adminLookup` and `principalResolver`.

Note it takes `resourceNames` as well as the type: direct ownership is per
resource (`spec.owner` differs between entities), while service-ownership is per
type. Whether the refusal can name the individual offenders depends on that —
see Step 3's note.

- [ ] **Step 4: Wire it in `plugin.ts`**

Beside `adminLookup`, using `serviceOwnerMap`/`serviceOwnedTypes` and the
`catalog` already injected there. Cache the template map the same way Task 2
does, and say in your report whether the two caches should later be shared —
do not share them in this task.

- [ ] **Step 5: Run to verify they pass**

Run: `cd backstage && CI=1 yarn test plugins/platform-requests-backend`
Expected: PASS across the package, including every pre-existing test.

- [ ] **Step 6: Commit**

```bash
cd backstage && yarn tsc && yarn lint:all
git add backstage/plugins/platform-requests-backend/src/router.ts \
        backstage/plugins/platform-requests-backend/src/plugin.ts \
        backstage/plugins/platform-requests-backend/src/router.test.ts
git commit -m "feat: refuse a bulk delete naming resources you do not service-own"
```

---

### Task 4: Document both gates

**Files:**
- Create: `docs/explanation/who-sees-what.md`
- Modify: `docs/reference/annotations.md` (the `platform.io/resource-type` entry)
- Modify: `mkdocs.yml`

- [ ] **Step 1: Write the explanation**

Terse, explaining *why*. It must make the two owners unmistakable, because
conflating them is the mistake this whole change guards against:

- **owner** = the Resource entity's `spec.owner`; who the thing belongs to.
- **service-owner** = the owning Template's `spec.owner`, carried on requests as
  `ownerGroup`; who approves changes to that type.

Cover: who sees a resource (admins, owner, service-owner); who may bulk-delete
(admins, service-owner) and that owners deliberately may not; that a mixed
selection is refused whole and why partial success was rejected; and that the
gate is the catalog's and the backend's, not the picker's — the picker only
narrows what is easy to click.

- [ ] **Step 2: Note the annotation's new load-bearing role**

`platform.io/resource-type` now decides visibility, not just which Template owns
a type. Say so in `docs/reference/annotations.md`: a Resource without it is not
narrowed by this policy at all.

- [ ] **Step 3: Add the nav entry and build**

```bash
cd /Users/adelin/Projects/Platform/new-ui && mkdocs build --strict 2>&1 | tail -5
```

Expected: no warnings. **Delete the generated `site/` directory afterwards** —
it is not in `.gitignore` and must not reach a commit.

- [ ] **Step 4: Commit**

```bash
git add docs/ mkdocs.yml
git commit -m "docs: who sees a resource, and who may bulk delete"
```

---

## Manual verification

Not a task. None of this is covered by the suite, and the visibility half is
invisible to it — a conditional decision that filters *nothing* looks identical
to one that filters correctly until a real catalog answers it.

1. `bash scripts/backstage-up.sh`, then `yarn start` from `backstage/`.
2. Sign in as a user in **neither** the owning group nor the service-owning
   group. The home page's resource list is empty, and `orders-db` is not
   findable in search or at its entity URL.
3. Sign in as a member of `group:default/payments` (owner of `orders-db` per the
   seed). It appears.
4. Sign in as a member of `group:default/checkout` (service-owner of
   `git-resource` via that template). Every `git-resource` appears, including
   ones the group does not own directly.
5. As an admin: everything appears, as before.
6. **Confirm nothing else narrowed.** The scaffolder still lists templates, the
   catalog still shows Components and the org sidebar still shows Groups, for
   every user above. This is the regression most likely to be missed.
7. Open the bulk-delete form as the `payments` owner: only resources they own
   or service-own are offered, and submitting succeeds. As `checkout`, every
   `git-resource` is offered. As a user in neither group, the picker is empty —
   which is the picker fix, delivered entirely by the catalog filter.
8. Hit `POST /requests` directly with a `resourceNames` array mixing one owned
   and one not, as a non-admin — confirm **403 and that nothing was created**.
   The picker is a courtesy; this is the gate.
