# Forms and Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Scaffolder form layer do four things it cannot do today: cascade selects over the infra coordinate tree, upload a file to S3 and pass its path to Argo, duplicate array rows, and render a field label that does not collide with its own outline.

**Architecture:** Everything rides existing seams. The cascade adds two `ui:options` keys to the existing `DynamicSelect` field and a pure tree-walking function; no new field type, no config-API change. The file picker is a third `FormFieldBlueprint` entry plus one backend route that mints presigned S3 URLs — bytes go browser→S3 directly, credentials stay server-side. Array duplication is a built-in RJSF option needing only documentation. The label fix moves input geometry from route-scoped CSS into the theme's published override keys, which is what `docs/explanation/design-system.md:34-38` requires.

**Tech Stack:** TypeScript, React 18, Backstage 1.53 (new frontend system), `@backstage/plugin-scaffolder-react` 2.0.2, RJSF 5.24.13 with the MUI v4 theme, jest + `@testing-library/react`, knex/Postgres backend, AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`).

**Spec:** `docs/superpowers/specs/2026-08-18-forms-and-fields-design.md`

## Global Constraints

- All Node commands run from `backstage/` (Yarn 4 via corepack, Node 22).
- `plugins/platform-ui/src/styles.ts` is **one template literal**: no backticks anywhere inside it, including CSS comments, and no backslash immediately before a digit (that fails the app build while `tsc` passes).
- Style Backstage's own components through `theme.tsx` override keys, not hashed class names (`docs/explanation/design-system.md:34-38`).
- Custom scaffolder field names must not collide with Backstage built-ins — prefix them (`SecretField.tsx:43-51` records why `PlatformSecret` is not `Secret`).
- Secrets and credentials never reach the browser. Authenticated upstreams go through the Backstage proxy (`docs/how-to/add-a-dynamic-select-field.md:26-41`).
- Conventional commits; the PR title is what git-cliff parses. Never hand-edit `CHANGELOG.md`.
- Run `yarn tsc` and `yarn lint:all` before the final commit of each task.

---

### Task 1: Fix the field label / notched-outline collision

**Files:**
- Modify: `backstage/plugins/platform-ui/src/styles.ts:954-971`
- Modify: `backstage/plugins/platform-ui/src/theme.tsx:139` (inside `componentOverrides`)
- Test: `backstage/plugins/platform-ui/src/styles.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing importable. Behavioural contract: no rule in `SHADCN_CSS` sets `left` on a selector that can match `MuiInputLabel-outlined`.

Root cause, for the implementer: `styles.ts:963-965` sets `left: var(--sc-field-x)` on **every** `MuiInputLabel-root`. It was written for MUI's *standard* variant (see the comment above it). Backstage's `MultiEntityPicker` hard-codes `variant="outlined"`, whose label is positioned by `transform: translate(14px, …)` and whose `<legend>` notch is only 13px wide. The two desync, and the label lands on the border instead of in the gap — visible the moment you select an entity, because that flips `shrink`/`notched` on.

- [ ] **Step 1: Write the failing test**

Add to `backstage/plugins/platform-ui/src/styles.test.ts`, inside the existing `describe('SHADCN_CSS')`:

```ts
  it('never repositions an outlined label, whose notch geometry MUI owns', () => {
    // The standard variant needs left: 10px to sit inside our boxed field.
    // The outlined variant must not be touched: its label is placed by a
    // transform and its <legend> is cut to match, so moving one and not the
    // other puts the text on the border. Selecting an entity in a
    // MultiEntityPicker is what makes it visible.
    const offenders = SHADCN_CSS.split('}')
      .filter(block => /left:\s*var\(--sc-field-x\)/.test(block))
      .filter(block => /MuiInputLabel-root|MuiFormLabel-root/.test(block));
    expect(offenders).toEqual([]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backstage && yarn test plugins/platform-ui/src/styles.test.ts -t 'never repositions an outlined label'`
Expected: FAIL — the array contains the block at `styles.ts:963-965`.

- [ ] **Step 3: Delete the CSS rules the theme is taking over**

In `backstage/plugins/platform-ui/src/styles.ts`, delete the comment block and both rules spanning lines 954-971 — the `.sc-route-create [class*="MuiInputLabel-root"], … { left: var(--sc-field-x); }` rule and the `.sc-route-create [class*="MuiInputLabel-shrink"] { padding-inline-end: 4px; }` rule that compensates for it. Leave the `MuiInput-root`, `MuiInput-underline` and `.Mui-focused` rules around them untouched.

- [ ] **Step 4: Add the geometry to the theme instead**

In `backstage/plugins/platform-ui/src/theme.tsx`, inside the `componentOverrides` object (opens at `:139`), add these three keys next to `BackstageAutocomplete`:

```ts
    // Input geometry lives here, not in styles.ts: MUI publishes these slots,
    // and createUnifiedTheme runs transformV5ComponentThemesToV4 over every
    // Mui* key, so a v5-shaped override reaches the MUI v4 scaffolder form.
    // Scoped by slot rather than by route class, which is what makes it cover
    // EntityPicker/OwnedEntityPicker/RepoUrlPicker the day a template uses one.
    MuiInputLabel: {
      styleOverrides: {
        // `formControl` is the standard variant only — the outlined and filled
        // slots below are separate, so this can no longer leak onto them.
        formControl: {
          left: 'var(--sc-field-x)',
        },
        shrink: {
          paddingInlineEnd: '4px',
        },
        outlined: {
          // Undo the standard-variant offset for this slot and give the shrunk
          // label one more pixel of clearance: our border is 2px where MUI's
          // -6px assumes 1px.
          left: '0',
          '&.MuiInputLabel-shrink': {
            paddingInlineEnd: '0',
            transform: 'translate(14px, -7px) scale(0.75)',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: {
          // The label is uppercased (styles.ts) but the <legend> MUI generates
          // from the raw title is not, so the notch was cut too narrow for the
          // text sitting in it.
          '& legend': {
            textTransform: 'uppercase',
            fontFamily: 'var(--sc-font-ui)',
          },
        },
      },
    },
```

