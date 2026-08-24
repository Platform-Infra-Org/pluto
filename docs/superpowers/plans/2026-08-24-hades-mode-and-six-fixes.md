# Hades Mode and Six Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship five small independent fixes (Grafana param types, a template-card
layout bug, a stale failure row, a screen rename, a configurable default potion)
plus the Hades potion — one new mode carrying nine god-boons, each with its own
ornament and animation, picked from a wheel on the home page.

**Architecture:** Tasks 1-5 are independent and touch disjoint files; they land
first so the branch is useful even if task 6 slips. Tasks 6-8 build the Hades
mode in three layers: registration and palette, the nine boon variants, then the
picker that equips them. All Hades CSS lives in a new `hades.ts` behind
`hadesCss()`, following `greek.ts`, because `styles.ts` is one template literal
where a stray backtick silently truncates the stylesheet.

**Tech Stack:** TypeScript, React 18, Backstage new frontend system, Jest +
Testing Library, CSS custom properties, pixel-art `Sprite` string arrays.

**Spec:** `docs/superpowers/specs/2026-08-24-hades-mode-and-six-fixes-design.md`

## Global Constraints

- All Node commands run from `backstage/`. Jest MUST have `CI=1` or
  `backstage-cli repo test` sits in interactive watch mode and prints nothing.
- Run one file with `CI=1 yarn test <path from backstage/>`.
- Gate before every commit: `yarn tsc` (silent) and the task's own test file.
  Full gate at the end: `yarn tsc && yarn lint:all && CI=1 yarn test`.
  Baseline on this branch is **860 passing, 0 failing** across 77 suites.
- **`plugins/platform-ui/src/styles.ts` is ONE template literal.** A stray
  backtick truncates the whole stylesheet; a backslash before a digit fails the
  app build while `tsc` stays silent. `styles.test.ts` guards both — never
  weaken it. New mode CSS goes in its own module, not inline here.
- **Every animation uses `steps()`, never `ease`**, and sits inside
  `@media (prefers-reduced-motion: no-preference)`. Nothing may convey state
  through motion alone.
- **Decoration may play, records may not.** Screen names can be renamed; request
  states and `kind` values (`CREATE`, `DELETE`) are records and must not be.
- Every new `config.d.ts` key needs `@visibility frontend`. A map whose *values*
  must reach the browser needs `@deepVisibility frontend` — plain `@visibility`
  annotates the map node only and the values are filtered out.
- Conventional commits. Never hand-edit `CHANGELOG.md` or a version field.
- Do not add a dependency to any `package.json`.

---

### Task 1: Grafana params accept scalars and lists

**Files:**
- Modify: `backstage/plugins/platform-ui/src/grafana.ts`
- Modify: `backstage/plugins/platform-ui/config.d.ts` (both `params` blocks)
- Test: `backstage/plugins/platform-ui/src/grafana.test.ts`
- Modify: `docs/how-to/embed-a-grafana-dashboard.md`

**Interfaces:**
- Consumes: existing `GrafanaConfig`, `readParams`, `dashboardUrl`, `resolveParams`.
- Produces:
  ```ts
  type ParamValue = string | string[];
  interface GrafanaConfig { /* … */ params?: Record<string, ParamValue> }
  ```
  `readParams`, `resolveParams` and `dashboardUrl` all move from `string` to
  `ParamValue`. Task 6-8 do not touch these.

- [ ] **Step 1: Write the failing tests**

Append to `grafana.test.ts`:

```ts
describe('non-string param values', () => {
  const read = (params: unknown) =>
    readGrafanaConfig(
      new ConfigReader({
        platform: {
          grafana: {
            baseUrl: 'https://grafana.example.com',
            dashboard: { uid: 'abc123', slug: 'platform-overview' },
            params,
          },
        },
      } as never) as never,
    )?.global.params;

  it('coerces a number', () => {
    expect(read({ 'var-limit': 10 })).toEqual({ 'var-limit': '10' });
  });

  it('coerces a boolean', () => {
    expect(read({ kiosk: true })).toEqual({ kiosk: 'true' });
  });

  it('keeps a list as a list', () => {
    expect(read({ 'var-env': ['prod', 'staging'] })).toEqual({
      'var-env': ['prod', 'staging'],
    });
  });

  it('coerces the members of a list', () => {
    expect(read({ 'var-n': [1, 2] })).toEqual({ 'var-n': ['1', '2'] });
  });

  it('skips a value that is not a scalar or a list of them', () => {
    // The frontend cannot refuse to start; a dashboard missing one variable
    // beats a blank page.
    expect(read({ ok: 'yes', bad: { nested: 1 } })).toEqual({ ok: 'yes' });
  });
});

describe('dashboardUrl with list params', () => {
  const CFG = {
    baseUrl: 'https://grafana.example.com',
    uid: 'abc123',
    slug: 'platform-overview',
  };

  it('repeats a list as multiple query parameters', () => {
    // How Grafana expresses a multi-value template variable.
    expect(dashboardUrl({ ...CFG, params: { 'var-env': ['prod', 'staging'] } })).toBe(
      'https://grafana.example.com/d/abc123/platform-overview?var-env=prod&var-env=staging',
    );
  });

  it('lets a computed value replace every member of a configured list', () => {
    const url = dashboardUrl(
      { ...CFG, params: { from: ['a', 'b'] } },
      { from: '1750000000000' },
    );
    expect(url).toContain('from=1750000000000');
    expect(url).not.toContain('from=a');
    expect(url).not.toContain('from=b');
  });
});

describe('resolveParams with list values', () => {
  const CTX = { requestId: 41, workflowName: 'git-ops-abc12' };

  it('resolves each member', () => {
    expect(resolveParams({ a: ['<< requestId >>', 'lit'] }, CTX)).toEqual({
      a: ['41', 'lit'],
    });
  });

  it('drops the members that resolve empty', () => {
    expect(resolveParams({ a: ['<< requestId >>', '<< nope >>'] }, CTX)).toEqual({
      a: ['41'],
    });
  });

  it('drops a key whose whole list resolves empty', () => {
    expect(resolveParams({ a: ['<< nope >>'], b: 'keep' }, CTX)).toEqual({ b: 'keep' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/grafana.test.ts`
Expected: FAIL — the number case throws a Backstage type error from
`getOptionalString`, and the list cases fail on shape.

- [ ] **Step 3: Implement**

In `grafana.ts`, widen the type and replace `readParams`:

```ts
/** A configured parameter: one value, or several for a multi-value variable. */
export type ParamValue = string | string[];
```

Change `GrafanaConfig.params` to `Record<string, ParamValue>`, then:

