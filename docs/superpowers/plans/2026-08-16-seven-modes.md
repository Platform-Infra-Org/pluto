# Seven modes, a bigger template title, and the visualizer — Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add seven mode potions, enlarge the template-card title, and bring the app visualizer onto the design system — without breaking the three modes that exist.

**Architecture:** Six of the seven are palette-plus-shape and live as a table (`brands.ts`); Spider-Verse is hand-written because its identity is a set of effects, not a palette. The visualizer is reached through `theme.tsx` typed override keys, which is the only hook that survives a production build.

---

## What the sites actually use

Measured by driving each with a browser and reading computed styles across the DOM. Counts are elements resolving to that value.

| Mode | Ground | Accent | Shape | Rules | Elevation |
|---|---|---|---|---|---|
| **New Form** `newform` | `#121613` ink / `#fafffa` paper | **`#2bee4b`** electric green | 10px (18), 50% (6) | 1px `#516254` | **green-tinted glow** `rgba(16,94,29,.45) 1px 8px 20px` |
| **Hungry Tiger** `tiger` | `#402011` spice (65 bg) | **`#faae33`** gold (847 text) | **100% (94)**, 6px, pills | 1px `#402011` (37) | none |
| **Hermes** `hermes` | `#f5f5f5` | **`#0000f2`** pure blue | **4px — square** | 1px and **33px** `#0000f2` | none |
| **Flying Papers** `papers` | `#f9f5f2` paper / `#1a1a1a` | **`#f4ed36`** acid yellow + `#8584bd` periwinkle | 6px (11), 100px (10) | **3px `#1a1a1a` (32)** | none |
| **Discord** `discord` | white / black | **`#5865f2`** blurple | **16px (76)**, 12, 40, 50, 120 | 2px white/.1 | none |
| **Claude** `claude` | see note | `#d97757` clay | soft | hairline | none |

**Claude is the one I could not measure.** `claude.ai/new` serves a Cloudflare interstitial to an automated browser — the DOM I got back was the challenge page, not the app. Rather than pass that off as research, this mode is built from Anthropic's **published design tokens** (Slate Dark `#141413`, Ivory Medium `#f0eee6`, Ivory Light `#faf9f5`, Cloud/Stone greys, Clay `#d97757`), and the file says so. Its three stated negatives — no drop shadows, no gradients, no pure white — are the character.

**Spider-Verse has no site to inspect**, so it is built from the film's art direction rather than measured: halftone/Ben-Day dots, chromatic aberration (red/cyan offset), heavy panel rules, and comic-primary colour. It is the only mode here whose identity is *effects* rather than palette, which is why it is hand-written.

---

## Decisions taken before coding

1. **Six in a table, one hand-written.** The five measured sites plus Claude differ by palette, radius, rule weight and one glow. That is a row each. Spider-Verse needs halftone backgrounds, offset text shadows and panel borders — expressible only as its own sheet.
2. **One typeface throughout.** Clash Grotesk stays the only family, per the standing instruction. Every mode differentiates by weight, size and case. No mode declares `--sc-font-ui` or a `@font-face`.
3. **Accents get measured before use, not after.** Every one of these sites uses its accent as a *fill behind large display type*, which is a different job from carrying a 13px button label. Expect several to need darkening for the button and to keep their published value for badges and marks. Record each figure beside the value.
4. **Motion only where the reference has it.** The design system permits a mode to own its easing. New Form's glow and Discord's soft radii suggest gentle motion; Hermes is brutalist and gets none. Adding motion to a mode whose reference has none would be inventing character rather than reproducing it.
5. **The visualizer is a fix, not a redesign.** It renders through four `BackstageDependencyGraph*` override keys carrying **hardcoded hex** (`#17171f`, `#32303e`, `#e7e7ef`). Those were chosen for one dark palette and are wrong in every mode and in light mode. They become `hsl(var(--sc-*))` so the graph follows whatever theme is live — the same lesson as the header art.

---

## Task list

### Task 1: Template title, and the visualizer

