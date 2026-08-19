# Potions and Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the sign-in page's potion shelf overflowing its card by giving it the same one-bottle-plus-tray box the app uses, then add three new schemes — Hanami (Japanese, sakura), Nightshade (Hades-2 witch) and Rimefast (Norse).

**Architecture:** The picker already has both behaviours in one component, branched on a single `floating` prop that conflates three things: the tray, the fixed position, and dragging. Task 1 separates the tray from the placement, which is what lets the login card have the tray without becoming a floating shelf. Each new scheme is a **hand-written mode** — its own file emitting `:root.sc-<id>` and `:root.sc-<id>.sc-dark`, interpolated into `styles.ts` — because all three carry an animation, and `BRAND_DEFS` rows cannot express one.

**Tech Stack:** TypeScript, React 18, CSS custom properties on root classes, jest + `@testing-library/react`, sprite grids rendered to SVG data URIs.

**Spec:** `docs/superpowers/specs/2026-08-18-potions-and-login-design.md`

## Global Constraints

- All Node commands run from `backstage/` (Yarn 4 via corepack, Node 22).
- **Ship Task 1 first.** Every added potion widens the login shelf; at 12 bottles it needs 358px in a 296px box, and at 15 it needs 442px. Task 1 is what makes that arithmetic stop mattering.
- `plugins/platform-ui/src/styles.ts` is **one template literal**: no backticks anywhere inside it, including CSS comments, and no backslash immediately before a digit. This is why each mode gets its own file.
- All motion lives inside `@media (prefers-reduced-motion: no-preference)` and uses `steps()`, never `ease`. Nothing may convey state through motion alone. The 0%/100% keyframe must equal the static rule outside the query — the still frame is designed, not frozen.
- A mode may **not** declare a typeface; `styles.test.ts:161,193` allows exactly one `@font-face`.
- Status ink must clear **5.0:1** against both the card and the dithered badge cell — above AA's 4.5, enforced by `contrast.test.ts`. Every card value below was solved backwards from that.
- Status colours stay stock: every new mode maps to `STATUS_TOKENS`. `SUCCEEDED`/`FAILED` keep their hue and their label in every scheme (`docs/explanation/design-system.md:7-24`).
- Both registers must declare **every** token base `:root` declares — `brands.test.ts:58` and each mode's parity test enforce it.
- `contrast.test.ts:210`: the dark `border` must sit ≥20° from the dark `primary`, or have saturation ≤25.

## Adding a mode: the ten files

Every one of Tasks 2-4 touches exactly these. Written once here; each task below states only its own values.