```ts
/** A scalar YAML value as a query-parameter string, or undefined if it is not one. */
function scalar(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

/**
 * A `params` block as a flat map; `undefined` when it holds nothing.
 *
 * Read raw rather than through `getOptionalString`: that throws on a type
 * mismatch, so a plain `var-limit: 10` used to take the whole field down.
 * Numbers and booleans are ordinary Grafana variable values and coerce; a list
 * stays a list, because Grafana expresses a multi-value variable as the same
 * key repeated. Anything else is skipped — the frontend cannot refuse to start,
 * and a dashboard missing one variable beats a blank page.
 */
function readParams(node: ConfigNode | undefined): Record<string, ParamValue> | undefined {
  if (!node) return undefined;
  const out: Record<string, ParamValue> = {};
  for (const key of node.keys()) {
    const raw: unknown = node.get(key);
    if (Array.isArray(raw)) {
      const members = raw.map(scalar).filter((v): v is string => v !== undefined);
      if (members.length) out[key] = members;
      continue;
    }
    const one = scalar(raw);
    if (one !== undefined) out[key] = one;
  }
  return Object.keys(out).length ? out : undefined;
}
```

In `dashboardUrl`, replace the config-params loop:

```ts
  for (const [key, value] of Object.entries(cfg.params ?? {})) {
    // `append` for a list so a multi-value variable survives as repeated keys.
    // The computed parameters below still use `set`, which collapses every
    // same-named value — so a computed one beats a configured list outright.
    if (Array.isArray(value)) for (const v of value) params.append(key, v);
    else params.set(key, value);
  }
```

In `resolveParams`, change the signature to
`Record<string, ParamValue> | undefined` returning the same, and replace the
loop body:

```ts
  const out: Record<string, ParamValue> = {};
  for (const [key, raw] of Object.entries(params)) {
    if (Array.isArray(raw)) {
      const members = raw.map(one).filter(Boolean);
      if (members.length) out[key] = members;
      continue;
    }
    const value = one(raw);
    if (value) out[key] = value;
  }
```

with the single-value substitution lifted into a local so both branches share it:

```ts
  const one = (raw: string) =>
    raw.replace(TOKEN, (_m, token: string) =>
      Object.hasOwn(values, token) ? values[token] : '',
    );
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/grafana.test.ts`
Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 5: Widen the config schema**

In `config.d.ts`, both `params` declarations change type and keep
`@deepVisibility frontend` (the values must reach the browser):

```ts
        /**
         * Extra query parameters … Values may be a string, a number, a boolean,
         * or a list of those — a list becomes the same key repeated, which is
         * how Grafana expresses a multi-value template variable.
         * @deepVisibility frontend
         */
        params?: {
          [key: string]: string | number | boolean | Array<string | number | boolean>;
        };
```

- [ ] **Step 6: Verify the values still survive frontend filtering**

Run:

```bash
cd backstage && cat > /tmp/graf-types.yaml <<'YAML'
platform:
  grafana:
    baseUrl: https://grafana.example.com
    dashboard: { uid: abc123, slug: overview }
    params:
      var-env: [prod, staging]
      var-limit: 10
YAML
yarn backstage-cli config:print --frontend --config app-config.yaml --config /tmp/graf-types.yaml 2>&1 | grep -A8 'grafana:'
```

Expected: the `params` block shows `var-env` with both members and
`var-limit: 10` — not `params: {}`. If it prints `{}`, `@deepVisibility` was
lost in the edit.

- [ ] **Step 7: Update the how-to**

In `docs/how-to/embed-a-grafana-dashboard.md`, in the params section, replace the
sentence describing param values with:

```markdown
Values may be a string, a number, a boolean, or a list. A list becomes the same
key repeated — `var-env: [prod, staging]` renders `?var-env=prod&var-env=staging`
— which is how Grafana expresses a multi-value template variable. A value that is
neither a scalar nor a list of them is skipped rather than failing the page.
```

- [ ] **Step 8: Commit**

```bash
git add backstage/plugins/platform-ui/src/grafana.ts \
        backstage/plugins/platform-ui/src/grafana.test.ts \
        backstage/plugins/platform-ui/config.d.ts \
        docs/how-to/embed-a-grafana-dashboard.md
git commit -m "fix: accept numbers, booleans and lists as grafana params"
```

---

### Task 2: A long template name stops pushing the card's buttons down

**Files:**
- Modify: `backstage/plugins/platform-ui/src/styles.ts` (the template-card title rule)
- Test: `backstage/plugins/platform-ui/src/styles.test.ts`

**Interfaces:**
- Consumes: nothing. Produces: nothing. One CSS declaration and its guard.

- [ ] **Step 1: Find the rule**

Run:

```bash
cd backstage && grep -n "overflow-wrap" plugins/platform-ui/src/styles.ts
```

The one to change is on the template card's title box, inside the
`.sc-route-create [class*="MuiCard-root"] > .MuiBox-root:first-child` group —
the rule that also carries `min-width: 0` and `text-align: left`.

- [ ] **Step 2: Write the failing test**

Append to `styles.test.ts`:

```ts
it('lets a long template name shrink below its longest word', () => {
  // `break-word` paints a break but does NOT reduce intrinsic min-content
  // width, so the flex line stayed as wide as the longest word and pushed the
  // detail/favourite row onto a second line. `anywhere` reduces it, which is
  // what keeps the buttons pinned top-right.
  const css = SHADCN_CSS;
  const titleRule = css.slice(
    css.indexOf('.sc-route-create'),
    css.indexOf('.sc-route-create') + 4000,
  );
  expect(titleRule).toContain('overflow-wrap: anywhere');
  expect(titleRule).not.toContain('overflow-wrap: break-word');
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/styles.test.ts`
Expected: FAIL — the stylesheet still says `break-word`.

- [ ] **Step 4: Implement**

Change that one declaration to `overflow-wrap: anywhere;` and extend the comment
directly above the rule so the reason survives:

```
   `anywhere`, not `break-word`: both paint the same break, but only `anywhere`
   reduces the box's intrinsic min-content width. With `break-word` the flex
   line stayed as wide as the longest word, which is what pushed the actions
   onto a second row. The container keeps `wrap` — the catch-all that forces
   every other header child onto its own full-width row depends on it.
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/styles.test.ts`
Expected: PASS, including the pre-existing backtick and backslash guards.

- [ ] **Step 6: Commit**

```bash
git add backstage/plugins/platform-ui/src/styles.ts \
        backstage/plugins/platform-ui/src/styles.test.ts
git commit -m "fix: keep template card actions pinned when the name is long"
```

---

### Task 3: A successful re-check clears the failure row

