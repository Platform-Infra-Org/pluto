# Agence Foudre, from the source — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Foudre mode from the live site's own HTML and CSS rather than a third-party description of it, so the app carries that design's real colours, shapes, type and motion.

**Architecture:** One mode sheet (`foudre.ts`) plus a self-hosted display face and a motion vocabulary that the mode owns. Everything hangs off the existing `sc-foudre` root class; no new mechanism.

**Tech Stack:** TypeScript, Backstage frontend plugin (`@internal/plugin-platform-ui`), Jest, Playwright (for verification), Yarn 4, Node 22.

---

## What the site actually uses

Measured by driving `https://www.agencefoudre.com/` with Playwright and reading computed styles across its whole DOM — not from a summary. Counts are how many elements resolve to that value.

**Colour** (the palette is small and used in strict proportion):

| Value | Hex | Where | Count |
|---|---|---|---|
| Warm chalk | `#fff8f6` | dominant text; also a ground | 583 text / 26 bg |
| Black | `#000000` | body copy | 278 |
| Lipstick magenta | `#db3c8a` | display type **and** filled blocks | 245 text / 50 bg |
| Forest green | `#00522d` | body text, button labels | 161 |
| Blush cream | `#fce5df` | soft ground | 27 / 36 bg |
| Bubblegum | `#f29ebd` | button fills | 18 / 18 bg |
| Lilac | `#d1cfe4` | **the hairline** — `1px solid` | 13 borders |

The chalk-at-40% (`rgba(255,248,246,.4)`, 25 uses) is a translucent overlay ground, not a token.

**Shape** — a small, deliberate radius set:

| Radius | Count | Read as |
|---|---|---|
| `50%` | 35 | circles — the site's buttons are 60px discs |
| `10px` | 73 | the default box |
| `20px` / `22px` / `25px` | 62 | larger surfaces |

**Elevation:** one box-shadow on the entire page. The system is flat.

**Type:**

| Face | Weight | Role | Evidence |
|---|---|---|---|
| Clash Grotesk | 400/500/700 | everything structural | 1102 elements |
| Beni | 900 | display only | 143 elements |

The display setting is the signature: `h2` is Beni 900 at **94px with a 65.8px line-height** — a ratio of **0.70**. Body is Clash Grotesk **500** at 10–20px.

**Motion** — the single most characteristic thing the description missed:

| Easing | Count | Name |
|---|---|---|
| `cubic-bezier(.23,1,.32,1)` @ .4s | 951+ | ease-out-quint |
| `cubic-bezier(.23,1,.32,1)` @ .8s | 18 | the same, slower, for entrances |
| `cubic-bezier(.17,.67,.3,1.33)` | 34 | a **back** ease that overshoots |
| `cubic-bezier(.645,.045,.355,1)` | 17 | ease-in-out-cubic |

Keyframes present: `rotation`, `flicker`, `flap`, plus limb animations for its illustrations.

---

## Two conflicts to settle before any code

### 1. This design is built on smooth easing; the design system forbids it

`docs/explanation/design-system.md` is unambiguous:

> Every animation uses `steps()`, never `ease`. Smooth interpolation is what makes a pixel interface look like a modern interface wearing a costume, so the rule is absolute — including for third-party motion.

Nearly a thousand elements on the reference transition on `cubic-bezier(.23,1,.32,1)`. A Foudre mode that steps its motion is not this design; it is this design's colours wearing the pixel system's timing. The brief also asks to keep and extend the animations.

**Ruling: amend the contract, do not quietly break it.** The rule already carries exactly one carve-out — a *mode* potion may redefine status hue wholesale (Greek spends it). Motion gets the same shape of exception, with the same conditions attached:

- A mode may redefine the easing vocabulary, but **wholesale** — it declares its own curves and uses them consistently, rather than mixing smooth and stepped.
- Everything timed still sits inside `@media (prefers-reduced-motion: no-preference)`, and the reduced case is still *designed* rather than merely disabled.
- Nothing conveys state through motion alone.

The default theme and Greek keep `steps()`. This is the difference between an exception and a hole in the rule, and the doc has to say so in the same breath as the code that relies on it.

### 2. Beni is licensed and cannot ship

Beni Black is the display face and there is no free licence for it. Clash Grotesk is already self-hosted here (ITF Free Font License) and covers the structural voice exactly.