- [ ] **Step 5: Run the test suite for the file**

Run: `cd backstage && yarn test plugins/platform-ui/src/styles.test.ts`
Expected: PASS, including the new assertion and the pre-existing truncation/brace guards.

- [ ] **Step 6: Type-check and lint**

Run: `cd backstage && yarn tsc && yarn lint:all`
Expected: clean. `componentOverrides` is a deliberately untyped local (`theme.tsx:130-138` explains why), so the new `Mui*` keys do not trip TS2353.

- [ ] **Step 7: Verify in the browser — this cannot be asserted in jest**

Run: `bash scripts/backstage-up.sh` then `cd backstage && yarn start`. Open `/create/templates/default/bulk-delete-resources`, select a resource, and confirm the "Resources" label sits inside the notch rather than on the border. Repeat in dark mode and on a template with a plain text field (`git-resource`) to confirm the standard variant still has its 10px inset.

- [ ] **Step 8: Fold in the twin rule**

`styles.ts:1704-1711` and `:1724-1728` (the `.sc-route-import` block) style `MuiInputLabel-root` and `MuiOutlinedInput-root` the same way for the catalog-import page. It does not set `left`, so it is not broken today — but it is the same hack one page away. Move any label/outline geometry from it into the theme keys added in Step 4, leaving colour-only rules in `styles.ts`.

- [ ] **Step 9: Note the contract in the docs**

In `docs/explanation/design-system.md`, in the section describing the three-layer contract, add one sentence: input geometry (label position, notch, outline width) lives in `theme.tsx` override keys; `styles.ts` may colour inputs but must not reposition their labels.

- [ ] **Step 10: Commit**

```bash
git add backstage/plugins/platform-ui/src/styles.ts backstage/plugins/platform-ui/src/theme.tsx backstage/plugins/platform-ui/src/styles.test.ts docs/explanation/design-system.md
git commit -m "fix: keep outlined field labels inside their notch"
```

---

### Task 2: Document array-row duplication

**Files:**
- Modify: `docs/how-to/author-a-template.md`
- Already applied (verify only): `deploy/dev/seed/software-templates/templates/git-resource/template.yaml`, `deploy/dev/seed/software-templates/templates/param-forwarding-demo/template.yaml`
- Possibly modify: `backstage/plugins/platform-ui/src/styles.ts:2131-2138`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. Documentation + a visual check.

No code is needed: `@rjsf/core/dist/index.js:767` reads `copyable` from `ui:options` and `@rjsf/material-ui/dist/index.js:115,331` renders the `CopyButton`. Both fixtures already carry the option.

- [ ] **Step 1: Verify the button actually appears**

Run: `bash scripts/backstage-up.sh` then `cd backstage && yarn start`. Open `/create/templates/default/git-resource` and `/create/templates/default/param-forwarding-demo`. Confirm: a copy icon on each array row; clicking appends a duplicate carrying that row's values; the duplicate is **independently editable** (edit the copy's `path` and confirm the original does not change — a shallow copy would alias them).

If the icon does not appear, stop: the cause is Backstage's `uiSchema` plumbing, not RJSF, and this task becomes a whole-array custom field roughly the size of `SecretField.tsx`. Report before proceeding.

- [ ] **Step 2: Check the button's styling**