**Files:**
- Modify: `backstage/plugins/platform-requests-backend/src/store.ts` (`setState`)
- Modify: `backstage/plugins/platform-requests/src/components/RequestPage.tsx` (the error row)
- Test: `backstage/plugins/platform-requests-backend/src/store.test.ts`
- Test: `backstage/plugins/platform-requests-backend/src/router.test.ts`
- Test: `backstage/plugins/platform-requests/src/components/RequestPage.test.tsx`

**Interfaces:**
- Consumes: `store.setState(id, state)`.
- Produces: the invariant *a `SUCCEEDED` request has no `error`*, enforced in
  `setState`. No signature change.

- [ ] **Step 1: Write the failing store test**

`store.test.ts` builds its store with a local `createStore(databaseId)` helper
and drives every case through `it.each(databases.eachSupportedId())`. Follow
that shape exactly — a plain `it()` would have no store:

```ts
  it.each(databases.eachSupportedId())(
    'clears the failure reason when a request succeeds, %p',
    async databaseId => {
      // A retried workflow reaches SUCCEEDED straight from FAILED. Leaving the
      // old reason on the row is not a UI problem — the API served it too.
      const store = await createStore(databaseId);
      const r = await store.create({
        kind: 'CREATE',
        resourceType: 'bucket',
        resourceName: 'data',
        requester: 'alice',
      });

      await store.setWorkflow(r.id, { error: 'boom' });
      await store.setState(r.id, 'FAILED');
      expect((await store.get(r.id))?.error).toBe('boom');

      await store.setState(r.id, 'SUCCEEDED');
      expect((await store.get(r.id))?.error).toBeUndefined();
    },
  );

  it.each(databases.eachSupportedId())(
    'leaves the failure reason alone on every other transition, %p',
    async databaseId => {
      const store = await createStore(databaseId);
      const r = await store.create({
        kind: 'CREATE',
        resourceType: 'bucket',
        resourceName: 'data',
        requester: 'alice',
      });

      await store.setWorkflow(r.id, { error: 'boom' });
      await store.setState(r.id, 'FAILED');
      await store.setState(r.id, 'IN_PROGRESS');
      expect((await store.get(r.id))?.error).toBe('boom');
    },
  );
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backstage && CI=1 yarn test plugins/platform-requests-backend/src/store.test.ts`
Expected: FAIL — `error` is still `'boom'` after the move to `SUCCEEDED`.

- [ ] **Step 3: Implement the invariant in the store**

In `store.ts`'s `setState`, clear the column when the new state is `SUCCEEDED`:

```ts
    // A succeeded request has no failure reason. Enforced here rather than at
    // the call sites because every path that can reach SUCCEEDED — the poller,
    // the re-check route, and whatever is added next — goes through this one
    // method. The '' rather than null matches how setWorkflow empties it, and
    // the DTO renders `error` on truthiness.
    if (state === 'SUCCEEDED') update.error = '';
```

Place it beside the existing state write, inside the same update object the
method already builds.

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backstage && CI=1 yarn test plugins/platform-requests-backend/src/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the route-level test**

Append to `router.test.ts`, reusing the file's existing app/store harness and its
`reconcileRequest` stub:

```ts
it('returns no failure reason when a re-check finds the workflow succeeded', async () => {
  // The bug: /refresh only cleared `error` when the outcome was IN_PROGRESS, so
  // a workflow retried in Argo that had already finished came back SUCCEEDED
  // with the previous run's message still attached.
  const created = await seedFailedRequest(/* …the file's usual helper… */);
  reconcile.mockResolvedValue({ state: 'SUCCEEDED', changed: true, reason: 'moved-to-succeeded' });

  const res = await request(app).post(`/requests/${created.id}/refresh`).send();
  expect(res.status).toBe(200);
  expect(res.body.request.state).toBe('SUCCEEDED');
  expect(res.body.request.error).toBeUndefined();
});
```

If the file has no `seedFailedRequest`-shaped helper, build the request with
whatever it already uses and drive it to `FAILED` with `setWorkflow` +
`setState`, as the store test does.

- [ ] **Step 6: Run it**

Run: `cd backstage && CI=1 yarn test plugins/platform-requests-backend/src/router.test.ts`
Expected: PASS — the store guard already fixes this path; the test pins it.

- [ ] **Step 7: Stop the view trusting the field alone**

In `RequestPage.tsx`, change the error row's condition:

```tsx
      {request.state === 'FAILED' && request.error && (
        <div className="sc-notice sc-notice-fail" style={{ marginBottom: 12 }}>
          <strong>Failed:</strong> {request.error}
        </div>
      )}
```

Add above it:

```tsx
      {/* Gated on the state as well as the message: rows written before the
          store enforced "a succeeded request has no error" are still in the
          database, and this is what stops them rendering without a migration. */}
```

- [ ] **Step 8: Add the view test**

Append to `RequestPage.test.tsx`'s existing describe, using its `renderWith`
helper:

`RequestPage.test.tsx`'s `renderWith(config, request)` takes a
`Partial<Request>` override as its second argument — added when the Metrics card
landed. Use it:

```tsx
it('shows no failure row on a succeeded request carrying a stale error', async () => {
  renderWith({}, { state: 'SUCCEEDED', error: 'boom from the previous run' });
  await waitFor(() => expect(screen.getByText('my-resource')).toBeInTheDocument());
  expect(screen.queryByText(/boom from the previous run/)).toBeNull();
});

it('still shows the failure row while failed', async () => {
  renderWith({}, { state: 'FAILED', error: 'boom' });
  await waitFor(() => expect(screen.getByText(/boom/)).toBeInTheDocument());
});
```

- [ ] **Step 9: Run all three test files**

Run:

```bash
cd backstage && CI=1 yarn test \
  plugins/platform-requests-backend/src/store.test.ts \
  plugins/platform-requests-backend/src/router.test.ts \
  plugins/platform-requests/src/components/RequestPage.test.tsx
```

Expected: PASS, all three, including every pre-existing test.

- [ ] **Step 10: Commit**

```bash
git add backstage/plugins/platform-requests-backend/src/store.ts \
        backstage/plugins/platform-requests-backend/src/store.test.ts \
        backstage/plugins/platform-requests-backend/src/router.test.ts \
        backstage/plugins/platform-requests/src/components/RequestPage.tsx \
        backstage/plugins/platform-requests/src/components/RequestPage.test.tsx
git commit -m "fix: drop the failure reason when a request succeeds"
```

---

### Task 4: "Create" becomes "New Request"

**Files:**
- Modify: `backstage/plugins/platform-ui/src/flavour.ts`
- Test: `backstage/plugins/platform-ui/src/flavour.test.ts`
- Modify: `backstage/packages/app/src/App.tsx` (translation override, if the key exists)