**Ruling: self-host Anton for display.** Anton is SIL OFL, condensed, single heavy weight, and is the closest licensable match to Beni's proportions. Set at a 0.70 line-height and tight tracking it reproduces the reference's dense display block. Task 1 verifies the licence before downloading; if it does not check out, fall back to Clash Grotesk 700 at the same leading and record that in the file.

### 3. There is already a `foudre` mode built from a description

It was built from a third-party summary and is close but wrong in specifics: it uses a magenta-derived border where the site uses lilac, a 20px card radius where the site's default box is 10px, no circles, and stepped motion.

**Ruling: rebuild `foudre` in place rather than adding a second Foudre.** The id is the key a browser has already persisted; two modes for one brand is a worse outcome than one accurate mode. Say so in the report so it can be overridden.

---

## Design

### Tokens

Both registers keep the reference's own relationships: chalk ground, black body copy, magenta as display and fill, lilac hairline. Every pair below is measured before the code is written (Task 2).

```
light  bg #fff8f6   fg #000000   card #ffffff   muted #fce5df
       border #d1cfe4 (hairline) · primary magenta (darkened to fill) · fg-on-primary chalk
dark   bg forest #00522d deepened · fg chalk · card a lifted forest
       border lilac · primary bubblegum · fg-on-primary forest
```

The dark register is an inversion the site does not define — it is a light site. Forest green is its second ground, so the dark register is built on forest rather than on an invented neutral, which is what keeps it recognisably Foudre.

### Shape

- `--sc-radius: 10px` — the site's default box.
- Large surfaces `20px`; cards holding a table stay `0` (see the table note in `styles.ts`).
- **Buttons and marks become 60px circles.** This is the most recognisable thing about the reference's chrome and the plan should not soften it: icon buttons and the brand mark are discs; text buttons take a pill so a label still fits.
- Borders: `1px solid` lilac. No shadows anywhere.

### Motion vocabulary

Declared once as tokens so every rule in the mode uses the same curves:

```
--sc-ease:       cubic-bezier(.23, 1, .32, 1)      /* the site's workhorse */
--sc-ease-back:  cubic-bezier(.17, .67, .3, 1.33)  /* overshoot, for arrivals */
--sc-dur:        .4s
--sc-dur-slow:   .8s
```

Applied to: nav item hover, button hover and press, card hover lift, dialog entrance, and a `flicker` on the brand mark echoing the reference's own keyframe. Each is a *response to an action*, which is what keeps it modern rather than busy.

---

## Tasks

### Task 1: The display face

**Files:** `backstage/packages/app/public/fonts/`, `public/fonts/LICENSE.txt`, `plugins/platform-ui/src/styles.ts`

- [ ] **Step 1: Confirm the licence.** Anton is SIL OFL 1.1. Verify at the source before downloading; if it is anything else, stop and use Clash Grotesk 700 instead.
- [ ] **Step 2: Download the woff2** and place it beside `clash-grotesk.woff2`.
- [ ] **Step 3: Record it in `LICENSE.txt`** — family, licence, source URL, and that it stands in for Beni.
- [ ] **Step 4: Add the `@font-face`** in `styles.ts` next to the other two, `font-display: swap`, same-origin `/fonts/` path.
- [ ] **Step 5:** `cd backstage && CI=true yarn test plugins/platform-ui/src/styles.test.ts` — the existing guard asserts every face is same-origin, so it covers this for free.
- [ ] **Step 6: Commit** — `feat(ui): self-host Anton for display type`

### Task 2: Measure the palette

**Files:** a scratch script; no repo changes.

- [ ] **Step 1: Write the checker** using the same maths as `contrast.test.ts` (`srgbOf` / `luminanceOf` / composite-over-cell).
- [ ] **Step 2: Check both registers** for: `fg/bg`, `fg/card`, `muted-fg/card`, `muted-fg/muted`, `accent-fg/accent`, `primary-fg/primary` at 4.5:1, and `border/card` at 3:1.
- [ ] **Step 3: Check the default status ink** against both new cards — this mode moves `--sc-card`, so the existing status colours must be re-measured on it.
- [ ] **Step 4: Adjust and re-run until everything passes.** Expect magenta to need darkening where it *fills*: at its published value it carries white at 3.3:1. It keeps full intensity as display type, which is how the site uses it.
- [ ] **Step 5: Record the final values** in the plan's report; they are the input to Task 3.

### Task 3: Rebuild `foudre.ts`

**Files:** `plugins/platform-ui/src/foudre.ts`, `statusTokens.ts` (card values)