The three existing array buttons are recoloured at `styles.ts:2131-2138` by targeting `MuiIconButton-colorPrimary`. Confirm the copy button inherits it in light and dark. If it does not, extend that selector — colour only, no geometry (Task 1's contract).

- [ ] **Step 3: Document it**

In `docs/how-to/author-a-template.md`, under the parameters section, add:

````markdown
### Repeating rows the user can duplicate

An array field gets a per-row copy button — which duplicates the row *with its
current values* — from one option:

```yaml
mounts:
  type: array
  title: Mounts
  ui:options:
    copyable: true
  items:
    type: object
    properties:
      path: { type: string, title: Path }
      readOnly: { type: boolean, title: Read only, default: false }
```

This is RJSF's own feature, not a platform field extension. Making **Add**
itself copy the previous row is not supported, and would remove the only way to
get an empty row.
````

- [ ] **Step 4: Commit**

```bash
git add docs/how-to/author-a-template.md deploy/dev/seed/software-templates/templates/git-resource/template.yaml deploy/dev/seed/software-templates/templates/param-forwarding-demo/template.yaml backstage/plugins/platform-ui/src/styles.ts
git commit -m "docs: array rows can be duplicated with ui:options.copyable"
```

---

### Task 3: The coordinate-tree walker

**Files:**
- Create: `backstage/plugins/platform-ui/src/coordinateTree.ts`
- Test: `backstage/plugins/platform-ui/src/coordinateTree.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function walkTree(root: unknown, keys: string[]): string[] | undefined` and `export function pickPath(data: unknown, path?: string): unknown`. Task 5 imports both.

The API returns `{ coordinates: { space: { network: { region: { island: [env, …] } } } }, projects: [...] }` — four levels of objects keyed by name, then a sorted array of environment names.

- [ ] **Step 1: Write the failing test**

Create `backstage/plugins/platform-ui/src/coordinateTree.test.ts`:

```ts
import { pickPath, walkTree } from './coordinateTree';

const TREE = {
  coordinates: {
    prod: {
      core: {
        'eu-west': { mgmt: ['dev', 'prod'], paris: ['prod'] },
        'us-east': { ashburn: ['dev'] },
      },
    },
  },
  projects: ['alpha', 'beta'],
};

describe('pickPath', () => {
  it('returns the whole payload when no path is given', () => {
    expect(pickPath(TREE)).toBe(TREE);
  });

  it('descends a dotted path', () => {
    expect(pickPath(TREE, 'coordinates.prod.core')).toEqual(
      TREE.coordinates.prod.core,
    );
  });

  it('returns undefined for a path that does not exist', () => {
    expect(pickPath(TREE, 'coordinates.nope')).toBeUndefined();
  });
});

describe('walkTree', () => {
  const root = TREE.coordinates;

  it('lists the top level when no ancestors are chosen', () => {
    expect(walkTree(root, [])).toEqual(['prod']);
  });

  it('lists children of the chosen ancestors', () => {
    expect(walkTree(root, ['prod', 'core'])).toEqual(['eu-west', 'us-east']);
  });

  it('returns the leaf array verbatim', () => {
    expect(walkTree(root, ['prod', 'core', 'eu-west', 'mgmt'])).toEqual([
      'dev',
      'prod',
    ]);
  });

  it('returns undefined when an ancestor is unset', () => {
    // An empty string is what RJSF holds for an untouched select.
    expect(walkTree(root, ['prod', ''])).toBeUndefined();
  });

  it('returns undefined when an ancestor names a value the tree lost', () => {
    expect(walkTree(root, ['prod', 'core', 'af-south'])).toBeUndefined();
  });

  it('returns undefined for a null node rather than throwing', () => {
    expect(walkTree({ a: null }, ['a', 'b'])).toBeUndefined();
  });

  it('returns an empty list for an empty branch, which is not the same as unset', () => {
    expect(walkTree({ a: {} }, ['a'])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backstage && yarn test plugins/platform-ui/src/coordinateTree.test.ts`
Expected: FAIL — `Cannot find module './coordinateTree'`.

- [ ] **Step 3: Write the implementation**

Create `backstage/plugins/platform-ui/src/coordinateTree.ts`:

```ts
/**
 * Walking the infra coordinate tree, client-side.
 *
 * The config API hands back the whole tree in one call — nested objects keyed
 * by name (space -> network -> region -> island) with a sorted array of
 * environment names at the leaf. Rather than teach DynamicSelect about trees,
 * or ask the config API for a per-level endpoint, each level's options are
 * resolved here from the ancestors the form already holds. Pure, so it is the
 * cheapest part of the cascade to test.
 */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Descend a dotted path (`coordinates.prod`), or return the payload unchanged. */
export function pickPath(data: unknown, path?: string): unknown {
  if (!path) return data;
  let node: unknown = data;
  for (const key of path.split('.')) {
    if (!isRecord(node)) return undefined;
    node = node[key];
  }
  return node;
}

/**
 * The options for the level below `keys`.
 *
 * `undefined` means "not answerable yet" — an ancestor is unset, or names a
 * value the tree no longer has. That is deliberately distinct from `[]`, which
 * means the branch exists and is empty: the first renders a disabled field
 * asking for the parent, the second an empty list.
 */
export function walkTree(root: unknown, keys: string[]): string[] | undefined {
  let node: unknown = root;
  for (const key of keys) {
    if (!key || !isRecord(node)) return undefined;
    if (!(key in node)) return undefined;
    node = node[key];
  }
  if (Array.isArray(node)) return node.map(String);
  if (isRecord(node)) return Object.keys(node);
  return undefined;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backstage && yarn test plugins/platform-ui/src/coordinateTree.test.ts`
Expected: PASS, 10 assertions.

- [ ] **Step 5: Commit**

```bash
git add backstage/plugins/platform-ui/src/coordinateTree.ts backstage/plugins/platform-ui/src/coordinateTree.test.ts
git commit -m "feat: walk the infra coordinate tree client-side"
```

---

### Task 4: Let DynamicSelect take pre-resolved options, and drop a stale value

**Files:**
- Modify: `backstage/plugins/platform-ui/src/DynamicSelect.tsx`
- Test: `backstage/plugins/platform-ui/src/DynamicSelect.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `DynamicSelectProps` gains `options?: ChoiceOption[]` (when present, no fetching happens at all) and the component now calls `onOptions` after every successful load. Task 5 passes both.

Two changes. First, the field will resolve options from the tree itself, so the component needs a mode where it renders a given list instead of fetching. Second, `onOptions` already exists in the props (`DynamicSelect.tsx:42`) and is already called at `:87` — but no caller passes it, which is why nothing clears a child selection today.

- [ ] **Step 1: Write the failing tests**

Append to `backstage/plugins/platform-ui/src/DynamicSelect.test.tsx`, inside `describe('DynamicSelect')`:

```ts
  it('renders given options without fetching', async () => {
    const fetcher = mockFetcher([['never-used']]);
    render(
      <DynamicSelect
        url="/api/regions"
        options={[{ label: 'eu-west', value: 'eu-west' }]}
        fetcher={fetcher}
      />,
    );
    await screen.findByRole('option', { name: 'eu-west' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reports fresh options so a caller can drop a stale selection', async () => {
    const onOptions = jest.fn();
    const fetcher = mockFetcher([['us-east-1']]);
    render(
      <DynamicSelect url="/api/regions" fetcher={fetcher} onOptions={onOptions} />,
    );
    await waitFor(() =>
      expect(onOptions).toHaveBeenCalledWith([
        { label: 'us-east-1', value: 'us-east-1' },
      ]),
    );
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backstage && yarn test plugins/platform-ui/src/DynamicSelect.test.tsx -t 'renders given options'`
Expected: FAIL — the fetcher is called, and `options` is not a known prop.

- [ ] **Step 3: Implement**

In `backstage/plugins/platform-ui/src/DynamicSelect.tsx`:

Add to `DynamicSelectProps` (after `url`):

```ts
  /**
   * Pre-resolved options. When given, nothing is fetched — the caller already
   * has the data (e.g. a cascade that resolved this level from a tree it holds).
   * `url` is still required so the component keeps one shape.
   */
  options?: ChoiceOption[];
```

Rename the state setter's source so the given list wins. Replace the destructure and the state line:

```ts
export function DynamicSelect({
  url,
  options: givenOptions,
  intervalMs,
  value,
  onChange,
  fetcher = defaultFetcher,
  placeholder = 'Select…',
  disabled,
  className = '',
  onOptions,
}: DynamicSelectProps) {
  const [fetched, setFetched] = useState<ChoiceOption[]>([]);
  const options = givenOptions ?? fetched;
  const [loading, setLoading] = useState(!givenOptions);
```

Inside the effect, guard the whole thing and use the new setter:

```ts
  useEffect(() => {
    if (givenOptions) return undefined;
    let cancelled = false;
    // …unchanged…
        setFetched(next);
    // …unchanged…
  }, [url, intervalMs, givenOptions]);
```

Leave the `onOptionsRef.current?.(next)` call where it is at `:87`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backstage && yarn test plugins/platform-ui/src/DynamicSelect.test.tsx`
Expected: PASS — the two new tests plus the six that existed.

- [ ] **Step 5: Commit**

```bash
git add backstage/plugins/platform-ui/src/DynamicSelect.tsx backstage/plugins/platform-ui/src/DynamicSelect.test.tsx
git commit -m "feat: DynamicSelect accepts pre-resolved options"
```

---

### Task 5: Cascade the field over the tree

**Files:**
- Modify: `backstage/plugins/platform-ui/src/DynamicSelectField.tsx`
- Test: `backstage/plugins/platform-ui/src/DynamicSelectField.test.tsx` (create)
- Modify: `backstage/app-config.yaml` (proxy endpoint)
- Modify: `docs/how-to/add-a-dynamic-select-field.md`
- Modify: `deploy/dev/seed/software-templates/templates/provision-database/template.yaml`

**Interfaces:**
- Consumes: `walkTree`, `pickPath` from Task 3; `options` and `onOptions` props from Task 4.
- Produces: two new `ui:options` keys — `treePath?: string` and `dependsOn?: string[]`.

- [ ] **Step 1: Probe how sibling values arrive — do this before writing anything**

The design assumes RJSF's `formContext` carries the whole form's data. Verify it rather than trust it: temporarily add `console.log('formContext', props.formContext)` at the top of `DynamicSelectFieldComponent`, run `yarn start`, open `/create/templates/default/provision-database`, type in a field, and read the console.

If `formContext.formData` holds the sibling values, continue. If it does not, stop and report — the fallbacks (`props.registry.formContext`, or lifting values through `ui:options`) change this task's shape. Remove the `console.log` before Step 3.

- [ ] **Step 2: Write the failing test**

Create `backstage/plugins/platform-ui/src/DynamicSelectField.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { DynamicSelectFieldComponent } from './DynamicSelectField';

const TREE = {
  coordinates: {
    prod: { core: { 'eu-west': { mgmt: ['dev'], paris: ['prod'] } } },
  },
};

function apis(body: unknown = TREE) {
  return [
    [discoveryApiRef, { getBaseUrl: async () => 'http://localhost:7007/api/proxy' }],
    [
      fetchApiRef,
      {
        fetch: async () =>
          ({ ok: true, status: 200, statusText: 'OK', json: async () => body }) as Response,
      },
    ],
  ] as const;
}

function renderField(props: Record<string, unknown>) {
  return render(
    <TestApiProvider apis={apis() as never}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <DynamicSelectFieldComponent {...(props as any)} />
    </TestApiProvider>,
  );
}

describe('DynamicSelectFieldComponent', () => {
  const base = {
    onChange: jest.fn(),
    schema: { title: 'Island' },
    formData: '',
  };

  it('offers the children of the chosen ancestors', async () => {
    renderField({
      ...base,
      uiSchema: {
        'ui:options': {
          proxyPath: '/infra/coordinate-tree',
          treePath: 'coordinates',
          dependsOn: ['space', 'network', 'region'],
        },
      },
      formContext: { formData: { space: 'prod', network: 'core', region: 'eu-west' } },
    });
    await screen.findByRole('option', { name: 'mgmt' });
    await screen.findByRole('option', { name: 'paris' });
  });

  it('is disabled and says so while an ancestor is unset', async () => {
    renderField({
      ...base,
      uiSchema: {
        'ui:options': {
          proxyPath: '/infra/coordinate-tree',
          treePath: 'coordinates',
          dependsOn: ['space', 'network'],
        },
      },
      formContext: { formData: { space: 'prod' } },
    });
    const select = await screen.findByRole('combobox');
    expect(select).toBeDisabled();
    expect(select).toHaveTextContent(/Pick network first/i);
  });

  it('drops a selection the new branch does not contain', async () => {
    const onChange = jest.fn();
    renderField({
      ...base,
      onChange,
      formData: 'paris',
      uiSchema: {
        'ui:options': {
          proxyPath: '/infra/coordinate-tree',
          treePath: 'coordinates',
          dependsOn: ['space', 'network', 'region'],
        },
      },
      // A region whose islands do not include 'paris'.
      formContext: { formData: { space: 'prod', network: 'core', region: 'nowhere' } },
    });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(undefined));
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backstage && yarn test plugins/platform-ui/src/DynamicSelectField.test.tsx`
Expected: FAIL — `DynamicSelectFieldComponent` is not exported.

- [ ] **Step 4: Implement the cascade**

In `backstage/plugins/platform-ui/src/DynamicSelectField.tsx`:

Export the component and import the walker:

```ts
import { pickPath, walkTree } from './coordinateTree';
```

Extend `UiOptions`:

```ts
  /**
   * Dotted path to the tree inside the response (e.g. `coordinates`), for an
   * endpoint that returns the whole hierarchy rather than one flat level.
   */
  treePath?: string;
  /**
   * Sibling field names whose values are this level's ancestors, outermost
   * first. Explicit rather than inferred from field order: a template may
   * interleave unrelated fields, and an implicit rule would break silently
   * when someone reorders the form.
   */
  dependsOn?: string[];
```

Change the signature to `export function DynamicSelectFieldComponent(props: any)` and destructure `formContext`:

```ts
  const { formData, onChange, uiSchema, schema, formContext } = props;
```

After the existing `url` effect, resolve the tree and this level's options:

```ts
  const ancestors: string[] = (opts.dependsOn ?? []).map(
    name => (formContext?.formData?.[name] as string) ?? '',
  );
  const [tree, setTree] = useState<unknown>();

  useEffect(() => {
    if (!url || !opts.treePath) return undefined;
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetchApi.fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`.trim());
        const body = await res.json();
        if (!cancelled) setTree(pickPath(body, opts.treePath));
      } catch (e) {
        if (!cancelled && (e as { name?: string })?.name !== 'AbortError') {
          setErr(String((e as Error)?.message ?? e));
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url, opts.treePath, fetchApi]);

  // undefined = an ancestor is unset or stale, which is not the same as an
  // empty branch. The first asks for the parent; the second is a real empty list.
  const levelValues = opts.treePath ? walkTree(tree, ancestors) : undefined;
  const options = levelValues?.map(v => ({ label: v, value: v }));
  const blockedBy = opts.dependsOn?.find(
    (_, i) => !ancestors[i],
  );

  // A value that survived an ancestor change points at a coordinate that no
  // longer exists; submitting it would name a resource nobody can resolve.
  useEffect(() => {
    if (!opts.treePath || !levelValues || !formData) return;
    if (!levelValues.includes(formData as string)) onChange(undefined);
  }, [levelValues, formData, onChange, opts.treePath]);
```

Render: when `opts.treePath` is set, pass `options` and a disabled state instead of letting the child fetch.

```tsx
      {url ? (
        <DynamicSelect
          url={url}
          options={options}
          intervalMs={opts.treePath ? undefined : opts.intervalMs}
          value={(formData as string) ?? ''}
          onChange={v => onChange(v)}
          disabled={Boolean(opts.treePath) && !options}
          placeholder={
            blockedBy
              ? `Pick ${blockedBy} first`
              : opts.placeholder ?? schema?.title ?? 'Select…'
          }
          fetcher={(u, signal) => fetchApi.fetch(u, { signal })}
        />
      ) : (
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backstage && yarn test plugins/platform-ui/src/DynamicSelectField.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 6: Share one fetch across the five levels**

Five sibling fields with the same URL currently mean five identical requests. Add a module-level cache above the component in `DynamicSelectField.tsx`:

```ts
/**
 * One request per URL, shared by every field on the form. Five coordinate
 * levels asking the same endpoint for the same whole tree is five times the
 * work for one answer. Short TTL rather than a context provider: the cache is
 * an implementation detail of this field, and a provider would have to be
 * mounted by every app that uses it.
 */
const TREE_TTL_MS = 30_000;
const treeCache = new Map<string, { at: number; promise: Promise<unknown> }>();

function fetchTree(url: string, fetcher: (u: string) => Promise<Response>) {
  const hit = treeCache.get(url);
  if (hit && Date.now() - hit.at < TREE_TTL_MS) return hit.promise;
  const promise = fetcher(url).then(res => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`.trim());
    return res.json();
  });
  treeCache.set(url, { at: Date.now(), promise });
  return promise;
}
```

Use it in the tree effect in place of the inline `fetchApi.fetch(...)` + `res.json()`, keeping the abort handling for the component's own unmount. Add a test that two mounted fields with the same `proxyPath` produce exactly one `fetch` call.

- [ ] **Step 7: Add the proxy endpoint**

In `backstage/app-config.yaml`, under `proxy.endpoints`, next to `/demo-options`:

```yaml
    '/infra':
      target: ${INFRA_CONFIG_API_URL}
      changeOrigin: true
      headers:
        Authorization: Bearer ${INFRA_CONFIG_API_TOKEN}
```

The token stays server-side; the browser only ever calls `/api/proxy/infra/...`. Document both env vars in `docs/reference/configuration.md` next to the existing proxy section.

- [ ] **Step 8: Add a worked example template**

In `deploy/dev/seed/software-templates/templates/provision-database/template.yaml`, add the five cascading properties:

```yaml
        space:
          type: string
          title: Space
          ui:field: DynamicSelect
          ui:options: { proxyPath: /infra/coordinate-tree, treePath: coordinates }
        network:
          type: string
          title: Network
          ui:field: DynamicSelect
          ui:options: { proxyPath: /infra/coordinate-tree, treePath: coordinates, dependsOn: [space] }
        region:
          type: string
          title: Region
          ui:field: DynamicSelect
          ui:options: { proxyPath: /infra/coordinate-tree, treePath: coordinates, dependsOn: [space, network] }
        island:
          type: string
          title: Island
          ui:field: DynamicSelect
          ui:options: { proxyPath: /infra/coordinate-tree, treePath: coordinates, dependsOn: [space, network, region] }
        environment:
          type: string
          title: Environment
          ui:field: DynamicSelect
          ui:options: { proxyPath: /infra/coordinate-tree, treePath: coordinates, dependsOn: [space, network, region, island] }
```

Forward them in the step's `params` block alongside the existing ones.

- [ ] **Step 9: Document the cascade**

In `docs/how-to/add-a-dynamic-select-field.md`, add a "Dependent selects" section with the YAML above, the response shape it expects, and the two rules: `dependsOn` is ordered outermost-first, and changing a parent clears any child whose value the new branch does not contain.

- [ ] **Step 10: Verify end to end**

Run the stack, open the template, and check: `network` is disabled until `space` is picked; picking a different `space` clears `network` downward; the network tab shows **one** request to `/api/proxy/infra/coordinate-tree`, not five.

- [ ] **Step 11: Commit**

```bash
cd backstage && yarn tsc && yarn lint:all
git add backstage/plugins/platform-ui/src/DynamicSelectField.tsx backstage/plugins/platform-ui/src/DynamicSelectField.test.tsx backstage/app-config.yaml deploy/dev/seed/software-templates/templates/provision-database/template.yaml docs/how-to/add-a-dynamic-select-field.md docs/reference/configuration.md
git commit -m "feat: cascading DynamicSelect over the infra coordinate tree"
```

---

### Task 6: Presigned-upload backend route

**Files:**
- Create: `backstage/plugins/platform-requests-backend/src/uploads.ts`
- Test: `backstage/plugins/platform-requests-backend/src/uploads.test.ts`
- Modify: `backstage/plugins/platform-requests-backend/src/router.ts`
- Modify: `backstage/plugins/platform-requests-backend/config.d.ts`
- Modify: `backstage/plugins/platform-requests-backend/package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `POST /api/platform-requests/uploads/presign` taking `{ filename: string; size: number; contentType: string }` and returning `{ url: string; key: string; bucket: string; expiresIn: number }` — `bucket` is in the response because Task 7 composes the form value `s3://<bucket>/<key>` from it. Also `export function uploadKey(prefix: string, requester: string, filename: string, uuid: string): string` and `export function validateUpload(input, config): string | undefined` (the error message, or `undefined` when valid) — Task 7 depends on the route contract only.

- [ ] **Step 1: Add the dependency**

Run: `cd backstage && yarn workspace @internal/backstage-plugin-platform-requests-backend add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`

- [ ] **Step 2: Write the failing test**

Create `backstage/plugins/platform-requests-backend/src/uploads.test.ts`:

```ts
import { uploadKey, validateUpload } from './uploads';

const CONFIG = {
  bucket: 'platform-uploads',
  region: 'eu-west-1',
  keyPrefix: 'scaffolder',
  maxBytes: 1024,
  allowedExtensions: ['.yaml', '.json'],
  urlTtlSeconds: 300,
};

describe('validateUpload', () => {
  const ok = { filename: 'values.yaml', size: 10, contentType: 'text/yaml' };

  it('accepts a permitted file', () => {
    expect(validateUpload(ok, CONFIG)).toBeUndefined();
  });

  it('rejects an extension that is not allowed', () => {
    expect(validateUpload({ ...ok, filename: 'run.sh' }, CONFIG)).toMatch(
      /extension/i,
    );
  });

  it('rejects a file over the cap', () => {
    expect(validateUpload({ ...ok, size: 1025 }, CONFIG)).toMatch(/1024/);
  });

  it('rejects a non-positive size, which would sign an unusable URL', () => {
    expect(validateUpload({ ...ok, size: 0 }, CONFIG)).toMatch(/size/i);
  });

  it('is case-insensitive about the extension', () => {
    expect(validateUpload({ ...ok, filename: 'VALUES.YAML' }, CONFIG)).toBeUndefined();
  });
});

describe('uploadKey', () => {
  it('namespaces by prefix, requester and a uuid', () => {
    expect(uploadKey('scaffolder', 'ada', 'values.yaml', 'uuid-1')).toBe(
      'scaffolder/ada/uuid-1/values.yaml',
    );
  });

  it('strips path separators and traversal out of the filename', () => {
    expect(uploadKey('p', 'ada', '../../etc/passwd', 'u')).toBe('p/ada/u/passwd');
  });

  it('replaces characters that would need escaping in a URL', () => {
    expect(uploadKey('p', 'ada', 'my values (1).yaml', 'u')).toBe(
      'p/ada/u/my-values-1-.yaml',
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backstage && yarn test plugins/platform-requests-backend/src/uploads.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `backstage/plugins/platform-requests-backend/src/uploads.ts`:

```ts
import { randomUUID } from 'crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadConfig {
  bucket: string;
  region: string;
  endpoint?: string;
  keyPrefix: string;
  maxBytes: number;
  allowedExtensions: string[];
  urlTtlSeconds: number;
}

export interface UploadRequest {
  filename: string;
  size: number;
  contentType: string;
}

/** The rejection message, or undefined when the upload is allowed. Pure. */
export function validateUpload(
  input: UploadRequest,
  config: UploadConfig,
): string | undefined {
  if (!Number.isInteger(input.size) || input.size <= 0) {
    return 'size must be a positive integer';
  }
  if (input.size > config.maxBytes) {
    return `file is ${input.size} bytes; the limit is ${config.maxBytes}`;
  }
  const lower = input.filename.toLowerCase();
  if (!config.allowedExtensions.some(ext => lower.endsWith(ext.toLowerCase()))) {
    return `extension not allowed; permitted: ${config.allowedExtensions.join(', ')}`;
  }
  return undefined;
}

/**
 * `<prefix>/<requester>/<uuid>/<filename>`. The uuid keeps two uploads of the
 * same name apart and makes a key unguessable; the requester segment is the
 * audit trail; the filename stays last so a human reading the bucket can tell
 * what it is.
 */
export function uploadKey(
  prefix: string,
  requester: string,
  filename: string,
  uuid: string,
): string {
  const base = filename.split('/').pop() ?? 'file';
  const safe = base.replace(/[^A-Za-z0-9._-]/g, '-');
  return `${prefix}/${requester}/${uuid}/${safe}`;
}

/**
 * Sign a single PUT of exactly this many bytes.
 *
 * Content-Length is signed, not merely advised: a presigned URL on its own
 * accepts a body of any size, so the cap would be a suggestion. With the
 * length in the signature S3 rejects anything else, and the limit is enforced
 * by S3 rather than by trusting the browser.
 */
export async function presignUpload(
  input: UploadRequest,
  config: UploadConfig,
  requester: string,
): Promise<{ url: string; key: string; bucket: string; expiresIn: number }> {
  const key = uploadKey(config.keyPrefix, requester, input.filename, randomUUID());
  const client = new S3Client({
    region: config.region,
    ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
  });
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: input.contentType,
      ContentLength: input.size,
    }),
    { expiresIn: config.urlTtlSeconds, signableHeaders: new Set(['content-length', 'content-type']) },
  );
  return { url, key, bucket: config.bucket, expiresIn: config.urlTtlSeconds };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backstage && yarn test plugins/platform-requests-backend/src/uploads.test.ts`
Expected: PASS, 8 assertions.

- [ ] **Step 6: Wire the route**

In `backstage/plugins/platform-requests-backend/src/router.ts`, import the module and add the route next to the others. `actorId(credentials.principal.userEntityRef)` and `httpAuth.credentials` are already used by the create route — match whatever those lines look like in the surrounding code.

```ts
import { presignUpload, UploadConfig, validateUpload } from './uploads';