- [ ] **Step 1: Enlarge the template-card title.** `.sc-route-create … > h4` is the name. Give it a size and weight that make it the card's headline rather than a caption, and confirm the type scale below it still reads.
- [ ] **Step 2: Re-point the four visualizer override keys** in `theme.tsx` from hardcoded hex to `hsl(var(--sc-card))`, `hsl(var(--sc-border))`, `hsl(var(--sc-fg))` and a `--sc-border`-derived edge. MUI freezes these at theme construction, so a variable is the only way they can follow a mode.
- [ ] **Step 3: Test.** A `styles.test.ts` case that the create title carries an explicit size, and a `theme` assertion that no `BackstageDependencyGraph*` override contains a `#` literal.
- [ ] **Step 4: Commit.**

### Task 2: Measure six palettes

- [ ] **Step 1: Write one checker** reusing `contrast.test.ts` maths.
- [ ] **Step 2: For each mode and register**, check `fg/bg`, `fg/card`, `muted-fg/card`, `muted-fg/muted`, `accent-fg/accent`, `primary-fg/primary` ≥ 4.5, `border/card` ≥ 3.
- [ ] **Step 3: Re-measure the default status ink against every new card** — twelve new surfaces.
- [ ] **Step 4: Iterate until all pass**, and record the departures (which accents had to darken, and by how much).

### Task 3: The brand table

- [ ] **Step 1: Create `brands.ts`** with a row per mode: id, label, bottle colour, both registers, radius set, border width, optional glow, optional easing.
- [ ] **Step 2: Generate** `:root.sc-<id>` and `:root.sc-<id>.sc-dark`, plus card/button shapes and the `:has(table)` zero-radius rule every mode needs.
- [ ] **Step 3: Wire** into `statusTokens.ts` (`SchemeMode`, `MODE_TOKENS`, `MODE_CARDS`), `styles.ts` and `SchemeRoot.tsx`.
- [ ] **Step 4: Test** — both registers emitted, token parity with base `:root`, cards matching `MODE_CARDS`, no `#` literals bypassing tokens, no mode declaring a font.

### Task 4: Spider-Verse

- [ ] **Step 1: Write `spiderverse.ts`.** Halftone as a repeating radial-gradient at low alpha; chromatic aberration as a two-colour `text-shadow` on display type only; panel rules at 3px; comic primaries.
- [ ] **Step 2: Keep it legible.** The aberration goes on headings, never body copy, and the halftone stays under 6% alpha or it eats the text beneath it. Measure the card and text pairs like any other mode.
- [ ] **Step 3: Motion** — a short "panel snap" entrance on dialogs, stepped rather than eased, because comic panels cut rather than glide. Behind the reduced-motion query.
- [ ] **Step 4: Test**, including that the aberration never lands on `.sc`-body text and that halftone alpha stays under the ceiling.

### Task 5: Verify in a browser

- [ ] **Step 1: For every mode**, in both registers: table surface radius 0 with no clipping ancestor; one font family across headings, body and table cells; card radius and border width match the row.
- [ ] **Step 2: Check the visualizer page** actually recolours per mode.
- [ ] **Step 3: Fix the sheet where the browser disagrees.** The browser is the authority — three separate fixes in this repo's history looked right in CSS and were wrong on screen.

### Task 6: CI and the image

- [ ] **Step 1:** `CI=true yarn tsc && yarn lint:all && yarn test && yarn build:all`.
- [ ] **Step 2:** `bash scripts/prod-image-up.sh`. Docker's disk fills after repeated rebuilds and takes Postgres down with it; `docker image prune -f && docker builder prune -f` is the documented remedy and must never include `--volumes`.

---

## Risks

- **Ten new modes' worth of contrast** is where the time goes, and where a silent AA failure would hide. The checker is not optional.
- **Spider-Verse can become unreadable fast.** Chromatic aberration on body text and halftone at full strength are both illegible; the ceilings in Task 4 are the guard.
- **Nothing may break.** Greek, Foudre and Slush stay exactly as they are; the mode list, `MODE_CARDS` and the tests that pin them are the tripwire.