- [ ] **Step 1: Replace the two register blocks** with the measured values from Task 2. Keep `--sc-hairline` as lilac `#d1cfe4`, which the site uses for every border.
- [ ] **Step 2: Set the shape tokens** — `--sc-radius: 10px`, `--sc-radius-sm: 10px`, `--sc-border-w: 1px`, `--sc-shadow: none`.
- [ ] **Step 3: Circles.** Icon buttons and both marks (`.sc-nav-mark`, `.sc-login-mark`) get `border-radius: 50%` and a fixed square size; text buttons get a pill. Keep the existing `:has(table)` rule at radius 0.
- [ ] **Step 4: Display type.** `.sc-h1` and `.sc-card-title` take the display face at `line-height: .70`, weight 900, tight tracking, magenta at full intensity.
- [ ] **Step 5: Update `MODE_CARDS.foudre`** in `statusTokens.ts` to the new card values, or `contrast.test.ts` measures against a colour nothing paints.
- [ ] **Step 6:** `CI=true yarn test plugins/platform-ui/src/foudre.test.ts plugins/platform-ui/src/contrast.test.ts`
- [ ] **Step 7: Commit** — `feat(ui): rebuild foudre from the site's own tokens`

### Task 4: The motion vocabulary

**Files:** `plugins/platform-ui/src/foudre.ts`, `docs/explanation/design-system.md`

- [ ] **Step 1: Amend the doc first.** Add the motion exception to the design-system contract, in the same section that carries the status-hue exception, with its three conditions (wholesale, reduced-motion respected, never state-by-motion-alone). Doing this before the code is deliberate: the contract should never trail the thing that breaks it.
- [ ] **Step 2: Declare the curves** as tokens on `:root.sc-foudre`.
- [ ] **Step 3: Apply them** to nav hover, button hover/press, card hover, and dialog entrance — all inside `@media (prefers-reduced-motion: no-preference)`.
- [ ] **Step 4: Add the brand-mark flicker**, echoing the reference's own `flicker` keyframe. Two frames, `--sc-ease`, and the unanimated default is the lit state so stillness reads as intended.
- [ ] **Step 5: Test.** A new case asserting that within this mode every `transition`/`animation` uses `var(--sc-ease…)` and none use `steps(` — the inverse of the base rule, which is exactly the point — plus the existing reduced-motion guard.
- [ ] **Step 6: Commit** — `feat(ui): give foudre the reference's own easing`

### Task 5: Verify in a browser, not in the sheet

**Files:** a scratch Playwright script; no repo changes.

This step is not optional. Three separate fixes in this file's history looked correct in CSS and were wrong on screen — a clipped table, a covered border arc, and a classless heading no selector reached.

- [ ] **Step 1: Log in** against the local stack (`admin`/`admin`, per `deploy/dev/ldap/bootstrap.ldif`).
- [ ] **Step 2: For the foudre mode, assert on the live DOM:** the table's surface has radius `0` and no clipping ancestor; `h1`, `.sc-h1` and `.sc-card-title` all resolve to the display or body face as intended; a button's computed `border-radius` is a circle; the computed `transition-timing-function` on a nav item is the site's curve.
- [ ] **Step 3: Check both registers** by toggling the theme, not just the light one.
- [ ] **Step 4: Report the measured values.** If any differ from the sheet, fix the sheet — the browser is the authority.
- [ ] **Step 5: Delete the scratch script** so it never lands in a commit.

### Task 6: Full CI and the image

- [ ] **Step 1:** `cd backstage && CI=true yarn tsc && CI=true yarn lint:all && CI=true yarn test && CI=true yarn build:all`
- [ ] **Step 2:** `bash scripts/prod-image-up.sh`
- [ ] **Step 3: Confirm the served bundle** carries the new face and the mode, and that `/fonts/<display>.woff2` returns 200 — a CDN reference would fail the CSP silently.

---

## Risks

- **The motion exception is the load-bearing decision here.** If it is not wanted, the mode still works with stepped timing and loses the thing that most distinguishes the reference. That is the one call worth confirming before Task 4.
- **Circles cost width.** A 60px disc is right for an icon button and wrong for `SUBMIT REQUEST`. The plan splits them deliberately; if a text button ends up circular it will truncate.
- **A 0.70 line-height clips descenders** on anything but a display size. It belongs on `.sc-h1` and card titles, not on body copy.
- **Anton is a stand-in, not Beni.** It is close in proportion and wrong in detail. Worth saying plainly rather than implying the type is exact.