1. **`plugins/platform-ui/src/<id>.ts`** — new. Exports `<id>Css(): string`, emitting `:root.sc-<id>` and `:root.sc-<id>.sc-dark`.
2. **`plugins/platform-ui/src/styles.ts`** — `import { <id>Css } from './<id>';` in the import block at `:5-11`, and `${<id>Css()}` in the interpolation block at `:84-89`.
3. **`plugins/platform-ui/src/statusTokens.ts`** — add `'<id>'` to the `SchemeMode` union (`:65`), a `<id>: STATUS_TOKENS` row in `MODE_TOKENS` (`:133`), and a `<id>: { light: '<hsl>', dark: '<hsl>' }` row in `MODE_CARDS` (`:153`) whose values **equal** the card values the sheet emits.
4. **`plugins/platform-ui/src/SchemeRoot.tsx`** — add `'<id>'` to the `MODES` tuple (`:75`) and a literal entry to `SCHEMES` (`:98-125`, alongside greek/foudre/slush/spiderverse).
5. **`plugins/platform-ui/src/SchemeRoot.test.ts`** — three hard-coded arrays: ids in order (`:34`), sorted mode names (`:39`), `sc-<id>` classes (`:56`).
6. **`plugins/platform-ui/src/<id>.test.ts`** — new. The standard suite (contents given in Task 2, Step 1; repeat it per mode with that mode's values).
7. **`plugins/platform-ui/src/brands.test.ts:216`** — add `['<id>', <id>Css()]` to the `sheets` array.
8. **`plugins/platform-ui/src/contrast.test.ts:222`** — add the mode to the `registers` list (hand-written modes are not auto-discovered from `BRAND_DEFS`).
9. **`plugins/platform-ui/src/sprites.ts` + `sprites.test.ts`** — any new motif grids; each must be exactly `SPRITE_SIZE`² or `SMALL_SPRITE_SIZE`².
10. **`plugins/platform-ui/src/styles.test.ts:18`** — optionally add `:root.sc-<id>` to the interpolation marker list (today only `:root.sc-greek` proves a mode sheet actually reaches the page).

Baked sprite fills: a data URI inherits neither `currentColor` nor a custom property, so a two-colour motif is two URIs with literal fills, which must track the register's tokens. `greek.ts:37-45` (`BRONZE`/`GOLD`) is the working example, and `greek.test.ts` checks they stay in step.

---

### Task 1: Give the sign-in card the app's potion box

**Files:**
- Modify: `backstage/plugins/platform-ui/src/SchemeRoot.tsx:407` (signature), `:648` (shelf), and the `floating`-gated JSX below it
- Modify: `backstage/plugins/platform-ui/src/styles.ts:1493` (`.sc-picker`)
- Modify: `backstage/packages/app/src/modules/auth.tsx:143-145`
- Test: `backstage/plugins/platform-ui/src/SchemePicker.test.tsx:224`

**Interfaces:**
- Consumes: nothing.
- Produces: `SchemePicker({ floating, compact }: { floating?: boolean; compact?: boolean })`. `floating` keeps its current meaning (fixed placement + drag + tray). `compact` is the tray without the placement — what the sign-in card mounts.

Today `floating` decides three unrelated things at once: `shelf = floating ? [equipped] : SCHEMES` (`:648`), the `sc-picker-float` class with its `position: fixed` and drag handlers, and the tray with its `aria-expanded`. The login card needs the first and third without the second.

- [ ] **Step 1: Write the failing test**

In `backstage/plugins/platform-ui/src/SchemePicker.test.tsx`, **replace** the test at `:224` (`keeps the sign-in card free of the tray`) with:

```tsx
  it('gives the sign-in card the same one-bottle box as the app', () => {
    // The card is 296px of content box; twelve bottles need 358px and fifteen
    // need 442px, so the flat shelf squeezed the sprites below their 16px grid
    // and got worse with every potion added. The tray is the same interaction
    // the app already has, and it does not grow the card at all.
    const { container } = render(<SchemePicker compact />);
    expect(potions(container)).toHaveLength(1);
    expect(container.querySelector('.sc-picker-toggle')).not.toBeNull();
    expect(container.querySelector('.sc-picker-float')).toBeNull();
  });

  it('opens the full inventory from the sign-in card', () => {
    const { container } = render(<SchemePicker compact />);
    const toggle = potions(container)[0];
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelectorAll('.sc-inv-potion')).toHaveLength(SCHEMES.length);
  });
```

Import `fireEvent` and `SCHEMES` at the top of the file if they are not already imported.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backstage && yarn test plugins/platform-ui/src/SchemePicker.test.tsx -t 'sign-in card'`
Expected: FAIL — `compact` is not a prop, so all twelve bottles render flat and there is no toggle.

- [ ] **Step 3: Separate the tray from the placement**

In `backstage/plugins/platform-ui/src/SchemeRoot.tsx`:

```ts
export function SchemePicker({
  floating,
  compact,
}: { floating?: boolean; compact?: boolean } = {}) {
```

Immediately after the props, derive the two independent behaviours:

```ts
  // `floating` used to mean three things at once: one bottle plus a tray, a
  // fixed position, and drag. The sign-in card wants the first without the
  // other two — its shelf is inside a 296px card and cannot grow.
  const collapsed = floating || compact;
```

Then replace every `floating` reference that is about the *shelf or the tray* with `collapsed`, and leave the ones about *placement* alone:

- `:648` becomes `const shelf = collapsed ? [equipped] : SCHEMES;`
- the `ref={floating ? invBtn : undefined}` on the bottle becomes `collapsed`
- the `aria-expanded` / `aria-controls` spread becomes `collapsed`
- the tray render guard becomes `collapsed`
- the `className` stays `sc-picker${floating ? ' sc-picker-float' : ''}`
- the drag handlers (`onPointerDown`/`onPointerMove`/`endDrag`) and `style={pos ? ... : undefined}` stay gated on `floating`

Update the two comments that now describe the old rule: the docstring at `:400-406` ("Without it the picker sits in the flow, which is how the sign-in card carries its own") and the comment at `:642-645` ("there the shelf IS the whole card — every bottle is already on show, so there is nothing to open"). Both are about to become false.

- [ ] **Step 4: Give the tray something to anchor to**

In `backstage/plugins/platform-ui/src/styles.ts`, add `position: relative;` to `.sc-picker` (`:1493`).

`.sc-picker-inv` is `position: absolute` (`:1581`). For the floating picker it resolves against `.sc-picker-float`'s `position: fixed`; the login instance has no positioned ancestor, so without this the tray escapes to the viewport. Harmless for the floating one, which overrides with `fixed`.

- [ ] **Step 5: Mount it on the login card**

In `backstage/packages/app/src/modules/auth.tsx`, change `<SchemePicker />` (`:144`) to `<SchemePicker compact />`.

Leave the `sc-signed-out` effect at `:114-119` alone: it hides `.sc-picker-float` (`styles.ts:1534`), and the compact instance does not carry that class.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backstage && yarn test plugins/platform-ui/src/SchemePicker.test.tsx`
Expected: PASS, including the reduced-motion assertion at `:279` — `equip()` (`SchemeRoot.tsx:657-673`) still skips the 360ms cast when the reader asked for less motion.

- [ ] **Step 7: Check the tray's opening direction**

`.sc-picker-inv` opens upward (`bottom: calc(100% + 10px)`, `styles.ts:1581`) and is capped at `max-height: 56vh`. The login card is vertically centred, so on a short viewport the tray can run off the top. Verify at 1280x600 in the browser; if it clips, add a `.sc-login-pick .sc-picker-inv { bottom: auto; top: calc(100% + 10px); }` rule rather than changing the shared one.

- [ ] **Step 8: Verify in the browser**

Sign out (or open a private window) and confirm: one bottle in the card, the tray opens with all schemes, picking one applies it immediately, the card does not grow or overflow, and the outer ring of the picker is not clipped by the card's border. Then sign in and confirm the floating shelf still drags.

- [ ] **Step 9: Commit**

```bash
cd backstage && yarn tsc && yarn lint:all
git add backstage/plugins/platform-ui/src/SchemeRoot.tsx backstage/plugins/platform-ui/src/styles.ts backstage/plugins/platform-ui/src/SchemePicker.test.tsx backstage/packages/app/src/modules/auth.tsx
git commit -m "fix: sign-in card uses the app's potion box"
```

---

### Task 2: Hanami — the Japanese mode

**Files:** the ten from "Adding a mode", with `<id>` = `hanami`.

**Interfaces:**
- Consumes: nothing.
- Produces: `export function hanamiCss(): string`; `SchemeMode` gains `'hanami'`; `SCHEMES` gains `{ id: 'hanami', label: 'Hanami', hsl: '355 59% 39%', fg: 'hsl(45 100% 98%)', mode: 'hanami' }`.

**Do this one first of the three.** It is the most complex sheet — light-led, the most motifs, and the petal animation — so it shakes out the checklist while the other two are still cheap to adjust.

- [ ] **Step 1: Write the failing sheet test**

Create `backstage/plugins/platform-ui/src/hanami.test.ts`:

```ts
import { hanamiCss } from './hanami';
import { MODE_CARDS } from './statusTokens';
import { SHADCN_CSS } from './styles';

describe('hanamiCss', () => {
  const css = hanamiCss();

  it('is not truncated and has balanced braces', () => {
    expect(css.length).toBeGreaterThan(1000);
    const open = (css.match(/{/g) ?? []).length;
    const close = (css.match(/}/g) ?? []).length;
    expect(`${open}/${close}`).toBe(`${close}/${close}`);
  });

  it('has no control characters, which is what a bad escape leaves behind', () => {
    // eslint-disable-next-line no-control-regex
    expect(css).not.toMatch(/[ -]/);
  });

  it('declares both registers', () => {
    expect(css).toContain(':root.sc-hanami');
    expect(css).toContain(':root.sc-hanami.sc-dark');
  });

  it('declares the load-bearing tokens in both registers', () => {
    const light = css.slice(
      css.indexOf(':root.sc-hanami'),
      css.indexOf(':root.sc-hanami.sc-dark'),
    );
    const dark = css.slice(css.indexOf(':root.sc-hanami.sc-dark'));
    for (const token of [
      '--sc-bg',
      '--sc-fg',
      '--sc-card',
      '--sc-primary',
      '--sc-primary-fg',
      '--sc-border',
      '--sc-muted-fg',
      '--sc-accent',
    ]) {
      expect(`${token} light:${light.includes(`${token}:`)}`).toBe(`${token} light:true`);
      expect(`${token} dark:${dark.includes(`${token}:`)}`).toBe(`${token} dark:true`);
    }
    // Guards the base sheet still declaring these at all, so this test cannot
    // pass vacuously after a token rename.
    expect(SHADCN_CSS).toContain('--sc-card:');
  });

  it('emits the card value MODE_CARDS advertises', () => {
    expect(css).toContain(`--sc-card: ${MODE_CARDS.hanami.light}`);
    expect(css).toContain(`--sc-card: ${MODE_CARDS.hanami.dark}`);
  });

  it('declares no typeface', () => {
    expect(css).not.toContain('@font-face');
    expect(css).not.toMatch(/font-family:/);
  });

  it('keeps every petal animation behind prefers-reduced-motion and on steps()', () => {
    const query = '@media (prefers-reduced-motion: no-preference)';
    expect(css.indexOf('animation:')).toBeGreaterThan(css.indexOf(query));
    const guarded = css.slice(css.indexOf(query));
    expect(guarded).toContain('steps(');
    expect(guarded).not.toMatch(/animation:[^;]*ease/);
    expect(guarded).not.toMatch(/animation:[^;]*cubic-bezier/);
  });

  it('paints a designed still frame, not a frozen one', () => {
    // Outside the motion query the petals must still be a deliberate picture.
    expect(css).toMatch(/\.sc-sakura i \{[^}]*opacity:/);
  });

  it('does not translate on :active', () => {
    expect(css).not.toMatch(/:active[^{]*\{[^}]*transform:\s*translate/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backstage && yarn test plugins/platform-ui/src/hanami.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the sheet**

Create `backstage/plugins/platform-ui/src/hanami.ts` following `greek.ts`'s shape: a file docstring explaining the art direction and why the values are solved rather than chosen, sprite fills as literals, and one exported `hanamiCss()` returning the template string.

Light register (this mode leads light — Japanese traditional colour is a light-ground tradition):

| Token | Name / romaji | HSL |
|---|---|---|
| `--sc-bg` | sakura-gasumi | `20 69% 94.9%` |
| `--sc-card` | gofun | `45 100% 98.4%` |
| `--sc-fg` | sumi | `24 12% 8.0%` |
| `--sc-muted-fg` | nando-iro | `180 8% 33.3%` |
| `--sc-primary` | enji | `355 59% 38.8%` |
| `--sc-primary-fg` | gofun | `45 100% 98.4%` |
| `--sc-accent` | ai-iro | `189 31% 21.6%` |

Dark register: `--sc-bg: 197 26% 5.3%`, `--sc-card: 195 29% 5.5%`, `--sc-fg: 45 100% 98.4%`, `--sc-muted-fg: 40 6% 63.5%`, `--sc-primary: beni 348 79% 70.2%`, `--sc-accent: asagi 187 38% 64.7%`.

Two colours are **decorative only** and must never carry text or a meaning-bearing border: sakura-iro `#FCC9B9` (1.45 on the card) and yamabuki `#FFA400` (1.95 light; safe as text in the dark register only, 9.64). Say so in a comment beside them — the next person will otherwise reach for the pretty pink.

Note in the docstring why kurenai `#C93756` is *not* the primary: 4.96 on the card clears AA but misses this repo's 5.0 bar, so enji takes the slot and kurenai stays a fill.

The dark card sits at 5.5% lightness because error-on-cell lands at exactly 5.00 there. That is a floor, not a starting point — record it.

- [ ] **Step 4: Add the petal animation**

Inside the sheet, wholly within `@media (prefers-reduced-motion: no-preference)`:

```css
@keyframes sc-petal-fall  { from { transform: translateY(-16px); } to { transform: translateY(102vh); } }
@keyframes sc-petal-drift { from { margin-left: -14px; } to { margin-left: 14px; } }
@keyframes sc-petal-turn  { to { background-position: -12px 0; } }

.sc-sakura i {
  animation: sc-petal-fall 11s steps(28) infinite,
             sc-petal-drift 2.6s steps(4) infinite alternate,
             sc-petal-turn 1.2s steps(4) infinite;
}
.sc-sakura i:nth-child(2) { animation-duration: 14s, 3.1s, 1.6s; animation-delay: -3s, 0s, -.4s; }
.sc-sakura i:nth-child(3) { animation-duration: 9s, 2.2s, 1s; animation-delay: -6s, -1s, -.8s; }
```

...continuing one line per petal for around nine petals. Each `steps()` is required, not stylistic: `fall` moves whole pixel rows so the sprite never lands on a sub-pixel and blurs; `turn` advances a 4-frame tumble strip that would otherwise smear. Negative delays start petals mid-flight so there is no synchronised burst on load.

Outside the query, `.sc-sakura` and `.sc-sakura i` must still paint a deliberate arrangement — a few petals at rest, `opacity: 1`, `pointer-events: none` on the fixed overlay.

- [ ] **Step 5: Add the motifs**

In `sprites.ts`, add 16x16 grids for seigaiha (tileable concentric arcs — a unit-cell pattern, so it tiles with zero seam), asanoha, a torii, a two-layer koi (gofun body + kurenai patches), a kitsune mask, plus an 8x8 blossom and a 3x4 petal for the animation. Add each to `sprites.test.ts`'s grid-size assertions.

- [ ] **Step 6: Register the mode**

Do items 2, 3, 4, 5, 7, 8 and 10 from "Adding a mode" with `<id>` = `hanami`, `MODE_CARDS.hanami = { light: '45 100% 98.4%', dark: '195 29% 5.5%' }`, and `MODE_TOKENS.hanami = STATUS_TOKENS`.

- [ ] **Step 7: Run the full suite**

Run: `cd backstage && yarn test plugins/platform-ui`
Expected: PASS. `contrast.test.ts` is the one that matters — it re-measures every status pair against the new card. If a pair fails, move the **card**, not the status token; a mode-specific `StatusToken[]` is an exception the design system has already spent on greek.

- [ ] **Step 8: Verify in the browser**

Pick Hanami from the tray. Check: light and dark both readable; the petals fall in visible pixel steps rather than gliding; `SUCCEEDED` and `FAILED` badges keep their system hue; and with OS "reduce motion" on, the petals are a still arrangement rather than absent.

- [ ] **Step 9: Commit**

```bash
cd backstage && yarn tsc && yarn lint:all
git add backstage/plugins/platform-ui/src/hanami.ts backstage/plugins/platform-ui/src/hanami.test.ts backstage/plugins/platform-ui/src/styles.ts backstage/plugins/platform-ui/src/statusTokens.ts backstage/plugins/platform-ui/src/SchemeRoot.tsx backstage/plugins/platform-ui/src/SchemeRoot.test.ts backstage/plugins/platform-ui/src/brands.test.ts backstage/plugins/platform-ui/src/contrast.test.ts backstage/plugins/platform-ui/src/sprites.ts backstage/plugins/platform-ui/src/sprites.test.ts backstage/plugins/platform-ui/src/styles.test.ts
git commit -m "feat: hanami potion"
```

---

### Task 3: Nightshade — the Hades-2 witch mode

**Files:** the ten from "Adding a mode", with `<id>` = `nightshade`.

**Interfaces:**
- Consumes: nothing.
- Produces: `export function nightshadeCss(): string`; `SchemeMode` gains `'nightshade'`; `SCHEMES` gains `{ id: 'nightshade', label: 'Nightshade', hsl: '142 67% 66%', fg: 'hsl(240 10% 8%)', mode: 'nightshade' }`.

- [ ] **Step 1: Write the failing sheet test**

Create `backstage/plugins/platform-ui/src/nightshade.test.ts` with the same nine assertions listed in Task 2, Step 1, with `hanami` replaced by `nightshade` throughout, `MODE_CARDS.nightshade` in the card assertion, and the still-frame assertion naming `.sc-moon` instead of `.sc-sakura i`. Repeat the assertions in full — do not import them from the other test file; each mode's suite must be readable on its own.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backstage && yarn test plugins/platform-ui/src/nightshade.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the sheet**

Create `backstage/plugins/platform-ui/src/nightshade.ts`. Dark-first.

| Token | Name | HSL |
|---|---|---|
| `--sc-bg` | Void | `251 41% 5.3%` |
| `--sc-card` | Crossroads slate | `254 39% 6.5%` |
| `--sc-fg` | Bone | `263 39% 93.5%` |
| `--sc-muted-fg` | Ash lavender | `256 24% 69.6%` |
| `--sc-primary` | Witch green | `142 67% 66.3%` |
| `--sc-primary-fg` | ink | `240 10% 8%` |
| `--sc-accent` | Filigree gold | `41 67% 54.9%` |
| second accent | Moonlight violet | `269 68% 69.8%` |

Light register: `--sc-bg: 40 20% 96%`, `--sc-card: 260 30% 99%`, `--sc-fg: 254 25% 12%`, `--sc-primary: 152 62% 26%`, gold `41 60% 40%`.

`MODE_CARDS.nightshade = { light: '260 30% 99%', dark: '254 39% 6.5%' }`, `MODE_TOKENS.nightshade = STATUS_TOKENS`. Verified status on the dark card: success 7.25 / cell 5.35, warn 8.35 / 5.35, error 6.35 / 5.06, muted 10.17 / 5.27.

Never pair witch green with filigree gold directly — both mid-light. Separate them with the card. Selene silver `219 40% 84.9%` is an ornament colour; do not recruit it as a second text tone.

In the docstring, state what this is and is not. The gold-filigree-on-saturated-dark read comes from Jen Zee's documented art-nouveau lineage (Mucha, Klimt), and the cool green/grey shift is Hades II's own. What must **not** appear: Melinoe or Hecate as characters or silhouettes (the bob-plus-crescent profile is a recognisable character mark), the four-goddess braid detail, the Hades II logotype or laurel lockup, the game's UI frame geometry, and the boon-rarity ramp (white/blue/purple/red) — which would also collide with our status semantics. Also note why this is not "greek at night": `greek` already owns gold-on-dark with meander and palmette, so Nightshade leads with witch green over violet.

- [ ] **Step 4: Add the moon animation**

Wholly inside `@media (prefers-reduced-motion: no-preference)`:

```css
@keyframes sc-moonphase { to { background-position: -64px 0; } }
.sc-moon { animation: sc-moonphase 8s steps(8) infinite; }
```

`.sc-moon` outside the query is an 8x8 element with the strip's first frame showing — one crescent, deliberately chosen, `opacity: 1`. `steps(8)` is mandatory: interpolation slides the strip mid-frame and shows two half-moons at once.

- [ ] **Step 5: Add the motifs**

In `sprites.ts`: a 16x16 crescent-and-torch as two layers (gold body, green flame); an 8x8 filigree corner scroll used at four rotations via `transform`; a 16x16 cauldron with three bubbles as two layers; an 8x8 moth; and a tileable nightshade sprig band for the sidebar. Add each to `sprites.test.ts`.

- [ ] **Step 6: Register the mode**

Items 2, 3, 4, 5, 7, 8 and 10 from "Adding a mode" with `<id>` = `nightshade`.

- [ ] **Step 7: Run the full suite**

Run: `cd backstage && yarn test plugins/platform-ui`
Expected: PASS, `contrast.test.ts` included.

- [ ] **Step 8: Verify in the browser**

Pick Nightshade. Check both registers, confirm the moon steps rather than glides, and confirm status badges keep their hue against the new card.

- [ ] **Step 9: Commit**

```bash
cd backstage && yarn tsc && yarn lint:all
git add backstage/plugins/platform-ui/src/nightshade.ts backstage/plugins/platform-ui/src/nightshade.test.ts backstage/plugins/platform-ui/src/styles.ts backstage/plugins/platform-ui/src/statusTokens.ts backstage/plugins/platform-ui/src/SchemeRoot.tsx backstage/plugins/platform-ui/src/SchemeRoot.test.ts backstage/plugins/platform-ui/src/brands.test.ts backstage/plugins/platform-ui/src/contrast.test.ts backstage/plugins/platform-ui/src/sprites.ts backstage/plugins/platform-ui/src/sprites.test.ts backstage/plugins/platform-ui/src/styles.test.ts
git commit -m "feat: nightshade potion"
```

---

### Task 4: Rimefast — the Norse mode

**Files:** the ten from "Adding a mode", with `<id>` = `rimefast`.

**Interfaces:**
- Consumes: nothing.
- Produces: `export function rimefastCss(): string`; `SchemeMode` gains `'rimefast'`; `SCHEMES` gains `{ id: 'rimefast', label: 'Rimefast', hsl: '41 75% 51%', fg: 'hsl(240 10% 8%)', mode: 'rimefast' }`.

- [ ] **Step 1: Write the failing sheet test**

Create `backstage/plugins/platform-ui/src/rimefast.test.ts` with the same nine assertions listed in Task 2, Step 1, with `hanami` replaced by `rimefast` throughout, `MODE_CARDS.rimefast` in the card assertion, and the still-frame assertion naming `.sc-rune-rule`. Repeat them in full.

Add one more, specific to this mode:

```ts
  it('names no rune that has been appropriated as an extremist symbol', () => {
    // Genuine Norse forms, all catalogued by the ADL. Ravens, Yggdrasil,
    // knotwork and generic futhark bands carry no such freight.
    const sheet = rimefastCss().toLowerCase();
    for (const banned of ['valknut', 'othala', 'sowilo', 'sunwheel', 'sigrune']) {
      expect(`${banned}:${sheet.includes(banned)}`).toBe(`${banned}:false`);
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backstage && yarn test plugins/platform-ui/src/rimefast.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the sheet**

Create `backstage/plugins/platform-ui/src/rimefast.ts`. Dark-first, cold and bright.

| Token | Name | HSL |
|---|---|---|
| `--sc-bg` | Polar night | `205 50% 4.7%` |
| `--sc-card` | Deep woad | `205 43% 5.5%` |
| `--sc-fg` | Bone / lead white | `44 29% 87.3%` |
| `--sc-muted-fg` | Frost slate | `201 12% 63.7%` |
| `--sc-primary` | Orpiment | `41 75% 51.4%` |
| `--sc-primary-fg` | ink | `240 10% 8%` |
| `--sc-accent` | Aurora | `157 60% 59.8%` |
| second accent | Lichen purple | `272 42% 68.2%` |
| third accent | Madder, lifted | `9 68% 62.0%` |

Light register: `--sc-bg: 44 30% 95%`, `--sc-card: 44 40% 98%`, `--sc-fg: 205 30% 12%`, `--sc-primary: 28 70% 34%`, border woad `205 45% 30%`.

`MODE_CARDS.rimefast = { light: '44 40% 98%', dark: '205 43% 5.5%' }`, `MODE_TOKENS.rimefast = STATUS_TOKENS`. Verified: success 7.15 / cell 5.17, warn 8.23 / 5.27, error 6.26 / 5.08, muted 10.02 / 5.16.

Two facts to record in the docstring, because both look like mistakes otherwise:

- Madder's true pigment value `#C7503F` measures **3.60 on the card and fails**. It is lifted to `9 68% 62.0%` for anything carrying text; the true value is fills-only.
- The card is at 5.5% lightness deliberately. At 8% the worst status pair drops to 4.78 and at 10% to 4.54, which would force a mode-specific `StatusToken[]`.

Also note why there is no brown: the Viking Age painted loudly — orpiment, lead-oxide red, hematite, copper green, vivianite blue, madder, woad and lichen purple are all identified from finds. "Medieval brown" is a modern screen convention.

- [ ] **Step 4: Add the aurora animation**

Wholly inside `@media (prefers-reduced-motion: no-preference)`:

```css
@keyframes sc-aurora { to { background-position: -192px 0; } }
.sc-rune-rule { animation: sc-aurora 4.8s steps(6) infinite; }
```

800ms per frame reads as a shimmer rather than a scroll. Outside the query `.sc-rune-rule` is the same strip, fully painted and correctly coloured on frame one.

- [ ] **Step 5: Add the motifs**

In `sprites.ts`: a 16x16 tileable Elder Futhark band using **decorative, non-semantic** rune sequences (runes were carved without horizontals, which is exactly what a pixel grid renders cleanly); a 16x16 Yggdrasil (2px trunk, three branches, three roots, symmetric); an 8x8 raven in profile; a 16x16 Urnes-style knotwork border with 2px strokes and a 1px gap at crossings (16x16 is the floor — interlace needs three distinguishable bands across a crossing); and a 32x8 dithered aurora strip. Add each to `sprites.test.ts`.

**Excluded, deliberately:** Valknut, Othala, Sowilo/sig-rune, Tyr rune, sunwheel. Put that list in a comment above the sprite grids so nobody adds one later thinking it was an oversight.

- [ ] **Step 6: Register the mode**

Items 2, 3, 4, 5, 7, 8 and 10 from "Adding a mode" with `<id>` = `rimefast`.

- [ ] **Step 7: Run the full suite**

Run: `cd backstage && yarn test plugins/platform-ui`
Expected: PASS.

- [ ] **Step 8: Check one adjacency by eye**

Aurora `157 60% 59.8%` sits about 5 degrees from the success status hue. Put an aurora ornament next to a `SUCCEEDED` badge in the browser and confirm the decoration does not read as state. If it does, move the ornament, not the status colour. This is the same trap `greek` recorded when it pushed success 60 degrees to clear the stock amber.

- [ ] **Step 9: Commit**

```bash
cd backstage && yarn tsc && yarn lint:all
git add backstage/plugins/platform-ui/src/rimefast.ts backstage/plugins/platform-ui/src/rimefast.test.ts backstage/plugins/platform-ui/src/styles.ts backstage/plugins/platform-ui/src/statusTokens.ts backstage/plugins/platform-ui/src/SchemeRoot.tsx backstage/plugins/platform-ui/src/SchemeRoot.test.ts backstage/plugins/platform-ui/src/brands.test.ts backstage/plugins/platform-ui/src/contrast.test.ts backstage/plugins/platform-ui/src/sprites.ts backstage/plugins/platform-ui/src/sprites.test.ts backstage/plugins/platform-ui/src/styles.test.ts
git commit -m "feat: rimefast potion"
```

---

### Task 5: Make the design-system docs true again

**Files:**
- Modify: `docs/explanation/design-system.md`
- Modify: `docs/how-to/rebrand-the-portal.md`

**Interfaces:**
- Consumes: the three modes from Tasks 2-4.
- Produces: documentation that matches the code.

Both files were already stale before this work — `design-system.md:130` says "Six of the seven bottles" and `:185` "all six schemes", and `rebrand-the-portal.md:45` has a table of "the six accents" that no longer exist. After Tasks 2-4 there are fifteen schemes, all of them modes.

- [ ] **Step 1: Fix the counts and the accents table**

In `docs/explanation/design-system.md`, correct every count and rewrite the "Mode potions" section to name all the modes. In `docs/how-to/rebrand-the-portal.md`, replace the stale accents table with the current list, or delete it and point at `SCHEMES` as the single source of truth — a table that must be hand-synced with a code array will go stale again.

- [ ] **Step 2: Document the login picker change**

Add a sentence to `docs/explanation/design-system.md` where the movable potion box is described: the sign-in card carries the same box, and both use the tray, because a flat shelf could not survive the scheme count.

- [ ] **Step 3: Document the three new modes**

One short paragraph each — what the palette is rooted in, which motion it carries, and, for Rimefast, the excluded iconography with the reason. That last one is the paragraph that stops someone "completing the set" in a year's time.

- [ ] **Step 4: Commit**

```bash
git add docs/explanation/design-system.md docs/how-to/rebrand-the-portal.md
git commit -m "docs: three new potions and the shared login picker"
```
