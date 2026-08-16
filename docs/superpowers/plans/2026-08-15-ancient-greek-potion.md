# Ancient Greek Potion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a seventh bottle to the colour-scheme picker that switches the whole app into an ancient-Greek register — Hades-style ornate chrome, lit bright in light mode and underworld-dark in dark mode.

**Architecture:** A scheme record gains an optional `mode` field; picking it toggles one `sc-greek` class on the root element. Every colour and every piece of chrome then comes from CSS in a new `greek.ts` module, interpolated into the existing stylesheet the same way `statusTokenCss()` already is. No second MUI theme, no new image assets, no config key.

**Tech Stack:** TypeScript, React 18, Backstage frontend plugin (`@internal/plugin-platform-ui`), Jest + Testing Library, Yarn 4 (corepack), Node 22.

**Spec:** `docs/superpowers/specs/2026-08-15-ancient-greek-potion-design.md`

## Global Constraints

Copy these exactly; they are repo rules, not preferences.

- **All Node commands run from `backstage/`.** Single test file: `yarn test plugins/platform-ui/src/<file>`. Single test by name: `yarn test -t '<name>'`.
- **`styles.ts` is one template literal.** A stray backtick truncates the whole stylesheet; a backslash before digits is a legacy octal escape that fails the app build while `tsc` passes. Never weaken `styles.test.ts`.
- **No class name that a production build discards.** Only `Mui*`, `bui-*`, `sc-*` and `material-icons` prefixes are permitted in CSS selectors. `Backstage*`, `PluginCatalogGraph*` and `DependencyGraph*` come back as `jss<n>` in a built image — `styles.test.ts` fails on them. Style Backstage's own components through `theme.tsx` override keys instead.
- **All animation uses `steps()`, never `ease`,** and sits inside `@media (prefers-reduced-motion: no-preference)`. Nothing conveys state through motion alone.
- **State labels are records and never change.** `SUCCEEDED`, `FAILED`, `PENDING_APPROVAL` are what the API, badge and audit trail all say. Do not reskin them.
- **Contrast is measured, not eyeballed.** Status text must clear **5.0:1** against both the card and the covered dither pixel. Body text must clear 4.5:1.
- **Conventional commits are enforced.** The PR title is what git-cliff parses. Never hand-edit `CHANGELOG.md` or version fields.
- **Exact colour values are given in each task.** They are solved outputs, not suggestions — do not round or "improve" them without re-running the contrast maths.

---

### Task 1: Greek status tokens

Restructures `STATUS_TOKENS` from a flat list into a per-mode map and adds the Greek set. This is the only shared data structure the feature touches, so it goes first.

