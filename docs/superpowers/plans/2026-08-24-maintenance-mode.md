# Maintenance Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin-flipped switch that stops non-admins filing new requests.
While it is on they get a Pluto page instead of the request form, the resource
page's edit/delete buttons explain themselves, and the page's one Hebrew line
renders in a face that belongs to this app.

**Architecture:** The flag is a row in the requests backend, read and written
over two routes. The enforcement point is `POST /requests` — the single choke
point every submission path goes through — and it resolves admin-ness from the
*resolved requester*, not the credential, because the Scaffolder path always
presents a service principal. The frontend gate is an `AppRootWrapper`, the
settings switch a `SubPageBlueprint` attached to the user-settings page's
`pages` input. Hebrew type is attached by `unicode-range` so Latin never leaves
Clash Grotesk.

**Tech Stack:** TypeScript, React 18, Backstage new frontend system, Knex
migrations, Jest + Testing Library, self-hosted woff2, pixel-art `Sprite`
string arrays.

**Spec:** `docs/superpowers/specs/2026-08-24-maintenance-mode-design.md`

## Global Constraints

- All Node commands run from `backstage/`. Jest MUST have `CI=1` or
  `backstage-cli repo test` sits in interactive watch mode and prints nothing.
- Before EVERY commit, all three clean: `yarn tsc` (silent), `yarn lint:all`
  (**ERROR count 0** — report it), and the task's test files. Full gate at the
  end: `CI=1 yarn test`. Baseline on this branch is **908 passing across 80
  suites**.
- **`plugins/platform-ui/src/styles.ts` is ONE template literal.** A stray
  backtick truncates the whole stylesheet; a backslash before a digit fails the
  app build while `tsc` stays silent. `styles.test.ts` guards both.
- **Every animation `steps()`, never `ease`**, inside
  `@media (prefers-reduced-motion: no-preference)`. Nothing conveys state
  through motion alone.
- **Request states and `kind` values (`CREATE`, `DELETE`) are records** and must
  never be renamed. Screen names may be.
- Every new `config.d.ts` key needs `@visibility frontend`; a map whose *values*
  must reach the browser needs `@deepVisibility frontend`.
- **Never add a cast (`as any`, `as unknown`, `@ts-ignore`) to make an extension
  register.** This branch already shipped one extension that type-checked via a
  cast and was silently dropped by the app's resolver. If the types object, the
  seam is wrong — stop and report.
- Do not add a dependency to any `package.json`. Never hand-edit `CHANGELOG.md`
  or a version field.
- Conventional commits.

---

### Task 1: The flag — migration, store, routes

**Files:**
- Create: `backstage/plugins/platform-requests-backend/migrations/0009_settings.js`
- Modify: `backstage/plugins/platform-requests-backend/src/store.ts`
- Modify: `backstage/plugins/platform-requests-backend/src/router.ts`
- Test: `backstage/plugins/platform-requests-backend/src/store.test.ts`
- Test: `backstage/plugins/platform-requests-backend/src/router.test.ts`

**Interfaces:**
- Consumes: the existing `RequestsStore`, `principalResolver`, `httpAuth`.
- Produces:
  ```ts
  // store.ts
  getSetting(key: string): Promise<string | undefined>
  setSetting(key: string, value: string): Promise<void>
  // routes
  GET  /maintenance -> { enabled: boolean }     // any authenticated caller
  PUT  /maintenance  { enabled: boolean }       // admins only
  ```
  Task 2 consumes `getSetting`; Tasks 4-6 consume the routes.

- [ ] **Step 1: Write the migration**

Create `migrations/0009_settings.js`, matching the style of `0008_resource_name_text.js`:

```js
/**
 * A one-row-per-key settings table.
 *
 * Deliberately generic rather than a `maintenance` column: the next
 * platform-wide switch should be a row, not another migration.
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('platform_settings', table => {
    table.string('key').primary().notNullable();
    table.text('value').notNullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('platform_settings');
};
```

- [ ] **Step 2: Write the failing store test**

`store.test.ts` drives every case through `it.each(databases.eachSupportedId())`
with a local `createStore(databaseId)` helper — a plain `it()` has no store.
Follow that shape:

```ts
  it.each(databases.eachSupportedId())(
    'round-trips a setting and reports absent as undefined, %p',
    async databaseId => {
      const store = await createStore(databaseId);
      expect(await store.getSetting('maintenance')).toBeUndefined();
      await store.setSetting('maintenance', 'true');
      expect(await store.getSetting('maintenance')).toBe('true');
      await store.setSetting('maintenance', 'false');
      expect(await store.getSetting('maintenance')).toBe('false');
    },
  );
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd backstage && CI=1 yarn test plugins/platform-requests-backend/src/store.test.ts`
Expected: FAIL — `store.getSetting is not a function`.