**Interfaces:**
- Consumes: `screenName(title, flavour)`, already the single funnel for nav labels.
- Produces: `screenName('Create', undefined) === 'New Request'` and
  `screenName('Create', 'fantasy') === 'Summon'`.

- [ ] **Step 1: Write the failing tests**

Append to `flavour.test.ts`:

```ts
describe('base screen names', () => {
  it('renames Create to New Request', () => {
    // The screen creates requests of several kinds — CREATE and DELETE today,
    // UPDATE later — so naming it after one of them reads as a filter.
    expect(screenName('Create', undefined)).toBe('New Request');
  });

  it('still reaches the fantasy name through the rename', () => {
    // Order matters: rename first, then flavour. Keying fantasy off the old
    // literal is how Summon would silently stop working.
    expect(screenName('Create', 'fantasy')).toBe('Summon');
  });

  it('leaves other screens alone', () => {
    expect(screenName('Requests', undefined)).toBe('Requests');
    expect(screenName('Catalog', undefined)).toBe('Catalog');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/flavour.test.ts`
Expected: FAIL — `screenName('Create', undefined)` returns `'Create'`.

- [ ] **Step 3: Implement**

Replace the maps and the function in `flavour.ts`:

```ts
/**
 * Screens this app renames regardless of flavour.
 *
 * `Create` is Backstage's own nav title. The screen files requests of several
 * kinds — CREATE and DELETE today, UPDATE later — so naming it after one of
 * them reads as a filter over the others. The request `kind` values themselves
 * are records and are untouched.
 */
const BASE_SCREENS: Record<string, string> = {
  Create: 'New Request',
};

/** Screen names only. Deliberately short: three entries people navigate by. */
const FANTASY_SCREENS: Record<string, string> = {
  Requests: 'Quests',
  'New Request': 'Summon',
  Catalog: 'Atlas',
};

export function screenName(title: string, flavour: Flavour): string {
  // Base rename first, then flavour on top of the result — so the fantasy map
  // is keyed on what this app calls the screen, not on what Backstage called it.
  const base = BASE_SCREENS[title] ?? title;
  if (flavour !== 'fantasy') return base;
  return FANTASY_SCREENS[base] ?? base;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/flavour.test.ts`
Expected: PASS.

- [ ] **Step 5: Find the page heading's translation key**

The sidebar is done; the page's own heading belongs to Backstage's scaffolder.
Find the key:

```bash
cd backstage && grep -rn "templateListPage\|Create a new component\|title" \
  node_modules/@backstage/plugin-scaffolder/dist/translation*.js 2>/dev/null | head -20
```

Expected: a translation ref exposing a templates-page title key.

**If a key exists**, override it in `packages/app/src/App.tsx` with
`createTranslationMessages` against the scaffolder's translation ref, registered
in `features` alongside the other modules already there. Follow the shape of the
existing registrations in that file.

**If no key exists**, stop and do not reach for a CSS `content` swap — it breaks
screen readers and copy-paste. Record in your report that the heading could not
be changed through a supported seam, leave it, and note it for the review to
triage.

- [ ] **Step 6: Verify the heading**

If Step 5 found a key:

```bash
cd backstage && yarn tsc
```

Expected: silent. The visual check belongs to the manual verification section.

- [ ] **Step 7: Commit**

```bash
git add backstage/plugins/platform-ui/src/flavour.ts \
        backstage/plugins/platform-ui/src/flavour.test.ts
# add packages/app/src/App.tsx only if Step 5 changed it
git commit -m "feat: name the templates screen New Request"
```

---

### Task 5: A configurable default potion

**Files:**
- Modify: `backstage/plugins/platform-ui/src/SchemeRoot.tsx`
- Modify: `backstage/plugins/platform-ui/config.d.ts` (`app.branding`)
- Test: `backstage/plugins/platform-ui/src/SchemeRoot.test.ts`

**Interfaces:**
- Consumes: `SCHEMES`, `applyScheme`, the module-level `branding` relay and
  `setBrandingImages`.
- Produces: `app.branding.defaultScheme`, and a `defaultScheme()` that resolves
  it through the shelf. Task 6 adds `hades` to `SCHEMES`, which becomes a legal
  value for this key with no further change here.

- [ ] **Step 1: Write the failing tests**

Append to `SchemeRoot.test.ts`, following the file's existing import style:

```ts
describe('configured default scheme', () => {
  it('falls back to obsidian when nothing is configured', () => {
    expect(resolveDefaultScheme(undefined).id).toBe('obsidian');
  });

  it('falls back to obsidian for an id no longer on the shelf', () => {
    // Same degrade rule the hard-coded default already documented: resolve
    // through the shelf, so a removed or renamed scheme leaves new visitors on
    // a real bottle instead of a dead id.
    expect(resolveDefaultScheme('no-such-potion').id).toBe('obsidian');
  });

  it('uses a configured id that exists', () => {
    expect(resolveDefaultScheme('greek').id).toBe('greek');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/SchemeRoot.test.ts`
Expected: FAIL — `resolveDefaultScheme` is not exported.

- [ ] **Step 3: Implement**

In `SchemeRoot.tsx`, replace the default-scheme block:

```ts
/**
 * What a browser with nothing stored gets.
 *
 * Resolved through the shelf rather than used raw, so a configured id that is
 * removed or renamed degrades to the first bottle instead of leaving every new
 * visitor on an id that no longer exists.
 */
const DEFAULT_SCHEME_ID = 'obsidian';

export function resolveDefaultScheme(configured: string | undefined): Scheme {
  return (
    SCHEMES.find(s => s.id === configured) ??
    SCHEMES.find(s => s.id === DEFAULT_SCHEME_ID) ??
    SCHEMES[0]
  );
}

const defaultScheme = (): Scheme => resolveDefaultScheme(branding.defaultScheme);
```

Add `defaultScheme?: string` to the module-level `branding` relay object and to
`setBrandingImages`'s parameter type, beside `mark` and `favicon`.

In the component that already calls `setBrandingImages` from config, pass it:

```ts
      defaultScheme: config.getOptionalString('app.branding.defaultScheme'),
```

Then apply it before paint, only when the visitor has no pick of their own:

```tsx
  // applyScheme runs at module load — before React, so before configApi exists
  // — and therefore cannot have seen the configured default. Re-apply here,
  // and only when nothing is stored: a returning visitor's own pick always
  // wins, or the picker would look broken. useLayoutEffect, not useEffect, so
  // a new visitor never sees obsidian paint first.
  useLayoutEffect(() => {
    const stored =
      typeof localStorage !== 'undefined' && localStorage.getItem('platform-scheme');
    if (!stored) applyScheme(defaultScheme().id);
  }, []);
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/SchemeRoot.test.ts`
Expected: PASS, including the pre-existing contrast and vessel-order tests.