const presignSchema = z.object({
  filename: z.string().min(1),
  size: z.number().int().positive(),
  contentType: z.string().min(1),
});

router.post('/uploads/presign', async (req, res) => {
  const credentials = await httpAuth.credentials(req, { allow: ['user'] });
  const raw = options.config.getOptionalConfig('platform.uploads');
  if (!raw) {
    // Fail loudly rather than 500ing somewhere inside the AWS SDK: an
    // unconfigured deployment is a deployment decision, not a bug.
    res.status(501).json({ error: 'platform.uploads is not configured' });
    return;
  }
  const uploads: UploadConfig = {
    bucket: raw.getString('bucket'),
    region: raw.getString('region'),
    endpoint: raw.getOptionalString('endpoint'),
    keyPrefix: raw.getString('keyPrefix'),
    maxBytes: raw.getNumber('maxBytes'),
    allowedExtensions: raw.getStringArray('allowedExtensions'),
    urlTtlSeconds: raw.getNumber('urlTtlSeconds'),
  };
  const input = presignSchema.parse(req.body);
  const rejection = validateUpload(input, uploads);
  if (rejection) {
    res.status(400).json({ error: rejection });
    return;
  }
  const requester = actorId(credentials.principal.userEntityRef);
  res.json(await presignUpload(input, uploads, requester));
});
```

- [ ] **Step 7: Declare the config**

In `backstage/plugins/platform-requests-backend/config.d.ts`, add under `platform`:

```ts
    /**
     * S3 destination for scaffolder file uploads. Backend-only: the browser
     * receives a presigned URL, never a credential.
     */
    uploads?: {
      bucket: string;
      region: string;
      /** Override for MinIO or another S3-compatible endpoint. */
      endpoint?: string;
      keyPrefix: string;
      maxBytes: number;
      allowedExtensions: string[];
      urlTtlSeconds: number;
    };