- [ ] **Step 4: Implement the store methods**

In `store.ts`, beside the existing methods:

```ts
  /**
   * A platform-wide setting, or undefined when never set.
   *
   * Values are text because the table is generic; each caller owns its own
   * parsing. `maintenance` stores 'true'/'false' and treats anything else,
   * including absence, as off — a malformed row must fail open rather than
   * locking the platform in maintenance with no way to read the switch.
   */
  async getSetting(key: string): Promise<string | undefined> {
    const row = await this.db('platform_settings').where({ key }).first();
    return row?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db('platform_settings')
      .insert({ key, value })
      .onConflict('key')
      .merge();
  }
```

Match the file's existing `this.db(...)` accessor name — read a neighbouring
method first rather than assuming.

- [ ] **Step 5: Run it to verify it passes**

Run: `cd backstage && CI=1 yarn test plugins/platform-requests-backend/src/store.test.ts`
Expected: PASS, including every pre-existing test.

- [ ] **Step 6: Write the failing route tests**

Append to `router.test.ts`. The file builds its app with a local
`makeApp({ result, principalResolver, ... })` helper and varies the caller with
`mockCredentials` **header values** — e.g. `mockCredentials.user.header(ref)`,
`mockCredentials.service.header()` — set via `.set('Authorization', ...)`. Use
that, not a new harness:

```ts
describe('maintenance mode', () => {
  it('is off when nothing has been set', async () => {
    const { app } = await makeApp({ result: AuthorizeResult.ALLOW });
    const res = await request(app).get('/maintenance').send();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: false });
  });

  it('lets an admin turn it on, and anyone read it', async () => {
    const { app } = await makeApp({
      result: AuthorizeResult.ALLOW,
      principalResolver: async () => ({ isAdmin: true, groups: [] }),
    });
    const put = await request(app)
      .put('/maintenance')
      .set('Authorization', asAdmin)
      .send({ enabled: true });
    expect(put.status).toBe(200);

    const get = await request(app).get('/maintenance').send();
    expect(get.body).toEqual({ enabled: true });
  });

  it('refuses a non-admin turning it on', async () => {
    // The settings page hides the switch from non-admins, but that is
    // decluttering. This is the actual gate.
    const { app } = await makeApp({
      result: AuthorizeResult.ALLOW,
      principalResolver: async () => ({ isAdmin: false, groups: [] }),
    });
    const res = await request(app).put('/maintenance').send({ enabled: true });
    expect(res.status).toBe(403);
    expect((await request(app).get('/maintenance').send()).body).toEqual({
      enabled: false,
    });
  });
});
```

- [ ] **Step 7: Run to verify they fail**

Run: `cd backstage && CI=1 yarn test plugins/platform-requests-backend/src/router.test.ts`
Expected: FAIL — 404 on both routes.

- [ ] **Step 8: Implement the routes**

In `router.ts`, beside the other routes:

```ts
  /**
   * Whether new submissions are being refused.
   *
   * Readable by any authenticated caller because the frontend has to know
   * whether to show the request form or the maintenance page. Writable only by
   * admins — and that check is here, not in the UI, because hiding a switch is
   * not the same as refusing to flip it.
   */
  router.get('/maintenance', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    res.json({ enabled: (await store.getSetting('maintenance')) === 'true' });
  });

  router.put('/maintenance', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const { isAdmin } = await principalResolver(credentials);
    if (!isAdmin) throw new NotAllowedError('Only platform admins may change maintenance mode');
    const enabled = Boolean(req.body?.enabled);
    await store.setSetting('maintenance', enabled ? 'true' : 'false');
    res.json({ enabled });
  });
```

`NotAllowedError` is already imported in this file. Confirm it maps to 403 the
way the file's other refusals do.

- [ ] **Step 9: Run to verify they pass**

Run: `cd backstage && CI=1 yarn test plugins/platform-requests-backend/src/router.test.ts plugins/platform-requests-backend/src/store.test.ts`
Expected: PASS, both files, including every pre-existing test.

- [ ] **Step 10: Commit**

```bash
cd backstage && yarn tsc && yarn lint:all
git add backstage/plugins/platform-requests-backend/migrations/0009_settings.js \
        backstage/plugins/platform-requests-backend/src/store.ts \
        backstage/plugins/platform-requests-backend/src/store.test.ts \
        backstage/plugins/platform-requests-backend/src/router.ts \
        backstage/plugins/platform-requests-backend/src/router.test.ts
git commit -m "feat: store and expose a platform maintenance flag"
```

---

### Task 2: The gate — refuse new requests, by requester not by credential