- [ ] **Step 5: Declare the config key**

In `config.d.ts`, inside `app.branding`, beside `flavour`:

```ts
      /**
       * Which potion a browser with nothing stored gets.
       *
       * An id from the scheme shelf (`obsidian`, `greek`, `hades`, …). A
       * visitor's own pick always wins — this decides only the first visit.
       * Missing or unknown falls back to `obsidian`.
       * @visibility frontend
       */
      defaultScheme?: string;
```

- [ ] **Step 6: Sample the key**

In `backstage/app-config.yaml`, under the commented `app.branding` example, add:

```yaml
    # Which potion a first-time visitor gets. A stored pick always wins.
    # Missing or unknown → obsidian.
    # defaultScheme: greek
```

- [ ] **Step 7: Commit**

```bash
git add backstage/plugins/platform-ui/src/SchemeRoot.tsx \
        backstage/plugins/platform-ui/src/SchemeRoot.test.ts \
        backstage/plugins/platform-ui/config.d.ts \
        backstage/app-config.yaml
git commit -m "feat: configurable default potion, obsidian when unset"
```

---

### Task 6: The Hades mode — registration, vessel and base palette

**Files:**
- Create: `backstage/plugins/platform-ui/src/hades.ts`
- Create: `backstage/plugins/platform-ui/src/hades.test.ts`
- Modify: `backstage/plugins/platform-ui/src/sprites.ts` (`HADES_VESSEL`)
- Modify: `backstage/plugins/platform-ui/src/SchemeRoot.tsx` (`MODES`, `SCHEMES`, `MODE_VESSELS`)
- Modify: `backstage/plugins/platform-ui/src/styles.ts` (import + interpolate)

**Interfaces:**
- Consumes: `Sprite` from `sprites.ts`; the `Mode` union in `SchemeRoot.tsx`.
- Produces:
  ```ts
  export const BOONS = ['zeus','poseidon','demeter','hermes','dionysus',
                        'ares','artemis','aphrodite','chaos'] as const;
  export type Boon = (typeof BOONS)[number];
  export const BOON_LABELS: Record<Boon, string>;
  export function hadesCss(): string;
  export const HADES_VESSEL: Sprite;   // from sprites.ts
  ```
  Task 7 fills in the per-boon blocks; Task 8 consumes `BOONS`/`BOON_LABELS`.

- [ ] **Step 1: Write the failing tests**

Create `hades.test.ts`:

```ts
import { BOONS, BOON_LABELS, hadesCss } from './hades';

describe('hades mode', () => {
  it('defines the nine boons of the wheel', () => {
    expect([...BOONS]).toEqual([
      'zeus', 'poseidon', 'demeter', 'hermes', 'dionysus',
      'ares', 'artemis', 'aphrodite', 'chaos',
    ]);
  });

  it('names every boon', () => {
    for (const b of BOONS) expect(BOON_LABELS[b]).toBeTruthy();
  });

  it('registers the base palette on the mode class', () => {
    expect(hadesCss()).toContain(':root.sc-hades');
  });

  it('animates only in steps()', () => {
    // The design-system contract: steps() everywhere, never ease, including
    // third-party motion. An eased keyframe here is a defect, not a taste call.
    const css = hadesCss();
    expect(css).not.toMatch(/animation[^;]*\bease\b/);
    expect(css).not.toMatch(/transition[^;]*\bease\b/);
    for (const decl of css.match(/animation:[^;]+;/g) ?? []) {
      expect(decl).toContain('steps(');
    }
  });

  it('puts every animation behind a reduced-motion guard', () => {
    // Count, not presence: one unguarded keyframe is exactly the bug this
    // catches, and a single guard elsewhere in the file would hide it.
    const css = hadesCss();
    const guards = (css.match(/@media \(prefers-reduced-motion: no-preference\)/g) ?? []).length;
    const animated = (css.match(/animation:/g) ?? []).length;
    expect(guards).toBeGreaterThan(0);
    expect(animated).toBeGreaterThan(0);
    const outside = css.split('@media (prefers-reduced-motion: no-preference)')[0];
    expect(outside).not.toContain('animation:');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/hades.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Create `hades.ts` with the base register**

Model the file on `greek.ts` — same doc-comment density, same `Css()` export
returning one template literal. The base register is Hades' own: obsidian ground,
crimson accent, gold trim.

```ts
/**
 * The Hades potion: one mode, nine boons.
 *
 * Unlike the other crafted modes, this one carries a second axis. `data-boon`
 * on the root selects a god, and each god redefines the accent tokens and swaps
 * the ornament and animation layer. Nine bottles on the shelf would have been
 * nine silhouettes to draw and nine rows to keep in contrast; one bottle and a
 * wheel is the same variety at a ninth of the surface.
 *
 * An unset `data-boon` is deliberate and is Hades' own register — the centre of
 * the wheel, which is the emblem rather than a god.
 */
import { Sprite } from './sprites';

export const BOONS = [
  'zeus', 'poseidon', 'demeter', 'hermes', 'dionysus',
  'ares', 'artemis', 'aphrodite', 'chaos',
] as const;
export type Boon = (typeof BOONS)[number];

/** Shown beside the wheel: the equipped boon must be readable, not only visible. */
export const BOON_LABELS: Record<Boon, string> = {
  zeus: 'Zeus', poseidon: 'Poseidon', demeter: 'Demeter',
  hermes: 'Hermes', dionysus: 'Dionysus', ares: 'Ares',
  artemis: 'Artemis', aphrodite: 'Aphrodite', chaos: 'Chaos',
};

export function hadesCss(): string {
  return `
:root.sc-hades {
  --sc-bg: 260 18% 7%;
  --sc-fg: 40 30% 92%;
  --sc-primary: 352 72% 45%;
  --sc-primary-fg: 0 0% 100%;
  --sc-accent: 43 74% 55%;
  --sc-border: 260 14% 18%;
}
`;
}
```

Fill the base register with the same token set the other modes define — copy the
token *names* from `greek.ts`'s `:root.sc-greek` block so nothing is missing, and
give them Hades values. Do not add animations yet; Task 7 owns those.

- [ ] **Step 4: Draw the vessel**

In `sprites.ts`, beside `AMPHORA_VESSEL`, add a 16-wide `HADES_VESSEL` in the
same format — `#` outline, `~` fill, `.` transparent, same row count as its
neighbours. A stemmed chalice with a flared lip reads as Hades' goblet at 16px
and stays distinct from `TANKARD_VESSEL` (straight-sided) and `CAULDRON_VESSEL`
(round-bottomed). Follow the existing sprites' silhouette conventions.