```

- [ ] **Step 8: Add a router test**

In `backstage/plugins/platform-requests-backend/src/router.test.ts`, following the existing style: an unauthenticated request is refused; a file with a banned extension returns 400 and the message; a valid request returns a `url` containing the bucket and a `key` matching `scaffolder/<requester>/`; and with no `platform.uploads` configured the route returns 501.

- [ ] **Step 9: Commit**

```bash
cd backstage && yarn tsc && yarn lint:all
git add backstage/plugins/platform-requests-backend/src/uploads.ts backstage/plugins/platform-requests-backend/src/uploads.test.ts backstage/plugins/platform-requests-backend/src/router.ts backstage/plugins/platform-requests-backend/src/router.test.ts backstage/plugins/platform-requests-backend/config.d.ts backstage/plugins/platform-requests-backend/package.json backstage/yarn.lock
git commit -m "feat: presigned S3 upload route for scaffolder file fields"
```

---

### Task 7: The PlatformFile field

**Files:**
- Create: `backstage/plugins/platform-ui/src/FileField.tsx`
- Test: `backstage/plugins/platform-ui/src/FileField.test.tsx`
- Modify: `backstage/plugins/platform-ui/src/DynamicSelectField.tsx:108-111` (the `extensions` array)
- Modify: `backstage/plugins/platform-ui/src/index.ts`
- Modify: `docs/how-to/author-a-template.md`
- Modify: `deploy/dev/seed/software-templates/templates/demo-resource/template.yaml`

**Interfaces:**
- Consumes: the route from Task 6.
- Produces: `export const fileFormField` (a `FormFieldBlueprint`) registering `ui:field: PlatformFile`, and `export function FileFieldComponent(props: any)`. The field's form value is the string `s3://<bucket>/<key>`.

