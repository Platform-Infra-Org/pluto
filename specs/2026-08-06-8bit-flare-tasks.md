# 8-bit Flare — Task List

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each task ends with its own commit; no task depends on a later one.

**Goal:** execute `specs/2026-08-06-8bit-flare-plan.md` — the second flare pass plus the fantasy layer (NES-era, Greek-myth register).

**Architecture:** almost all of it is CSS in the single injected stylesheet, `plugins/platform-ui/src/styles.ts`. Four tasks touch TypeScript: new sprites, the approval readout, the tab-activity ticker and the Konami handler. Nothing new is installed.

**Tech Stack:** TypeScript, React 18, Backstage 1.53, MUI v4/v5 bridge, canon (`bui-*`) components, Jest, Playwright.

## Global Constraints

- **Branch:** create `feat/8bit-flare` from `feat/8bit-ui`. Do not merge to `main` without explicit approval.
- Source of truth: `specs/2026-08-06-8bit-flare-plan.md`. Design lineage: `specs/2026-08-03-8bit-ui-design.md`.
- **No backticks anywhere in `styles.ts`.** It is one template literal; a backtick in a CSS comment truncates the whole stylesheet and the app renders unstyled while `tsc` and the tests still pass. This has happened three times. `styles.test.ts` guards it — keep it passing.
- Every animation lives inside `@media (prefers-reduced-motion: no-preference)` and uses `steps()`, never `ease`.
- Sprites are `aria-hidden="true"`; state is always conveyed by text as well.
- No sound, no XP/points/achievements, no game copy on **state**. Screen names are the one exception and are config-gated, off by default (Task 12).
- Run everything from `backstage/`:
  - `yarn tsc`
  - `CI=true yarn test [path-filter]` — the per-package `yarn workspace … test` script does **not** work
  - `yarn lint:all`
- **Known pre-existing failure:** `packages/app/src/App.test.tsx` fails to parse (`import.meta.webpackContext` in the branding glob). It fails identically on `feat/8bit-ui`. Do not chase it; do not "fix" it as part of this work.
- Commits are conventional (git-cliff parses them). Regenerate `CHANGELOG.md` once at the end (Task 16), not per task.

## Playwright harness

Several tasks verify in a real browser. The app must be running (`yarn start` in `backstage/`, front end on `:3000`).

Playwright is **not** a repo dependency — install it in the scratchpad once and keep scripts there:

```bash
mkdir -p "$SCRATCH/pw" && cd "$SCRATCH/pw"
npm i --no-audit --no-fund playwright && npx playwright install chromium
```

ESM resolves from the script's own directory, so scripts must live in `$SCRATCH/pw/`, and must `import { chromium } from 'playwright'` (not `@playwright/test`).

The login flow, needed by every authenticated check:

```js
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
const [popup] = await Promise.all([
  p.waitForEvent('popup', { timeout: 15000 }).catch(() => null),
  p.locator('button:has-text("Keycloak")').first().click(),   // NOT text=Sign in — that matches the heading
]);
const t = popup ?? p;
await t.waitForSelector('#username', { timeout: 30000 });
await t.fill('#username', 'admin'); await t.fill('#password', 'admin'); await t.click('#kc-login');
await p.waitForTimeout(5000);
```

Credentials come from `deploy/ldap/bootstrap.ldif` (`admin`/`admin`). Always pass `SP=$SCRATCH` in the environment when a script writes a screenshot — a bare `process.env.SP` resolves to the string `undefined` and creates an `undefined/` directory in the repo.

---

## File Structure