- [ ] **Step 5: Register the mode**

In `SchemeRoot.tsx`, three edits:

```ts
// 1. MODES — the list applyScheme clears from. A mode missing here leaves its
//    palette applied after the next pick.
const MODES = [ /* … */, 'egyptian', 'hades'] as const;
```

```ts
// 2. MODE_VESSELS
  egyptian: CANOPIC_VESSEL,
  hades: HADES_VESSEL,
```

```ts
// 3. SCHEMES — inside the vessel group at the FRONT, after `egyptian`.
//    SchemeRoot.test.ts fails if a non-vessel scheme is slotted between them.
  {
    id: 'hades',
    label: 'Hades',
    hsl: '352 72% 45%',
    fg: WHITE, // measured — see SchemeRoot.test.ts
    mode: 'hades',
  },
```

Import `HADES_VESSEL` alongside the other vessels.

- [ ] **Step 6: Interpolate the stylesheet**

In `styles.ts`, add the import beside `egyptianCss` and the interpolation beside
`${egyptianCss()}`:

```ts
import { hadesCss } from './hades';
```
```
${hadesCss()}
```

- [ ] **Step 7: Run the tests**

Run:

```bash
cd backstage && CI=1 yarn test \
  plugins/platform-ui/src/hades.test.ts \
  plugins/platform-ui/src/SchemeRoot.test.ts \
  plugins/platform-ui/src/styles.test.ts \
  plugins/platform-ui/src/contrast.test.ts \
  plugins/platform-ui/src/sprites.test.ts
```

Expected: PASS. If `contrast.test.ts` fails on the new register, adjust the
Hades token values until the measured ratio clears — do not weaken the test.
If `sprites.test.ts` pins a sprite count, update the count, not the assertion's
intent.

- [ ] **Step 8: Commit**

```bash
git add backstage/plugins/platform-ui/src/hades.ts \
        backstage/plugins/platform-ui/src/hades.test.ts \
        backstage/plugins/platform-ui/src/sprites.ts \
        backstage/plugins/platform-ui/src/SchemeRoot.tsx \
        backstage/plugins/platform-ui/src/styles.ts
git commit -m "feat: add the Hades potion and its vessel"
```

---

### Task 7: The nine boons — palettes, ornaments and motion

**Files:**
- Modify: `backstage/plugins/platform-ui/src/hades.ts`
- Test: `backstage/plugins/platform-ui/src/hades.test.ts`
- Test: `backstage/plugins/platform-ui/src/contrast.test.ts`

**Interfaces:**
- Consumes: `BOONS`, `hadesCss()` from Task 6.
- Produces: a `:root.sc-hades[data-boon="<boon>"]` block per boon, each with an
  ornament and one stepped animation. Task 8 only sets the attribute.

- [ ] **Step 1: Write the failing tests**

Append to `hades.test.ts`:

```ts
describe('boon variants', () => {
  const css = hadesCss();

  it('gives every boon its own block', () => {
    for (const b of BOONS) {
      expect(`${b}:${css.includes(`[data-boon="${b}"]`)}`).toBe(`${b}:true`);
    }
  });

  it('gives every boon its own accent', () => {
    const accents = BOONS.map(b => {
      const block = css.slice(css.indexOf(`[data-boon="${b}"]`));
      return block.slice(0, block.indexOf('}')).match(/--sc-primary:\s*([^;]+);/)?.[1];
    });
    expect(accents.every(Boolean)).toBe(true);
    // Nine gods that all render the same colour is the failure this catches.
    expect(new Set(accents).size).toBe(BOONS.length);
  });

  it('gives every boon its own keyframes', () => {
    for (const b of BOONS) {
      expect(`${b}:${css.includes(`sc-hades-${b}`)}`).toBe(`${b}:true`);
    }
  });

  it('defines the one-shot flare', () => {
    expect(css).toContain('sc-hades-flare');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/hades.test.ts`
Expected: FAIL — no `[data-boon]` blocks yet.

- [ ] **Step 3: Implement the nine blocks**

Each boon is one block plus one keyframes rule. Here is the complete pattern for
two of them — write the remaining seven to this exact shape, taking the accent,
ornament and motion from the table below:

```css
/* ZEUS — electric gold. Forked bolts in the header rule, arc-flicker.
   The flicker is two stops, not a fade: a bolt either strikes or it does not,
   and steps() is the only cadence that reads as electricity rather than as a
   dimmer. */
:root.sc-hades[data-boon="zeus"] {
  --sc-primary: 45 96% 55%;
  --sc-primary-fg: 240 10% 8%;
  --sc-boon-ornament: linear-gradient(115deg, transparent 45%, hsl(45 96% 55% / 0.5) 46%, transparent 47%);
}
@media (prefers-reduced-motion: no-preference) {
  :root.sc-hades[data-boon="zeus"] .sc-card-h::after {
    animation: sc-hades-zeus 1.4s steps(2, end) infinite;
  }
}
@keyframes sc-hades-zeus { 0%, 80% { opacity: 0; } 81%, 100% { opacity: 1; } }
```

```css
/* POSEIDON — deep aqua. A wave meander along card edges, swelling in four
   stops so the crest moves in discrete cells like the rest of the pixel
   furniture. */
:root.sc-hades[data-boon="poseidon"] {
  --sc-primary: 190 82% 42%;
  --sc-primary-fg: 0 0% 100%;
  --sc-boon-ornament: repeating-linear-gradient(90deg, hsl(190 82% 42% / 0.45) 0 6px, transparent 6px 12px);
}
@media (prefers-reduced-motion: no-preference) {
  :root.sc-hades[data-boon="poseidon"] .sc-card-h::after {
    animation: sc-hades-poseidon 2s steps(4, end) infinite;
  }
}
@keyframes sc-hades-poseidon { from { background-position: 0 0; } to { background-position: 24px 0; } }
```

The remaining seven, each a block and a keyframes rule in the same shape. The
row IS the specification — accent, ornament and the motion's character and stop
count:

| Boon | `--sc-primary` | Ornament | Motion (all `steps()`) |
|---|---|---|---|
| `demeter` | `195 40% 88%` | frost/wheat border, repeating-linear-gradient | slow drift, 6 stops, 6s |
| `hermes` | `32 92% 55%` | speed lines on the nav cursor | fastest, 3 stops, 0.6s |
| `dionysus` | `280 62% 58%` | vine-and-goblet corner marks | bubble rise, 5 stops, 2.4s |
| `ares` | `0 78% 46%` | crossed spears in the header rule | blade flash, 2 stops, 1.1s |
| `artemis` | `140 55% 45%` | arrow rule beneath the title | streak, 4 stops, 1.8s |
| `aphrodite` | `330 78% 62%` | heart-laurel corner marks | pulse, 4 stops, 2s |
| `chaos` | `268 45% 52%` | orbiting rings | orbit, 8 stops, 4s |