**Name check before you start:** `PlatformFile`, not `FilePicker` — `SecretField.tsx:43-51` records that a built-in of the same name silently shadows a custom one.

- [ ] **Step 1: Write the failing test**

Create `backstage/plugins/platform-ui/src/FileField.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { FileFieldComponent } from './FileField';

function apis(presign: unknown, putOk = true) {
  const fetch = jest.fn(async (url: string) => {
    if (String(url).includes('/uploads/presign')) {
      return { ok: true, status: 200, json: async () => presign } as Response;
    }
    return { ok: putOk, status: putOk ? 200 : 403, statusText: 'Forbidden' } as Response;
  });
  return {
    fetch,
    apis: [
      [discoveryApiRef, { getBaseUrl: async () => 'http://localhost:7007/api/platform-requests' }],
      [fetchApiRef, { fetch }],
    ] as const,
  };
}

const FILE = new File(['name: demo'], 'values.yaml', { type: 'text/yaml' });

describe('FileFieldComponent', () => {
  it('uploads the file and stores the s3 url', async () => {
    const onChange = jest.fn();
    const { apis: a } = apis({
      url: 'https://s3.example.com/platform-uploads/scaffolder/ada/u/values.yaml?sig',
      key: 'scaffolder/ada/u/values.yaml',
      bucket: 'platform-uploads',
      expiresIn: 300,
    });
    render(
      <TestApiProvider apis={a as never}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <FileFieldComponent {...({ onChange, schema: { title: 'Values' }, uiSchema: {} } as any)} />
      </TestApiProvider>,
    );
    fireEvent.change(screen.getByLabelText(/values/i), { target: { files: [FILE] } });
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        's3://platform-uploads/scaffolder/ada/u/values.yaml',
      ),
    );
  });

  it('leaves the value unset and reports when the upload is rejected', async () => {
    const onChange = jest.fn();
    const { apis: a } = apis(
      { url: 'https://s3.example.com/x?sig', key: 'k', expiresIn: 300, bucket: 'b' },
      false,
    );
    render(
      <TestApiProvider apis={a as never}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <FileFieldComponent {...({ onChange, schema: { title: 'Values' }, uiSchema: {} } as any)} />
      </TestApiProvider>,
    );
    fireEvent.change(screen.getByLabelText(/values/i), { target: { files: [FILE] } });
    await screen.findByText(/upload failed/i);
    expect(onChange).not.toHaveBeenCalledWith(expect.stringContaining('s3://'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backstage && yarn test plugins/platform-ui/src/FileField.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the field**

Create `backstage/plugins/platform-ui/src/FileField.tsx`:

```tsx
import { useRef, useState } from 'react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import {
  createFormField,
  FormFieldBlueprint,
} from '@backstage/plugin-scaffolder-react/alpha';