**Files:**
- Create: `backstage/plugins/platform-requests-backend/src/maintenance.ts`
- Create: `backstage/plugins/platform-requests-backend/src/maintenance.test.ts`
- Modify: `backstage/plugins/platform-requests-backend/src/plugin.ts`
- Modify: `backstage/plugins/platform-requests-backend/src/router.ts`
- Test: `backstage/plugins/platform-requests-backend/src/router.test.ts`

**Interfaces:**
- Consumes: `store.getSetting` (Task 1); `catalogServiceRef`, already injected
  at `plugin.ts:78`; `platform.rbac.adminGroups`, already read at `plugin.ts:119`.
- Produces:
  ```ts
  // maintenance.ts — pure, no catalog client of its own
  export function isAdminRef(
    groups: string[] | undefined,
    adminGroups: string[],
  ): boolean;
  // router options
  type AdminLookup = (userRef: string) => Promise<boolean>;
  ```

**This is the task the whole feature turns on. Read this before writing code.**

`POST /requests` accepts both user and service principals:

```ts
const credentials = await httpAuth.credentials(req, { allow: ['user', 'service'] });
let requester: string;
if (credentials.principal.type === 'service') {
  if (!onBehalf) throw new InputError('service callers must set `requester`');
  requester = onBehalf;
} else {
  requester = actorId(credentials.principal.userEntityRef);
}
```

The Scaffolder action (`plugins/scaffolder-backend-module-platform-actions/src/module.ts:208`)
POSTs here with a **service** token and names the human in `requester`. That is
the path almost every submission takes.

`principalResolver` resolves via `userInfo.getUserInfo(credentials)`, which only
works for a *user* credential and returns `{ isAdmin: false }` for a service one.
So:

- gating on `principalResolver(credentials)` blocks **admins too**, on the main path;
- skipping the gate for service principals makes it **decorative**.

The gate must resolve admin-ness from the **resolved `requester` string**, after
that branch.

- [ ] **Step 1: Write the failing pure test**

Create `maintenance.test.ts`:

```ts
import { isAdminRef } from './maintenance';

describe('isAdminRef', () => {
  const ADMINS = ['group:default/platform-admins'];

  it('is true for a member of an admin group', () => {
    expect(isAdminRef(['group:default/platform-admins', 'group:default/checkout'], ADMINS)).toBe(true);
  });

  it('is false for a member of no admin group', () => {
    expect(isAdminRef(['group:default/checkout'], ADMINS)).toBe(false);
  });

  it('is false for a user with no groups', () => {
    expect(isAdminRef([], ADMINS)).toBe(false);
  });

  it('is false when the user could not be resolved at all', () => {
    // An unknown ref must not fail open — that would let anyone through by
    // naming a user that does not exist.
    expect(isAdminRef(undefined, ADMINS)).toBe(false);
  });

  it('compares refs exactly, as the permission policy does', () => {
    expect(isAdminRef(['group:default/Platform-Admins'], ADMINS)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backstage && CI=1 yarn test plugins/platform-requests-backend/src/maintenance.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement the pure part**

Create `maintenance.ts`:

```ts
/**
 * Who counts as an admin when the caller is a service acting for a human.
 *
 * Kept apart from the catalog lookup so the rule is a pure function with a
 * test, rather than something only reachable through a live catalog.
 *
 * Exact ref comparison, matching the permission policy — the two must not
 * drift into disagreeing about who is an admin.
 */