| File | Responsibility |
|---|---|
| `backstage/plugins/platform-ui/src/styles.ts` | Tokens, `.sc-*` classes, native reskin, keyframes. **12 of 16 tasks touch only this.** |
| `backstage/plugins/platform-ui/src/styles.test.ts` | Structural guard: length, required markers, balanced braces. Extend it as markers are added. |
| `backstage/plugins/platform-ui/src/sprites.ts` | Pixel-grid sprite data + `spriteRects()`. Gains five sprites in Task 8. |
| `backstage/plugins/platform-ui/src/sprites.test.ts` | Grid-shape and run-merge assertions. |
| `backstage/plugins/platform-ui/src/components.tsx` | Primitives, `PlatformMark`, `PixelSprite`. Gains `EmptyState` in Task 14. |
| `backstage/plugins/platform-ui/src/SchemeRoot.tsx` | Palette, `applyScheme`, favicon canvas, branding relays. Wires Tasks 13 and 15. |
| `backstage/plugins/platform-ui/src/tabActivity.ts` | **New** (Task 13). Title ticker while work is in flight. |
| `backstage/plugins/platform-ui/src/konami.ts` | **New** (Task 15). |
| `backstage/plugins/platform-requests/src/components/RequestPage.tsx` | Approval readout (Task 9). |
| `backstage/packages/app/src/modules/auth.tsx` | Sign-in gate copy (Task 11). |
| `backstage/plugins/platform-ui/src/CustomNav.tsx` | Screen names (Task 12). |

---

## Task 0: Branch

- [ ] **Step 1: Branch from the merged 8-bit branch**

```bash
git checkout feat/8bit-ui
git pull --ff-only 2>/dev/null || true
git checkout -b feat/8bit-flare
git log --oneline -1   # expect the changelog commit on top of the retention merge
```

- [ ] **Step 2: Confirm the baseline is green**

```bash
yarn tsc && CI=true yarn test plugins/ && yarn lint:all
```

Expected: `tsc` silent, all plugin suites pass, lint clean. (`packages/app` is excluded from the filter on purpose — see Global Constraints.)

---

## Task 1: Loading is a loading screen

Backstage's `Progress` is MUI v4 `LinearProgress` (`node_modules/@backstage/core-components/dist/components/Progress/Progress.esm.js:3`), so one selector pair reaches every native page's loading state. Today it is a smooth indeterminate sweep — the most modern-looking thing left in the app.

**Files:** Modify `plugins/platform-ui/src/styles.ts`

- [ ] **Step 1: Add the rules**

Add near the existing native-reskin block. Note `transition: none` — MUI animates `transform` with a cubic-bezier and it will fight the steps.

```css
/* Loading is a loading screen: discrete cells advancing, not a smooth sweep.
   MUI drives the bar with a transform transition, which has to go or it
   interpolates between our steps. */
.MuiLinearProgress-root {
  height: 12px !important;
  background: hsl(var(--sc-muted)) !important;
  border: var(--sc-border-w) solid hsl(var(--sc-border));
  border-radius: var(--sc-radius);
  overflow: hidden;
}
.MuiLinearProgress-bar {
  background-color: hsl(var(--sc-primary)) !important;
  transition: none !important;
  background-image: repeating-linear-gradient(90deg,
    hsl(var(--sc-primary)) 0 4px, hsl(var(--sc-primary) / .55) 4px 8px);
}
```

- [ ] **Step 2: Make it march, under the motion guard**

Inside the existing `@media (prefers-reduced-motion: no-preference)` block, reusing the `sc-march` keyframes that already exist:

```css
  .MuiLinearProgress-bar { animation: sc-march .8s steps(8) infinite; }
```

- [ ] **Step 3: Verify in the browser**

Script in `$SCRATCH/pw/`: log in, `p.route()` a 3-second delay onto `**/api/catalog/**`, navigate to Catalog, then assert while loading:

```js
const cs = await p.$eval('.MuiLinearProgress-bar', e => getComputedStyle(e).animationTimingFunction);
// expect it to contain 'steps'
```

Screenshot it. Expected: a chunky segmented bar, no smooth motion.

- [ ] **Step 4: Guard and commit**

```bash
CI=true yarn test plugins/platform-ui && yarn tsc
git add plugins/platform-ui/src/styles.ts
git commit -m "feat(ui): march the loading bar in discrete cells"
```