interface UiOptions {
  /** Forwarded to the input's accept attribute, e.g. `.yaml,.json`. */
  accept?: string;
}

interface Presigned {
  url: string;
  key: string;
  bucket: string;
  expiresIn: number;
}

/**
 * Scaffolder field that puts a local file in S3 and stores its path.
 *
 * The bytes never pass through Backstage: the backend signs a single PUT for
 * exactly this key and exactly this length, and the browser uploads straight
 * to S3. The form value is the s3:// path, which the template forwards to Argo
 * as an ordinary param.
 *
 * A file is not a secret. Anything sensitive belongs in PlatformSecret, which
 * encrypts it and keeps it out of params, logs and Git.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FileFieldComponent(props: any) {
  const { formData, onChange, uiSchema, schema, idSchema } = props;
  const opts = (uiSchema?.['ui:options'] ?? {}) as UiOptions;
  const fetchApi = useApi(fetchApiRef);
  const discovery = useApi(discoveryApiRef);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [name, setName] = useState<string>();
  const aborter = useRef<AbortController>();

  const id = idSchema?.$id ?? 'platform-file';

  const upload = async (file: File) => {
    setBusy(true);
    setErr(undefined);
    setName(file.name);
    aborter.current?.abort();
    aborter.current = new AbortController();
    try {
      const base = await discovery.getBaseUrl('platform-requests');
      const presignRes = await fetchApi.fetch(`${base}/uploads/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          size: file.size,
          contentType: file.type || 'application/octet-stream',
        }),
        signal: aborter.current.signal,
      });
      if (!presignRes.ok) {
        throw new Error((await presignRes.text()) || `${presignRes.status}`);
      }
      const signed = (await presignRes.json()) as Presigned;

      // Content-Length is part of the signature. Sending anything else is
      // rejected by S3, which is what makes the size cap real rather than
      // advisory.
      const put = await fetch(signed.url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'Content-Length': String(file.size),
        },
        signal: aborter.current.signal,
      });
      if (!put.ok) throw new Error(`${put.status} ${put.statusText}`.trim());

      onChange(`s3://${signed.bucket}/${signed.key}`);
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return;
      setErr(`Upload failed: ${(e as Error)?.message ?? e}`);
      onChange(undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sc">
      {schema?.title && (
        <label className="sc-label" htmlFor={id}>
          {schema.title}
        </label>
      )}
      <input
        id={id}
        type="file"
        accept={opts.accept}
        disabled={busy}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      {busy && <div className="sc-muted">Uploading {name}…</div>}
      {!busy && formData && (
        <div className="sc-muted" style={{ fontSize: 12, marginTop: 4 }}>
          {name ?? 'Uploaded'} — {String(formData)}{' '}
          <button
            type="button"
            onClick={() => {
              setName(undefined);
              onChange(undefined);
            }}
          >
            Clear
          </button>
        </div>
      )}
      {err && (
        <div style={{ color: 'hsl(var(--sc-destructive))', fontSize: 12 }}>{err}</div>
      )}
      {schema?.description && (
        <div className="sc-muted" style={{ fontSize: 12, marginTop: 4 }}>
          {schema.description}
        </div>
      )}
    </div>
  );
}

export const fileFormField = FormFieldBlueprint.make({
  name: 'platform-file',
  params: {
    field: async () =>
      createFormField({ name: 'PlatformFile', component: FileFieldComponent }),
  },
});
```

Note the PUT uses the global `fetch`, not `fetchApi.fetch`: `fetchApi` injects a Backstage token, and sending one to S3 would both leak it off-origin and break the signature's header set.

`bucket` comes from the presign response (Task 6 returns it for exactly this reason) rather than from frontend config — the browser then cannot disagree with the backend about where the object went.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backstage && yarn test plugins/platform-ui/src/FileField.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Register the field**

In `backstage/plugins/platform-ui/src/DynamicSelectField.tsx`, import `fileFormField` and add it to the `extensions` array:

```ts
export const platformScaffolderFieldsModule = createFrontendModule({
  pluginId: 'scaffolder',
  extensions: [dynamicSelectFormField, secretFormField, fileFormField],
});
```

Export `fileFormField` from `plugins/platform-ui/src/index.ts` next to the existing field exports. No change to `packages/app/src/App.tsx` — the module is already in `features`.

- [ ] **Step 6: Add it to a demo template**

In `deploy/dev/seed/software-templates/templates/demo-resource/template.yaml`:

```yaml
        valuesFile:
          type: string
          title: Values file
          ui:field: PlatformFile
          ui:options:
            accept: .yaml,.yml,.json
          description: Uploaded to S3; the workflow receives the s3:// path.
```

Forward it in the step's `params` block so the workflow receives it.

- [ ] **Step 7: Document it**

In `docs/how-to/author-a-template.md`, add a "File uploads" section: the YAML above, the value shape (`s3://bucket/key`), the required `platform.uploads` config block from Task 6, and the three infrastructure prerequisites — bucket CORS allowing `PUT` from the Backstage origin with `Content-Type`/`Content-Length` in `AllowedHeaders`; the S3 endpoint added to `backend.csp.connect-src`; and a lifecycle rule on the key prefix so abandoned uploads expire. Include the warning that a file is *not* a secret: anything sensitive belongs in `PlatformSecret`, which encrypts it and keeps it out of params.

- [ ] **Step 8: Verify end to end**

With `platform.uploads` configured against a MinIO bucket from the dev stack, upload a file from `/create/templates/default/demo-resource` and confirm: the object appears in the bucket under `scaffolder/<you>/<uuid>/`; the form value is the `s3://` path; a file over `maxBytes` is refused *before* any bytes leave the browser; and a tampered `Content-Length` is refused by S3.

- [ ] **Step 9: Commit**

```bash
cd backstage && yarn tsc && yarn lint:all
git add backstage/plugins/platform-ui/src/FileField.tsx backstage/plugins/platform-ui/src/FileField.test.tsx backstage/plugins/platform-ui/src/DynamicSelectField.tsx backstage/plugins/platform-ui/src/index.ts deploy/dev/seed/software-templates/templates/demo-resource/template.yaml docs/how-to/author-a-template.md
git commit -m "feat: PlatformFile scaffolder field uploading to S3"
```