Pick `--sc-primary-fg` per boon as WHITE or near-black, whichever measures above
4.5:1 against that accent — the same rule the other schemes follow. Add each to
`contrast.test.ts`'s table so the ratio is measured rather than asserted by eye.

Finally the flare, one shot on pick, in whatever accent is current:

```css
@media (prefers-reduced-motion: no-preference) {
  .sc-boon-flare { animation: sc-hades-flare 420ms steps(6, end) 1; }
}
@keyframes sc-hades-flare {
  from { box-shadow: 0 0 0 0 hsl(var(--sc-primary) / 0.9); }
  to { box-shadow: 0 0 0 18px hsl(var(--sc-primary) / 0); }
}
```

- [ ] **Step 4: Run the tests**

Run:

```bash
cd backstage && CI=1 yarn test \
  plugins/platform-ui/src/hades.test.ts \
  plugins/platform-ui/src/contrast.test.ts \
  plugins/platform-ui/src/styles.test.ts
```

Expected: PASS. Every boon distinct, every animation stepped and guarded, every
foreground measured.

- [ ] **Step 5: Commit**

```bash
git add backstage/plugins/platform-ui/src/hades.ts \
        backstage/plugins/platform-ui/src/hades.test.ts \
        backstage/plugins/platform-ui/src/contrast.test.ts
git commit -m "feat: nine Hades boons, each with its own ornament and cadence"
```

---

### Task 8: The boon wheel on the home page

**Files:**
- Create: `backstage/plugins/platform-ui/src/BoonPicker.tsx`
- Create: `backstage/plugins/platform-ui/src/BoonPicker.test.tsx`
- Modify: `backstage/plugins/platform-ui/src/index.ts` (export it)
- Modify: `backstage/plugins/platform-ui/src/SchemeRoot.tsx` (`applyBoon`)
- Modify: `backstage/plugins/platform-requests/src/components/HomePage.tsx`
- Modify: `backstage/app-config.yaml` (`platform.home.sections`)
- Modify: `backstage/plugins/platform-requests/config.d.ts` (the `sections` enum, if it is enumerated)

**Interfaces:**
- Consumes: `BOONS`, `BOON_LABELS` from `hades.ts`; `applyScheme` from `SchemeRoot`.
- Produces: `<BoonPicker />`, and `applyBoon(boon)` exported from `SchemeRoot`.

- [ ] **Step 1: Write the failing tests**

Create `BoonPicker.test.tsx`:

```tsx
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { BOONS, BOON_LABELS } from './hades';
import { BoonPicker } from './BoonPicker';

describe('BoonPicker', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-boon');
  });

  it('offers every boon as a named button', () => {
    render(<BoonPicker />);
    for (const b of BOONS) {
      expect(screen.getByRole('button', { name: BOON_LABELS[b] })).toBeInTheDocument();
    }
  });

  it('equips the Hades potion and the boon in one act', () => {
    // "Pick a symbol and the theme changes" has to be true from any starting
    // scheme, so the pick sets both.
    render(<BoonPicker />);
    fireEvent.click(screen.getByRole('button', { name: BOON_LABELS.zeus }));
    expect(document.documentElement).toHaveClass('sc-hades');
    expect(document.documentElement.getAttribute('data-boon')).toBe('zeus');
    expect(localStorage.getItem('platform-boon')).toBe('zeus');
  });

  it('names the equipped boon in text', () => {
    // Nothing conveys state through motion alone: with animation off, the
    // equipped god must still be readable.
    render(<BoonPicker />);
    fireEvent.click(screen.getByRole('button', { name: BOON_LABELS.ares }));
    expect(screen.getByText(BOON_LABELS.ares, { selector: ':not(button)' })).toBeInTheDocument();
  });

  it('marks the equipped boon as pressed', () => {
    render(<BoonPicker />);
    const zeus = screen.getByRole('button', { name: BOON_LABELS.zeus });
    fireEvent.click(zeus);
    expect(zeus).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: BOON_LABELS.ares })).toHaveAttribute(
      'aria-pressed', 'false',
    );
  });

  it('restores the stored boon on mount', () => {
    localStorage.setItem('platform-boon', 'artemis');
    render(<BoonPicker />);
    expect(document.documentElement.getAttribute('data-boon')).toBe('artemis');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/BoonPicker.test.tsx`
Expected: FAIL — the component does not exist.

- [ ] **Step 3: Add `applyBoon` to SchemeRoot**

```ts
/**
 * Equip a boon. Separate from `applyScheme` because it is a second axis: the
 * scheme decides the mode class, the boon decides which of that mode's nine
 * registers applies. Written as an attribute rather than a class so it cannot
 * collide with the `sc-<mode>` classes `applyScheme` clears.
 */
export function applyBoon(boon: string | undefined) {
  const root = document.documentElement;
  if (boon) root.setAttribute('data-boon', boon);
  else root.removeAttribute('data-boon');
  if (typeof localStorage !== 'undefined') {
    if (boon) localStorage.setItem('platform-boon', boon);
    else localStorage.removeItem('platform-boon');
  }
}
```

Call it from the same place `applyScheme` is restored at startup, reading
`localStorage.getItem('platform-boon')`, so a reload keeps the equipped god.

- [ ] **Step 4: Implement the picker**

Create `BoonPicker.tsx`. A `Card` matching the other home blocks, holding the
nine symbols on a circle and the equipped name in text.