---

## Task 2: Tooltips become dialogue boxes

Two primitives are in play: canon (`[class*="bui-Tooltip"]`) and MUI v4 (`.MuiTooltip-tooltip`). Both render a soft grey rounded pill today.

**Files:** Modify `plugins/platform-ui/src/styles.ts`

- [ ] **Step 1: Restyle both surfaces**

```css
/* Tooltips are dialogue boxes: card fill, hard edge, pixel type — never a
   floating grey pill. */
[class*="bui-Tooltip"], .MuiTooltip-tooltip {
  background: hsl(var(--sc-card)) !important;
  color: hsl(var(--sc-fg)) !important;
  border: var(--sc-border-w) solid hsl(var(--sc-fg) / .8) !important;
  border-radius: var(--sc-radius) !important;
  box-shadow: var(--sc-shadow) !important;
  font-family: var(--sc-font-pixel) !important;
  font-size: 12px !important;
  padding: 8px 10px 12px !important;
  position: relative;
}
/* MUI's arrow is a rotated square with a blur; restyling it costs more than
   dropping it. */
.MuiTooltip-arrow { display: none !important; }
```

- [ ] **Step 2: Add the continue marker**

The `/ ''` half of the `content` shorthand is the alt text — it keeps the glyph out of the accessible name. The title caret needed exactly this fix; do not omit it.

```css
[class*="bui-Tooltip"]::after, .MuiTooltip-tooltip::after {
  content: '▼' / '';
  position: absolute; right: 6px; bottom: 2px;
  font-size: 9px; line-height: 1; color: hsl(var(--sc-primary));
}
```

And inside the motion guard:

```css
  [class*="bui-Tooltip"]::after, .MuiTooltip-tooltip::after {
    animation: sc-caret 1s steps(1) infinite;   /* keyframes already exist */
  }
```

- [ ] **Step 3: Verify**

Hover a truncated sidebar label (`Register Existi…`) in Playwright. Assert computed `border-width` is `2px` and that the tooltip's accessible name does **not** contain `▼`:

```js
const name = await p.locator('[role="tooltip"]').first().getAttribute('aria-label')
  ?? await p.locator('[role="tooltip"]').first().innerText();
// expect(name).not.toContain('▼')
```

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(ui): tooltips as dialogue boxes with a continue marker"
```

---

## Task 3: Rows select like a menu

The sidebar already marks its active row with `▶`; tables — where people actually spend time — mark nothing.

**Files:** Modify `plugins/platform-ui/src/styles.ts`

- [ ] **Step 1: Reserve the gutter first**

Do this before adding the cursor. A 12px reflow on every hover is worse than no cursor at all.

```css
/* The cursor gutter is always reserved, whether or not the cursor is in it —
   otherwise every row shifts 12px under the pointer. */
.sc-table tbody td:first-child,
.MuiTableBody-root .MuiTableCell-root:first-child { padding-left: 22px; position: relative; }
```

- [ ] **Step 2: Put the cursor in it**

```css
.sc-table tbody tr:hover td:first-child::before,
.sc-table tbody tr:focus-within td:first-child::before,
.MuiTableBody-root .MuiTableRow-root:hover .MuiTableCell-root:first-child::before {
  content: '▶' / '';
  position: absolute; left: 6px; top: 50%; transform: translateY(-50%);
  font-family: var(--sc-font-pixel); font-size: 10px;
  color: hsl(var(--sc-primary));
}
```

- [ ] **Step 3: Verify no reflow**

```js
const off = await p.$eval('.sc-table tbody td:first-child', e => e.getBoundingClientRect().left);
await p.hover('.sc-table tbody tr');
const on = await p.$eval('.sc-table tbody td:first-child', e => e.getBoundingClientRect().left);
// expect(on).toBe(off)
```

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(ui): menu cursor on table row hover"
```

---

## Task 4: Pixel scrollbars