**Files:**
- Modify: `backstage/plugins/platform-ui/src/statusTokens.ts`
- Test: `backstage/plugins/platform-ui/src/contrast.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `SchemeMode` (`'default' | 'greek'`), `GREEK_CARD_LIGHT`, `GREEK_CARD_DARK`, `GREEK_STATUS_TOKENS: StatusToken[]`, `MODE_TOKENS: Record<SchemeMode, StatusToken[]>`, `MODE_CARDS: Record<SchemeMode, { light: string; dark: string }>`. `STATUS_TOKENS`, `CARD_LIGHT`, `CARD_DARK` and `statusTokenCss()` keep their existing names and signatures.

- [ ] **Step 1: Write the failing tests**

Append to `backstage/plugins/platform-ui/src/contrast.test.ts`. Add `MODE_CARDS`, `MODE_TOKENS` and `GREEK_STATUS_TOKENS` to the existing import from `./statusTokens` (`STATUS_TOKENS` and `statusTokenCss` are already imported).

```ts
describe('greek status text colours', () => {
  it('clears AA on the plain card in every mode', () => {
    for (const [mode, tokens] of Object.entries(MODE_TOKENS)) {
      const cards = MODE_CARDS[mode as keyof typeof MODE_CARDS];
      for (const t of tokens) {
        const light = contrast(t.light, cards.light);
        const dark = contrast(t.dark, cards.dark);
        expect(`${mode}/${t.name} light:${light >= AA}`).toBe(
          `${mode}/${t.name} light:true`,
        );
        expect(`${mode}/${t.name} dark:${dark >= AA}`).toBe(
          `${mode}/${t.name} dark:true`,
        );
      }
    }
  });

  it('clears AA on the dithered fill in every mode', () => {
    for (const [mode, tokens] of Object.entries(MODE_TOKENS)) {
      const cards = MODE_CARDS[mode as keyof typeof MODE_CARDS];
      for (const t of tokens) {
        const light = contrastOver(t.light, t.cell, t.cellAlpha, cards.light);
        const dark = contrastOver(t.dark, t.cell, t.cellAlpha, cards.dark);
        expect(`${mode}/${t.name} light:${light >= AA}`).toBe(
          `${mode}/${t.name} light:true`,
        );
        expect(`${mode}/${t.name} dark:${dark >= AA}`).toBe(
          `${mode}/${t.name} dark:true`,
        );
      }
    }
  });

  it('covers the same token names in every mode', () => {
    // A mode that forgets a token inherits the default colour on a surface it
    // was never measured against, which is exactly the failure this file exists
    // to catch.
    const names = STATUS_TOKENS.map(t => t.name).sort();
    for (const tokens of Object.values(MODE_TOKENS)) {
      expect(tokens.map(t => t.name).sort()).toEqual(names);
    }
  });

  it('emits the greek blocks after the default dark block', () => {
    // `:root.sc-dark` and `:root.sc-greek` are both specificity (0,2,0), so the
    // tie is broken by source order alone. Emit greek first and a greek page in
    // dark mode silently keeps the default dark status colours.
    const css = statusTokenCss();
    expect(css.indexOf(':root.sc-greek')).toBeGreaterThan(
      css.indexOf(':root.sc-dark'),
    );
    expect(css.indexOf(':root.sc-greek.sc-dark')).toBeGreaterThan(
      css.indexOf(':root.sc-greek {'),
    );
  });

  it('emits a light and dark value for every greek token', () => {
    const css = statusTokenCss();
    for (const t of GREEK_STATUS_TOKENS) {
      expect(css).toContain(`--sc-${t.name}: ${t.light}`);
      expect(css).toContain(`--sc-${t.name}: ${t.dark}`);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backstage && yarn test plugins/platform-ui/src/contrast.test.ts
```

Expected: FAIL — `MODE_TOKENS`, `MODE_CARDS` and `GREEK_STATUS_TOKENS` are not exported from `./statusTokens`.

- [ ] **Step 3: Add the Greek tokens and the per-mode map**

In `statusTokens.ts`, after the existing `STATUS_TOKENS` array, add:

```ts
/** Which palette a scheme drives. `default` is the six accent-only potions. */
export type SchemeMode = 'default' | 'greek';

/** `--sc-card` in the Greek registers, from greek.ts. */
export const GREEK_CARD_LIGHT = '42 45% 98%';
export const GREEK_CARD_DARK = '265 26% 10%';

/**
 * Ancient Greek status colours: laurel-gold, Styx cyan, ember.
 *
 * This mode deliberately redefines status hue, which the rest of the design
 * system does not do — see docs/explanation/design-system.md. Success is at
 * 60deg rather than a straight gold so it sits 25deg off the stock amber that
 * means *running* in the other six schemes, instead of the 15deg a plain gold
 * gave. Every value here is the lowest lightness clearing 5.0:1 against BOTH
 * the Greek card and the covered dither pixel — the same method as above.
 */
export const GREEK_STATUS_TOKENS: StatusToken[] = [
  {
    name: 'on-success',
    light: '60 95% 19%',
    dark: '60 72% 42%',
    cell: '58 62% 42%',
    cellAlpha: 0.28,
  },
  {
    name: 'on-warning',
    light: '188 95% 23%',
    dark: '188 72% 49%',
    cell: '188 65% 45%',
    cellAlpha: 0.28,
  },
  {
    name: 'on-destructive',
    light: '12 88% 34%',
    dark: '12 92% 65%',
    cell: '12 78% 50%',
    cellAlpha: 0.24,
  },
  {
    name: 'on-muted',
    light: '38 12% 32%',
    dark: '38 14% 72%',
    cell: '38 10% 58%',
    cellAlpha: 0.36,
  },
];

export const MODE_TOKENS: Record<SchemeMode, StatusToken[]> = {
  default: STATUS_TOKENS,
  greek: GREEK_STATUS_TOKENS,
};

export const MODE_CARDS: Record<SchemeMode, { light: string; dark: string }> = {
  default: { light: CARD_LIGHT, dark: CARD_DARK },
  greek: { light: GREEK_CARD_LIGHT, dark: GREEK_CARD_DARK },
};
```

- [ ] **Step 4: Rewrite `statusTokenCss()` to emit all four blocks**

Replace the existing function body:

```ts
/** The `:root` declarations for every mode, for interpolation into SHADCN_CSS. */
export function statusTokenCss(): string {
  const block = (selector: string, tokens: StatusToken[], key: 'light' | 'dark') =>
    `${selector} {\n${tokens
      .map(t => `  --sc-${t.name}: ${t[key]};`)
      .join('\n')}\n}`;
  // ORDER IS LOAD-BEARING. `:root.sc-dark` and `:root.sc-greek` are both
  // specificity (0,2,0), so whichever is written last wins when both match.
  // The greek light block must therefore follow the default dark block, and
  // `:root.sc-greek.sc-dark` — (0,3,0) — settles greek-in-dark outright.
  return [
    block(':root', STATUS_TOKENS, 'light'),
    block(':root.sc-dark', STATUS_TOKENS, 'dark'),
    block(':root.sc-greek', GREEK_STATUS_TOKENS, 'light'),
    block(':root.sc-greek.sc-dark', GREEK_STATUS_TOKENS, 'dark'),
  ].join('\n');
}
```

- [ ] **Step 5: Run the full platform-ui suite**

```bash
cd backstage && yarn test plugins/platform-ui/src/contrast.test.ts plugins/platform-ui/src/styles.test.ts
```

Expected: PASS. `styles.test.ts` must still pass — `statusTokenCss()` is interpolated into `SHADCN_CSS`, so a brace slip here breaks the balanced-braces guard there.

- [ ] **Step 6: Commit**

```bash
git add backstage/plugins/platform-ui/src/statusTokens.ts \
        backstage/plugins/platform-ui/src/contrast.test.ts
git commit -m "feat(ui): add greek status colour tokens"
```

---

### Task 2: The Greek stylesheet module

Creates `greek.ts` with the two colour registers, and the parity test that stops a half-declared mode shipping.

**Files:**
- Create: `backstage/plugins/platform-ui/src/greek.ts`
- Create: `backstage/plugins/platform-ui/src/greek.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 at runtime (the status tokens reach the page through `statusTokenCss()` independently).
- Produces: `greekCss(): string`.

- [ ] **Step 1: Write the failing test**

Create `backstage/plugins/platform-ui/src/greek.test.ts`:

```ts
import { greekCss } from './greek';
import { SHADCN_CSS } from './styles';

/** Every `--sc-*` whose value is an "H S% L%" triplet, inside one selector block. */
function colourTokens(css: string, selector: string): string[] {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return [];
  const end = css.indexOf('}', start);
  const body = css.slice(start, end);
  return Array.from(
    body.matchAll(/--(sc-[a-z-]+):\s*[\d.]+\s+[\d.]+%\s+[\d.]+%\s*;/g),
    m => m[1],
  ).sort();
}

describe('greekCss', () => {
  it('is not truncated', () => {
    expect(greekCss().length).toBeGreaterThan(500);
  });

  it('has balanced braces', () => {
    const css = greekCss();
    const open = (css.match(/{/g) ?? []).length;
    const close = (css.match(/}/g) ?? []).length;
    expect(`${open}/${close}`).toBe(`${close}/${close}`);
  });

  it('has no control characters, which is what a bad escape leaves behind', () => {
    const control = [...greekCss()].filter(ch => {
      const code = ch.codePointAt(0) ?? 32;
      return code < 32 && ch !== '\n' && ch !== '\t' && ch !== '\r';
    });
    expect(control).toEqual([]);
  });

  it('declares every colour token the default :root declares', () => {
    // A mode that forgets one inherits a colour from the wrong register, which
    // degrades into unreadable text rather than an obvious break.
    const base = colourTokens(SHADCN_CSS, ':root');
    const greek = colourTokens(greekCss(), ':root.sc-greek');
    expect(base.length).toBeGreaterThan(8); // the regex actually matched
    expect(greek).toEqual(expect.arrayContaining(base));
  });

  it('redeclares every colour token in the dark register', () => {
    const light = colourTokens(greekCss(), ':root.sc-greek');
    const dark = colourTokens(greekCss(), ':root.sc-greek.sc-dark');
    expect(dark).toEqual(light);
  });

  it('uses steps() for any animation, never ease', () => {
    expect(greekCss()).not.toMatch(/animation:[^;]*\bease\b/);
  });

  it('names no class a production build discards', () => {
    const names = Array.from(greekCss().matchAll(/\.([A-Za-z][\w-]*)/g), m => m[1]);
    const bad = names.filter(
      n =>
        !n.startsWith('Mui') &&
        !n.startsWith('bui-') &&
        !n.startsWith('sc-') &&
        !n.startsWith('material-icons'),
    );
    expect(bad).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backstage && yarn test plugins/platform-ui/src/greek.test.ts
```

Expected: FAIL — cannot resolve `./greek`.

- [ ] **Step 3: Create `greek.ts` with the two registers**

```ts
/**
 * Ancient Greek mode: the seventh potion, and the first that is a *mode*
 * rather than an accent.
 *
 * Everything here hangs off one root class, `sc-greek`, toggled by
 * `applyScheme()`. That works because `:root.sc-greek` is specificity (0,2,0)
 * and the injected accent sheet's `:root` is (0,1,0) — Greek wins regardless
 * of injection order, which is the same reason `sc-konami` can override the
 * picked accent. `:root.sc-greek.sc-dark` is (0,3,0) and settles the dark
 * register over both.
 *
 * Kept out of styles.ts deliberately: that file is 1382 lines of a single
 * template literal and has been silently truncated by a stray backtick twice.
 * A whole second art direction inline makes a known hazard worse.
 *
 * Colour values are solved, not chosen: every pair that carries text clears
 * 4.5:1, the gold rule clears 3:1 against its card, and the status set clears
 * 5.0:1 against both card and dithered cell. See statusTokens.ts.
 */
export function greekCss(): string {
  return `
/* ===== Ancient Greek mode — light register: Olympus ===== */
:root.sc-greek {
  --sc-bg: 40 30% 96%;
  --sc-fg: 30 14% 13%;
  --sc-card: 42 45% 98%;
  --sc-card-fg: 30 14% 13%;
  --sc-muted: 40 20% 92%;
  --sc-muted-fg: 35 14% 34%;
  --sc-border: 40 55% 46%;
  --sc-input: 40 55% 46%;
  --sc-primary: 10 68% 34%;
  --sc-primary-fg: 0 0% 100%;
  --sc-primary-shade: 240 10% 8%;
  --sc-ring: 10 68% 34%;
  --sc-accent: 40 25% 90%;
  --sc-accent-fg: 30 14% 20%;
  --sc-success: 58 62% 42%;
  --sc-warning: 188 65% 45%;
  --sc-destructive: 12 78% 50%;
  /* The filigree gold, used by the chrome. Not a shadcn token. */
  --sc-gold: 40 55% 46%;
}
/* ===== dark register: the Underworld ===== */
:root.sc-greek.sc-dark {
  --sc-bg: 265 32% 6%;
  --sc-fg: 40 28% 92%;
  --sc-card: 265 26% 10%;
  --sc-card-fg: 40 28% 92%;
  --sc-muted: 265 18% 18%;
  --sc-muted-fg: 40 14% 70%;
  --sc-border: 43 62% 46%;
  --sc-input: 43 62% 46%;
  --sc-primary: 14 88% 55%;
  --sc-primary-fg: 240 10% 8%;
  --sc-primary-shade: 0 0% 100%;
  --sc-ring: 14 88% 55%;
  --sc-accent: 265 20% 16%;
  --sc-accent-fg: 40 28% 92%;
  --sc-success: 58 62% 42%;
  --sc-warning: 188 65% 45%;
  --sc-destructive: 12 78% 50%;
  --sc-gold: 43 62% 46%;
}
`;
}
```

- [ ] **Step 4: Run it to verify it passes**

```bash
cd backstage && yarn test plugins/platform-ui/src/greek.test.ts
```

Expected: PASS, all seven cases. If the parity case fails, the message names the missing token — add it to **both** registers.

- [ ] **Step 5: Commit**

```bash
git add backstage/plugins/platform-ui/src/greek.ts \
        backstage/plugins/platform-ui/src/greek.test.ts
git commit -m "feat(ui): add the greek colour registers"
```

---

### Task 3: Register the potion

Wires the module into the stylesheet and adds the seventh bottle. After this task the feature is visibly working, in colour, end to end.

**Files:**
- Modify: `backstage/plugins/platform-ui/src/styles.ts` (import + one interpolation)
- Modify: `backstage/plugins/platform-ui/src/SchemeRoot.tsx:50-57` (the `SCHEMES` array) and `:247-283` (`applyScheme`)
- Test: `backstage/plugins/platform-ui/src/SchemeRoot.test.ts`
- Test: `backstage/plugins/platform-ui/src/styles.test.ts`

**Interfaces:**
- Consumes: `greekCss()` from Task 2.
- Produces: a `SCHEMES` entry `{ id: 'greek', label: 'Ancient Greek', hsl: '10 68% 34%', fg: WHITE, mode: 'greek' }`, and the `sc-greek` class contract that Tasks 5–7 style against.

- [ ] **Step 1: Write the failing tests**

Replace the `keeps six schemes with stable ids` case in `SchemeRoot.test.ts` and add two more. Change the import to `import { SCHEMES, applyScheme } from './SchemeRoot';`.

```ts
  it('keeps seven schemes with stable ids', () => {
    expect(SCHEMES.map(s => s.id)).toEqual([
      'violet',
      'blue',
      'green',
      'rose',
      'amber',
      'slate',
      'greek',
    ]);
  });

  it('marks exactly one scheme as a mode', () => {
    const modes = SCHEMES.filter(s => s.mode);
    expect(modes.map(s => s.mode)).toEqual(['greek']);
  });

  it('toggles sc-greek on the root element when the mode is picked', () => {
    applyScheme('greek');
    expect(document.documentElement.classList.contains('sc-greek')).toBe(true);
    applyScheme('violet');
    expect(document.documentElement.classList.contains('sc-greek')).toBe(false);
  });
```

The existing `every scheme clears 4.5:1` case needs no change — it covers the new entry automatically (ox-blood on white measures 7.94:1).

Also add to `styles.test.ts`, inside the existing `still carries the rules the app depends on` case, so the marker list becomes:

```ts
    for (const marker of [
      '@font-face',
      '--sc-font-pixel',
      '--sc-radius',
      '.sc-nav',
      'prefers-reduced-motion',
      // Proves greekCss() is actually interpolated. Without this, greek.ts can
      // be perfectly correct and simply never reach the page.
      ':root.sc-greek',
    ]) {
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backstage && yarn test plugins/platform-ui/src/SchemeRoot.test.ts
```

Expected: FAIL — the id list has six entries, and `sc-greek` is never added.

- [ ] **Step 3: Interpolate the Greek sheet into `styles.ts`**

Add to the imports at the top of `styles.ts`:

```ts
import { greekCss } from './greek';
```

Then, immediately after the existing `${statusTokenCss()}` interpolation on line 65, add a new line:

```
${greekCss()}
```

It must come **after** `statusTokenCss()` so the Greek chrome added in Task 6 can override tokens the status sheet sets.

- [ ] **Step 4: Add the seventh scheme and the class toggle**

In `SchemeRoot.tsx`, extend the `SCHEMES` array with a seventh entry:

```ts
  { id: 'slate', label: 'Slate', hsl: '215 30% 45%', fg: WHITE }, // 5.29
  // The mode potion. `hsl` here is the bottle's own liquid colour and what
  // SchemeRoot.test.ts measures — the applied accent comes from greek.ts and
  // differs by register (ox-blood in light, ember in dark).
  {
    id: 'greek',
    label: 'Ancient Greek',
    hsl: '10 68% 34%',
    fg: WHITE, // 7.94
    mode: 'greek' as const,
  },
];
```

In `applyScheme()`, immediately after the line `const s = SCHEMES.find(x => x.id === id) ?? SCHEMES[0];`, add:

```ts
  // A mode potion carries a whole palette rather than an accent. Everything it
  // changes hangs off this class — see greek.ts for why specificity makes that
  // enough, and sc-konami for the same mechanism used as an easter egg.
  document.documentElement.classList.toggle('sc-greek', s.mode === 'greek');
```

- [ ] **Step 5: Run the tests**

```bash
cd backstage && yarn test plugins/platform-ui/src/SchemeRoot.test.ts plugins/platform-ui/src/styles.test.ts plugins/platform-ui/src/greek.test.ts
```

Expected: PASS.

- [ ] **Step 6: Type check**

```bash
cd backstage && yarn tsc
```

Expected: clean. `SCHEMES` is inferred, so the optional `mode` on one entry widens the element type — if any consumer breaks, fix it here rather than casting.

- [ ] **Step 7: Commit**

```bash
git add backstage/plugins/platform-ui/src/styles.ts \
        backstage/plugins/platform-ui/src/SchemeRoot.tsx \
        backstage/plugins/platform-ui/src/SchemeRoot.test.ts
git commit -m "feat(ui): add the ancient greek potion to the scheme picker"
```

---

### Task 4: The tab icon follows the computed accent

`updateFavicon` is handed the record's literal `hsl`, so under Greek mode the tab icon would draw ox-blood while the app paints ember. This is the root-cause fix — the icon should track whatever won the cascade, for any mode.

**Files:**
- Modify: `backstage/plugins/platform-ui/src/SchemeRoot.tsx:282` (the `updateFavicon` call in `applyScheme`)
- Test: `backstage/plugins/platform-ui/src/favicon.test.ts`

**Interfaces:**
- Consumes: the `sc-greek` class contract from Task 3.
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

Append inside the existing top-level `describe` in `favicon.test.ts`:

```ts
  it('draws the tile from the computed accent, not the record literal', () => {
    // A mode potion sets --sc-primary in CSS, so the record's own hsl is not
    // what the page is painted with. Reading the computed value keeps the tab
    // icon correct for any mode, not just this one.
    const spy = jest
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({
        getPropertyValue: (p: string) =>
          p === '--sc-primary'
            ? '14 88% 55%'
            : p === '--sc-primary-fg'
              ? '240 10% 8%'
              : p === '--sc-card'
                ? '265 26% 10%'
                : '',
      } as unknown as CSSStyleDeclaration);
    try {
      applyScheme('greek');
      expect(stops[0]).toBe('hsl(14 88% 55%)');
    } finally {
      spy.mockRestore();
    }
  });
```

Read the top of `favicon.test.ts` first: it already has a canvas/gradient harness that records `stops`. Reuse that harness exactly rather than building a second one — match how the existing `amber` case on line 98 reads `stops[0]`.

- [ ] **Step 2: Run to verify it fails**

```bash
cd backstage && yarn test plugins/platform-ui/src/favicon.test.ts
```

Expected: FAIL — the first gradient stop is `hsl(10 68% 34%)`, the record's literal.

- [ ] **Step 3: Read the computed accent in `applyScheme`**

Replace the final line of `applyScheme()`, `updateFavicon(s.hsl, s.fg);`, with:

```ts
  // The record's own hsl is not necessarily what is painted: a mode potion
  // sets --sc-primary from CSS, which wins on specificity. Reading the
  // computed value is what keeps the tab icon in step with the page — the
  // same reason cardHsl() reads computed style rather than a constant.
  const root = getComputedStyle(document.documentElement);
  updateFavicon(
    root.getPropertyValue('--sc-primary').trim() || s.hsl,
    root.getPropertyValue('--sc-primary-fg').trim() || s.fg,
  );
```

The `||` fallbacks matter: jsdom resolves custom properties inconsistently, and an empty string would paint a transparent tile.

- [ ] **Step 4: Run to verify it passes**

```bash
cd backstage && yarn test plugins/platform-ui/src/favicon.test.ts
```

Expected: PASS, including every pre-existing case. If the `blue` or `amber` case now fails, the mock in Step 1 leaked — confirm `mockRestore()` runs in the `finally`.

- [ ] **Step 5: Commit**

```bash
git add backstage/plugins/platform-ui/src/SchemeRoot.tsx \
        backstage/plugins/platform-ui/src/favicon.test.ts
git commit -m "fix(ui): draw the tab icon from the computed accent"
```

---

### Task 5: The amphora bottle

The Greek bottle on the shelf should be an amphora, not a flask. The existing `AMPHORA` sprite is single-layer and cannot show an accent fill, so this adds a two-layer grid alongside it.

**Files:**
- Modify: `backstage/plugins/platform-ui/src/sprites.ts` (add `AMPHORA_VESSEL` after `AMPHORA`, around line 215)
- Modify: `backstage/plugins/platform-ui/src/components.tsx:58-85` (`PixelPotion`)
- Modify: `backstage/plugins/platform-ui/src/SchemeRoot.tsx:516` (the `PixelPotion` call)
- Modify: `backstage/plugins/platform-ui/src/index.ts:24-30`
- Test: `backstage/plugins/platform-ui/src/sprites.test.ts`

**Interfaces:**
- Consumes: the `mode` field from Task 3.
- Produces: `AMPHORA_VESSEL: Sprite`; `PixelPotion` gains an optional `sprite?: Sprite` prop defaulting to `POTION`.

- [ ] **Step 1: Write the failing test**

Add to `sprites.test.ts`. Include `AMPHORA_VESSEL` in the import from `./sprites`.

```ts
  it('gives the amphora vessel both layers, like the potion', () => {
    // The picker paints '~' in the scheme colour and '#' in currentColor. A
    // grid with no '~' renders as an outline with nothing inside it.
    expect(spriteRects(AMPHORA_VESSEL, '~').length).toBeGreaterThan(0);
    expect(spriteRects(AMPHORA_VESSEL, '#').length).toBeGreaterThan(0);
  });

  it('keeps the amphora vessel on the 16x16 grid', () => {
    expect(AMPHORA_VESSEL).toHaveLength(SPRITE_SIZE);
    for (const row of AMPHORA_VESSEL) expect(row).toHaveLength(SPRITE_SIZE);
  });
```

Check the existing imports at the top of `sprites.test.ts` — `spriteRects` and `SPRITE_SIZE` may already be imported; do not duplicate them.

- [ ] **Step 2: Run to verify it fails**

```bash
cd backstage && yarn test plugins/platform-ui/src/sprites.test.ts
```

Expected: FAIL — `AMPHORA_VESSEL` is not exported.

- [ ] **Step 3: Author the sprite**

Add to `sprites.ts` directly after the existing `AMPHORA`:

```ts
/**
 * The amphora as a *vessel*: '#' is the clay, '~' is what it holds.
 *
 * Two layers rather than reusing AMPHORA, which is a solid silhouette and has
 * nothing for the picker to fill with the scheme colour. Same reason POTION
 * and RUPEE carry a second layer.
 */
export const AMPHORA_VESSEL: Sprite = [
  '.....######.....',
  '.....#~~~~#.....',
  '......####......',
  '..##..#~~#..##..',
  '.####.#~~#.####.',
  '.##.##~~~~##.##.',
  '.##.#~~~~~~#.##.',
  '..#~~~~~~~~~~#..',
  '..#~~~~~~~~~~#..',
  '..#~~~~~~~~~~#..',
  '..#~~~~~~~~~~#..',
  '...#~~~~~~~~#...',
  '....#~~~~~~#....',
  '.....#~~~~#.....',
  '......####......',
  '.....######.....',
];
```

- [ ] **Step 4: Give `PixelPotion` an optional sprite**

In `components.tsx`, change the signature and both `spriteRects` calls:

```tsx
export function PixelPotion({
  liquid,
  className,
  sprite = POTION,
}: {
  liquid: string;
  className?: string;
  sprite?: Sprite;
}) {
```

Then replace `spriteRects(POTION, '~')` with `spriteRects(sprite, '~')` and `spriteRects(POTION, '#')` with `spriteRects(sprite, '#')`. Add `Sprite` and `AMPHORA_VESSEL` to the existing import from `./sprites` — `Sprite` is a type, so use `import type` or fold it into the existing type import if one exists.

- [ ] **Step 5: Use it in the picker**

In `SchemeRoot.tsx`, change the `PixelPotion` call inside the `SCHEMES.map`:

```tsx
          <PixelPotion
            liquid={`hsl(${s.hsl})`}
            sprite={s.mode === 'greek' ? AMPHORA_VESSEL : undefined}
          />
```

Add `AMPHORA_VESSEL` to the existing `./sprites` import in that file.

- [ ] **Step 6: Export it**

In `index.ts`, add `AMPHORA_VESSEL` to the existing `./sprites` export block:

```ts
export {
  STATE_SPRITES,
  TEMPLE,
  SCROLL,
  HOURGLASS,
  LAUREL,
  AMPHORA_VESSEL,
} from './sprites';
```

- [ ] **Step 7: Run the tests**

```bash
cd backstage && yarn test plugins/platform-ui/src/sprites.test.ts plugins/platform-ui/src/SchemePicker.test.tsx plugins/platform-ui/src/components.test.tsx
```

Expected: PASS. `sprites.test.ts` also asserts `STATE_SPRITES.APPROVED === LAUREL` — that must stay green; state iconography is not part of this change.

- [ ] **Step 8: Commit**

```bash
git add backstage/plugins/platform-ui/src/sprites.ts \
        backstage/plugins/platform-ui/src/sprites.test.ts \
        backstage/plugins/platform-ui/src/components.tsx \
        backstage/plugins/platform-ui/src/SchemeRoot.tsx \
        backstage/plugins/platform-ui/src/index.ts
git commit -m "feat(ui): give the greek potion an amphora bottle"
```

---

### Task 6: Ornate chrome

The Hades frame grammar: gold rules, diamond corner marks, inner glow. One grammar at two brightnesses — the light register is the same filigree in bronze on bone.

**Files:**
- Modify: `backstage/plugins/platform-ui/src/greek.ts` (append to the returned string)
- Modify: `backstage/plugins/platform-ui/src/theme.tsx:100` (the header-art hook)
- Test: `backstage/plugins/platform-ui/src/greek.test.ts`

**Interfaces:**
- Consumes: `--sc-gold`, `--sc-card`, `--sc-primary` from Task 2.
- Produces: the `--sc-header-art` variable contract read by `theme.tsx`.

- [ ] **Step 1: Write the failing tests**

Append to `greek.test.ts`:

```ts
describe('greek chrome', () => {
  it('frames dialogs in gold without touching plain cards', () => {
    const css = greekCss();
    // Windows only, never cards: the existing design keeps a double frame as
    // the difference between a decision and a panel of content.
    expect(css).toMatch(/:root\.sc-greek[^{]*MuiDialog-paper[^{]*\{[^}]*--sc-gold/);
  });

  it('supplies header art through a variable, not a Backstage class name', () => {
    const css = greekCss();
    expect(css).toContain('--sc-header-art');
    expect(css).not.toContain('BackstageHeader');
  });

  it('marks dialog corners with rotated squares', () => {
    expect(greekCss()).toMatch(/rotate\(45deg\)/);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd backstage && yarn test plugins/platform-ui/src/greek.test.ts
```

Expected: FAIL on all three — no chrome exists yet.

- [ ] **Step 3: Append the chrome to `greek.ts`**

Add before the closing backtick of the returned template string:

```
/* ===== Ornate chrome. One grammar, two brightnesses: the light register is
   the same filigree in bronze on bone, the dark one is gold on obsidian with
   the glow doing real work. No image assets — box-shadow and gradients. ===== */

/* Cards get a gold rule and a thin inner line. Single frame only. */
:root.sc-greek .MuiCard-root,
:root.sc-greek .MuiPaper-elevation1,
:root.sc-greek .MuiPaper-elevation2,
:root.sc-greek .sc-card {
  border-color: hsl(var(--sc-gold)) !important;
  box-shadow:
    inset 0 0 0 1px hsl(var(--sc-gold) / .3),
    var(--sc-shadow) !important;
}

/* The command window, in gold. Same three-shadow construction the base sheet
   already uses for dialogs, retinted, plus an ember bloom behind it. */
:root.sc-greek [class*="bui-DialogInner"],
:root.sc-greek .MuiDialog-paper {
  position: relative;
  border-color: hsl(var(--sc-gold)) !important;
  box-shadow:
    0 0 0 2px hsl(var(--sc-card)),
    0 0 0 4px hsl(var(--sc-gold)),
    0 0 14px hsl(var(--sc-primary) / .3),
    var(--sc-shadow) !important;
}
/* Diamond corner marks. ponytail: two corners, not four — a diamond needs its
   own box and an element has two pseudo-elements. Asymmetric corner accents
   are a real Hades motif, so this is a deliberate stop rather than a
   limitation; add a wrapper span if four are ever wanted. */
:root.sc-greek [class*="bui-DialogInner"]::before,
:root.sc-greek .MuiDialog-paper::before,
:root.sc-greek [class*="bui-DialogInner"]::after,
:root.sc-greek .MuiDialog-paper::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  background: hsl(var(--sc-gold));
  transform: rotate(45deg);
  pointer-events: none;
  z-index: 1;
}
:root.sc-greek [class*="bui-DialogInner"]::before,
:root.sc-greek .MuiDialog-paper::before { top: -8px; left: -8px; }
:root.sc-greek [class*="bui-DialogInner"]::after,
:root.sc-greek .MuiDialog-paper::after { bottom: -8px; right: -8px; }

/* The filigree band behind page headers. Read by theme.tsx through
   --sc-header-art, because a selector naming BackstageHeader is dead in a
   production build. */
:root.sc-greek {
  --sc-header-art:
    repeating-linear-gradient(
      90deg,
      hsl(var(--sc-gold) / .22) 0 2px,
      transparent 2px 6px,
      hsl(var(--sc-gold) / .22) 6px 8px,
      transparent 8px 18px
    );
}

/* Primary buttons carry the gold rule too. */
:root.sc-greek .MuiButton-containedPrimary,
:root.sc-greek .sc-btn-primary {
  border: var(--sc-border-w) solid hsl(var(--sc-gold)) !important;
}
```

- [ ] **Step 4: Add the theme hook**

In `theme.tsx`, in the `BackstageHeader.styleOverrides.header` block, replace `backgroundImage: 'none',` with:

```ts
            // The hook a mode potion fills; `none` keeps every other scheme
            // byte-identical. A CSS selector cannot reach this element —
            // BackstageHeader-* becomes jss<n> in a production build.
            backgroundImage: 'var(--sc-header-art, none)',
```

- [ ] **Step 5: Run the tests**

```bash
cd backstage && yarn test plugins/platform-ui/src/greek.test.ts plugins/platform-ui/src/styles.test.ts
```

Expected: PASS. The `names no class a production build discards` case from Task 2 now has real selectors to check — if it fails, a `Backstage*` or `PluginCatalogGraph*` name crept in.

- [ ] **Step 6: Commit**

```bash
git add backstage/plugins/platform-ui/src/greek.ts \
        backstage/plugins/platform-ui/src/greek.test.ts \
        backstage/plugins/platform-ui/src/theme.tsx
git commit -m "feat(ui): add ornate greek chrome"
```

---

### Task 7: The ember glow

One piece of motion, stepped, behind the reduced-motion query, resolving to a lit frame rather than freezing.

**Files:**
- Modify: `backstage/plugins/platform-ui/src/greek.ts`
- Test: `backstage/plugins/platform-ui/src/greek.test.ts`

**Interfaces:**
- Consumes: the chrome selectors from Task 6.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Append to `greek.test.ts`:

```ts
describe('greek motion', () => {
  it('puts every animation behind the reduced-motion query', () => {
    const css = greekCss();
    const guarded = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));
    const animations = (css.match(/animation:/g) ?? []).length;
    const guardedAnimations = (guarded.match(/animation:/g) ?? []).length;
    expect(`${guardedAnimations}/${animations}`).toBe(`${animations}/${animations}`);
  });

  it('steps the ember pulse', () => {
    expect(greekCss()).toMatch(/animation:[^;]*steps\(/);
  });

  it('leaves the reduced-motion case lit, not frozen mid-cycle', () => {
    // A static creature on a bar is a smudge; the same reasoning applies to a
    // glow caught at 40% opacity.
    expect(greekCss()).toMatch(/@keyframes sc-greek-ember/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backstage && yarn test plugins/platform-ui/src/greek.test.ts -t 'greek motion'
```

Expected: FAIL — no keyframes exist.

- [ ] **Step 3: Add the glow**

Append to the returned string in `greek.ts`:

```
/* The ember bloom on primary surfaces. Two frames, stepped — no interpolation,
   which is the rule the whole design system follows. The unanimated default
   below is the LIT frame, so someone who asked for stillness gets the intended
   look rather than a glow frozen halfway. */
:root.sc-greek .MuiButton-containedPrimary,
:root.sc-greek .sc-btn-primary {
  box-shadow: 0 0 8px hsl(var(--sc-primary) / .45), var(--sc-shadow);
}
@media (prefers-reduced-motion: no-preference) {
  @keyframes sc-greek-ember {
    0%, 100% { box-shadow: 0 0 8px hsl(var(--sc-primary) / .45), var(--sc-shadow); }
    50% { box-shadow: 0 0 14px hsl(var(--sc-primary) / .7), var(--sc-shadow); }
  }
  :root.sc-greek .MuiButton-containedPrimary,
  :root.sc-greek .sc-btn-primary {
    animation: sc-greek-ember 1.6s steps(2) infinite;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd backstage && yarn test plugins/platform-ui/src/greek.test.ts
```

Expected: PASS, all cases including Task 2's `uses steps() for any animation, never ease`.

- [ ] **Step 5: Commit**

```bash
git add backstage/plugins/platform-ui/src/greek.ts \
        backstage/plugins/platform-ui/src/greek.test.ts
git commit -m "feat(ui): add the stepped ember glow to greek mode"
```

---

### Task 8: Amend the design-system contract

The status-colour rule in the docs now has an exception. Left unwritten, the next person reads the doc, sees the code contradict it, and does not know which is authoritative.

**Files:**
- Modify: `docs/explanation/design-system.md:101-106` (the "Where colour deliberately ignores the picker" section, ending just before `## Motion` on line 108)

**Interfaces:** none.

- [ ] **Step 1: Replace the section**

Replace the whole `## Where colour deliberately ignores the picker` section with:

```markdown
## Where colour deliberately ignores the picker

The experience bar is yellow while a workflow runs, green when it lands, red
when it does not — regardless of the picked *accent*. Status has to mean the
same thing across a working session; a bar that is violet on Tuesday and amber
on Wednesday says nothing at a glance.

The rule is about the accent, and there is exactly one exception: a **mode**
potion may redefine status hue, and Ancient Greek does — laurel-gold, Styx
cyan, ember. What makes that admissible rather than a hole in the rule is that
it is wholesale and measured:

- A mode redefines **every** status token or none of them. A partial override
  puts a default colour on a surface it was never measured against, which is
  why `contrast.test.ts` checks that each mode covers the same token names.
- The text label is untouched. `SUCCEEDED` is still the word on the badge, so
  no meaning rests on hue alone and the change costs consistency, not access.
- Every pair is re-measured against **that mode's** card colours, to the same
  5.0:1 target as the defaults.

The cost is real and worth naming: Greek's gold success sits near the amber
that means *running* elsewhere. Success is pushed to 60° rather than a straight
gold to open that gap to 25°, and running moves to a cold 188° cyan that no
other scheme uses.

## Mode potions

Six of the seven bottles are one accent hue. The seventh, Ancient Greek, is a
*mode*: it carries a whole palette and its own chrome, hung off a single
`sc-greek` class on the root element.

That works on specificity alone. The injected accent sheet writes `:root`,
which is (0,1,0); `:root.sc-greek` is (0,2,0) and wins whatever the injection
order, and `:root.sc-greek.sc-dark` is (0,3,0) and settles the dark register
over both. `sc-konami` has always worked this way — the mode potion is the same
mechanism, persisted instead of thrown away on reload.

Its CSS lives in `greek.ts`, not `styles.ts`. That is not tidiness: `styles.ts`
is a single template literal that a stray backtick has silently truncated
twice, and a second complete art direction inline makes a known hazard worse.
`greek.test.ts` carries a parity check that every colour token the default
`:root` declares is declared in both Greek registers — a half-declared mode
inherits a colour from the wrong register and degrades into unreadable text
rather than an obvious break.
```

- [ ] **Step 2: Check the docs build**

```bash
mkdocs build --strict
```

Run from the repo root. Expected: no warnings. If `mkdocs` is not installed, skip — CI covers it.

- [ ] **Step 3: Commit**

```bash
git add docs/explanation/design-system.md
git commit -m "docs: record the mode potion and the status-hue exception"
```

---

### Task 9: Full verification

**Files:** none modified.

- [ ] **Step 1: Run the whole CI sequence**

```bash
cd backstage && yarn tsc && yarn lint:all && yarn test && yarn build:all
```

This is exactly what `.github/workflows/checks.yml` runs. Expected: all four clean.

- [ ] **Step 2: Check the app actually renders**

```bash
cd backstage && yarn start
```

Open `http://localhost:3000`, click the amphora, and confirm by eye:

1. The whole app recolours — sidebar, cards, tables, and the native catalog and scaffolder pages, not just our own.
2. Toggling light/dark switches register: marble/bronze ↔ obsidian/gold.
3. The tab icon is ember in dark and ox-blood in light.
4. Badges read `SUCCEEDED` / `FAILED` in gold and ember — the **words** unchanged.
5. Reloading keeps Greek mode; it is in `localStorage`.
6. Signing out shows the sign-in gate already in Greek.

Point 6 is the one most likely to break and the least likely to be covered by a test — `applyScheme()` runs at module load, before React, and the gate renders before `SchemeRoot` mounts.

- [ ] **Step 3: Commit nothing**

Verification only. If anything failed, fix it in the task that owns it.

---

## Notes for the executor

- **The spec is `docs/superpowers/specs/2026-08-15-ancient-greek-potion-design.md`.** It is untracked — `.gitignore:17` has a blanket `specs/` rule — so read it from disk, do not expect it in git history.
- **Do not add a `flavour: 'greek'`.** Screen renaming was considered and cut. `flavour.ts` is not part of this work.
- **Do not register a second MUI theme.** It would add "Greek Light / Greek Dark" to Backstage's own theme picker and couple the potion to a theme id.
- **Do not change the pixel font.** It is the identity of the design system.
- **If a colour needs changing,** re-run the maths rather than nudging by eye. The method is in `statusTokens.ts`: lowest lightness clearing 5.0:1 against both the card and the covered dither pixel.