```tsx
/**
 * The boon wheel: nine gods around the Hades emblem.
 *
 * Picking sets the scheme AND the boon, so "pick a symbol and the theme
 * changes" holds from any starting potion rather than only from Hades.
 *
 * Laid out on a circle with transforms rather than nine hand-placed offsets:
 * the ring is one formula, and adding or removing a god is a row in BOONS.
 */
export function BoonPicker() {
  const [boon, setBoon] = useState<Boon | undefined>(
    () => (localStorage.getItem('platform-boon') as Boon) || undefined,
  );
  const [flaring, setFlaring] = useState(false);

  const pick = (b: Boon) => {
    applyScheme('hades');
    applyBoon(b);
    setBoon(b);
    setFlaring(true);
  };

  return (
    <Card>
      <div className="sc-card-h">
        <div className="sc-card-title">Boons</div>
      </div>
      <div className="sc-card-b">
        <div
          className={`sc-boon-wheel${flaring ? ' sc-boon-flare' : ''}`}
          onAnimationEnd={() => setFlaring(false)}
        >
          {BOONS.map((b, i) => (
            <button
              key={b}
              type="button"
              className="sc-boon"
              aria-pressed={boon === b}
              aria-label={BOON_LABELS[b]}
              style={{ '--i': i, '--n': BOONS.length } as CSSProperties}
              onClick={() => pick(b)}
            >
              <PixelSprite sprite={BOON_SPRITES[b]} />
            </button>
          ))}
        </div>
        {/* The equipped god in text: with motion off, the flare and the
            ornament are gone and this is what still says which one is on. */}
        <div className="sc-muted">
          {boon ? BOON_LABELS[boon] : 'No boon — the house of Hades'}
        </div>
      </div>
    </Card>
  );
}
```

Add `BOON_SPRITES: Record<Boon, Sprite>` to `sprites.ts` — nine small glyphs
(bolt, trident, wheat, wing, goblet, spear, bow, heart, orbit) in the same
format as the existing sprites. Add the wheel's layout CSS to `hades.ts`,
positioning each `.sc-boon` with `rotate(calc(var(--i) * 360deg / var(--n)))`
and a counter-rotation on the glyph so symbols stay upright.

- [ ] **Step 5: Run the picker tests**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/BoonPicker.test.tsx`
Expected: PASS.

- [ ] **Step 6: Add the home section**

Export `BoonPicker` from `plugins/platform-ui/src/index.ts`. In `HomePage.tsx`,
add to the `Section` union, the default section list, and the switch:

```tsx
            case 'pantheon':
              return <BoonPicker key={s} />;
```

It fills the cell the current six leave empty: `standingRequests` carries
`sc-span-2`, so six sections occupy seven cells of a two-column grid.

Add `pantheon` to the commented `sections` list in `app-config.yaml`, and to the
enum in `plugins/platform-requests/config.d.ts` if `sections` is enumerated
there rather than typed as `string[]`.

- [ ] **Step 7: Run the full gate**

Run:

```bash
cd backstage && yarn tsc && yarn lint:all && CI=1 yarn test
```

Expected: `tsc` silent, lint clean, and the suite green — **860 passing plus the
new tests, 0 failing**. A failure anywhere else means this task broke it.

- [ ] **Step 8: Commit**

```bash
git add backstage/plugins/platform-ui/src/BoonPicker.tsx \
        backstage/plugins/platform-ui/src/BoonPicker.test.tsx \
        backstage/plugins/platform-ui/src/index.ts \
        backstage/plugins/platform-ui/src/SchemeRoot.tsx \
        backstage/plugins/platform-ui/src/sprites.ts \
        backstage/plugins/platform-ui/src/hades.ts \
        backstage/plugins/platform-requests/src/components/HomePage.tsx \
        backstage/plugins/platform-requests/config.d.ts \
        backstage/app-config.yaml
git commit -m "feat: pick a boon from the wheel on the home page"
```

---

### Task 9: Document the Hades mode

**Files:**
- Modify: `docs/explanation/design-system.md`
- Modify: `docs/how-to/change-the-logo-favicon-and-title.md` (or wherever
  `app.branding` keys are documented — find it in Step 1)

**Interfaces:**
- Consumes: everything above. Produces: nothing consumed by later tasks.

- [ ] **Step 1: Find where branding keys are documented**

Run:

```bash
cd /Users/adelin/Projects/Platform/new-ui && grep -rln "app.branding" docs/
```

Use whichever page documents `mark`/`favicon`/`flavour`.

- [ ] **Step 2: Document `defaultScheme`**

Add to that page:

```markdown
### The potion a first-time visitor gets

```yaml
app:
  branding:
    defaultScheme: hades
```

An id from the scheme shelf. A visitor's own pick always wins — this decides the
first visit only, so setting it never overrides a choice someone has made.
Missing or unknown falls back to `obsidian`.
```

- [ ] **Step 3: Document the mode and its second axis**

Add to `docs/explanation/design-system.md`, in the modes section:

```markdown
### Hades: one mode, two axes

Every other mode is a palette. Hades is a palette plus a `data-boon` attribute
naming one of nine gods, each redefining the accent and swapping the ornament
and animation layer. The scheme picker equips the mode; the wheel on the home
page equips the god, and picking one does both so it works from any starting
potion.

Nine bottles on the shelf would have been nine silhouettes to draw and nine rows
to keep in contrast. One bottle and a wheel is the same variety at a ninth of
the surface.

The boon rides an attribute rather than a class so it cannot collide with the
`sc-<mode>` classes `applyScheme` clears on every pick — the two axes are
independent and must stay that way.

Both constraints still bind: every boon's motion is `steps()` inside a
`prefers-reduced-motion` guard, and the equipped god is named in text beside the
wheel, because nothing conveys state through motion alone.
```

- [ ] **Step 4: Commit**

```bash
git add docs/
git commit -m "docs: the Hades mode, its boons, and the default potion key"
```

---

## Manual verification

Not a task — do this once after Task 9, in a browser.

1. `bash scripts/backstage-up.sh`, then `yarn start` from `backstage/`.
2. **Task 4:** the sidebar reads *New Request*, and the page it opens agrees.
   With `app.branding.flavour: fantasy` it reads *Summon*.
3. **Task 2:** on the templates page, a template whose name is longer than the
   card keeps its detail and favourite buttons pinned top-right, with the name
   wrapping beneath itself. Seed a long name if none exists.
4. **Task 5:** clear `localStorage`, set `app.branding.defaultScheme: greek`,
   reload — the Greek potion is equipped with no obsidian flash. Pick another
   potion, reload: your pick survives.
5. **Tasks 6-8:** the home page's last block shows the wheel. Click each of the
   nine — the palette, ornaments and animation all change, and the flare fires
   once. The equipped god is named in text. Reload: it persists.
6. Turn on *Reduce motion* in the OS and repeat step 5: no animation anywhere,
   and the equipped god still readable.
7. **Task 1:** with `platform.grafana` configured, set
   `params: { var-env: [prod, staging], var-limit: 10 }` and confirm the
   dashboard iframe's `src` carries `var-env=prod&var-env=staging&var-limit=10`.
   This one needs the prod image (`bash scripts/prod-image-up.sh`) only if you
   also want the CSP exercised.
8. **Task 3:** cannot be driven from the UI alone — it needs a workflow that
   fails and is then retried in Argo. Covered by the store and router tests; if
   you have a failing request to hand, press *Re-check status* after retrying
   its workflow and confirm the red row goes.