**Files:** Modify `plugins/platform-ui/src/styles.ts`

- [ ] **Step 1: WebKit, then the Firefox fallback**

```css
/* Square thumb, hard edge. The two-property Firefox fallback cannot express
   the border, which is fine — it degrades to a plain accent bar. */
* { scrollbar-color: hsl(var(--sc-primary)) hsl(var(--sc-muted)); scrollbar-width: thin; }
::-webkit-scrollbar { width: 14px; height: 14px; }
::-webkit-scrollbar-track { background: hsl(var(--sc-muted)); }
::-webkit-scrollbar-thumb {
  background: hsl(var(--sc-primary));
  border: var(--sc-border-w) solid hsl(var(--sc-bg));
  border-radius: 0;
}
::-webkit-scrollbar-thumb:hover { background: hsl(var(--sc-primary) / .8); }
::-webkit-scrollbar-corner { background: hsl(var(--sc-muted)); }
```

- [ ] **Step 2: Verify**

Screenshot a long table. Assert the thumb is square:

```js
await p.$eval('body', () => getComputedStyle(document.body, '::-webkit-scrollbar-thumb').borderRadius);
// expect '0px'
```

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(ui): square pixel scrollbars"
```

---

## Task 5: Dither instead of alpha

The NES had no alpha channel — tints were checkerboards. **This is the one task with real regression risk**, so it gets its own commit and its own contrast pass.

**Files:** Modify `plugins/platform-ui/src/styles.ts`

- [ ] **Step 1: Add the token**

```css
  --sc-dither: repeating-conic-gradient(
    hsl(var(--sc-primary) / .22) 0% 25%, transparent 0% 50%) 0 0 / 4px 4px;
```

- [ ] **Step 2: Apply it to exactly five places**

Badge fills, table row hover, disabled surfaces, the success notice, the `IN_PROGRESS` badge. Nowhere else in this task — a checkerboard everywhere is just a noisier wash.

Leave alpha where it is load-bearing for contrast: the template-header text outline (`--sc-primary-shade`) and the CRT layer. Those are doing a different job.

- [ ] **Step 3: Re-check contrast — the actual risk**

A checkerboard at 25% coverage reads roughly half a step lighter than the equivalent alpha wash, which is enough to fail a badge. For each changed surface, in **both** themes across **all six** schemes, sample the rendered pixel and compute contrast against its text colour. Reuse the luminance maths already in `plugins/platform-ui/src/imageTone.ts` (`relativeLuminance`) rather than rewriting it.

Anything under 4.5:1 → raise the dither alpha for that surface until it clears, or revert that one surface to alpha and say so in the commit body.

- [ ] **Step 4: Commit alone**

```bash
git commit -am "feat(ui): dither tints instead of alpha washes"
```

---

## Task 6: The command window (F1)

The Dragon Quest frame: a double line with a gap, not a single border. Free via stacked shadows, and it composes with the rounding that shipped last week.

**Files:** Modify `plugins/platform-ui/src/styles.ts`

- [ ] **Step 1: Frame the two dialog primitives and the picker**

Extend the rule added last week (`[class*="bui-DialogInner"], .MuiDialog-paper`) — do not write a second competing rule:

```css
  box-shadow:
    0 0 0 2px hsl(var(--sc-card)),
    0 0 0 4px hsl(var(--sc-fg) / .85),
    var(--sc-shadow) !important;
```

Windows only — dialogs and the scheme picker. **Not cards.** Every surface double-framed is a page of noise; the distinction between "a panel of content" and "a window demanding a decision" is the whole point.

- [ ] **Step 2: Verify**

Open the unregister dialog (Catalog → any entity → **More actions** → *Unregister entity*; the item is `[role="menuitem"]`, and the surface is `[class*="bui-DialogInner"]`, **not** `.MuiDialog-paper`). Assert the computed `box-shadow` resolves to three layers, then screenshot the element alone — a full-page shot is too small to judge a 2px gap.

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(ui): double-framed command windows for dialogs"
```