export function isAdminRef(
  groups: string[] | undefined,
  adminGroups: string[],
): boolean {
  // `undefined` means the user could not be resolved. Failing open here would
  // let anyone past the gate by naming a user that does not exist.
  if (!groups) return false;
  return groups.some(g => adminGroups.includes(g));
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backstage && CI=1 yarn test plugins/platform-requests-backend/src/maintenance.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the catalog lookup in `plugin.ts`**

Beside the existing `principalResolver`, add a lookup that answers for a *named*
user rather than a credential:

```ts
        // Admin-ness for a user we only have a name for.
        //
        // The Scaffolder posts as a service and names the human in
        // `requester`, so `principalResolver` — which needs a user credential —
        // cannot answer for the path most submissions take. Same adminGroups
        // list, so the two cannot disagree.
        const adminLookup = async (userRef: string) => {
          try {
            const entity = await catalog.getEntityByRef(userRef, {
              credentials: await auth.getOwnServiceCredentials(),
            });
            const groups = entity?.relations
              ?.filter(r => r.type === 'memberOf')
              .map(r => r.targetRef);
            return isAdminRef(groups, adminGroups);
          } catch {
            return false;
          }
        };
```

Check the actual `catalog` service method and credentials shape against how
`resolveResource` already uses `catalog` in this file — follow that, do not
invent a call signature. `requester` is a short id (see `actorId`), so build the
full `user:<namespace>/<id>` ref using the same `catalogNamespace` the file
already resolves at line 126. Pass `adminLookup` into `createRouter` alongside
`principalResolver`.

- [ ] **Step 6: Write the failing gate tests**

Append to `router.test.ts` — **these are the tests that matter most in this
plan**:

Add `adminLookup` to `makeApp`'s options object and pass it through to
`createRouter`, exactly as `principalResolver` is passed today. Then:

```ts
describe('the maintenance gate on POST /requests', () => {
  // A stub, so the catalog is not needed: 'boss' is an admin, 'dev' is not.
  const adminLookup = async (ref: string) => ref === 'boss';

  async function maintenanceApp() {
    const { app, store } = await makeApp({
      result: AuthorizeResult.ALLOW,
      principalResolver: async () => ({ isAdmin: true, groups: [] }),
      adminLookup,
    });
    await request(app)
      .put('/maintenance')
      .set('Authorization', asAdmin)
      .send({ enabled: true });
    return { app, store };
  }

  it('refuses a service-principal submission naming a NON-admin requester', async () => {
    // The Scaffolder path, and the whole point of this task. A gate keyed on
    // the credential would see a service principal, call every submission
    // non-admin, and look like it worked — while blocking admins too.
    const { app } = await maintenanceApp();
    const res = await request(app)
      .post('/requests')
      .set('Authorization', mockCredentials.service.header())
      .send({ ...VALID_BODY, requester: 'dev' });
    expect(res.status).toBe(503);
  });

  it('allows a service-principal submission naming an ADMIN requester', async () => {
    // The other half of the trap: an admin filing through a template must not
    // be blocked by their own maintenance mode.
    const { app } = await maintenanceApp();
    const res = await request(app)
      .post('/requests')
      .set('Authorization', mockCredentials.service.header())
      .send({ ...VALID_BODY, requester: 'boss' });
    expect(res.status).toBe(201);
  });

  it('refuses a DELETE just as it refuses a CREATE', async () => {
    const { app } = await maintenanceApp();
    const res = await request(app)
      .post('/requests')
      .set('Authorization', mockCredentials.service.header())
      .send({ ...VALID_BODY, kind: 'DELETE', requester: 'dev' });
    expect(res.status).toBe(503);
  });

  it('lets everything through once maintenance is off', async () => {
    const { app } = await maintenanceApp();
    await request(app)
      .put('/maintenance')
      .set('Authorization', asAdmin)
      .send({ enabled: false });
    const res = await request(app)
      .post('/requests')
      .set('Authorization', mockCredentials.service.header())
      .send({ ...VALID_BODY, requester: 'dev' });
    expect(res.status).toBe(201);
  });
});
```

`VALID_BODY` is whatever minimal request body the file's existing creation tests
post (read the first `it('creates a request …')` and reuse its shape). If the
file has no shared constant, hoist one rather than repeating the literal four
times.

- [ ] **Step 7: Run to verify they fail**

Run: `cd backstage && CI=1 yarn test plugins/platform-requests-backend/src/router.test.ts`
Expected: FAIL — all four; nothing refuses anything yet.

- [ ] **Step 8: Implement the gate**

In `router.ts`'s `POST /requests`, immediately after `requester` is resolved and
**before** any encryption or write:

```ts
    // Maintenance mode. Keyed on the resolved requester, not on the credential:
    // the Scaffolder posts as a service and names the human in `requester`, so
    // a credential-keyed check would see a service principal, call every
    // submission non-admin, and block admins too. Admins are never gated —
    // being able to file during maintenance is the point of being able to turn
    // it on.
    if ((await store.getSetting('maintenance')) === 'true') {
      if (!(await adminLookup(requester))) {
        res.status(503).json({
          error: 'Platform maintenance is on — new requests are paused.',
        });
        return;
      }
    }
```

Add `adminLookup` to `RouterOptions` with a default of `async () => false`,
matching how `principalResolver` and `submitWorkflow` already default.

- [ ] **Step 9: Run to verify they pass**

Run: `cd backstage && CI=1 yarn test plugins/platform-requests-backend`
Expected: PASS across the whole backend package, including every pre-existing test.

- [ ] **Step 10: Commit**

```bash
cd backstage && yarn tsc && yarn lint:all
git add backstage/plugins/platform-requests-backend/src/maintenance.ts \
        backstage/plugins/platform-requests-backend/src/maintenance.test.ts \
        backstage/plugins/platform-requests-backend/src/plugin.ts \
        backstage/plugins/platform-requests-backend/src/router.ts \
        backstage/plugins/platform-requests-backend/src/router.test.ts
git commit -m "feat: refuse new requests from non-admins during maintenance"
```

---

### Task 3: Hebrew type

**Files:**
- Create: `backstage/packages/app/public/fonts/heebo.woff2`
- Create: `backstage/packages/app/public/fonts/HEEBO-LICENSE.txt`
- Modify: `backstage/plugins/platform-ui/src/styles.ts` (the `@font-face` block and both font stacks)
- Test: `backstage/plugins/platform-ui/src/styles.test.ts`

**Interfaces:**
- Consumes: nothing. Produces: Hebrew coverage for every task after this one.

- [ ] **Step 1: Fetch the font**

Heebo, SIL Open Font License, variable 100–900. Obtain the **variable woff2**
and its OFL text, and place them at the two paths above.

```bash
cd /Users/adelin/Projects/Platform/new-ui/backstage/packages/app/public/fonts
# e.g. from the google/fonts repository (ofl/heebo), or the Google Fonts CSS2
# API with a modern UA so it serves woff2.
ls -la heebo.woff2 HEEBO-LICENSE.txt
```

**If you cannot reach the network, STOP and report `BLOCKED` naming this step.**
Do not commit a placeholder file, do not inline a base64 blob, and do not fall
back to a CDN `@font-face` — the CSP is `font-src 'self'` and a CDN reference
fails *silently* into something that looks nearly right, which is precisely the
bug this task exists to fix.

Sanity-check what you fetched: the file should be roughly 20–120 KB, and
`file heebo.woff2` should report WOFF2.

- [ ] **Step 2: Write the failing test**

Append to `styles.test.ts`:

```ts
describe('Hebrew type', () => {
  it('serves Heebo from our own origin', () => {
    // The CSP is font-src 'self'. A CDN reference does not load, and fails
    // silently into a system fallback that looks nearly right.
    expect(SHADCN_CSS).toContain("src: url('/fonts/heebo.woff2')");
    expect(SHADCN_CSS).not.toMatch(/@font-face[^}]*https?:\/\//);
  });

  it('scopes Heebo to the Hebrew blocks', () => {
    // unicode-range is what makes this a fix rather than a fallback: Latin
    // never leaves Clash Grotesk, and no rule has to know which script it is
    // rendering.
    const face = SHADCN_CSS.slice(SHADCN_CSS.indexOf("font-family: 'Heebo'"));
    const block = face.slice(0, face.indexOf('}'));
    expect(block).toContain('unicode-range');
    expect(block).toContain('U+0590-05FF');
  });

  it('lists Heebo in both font stacks', () => {
    for (const token of ['--sc-font-ui', '--sc-font-title']) {
      const decl = SHADCN_CSS.slice(SHADCN_CSS.indexOf(`${token}:`));
      expect(`${token}:${decl.slice(0, decl.indexOf(';')).includes('Heebo')}`).toBe(
        `${token}:true`,
      );
    }
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/styles.test.ts`
Expected: FAIL — no Heebo anywhere.

- [ ] **Step 4: Implement**

In `styles.ts`, directly after the Clash Grotesk `@font-face`:

```css
/* Hebrew. Clash Grotesk carries none, so every Hebrew glyph fell back to
   whatever the OS offered — which is what made the one Hebrew line in the app
   look pasted in from somewhere else.

   Heebo is a neo-grotesque Hebrew drawn as Roboto's companion: closed
   apertures, even stroke contrast, proportions near enough to Clash Grotesk to
   sit in the same sentence. SIL OFL, see public/fonts/HEEBO-LICENSE.txt.

   Attached by unicode-range rather than appended as a fallback: the browser
   pulls this face ONLY for these codepoints, so Latin never leaves Clash
   Grotesk and no rule has to know which script it is rendering. */
@font-face {
  font-family: 'Heebo';
  src: url('/fonts/heebo.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0590-05FF, U+FB1D-FB4F;
}
```

Then add `'Heebo'` immediately after `'Clash Grotesk'` in both `--sc-font-ui`
and `--sc-font-title`.

- [ ] **Step 5: Run to verify it passes**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/styles.test.ts`
Expected: PASS, including the pre-existing truncation and backslash guards.

- [ ] **Step 6: Commit**

```bash
cd backstage && yarn tsc && yarn lint:all
git add backstage/packages/app/public/fonts/heebo.woff2 \
        backstage/packages/app/public/fonts/HEEBO-LICENSE.txt \
        backstage/plugins/platform-ui/src/styles.ts \
        backstage/plugins/platform-ui/src/styles.test.ts
git commit -m "feat: render Hebrew in Heebo instead of the system fallback"
```

---

### Task 4: The Pluto mark and the maintenance page

**Files:**
- Modify: `backstage/plugins/platform-ui/src/sprites.ts` (`PLUTO`)
- Modify: `backstage/plugins/platform-ui/src/sprites.test.ts`
- Create: `backstage/plugins/platform-ui/src/MaintenancePage.tsx`
- Create: `backstage/plugins/platform-ui/src/MaintenancePage.test.tsx`
- Modify: `backstage/plugins/platform-ui/src/index.ts`

**Interfaces:**
- Consumes: `Page`, `Card`, `CardBody`, `PixelSprite` from this package.
- Produces: `export const PLUTO: Sprite` and `export function MaintenancePage()`.
  Tasks 5 and 6 render the page.

- [ ] **Step 1: Draw the mark**

In `sprites.ts`, beside the other sprites, add a 16-wide `PLUTO` in the same
`#` outline / `~` fill / `.` transparent format: **Pluto's disc with the
astrological glyph on its face** — the PL monogram, a vertical stroke whose top
carries a small bowl, sitting inside the circle. The planet says which body, the
glyph says the joke.

Read `AMPHORA_VESSEL` and the `BOON_*` glyphs first and match their row count
and conventions. `sprites.test.ts` enforces set-wide invariants — read those
assertions and satisfy them; if the new sprite must join a hardcoded list, add
it. **Never weaken an assertion to make art fit.**

- [ ] **Step 2: Write the failing page test**

Create `MaintenancePage.test.tsx`:

```tsx
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MaintenancePage } from './MaintenancePage';

describe('MaintenancePage', () => {
  it('says the line in Hebrew, marked as Hebrew', () => {
    // lang and dir so it is announced and ordered correctly whatever the font
    // resolves to — the typography fix is separate from the semantics.
    render(<MaintenancePage />);
    const line = screen.getByText('פלוטו בנסיגה...');
    expect(line).toHaveAttribute('lang', 'he');
    expect(line).toHaveAttribute('dir', 'rtl');
  });

  it('explains itself in English too', () => {
    render(<MaintenancePage />);
    expect(screen.getByText(/maintenance/i)).toBeInTheDocument();
  });

  it('carries no colour of its own', () => {
    // It must follow the picked potion like every other surface, including the
    // Hades boons. A hex or hsl() literal here is a scheme that stopped
    // theming.
    const { container } = render(<MaintenancePage />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,6}\b|hsl\(\s*\d/i);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/MaintenancePage.test.tsx`
Expected: FAIL — the module does not exist.

- [ ] **Step 4: Implement the page**

Create `MaintenancePage.tsx`, built only from this package's own components and
`sc-*` classes so it follows the picked potion:

```tsx
/**
 * What a non-admin sees instead of the request form while maintenance is on.
 *
 * Built from our own furniture and nothing else — no colour literals — so it
 * follows the picked potion, Hades boons included. A maintenance screen that
 * ignored the theme would look like an error page from another application,
 * which is exactly the wrong impression: nothing is broken.
 *
 * The Hebrew line is the joke. Pluto is in retrograde, so the platform is
 * resting; astrology is as good an explanation as most incident reports.
 */
export function MaintenancePage() {
  return (
    <Page>
      <Card>
        <CardBody>
          <PixelSprite sprite={PLUTO} />
          <div className="sc-empty-title">Maintenance</div>
          <p className="sc-muted" lang="he" dir="rtl">
            פלוטו בנסיגה...
          </p>
          <p className="sc-muted">
            New requests are paused while the platform is being worked on.
            Anything already filed is unaffected.
          </p>
        </CardBody>
      </Card>
    </Page>
  );
}
```

Export it and `PLUTO` from `index.ts`.

- [ ] **Step 5: Run the tests**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/MaintenancePage.test.tsx plugins/platform-ui/src/sprites.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd backstage && yarn tsc && yarn lint:all
git add backstage/plugins/platform-ui/src/sprites.ts \
        backstage/plugins/platform-ui/src/sprites.test.ts \
        backstage/plugins/platform-ui/src/MaintenancePage.tsx \
        backstage/plugins/platform-ui/src/MaintenancePage.test.tsx \
        backstage/plugins/platform-ui/src/index.ts
git commit -m "feat: a Pluto maintenance page that follows the picked potion"
```

---

### Task 5: Read the flag in the frontend, and gate `/create`

**Files:**
- Create: `backstage/plugins/platform-ui/src/useMaintenance.ts`
- Create: `backstage/plugins/platform-ui/src/useMaintenance.test.tsx`
- Create: `backstage/plugins/platform-ui/src/MaintenanceGate.tsx`
- Create: `backstage/plugins/platform-ui/src/MaintenanceGate.test.tsx`
- Modify: `backstage/plugins/platform-ui/src/theme.tsx` (register the wrapper)
- Modify: `backstage/plugins/platform-ui/src/index.ts`

**Interfaces:**
- Consumes: `MaintenancePage` (Task 4), `useIsAdmin` (existing),
  `GET /maintenance` (Task 1), `discoveryApiRef`/`fetchApiRef`.
- Produces: `useMaintenance(): boolean | undefined` and a registered
  `AppRootWrapperBlueprint` extension. Task 6 reuses `useMaintenance`.

- [ ] **Step 1: Write the failing hook test**

`useMaintenance` fetches `GET /maintenance` through `fetchApi` against the
`platform-requests` base URL, returning `undefined` while in flight and `false`
if the call fails — **failing open**, because a frontend that cannot reach the
backend must not lock everyone out of a form the backend would have accepted.

Write `useMaintenance.test.tsx` covering: resolves `true` when the API says so;
resolves `false` when it says so; resolves `false` on a rejected fetch; is
`undefined` before the first answer. Use `TestApiProvider` with
`discoveryApiRef` and `fetchApiRef` stubs, as `DynamicSelectField.test.tsx`
already does.

- [ ] **Step 2: Run to verify it fails, then implement**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/useMaintenance.test.tsx`
Expected: FAIL — the module does not exist. Then write the hook.

- [ ] **Step 3: Write the failing gate test**

`MaintenanceGate` renders `children` unless **all** of: maintenance is on, the
user is not an admin, and the current path is the request-form route. Write
`MaintenanceGate.test.tsx` covering, with `MemoryRouter` at the relevant path:

- maintenance on + non-admin + on `/create` → the maintenance page, not children;
- maintenance on + **admin** + on `/create` → children;
- maintenance on + non-admin + on `/requests` → children (only the form is gated);
- maintenance **off** + non-admin + on `/create` → children;
- maintenance `undefined` (still loading) → children, **not** a flash of the
  maintenance page.

That last one matters: showing maintenance while the answer is unknown would
flash it at every user on every load.

- [ ] **Step 4: Implement the gate**

```tsx
/**
 * Replaces the request form with the maintenance page for non-admins.
 *
 * A wrapper rather than an override of the Scaffolder's own page extension:
 * the page belongs to a plugin we do not own, and wrapping is both cheaper and
 * harder to get silently wrong than replacing someone else's extension.
 *
 * Admins are never gated — filing during maintenance is the point of being
 * able to turn it on. And `undefined` (still loading) renders children: a
 * maintenance page shown while the answer is unknown would flash at every user
 * on every load.
 */
```

Register it in `theme.tsx` with `AppRootWrapperBlueprint`, beside the existing
`SchemeRoot` app-root registration. Its params take a
`component: ({ children }) => ReactNode`.

**If the blueprint's types object to your registration, stop and report.** Do
not add a cast — an extension that type-checks only because of a cast is exactly
how this branch already shipped one that silently did nothing.

- [ ] **Step 5: Run the tests**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/useMaintenance.test.tsx plugins/platform-ui/src/MaintenanceGate.test.tsx`
Expected: PASS.

- [ ] **Step 6: Prove the wrapper is actually mounted**

`tsc` passing does not prove an extension registered. Run the app's own test:

```bash
cd backstage && CI=1 yarn test packages/app/src/App.test.tsx
```

Expected: PASS. In your report, state how you satisfied yourself the wrapper is
in the app tree — a passing `App.test.tsx`, an added assertion, or an explicit
"could not verify without running the app". An honest "not verified" is worth
more than an assumed yes.

- [ ] **Step 7: Commit**

```bash
cd backstage && yarn tsc && yarn lint:all
git add backstage/plugins/platform-ui/src/useMaintenance.ts \
        backstage/plugins/platform-ui/src/useMaintenance.test.tsx \
        backstage/plugins/platform-ui/src/MaintenanceGate.tsx \
        backstage/plugins/platform-ui/src/MaintenanceGate.test.tsx \
        backstage/plugins/platform-ui/src/theme.tsx \
        backstage/plugins/platform-ui/src/index.ts
git commit -m "feat: show the maintenance page instead of the request form"
```

---

### Task 6: The resource page's buttons, and the settings switch

**Files:**
- Modify: `backstage/plugins/platform-requests/src/components/ResourceActionsCard.tsx`
- Test: `backstage/plugins/platform-requests/src/components/ResourceActionsCard.test.tsx`
- Create: `backstage/packages/app/src/modules/maintenanceSettings.tsx`
- Modify: `backstage/packages/app/src/App.tsx`

**Interfaces:**
- Consumes: `useMaintenance` and `useIsAdmin`; `PUT /maintenance` (Task 1).
- Produces: nothing consumed later.

- [ ] **Step 1: Write the failing button tests**

`ResourceActionsCard` already imports `Dialog`. While maintenance is on and the
user is not an admin, *Request update* and *Request delete* must open a
maintenance dialog instead of their normal flow. Write tests for: dialog opens
and no request is submitted (maintenance on, non-admin); normal flow (admin);
normal flow (maintenance off).

Read the file's existing test harness first and use it.

- [ ] **Step 2: Run to verify they fail, then implement**

The buttons keep their labels — a disabled button with no explanation is the
thing being avoided. Reuse the existing `Dialog` and `PLUTO`/`MaintenancePage`
copy so the two surfaces say the same thing.

- [ ] **Step 3: Build the settings page**

Create `packages/app/src/modules/maintenanceSettings.tsx`. Backstage's
user-settings page extension declares an **`inputs.pages`** slot, so attach a
`SubPageBlueprint` to `page:user-settings` / input `pages`.

Read `SubPageBlueprint`'s declaration in
`node_modules/@backstage/frontend-plugin-api/dist/index.d.ts` (there is a
worked example in its doc comment, around line 2307) and follow it. Wrap it in
`createFrontendModule` and register that in `App.tsx`'s `features` — the same
shape `scaffolderTranslations.ts` uses, which is already in this file and is
known to work.

The page shows a toggle reading `useMaintenance()` and writing `PUT /maintenance`.
For non-admins it renders a short "platform admins only" note rather than the
toggle. That is decluttering; the real gate is the backend's 403, which Task 1
already tests.

**Do not add a cast to make the registration type-check.** If it objects, the
seam is wrong — stop and report what it said.

- [ ] **Step 4: Prove the settings page is actually mounted**

Same standard as Task 5 Step 6, and for the same reason: this branch already
shipped an extension into a plugin it does not own that silently did nothing.

```bash
cd backstage && yarn tsc && CI=1 yarn test packages/app/src/App.test.tsx
```

State in your report how you satisfied yourself it is mounted, or say plainly
that you could not verify it without running the app.

- [ ] **Step 5: Full gate**

```bash
cd backstage && yarn tsc && yarn lint:all && CI=1 yarn test
```

Expected: `tsc` silent, lint **0 errors**, suite green — **908 baseline plus
this plan's new tests, 0 failing**.

- [ ] **Step 6: Commit**

```bash
git add backstage/plugins/platform-requests/src/components/ResourceActionsCard.tsx \
        backstage/plugins/platform-requests/src/components/ResourceActionsCard.test.tsx \
        backstage/packages/app/src/modules/maintenanceSettings.tsx \
        backstage/packages/app/src/App.tsx
git commit -m "feat: explain maintenance on the resource page, and let admins toggle it"
```

---

### Task 7: Document it

**Files:**
- Modify: `docs/reference/configuration.md`
- Create: `docs/how-to/pause-the-platform.md`
- Modify: `mkdocs.yml` (nav entry for the new page)

- [ ] **Step 1: Write the how-to**

Terse, and explaining *why* — match the surrounding voice. Cover: what
maintenance mode blocks (every kind of new request, from non-admins) and what it
does not (approvals, re-checks, workflows in flight); where the switch is; that
admins can still file; and that the gate is the backend's, so hiding the switch
is not what enforces it.

- [ ] **Step 2: Add the nav entry and cross-link**

Add the page to `mkdocs.yml`'s nav beside the other how-tos, and reference it
from wherever `platform.rbac.adminGroups` is documented.

- [ ] **Step 3: Verify the docs build**

```bash
cd /Users/adelin/Projects/Platform/new-ui && mkdocs build --strict 2>&1 | tail -5
```

Expected: no warnings. `--strict` turns a broken cross-link into a failure,
which is the point. If `mkdocs` is not installed, say so rather than skipping
silently.

- [ ] **Step 4: Commit**

```bash
git add docs/ mkdocs.yml
git commit -m "docs: how to pause the platform"
```

---

## Manual verification

Not a task — do this once after Task 7, in a browser. None of it is covered by
the suite.

1. `bash scripts/backstage-up.sh`, then `yarn start` from `backstage/`.
2. As an admin, open `/settings` — the maintenance page is there and the toggle
   flips. As a non-admin it is absent or explains itself.
3. With maintenance **on**, as a non-admin: `/create` shows the Pluto page. The
   Hebrew line reads in Heebo, not a system fallback — compare it against the
   surrounding Latin; the two should look related. Switch potions, including
   Hades with a few boons, and confirm the page recolours with them.
4. Still as a non-admin, open a resource page: *Request update* and *Request
   delete* open the maintenance dialog rather than submitting.
5. As an **admin** with maintenance on: `/create` works and a submission
   succeeds. This is the half of the gate that a credential-keyed
   implementation would break.
6. Submit a template as a non-admin by hitting the API directly, bypassing the
   UI, and confirm the backend answers 503 — the UI gate is a courtesy, the
   backend gate is the feature.
7. Turn maintenance off; confirm everything returns to normal.
8. `bash scripts/prod-image-up.sh` and re-check step 3 — the font is served from
   `/fonts/heebo.woff2` under the production CSP, which is the only place
   `font-src 'self'` actually applies.