---

## Task 7: Pixel-mask dialog transition

**Files:** Modify `plugins/platform-ui/src/styles.ts`

- [ ] **Step 1: Bayer mask, four steps, 160ms**

Inside the motion guard. Longer than 160ms stops reading as a scene change and starts reading as a wait.

```css
  @keyframes sc-dither-in {
    from { mask-size: 16px 16px; opacity: .4; }
    to   { mask-size: 1px 1px; opacity: 1; }
  }
  [class*="bui-DialogInner"], .MuiDialog-paper {
    mask-image: repeating-conic-gradient(#000 0% 25%, transparent 0% 50%);
    animation: sc-dither-in .16s steps(4) both;
  }
```

- [ ] **Step 2: Fall back if it is fragile**

If `mask-image` behaves differently across the two primitives (canon renders a `<section>`, MUI a `<div>` with its own compositing), drop the mask and use a 3-frame pop instead:

```css
  @keyframes sc-pop-in { from { transform: scale(.94); opacity: 0; } to { transform: none; opacity: 1; } }
```

Decide by looking at both dialogs, not by taste.

- [ ] **Step 3: Verify both motion modes**

Open the dialog normally, then re-run with `p.emulateMedia({ reducedMotion: 'reduce' })` and assert the computed `animation-name` is `none`.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(ui): dither-wipe dialogs in like a scene change"
```

---

## Task 8: The item vocabulary (F2)

Five 16×16 sprites in the existing grid format. Objects, not creatures — a silhouette that reads at 16px is the constraint, and objects also carry meaning about a request in a way a dragon does not.

**Files:** Modify `plugins/platform-ui/src/sprites.ts`, `sprites.test.ts`, and the `STATE_SPRITES` consumers

- [ ] **Step 1: Draw them**

| Sprite | Meaning | Where it is used |
|---|---|---|
| `AMPHORA` | stored data | database / Postgres templates |
| `KEY` | a secret | templates with `secrets.schema`, `SecretField` |
| `LAUREL` | granted | `APPROVED` |
| `HELM` | an owning team | owner chips |
| `TORCH` | running | `IN_PROGRESS`, beside the marching bar |

Follow the existing format exactly — 16 strings of 16 characters, same palette characters as `TEMPLE`/`CHEST`.

- [ ] **Step 2: Repoint `APPROVED`**

```ts
APPROVED: LAUREL,   // was SCROLL
```

`SCROLL` is then free for what it should always have meant: documentation. `STATE_SPRITES` gains no new keys.

- [ ] **Step 3: Test the grid shape**

Extend `sprites.test.ts` with the assertions it already makes about the other sprites (16×16, known characters, `spriteRects()` merges runs).

- [ ] **Step 4: Eyeball at 16px, not 64px**

The tests catch structural mistakes, not ugly ones. Render each at its real size and look. A sprite that only reads when enlarged has failed.

- [ ] **Step 5: Commit**

```bash
CI=true yarn test plugins/platform-ui/src/sprites.test.ts
git commit -am "feat(ui): amphora, key, laurel, helm and torch sprites"
```

---

## Task 9: Numbers beside the bar (F3)

**The plan was optimistic here.** There is no approval bar to add numbers to — `RequestPage.tsx:142-155` renders a plain list of decisions and `No decisions yet.` So this task builds both the readout and the bar.

The counts are derivable and already on the wire (`plugins/platform-common/src/index.ts:27`):

```ts
const required = request.policy.mode === 'SINGLE' ? 1 : request.policy.n;
const granted = request.approvals.filter(a => a.decision === 'approve').length;
```

**Files:** Modify `plugins/platform-requests/src/components/RequestPage.tsx`, `plugins/platform-ui/src/styles.ts`

- [ ] **Step 1: Render the readout above the decisions list**

`2/3 APPROVALS` in pixel type, beside a segmented bar of `required` cells with `granted` filled. The NES rule is that HP is always `23/40` and never a bare bar — which is also the accessible version, and the reason this is the cheapest win in the plan.

- [ ] **Step 2: Style the segments**

Filled cells take the accent; empty cells take the muted fill and a 2px border. No smooth fill transition.

- [ ] **Step 3: Test the arithmetic, not the pixels**

Add a unit test: `SINGLE` → `0/1` then `1/1`; `N_OF_M` with `n: 3` and two approvals plus one reject → `2/3`. The reject must not count.

- [ ] **Step 4: Commit**

```bash
CI=true yarn test plugins/platform-requests && yarn tsc
git commit -am "feat(requests): approval progress as a counted segmented bar"
```

---

## Task 10: Three header scenes (F4)

The built-in Greek art is one scene repeated identically down the whole grid — and it is the first impression on a fresh install, since it only shows when the drop-in folder is empty.

**Files:** Modify `plugins/platform-ui/src/styles.ts`

- [ ] **Step 1: Draw two more scenes**

Keep the existing temple frieze as scene 1; add an oracle flame and an underworld gate. Same technique as `styles.ts:265` — hard colour stops only, no gradients that read as smooth.

- [ ] **Step 2: Cycle them the way the images cycle**

Mirror `templateHeaders.ts`: `[class*="BackstageItemCardGrid-root"] > .MuiCard-root:nth-child(3n + i) [class*="ItemCardHeader"]`.

- [ ] **Step 3: Verify with the folder emptied**

Temporarily move `packages/app/src/branding/template-headers/*.{png,jpg}` aside, reload `/create`, and assert three distinct `background-image` values across the grid. **Put them back** — they are committed now (`0748820`).

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(ui): three cycling scenes in the built-in header art"
```

---

## Task 11: PRESS START (Tier 2)

**Files:** Modify `packages/app/src/modules/auth.tsx`, `plugins/platform-ui/src/styles.ts`

- [ ] **Step 1: Swap the subtitle**

`Sign in to continue` → a blinking `PRESS START`. The **button keeps its literal label** (`Sign in with Keycloak`) — the actionable text stays honest; only the decoration plays.

- [ ] **Step 2: Blink it**

`sc-caret` keyframes, `steps(1)`, 1s, inside the motion guard.

- [ ] **Step 3: Verify the accessible name**

The sign-in button's accessible name must still be `Sign in with Keycloak`. Check it in Playwright before committing.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(ui): press start on the sign-in gate"
```

---

## Task 12: Screen names, not state names (F5)

Config-gated, **default off**.

**Files:** Modify `plugins/platform-ui/src/CustomNav.tsx`, `app-config.yaml`, the branding docs

- [ ] **Step 1: Read the flag**

`app.branding.flavour: fantasy` (optional string, default absent). Follow the existing `app.branding.*` reader in `SchemeRoot.tsx`.

- [ ] **Step 2: Map screen labels only**

`REQUESTS → QUESTS`, `CREATE → SUMMON`, `CATALOG → ATLAS`. **Nav labels only.** Not page headers that name a state, not badges, not the audit trail.

The boundary, and it is the one this whole plan rests on: a label naming a **screen** is decoration — someone who cannot find "Requests" finds it one click later. A label naming a **state** is a record, and `QUEST FAILED` in an audit trail is a support ticket.

- [ ] **Step 3: Document it**

In the branding docs beside the mark/favicon/header-image settings, with the screen-vs-state boundary stated.

- [ ] **Step 4: Test both settings**

Flag absent → literal labels. Flag `fantasy` → renamed labels. Assert the request **state** strings are byte-identical in both.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(ui): optional fantasy screen names behind a branding flag"
```

---

## Task 13: The tab tells you something is running (Tier 2)

**Files:** Create `plugins/platform-ui/src/tabActivity.ts`; modify `SchemeRoot.tsx`

- [ ] **Step 1: The ticker**

Cycle the `document.title` prefix through `▖▘▝▗` on a 1s `steps` interval while any request is `IN_PROGRESS`. Restore the original title exactly when the last one settles.

- [ ] **Step 2: Stop when the tab is hidden**

Gate on `document.hidden` and listen for `visibilitychange`. A title animating in a background tab is a battery drain, and browsers throttle the timer unpredictably anyway.

- [ ] **Step 3: A favicon pip**

The favicon is already canvas-generated per accent in `SchemeRoot.tsx` — draw a small accent pip in the corner while work is in flight, and redraw without it when it settles.

- [ ] **Step 4: Test the pure part**

Unit-test the frame sequence and the restore. Do not test the DOM timer.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(ui): tab ticker and favicon pip while work is in flight"
```

---

## Task 14: Empty states become arcade panels (Tier 2)

`.sc-empty` exists in `styles.ts:573` with a bobbing sprite — **and is used by no component.** This task builds the component that was styled a week ago and never written.

**Files:** Modify `plugins/platform-ui/src/components.tsx`, `styles.ts`; use it in `RequestPage.tsx` and `RequestsPage.tsx`

- [ ] **Step 1: `EmptyState`**

Props: sprite, a pixel heading (`NO DATA`), and a muted hint saying what would fill it. A 2px-bordered panel — the frame is what makes it a panel rather than a stray sentence.

- [ ] **Step 2: Replace the bare sentences**

Starting with `No decisions yet.` (`RequestPage.tsx:146`) and the empty requests list.

- [ ] **Step 3: Test that the hint renders**

The heading alone is decoration; the hint is the part that does the user any good.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(ui): arcade-panel empty states"
```

---

## Task 15: Konami code (Tier 2)

**Files:** Create `plugins/platform-ui/src/konami.ts`; wire in `SchemeRoot.tsx`

- [ ] **Step 1: The handler**

`↑↑↓↓←→←→BA` on `keydown`. Flip the palette to a fixed NES-hardware six and send one sprite walking across the footer. Reset on reload; store nothing; announce nothing.

- [ ] **Step 2: Do not break typing**

Ignore the sequence while focus is in an `input`, `textarea` or `[contenteditable]`. Someone typing `bbaa` in a note field must not trigger it.

- [ ] **Step 3: Test the matcher**

Pure function over a key sequence: correct sequence → true, near-misses → false, and a reset after a wrong key.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(ui): konami code easter egg"
```

---

## Task 16: Full verification and changelog

- [ ] **Step 1: Everything green**

```bash
yarn tsc && CI=true yarn test && yarn lint:all
```

Only `packages/app/src/App.test.tsx` may fail (pre-existing, see Global Constraints). Anything else is yours.

- [ ] **Step 2: One Playwright pass over the whole app**

Load home, catalog, `/create`, a request detail and the sign-in gate. Assert:

1. No animation on any visible element resolves to a non-`steps` timing function.
2. With `reducedMotion: 'reduce'`, every ambient loop is gone (`animation-name: none`).
3. Screenshots diff against `feat/8bit-ui` — every visual change is one somebody chose.

- [ ] **Step 3: Regenerate the changelog**

```bash
git cliff -o CHANGELOG.md
git add CHANGELOG.md
git commit -m "chore(changelog): regenerate for the 8-bit flare pass"
```

- [ ] **Step 4: Report, do not merge**

Summarise what shipped, what was dropped and why, and what the contrast pass in Task 5 measured. Merging to `feat/8bit-ui` or `main` needs explicit approval.

---

## Sequencing notes

- Tasks 1–5 are independent; any order, any subset.
- Task 7 (dither wipe) assumes Task 6's dialog rule — do 6 first.
- Task 9 needs no other task, but it is the highest-value one for anyone actually using the app: it is the only task here that adds information rather than character.
- Tasks 11–15 are individually droppable. If the pass has to be cut short, cut from the bottom.
