# More 8-bit flare — plan

**Goal:** push the pixel-game motif past "themed" into "reads like a game" — and
commit to a genre while doing it: **NES-era fantasy in the Greek-myth register**,
which is what the app has been half-drawing already. No new dependency, no build
step, no millisecond of blocked input.

Follows `2026-08-03-8bit-ui-design.md`, which established the tokens, the sprite
system, the CRT layer and the motion rules. This plan only adds what that one
left on the table.

## What already exists

Tokens and pixel type everywhere · 8 sprites (`TEMPLE`, `HOURGLASS`, `SCROLL`,
`GEAR`, `CHEST`, `SKULL`, `CROSS`, `HOURGLASS_SPENT`) · marching progress bar ·
gear spin · success flash · failure shake · nav `▶` cursor · empty-state bob ·
title caret · CRT scanlines · drag-resizable sidebar · supplied template header
images with per-image text tone.

Untouched ground, confirmed by grep: **scrollbars, tooltips, loading states,
`::selection`, route/dialog transitions, the browser tab, and every tint that is
currently a soft alpha wash rather than a dither.**

## Principles (unchanged, restated because they constrain every task)

- `steps()` only. Any `ease` reads as a modern UI in a costume.
- Everything motion-bearing sits inside `@media (prefers-reduced-motion: no-preference)`.
- No new dependency. All of it is CSS in `styles.ts` plus, at most, three small
  components.
- **No backticks anywhere in `styles.ts`** — it is one template literal and a
  stray backtick silently truncates the whole stylesheet. `styles.test.ts` guards
  the length and the balanced braces; keep it passing.
- State is never conveyed by pixel art or colour alone. Sprites stay `aria-hidden`.

## Where the flare comes from

Two references worth stealing from, both consistent with the constraints above:

- **NES.css** — the canonical component vocabulary for this look: dialogue
  balloons, chunky progress bars, menu cursors. Pure CSS, no JS.
  <https://nostalgic-css.github.io/NES.css/>
- **Codrops, "Building a Nostalgic 8-bit Universe"** — the one technique in it we
  can afford is the **pixel-mask transition**: a 4×4 Bayer dither matrix wiping a
  scene in instead of a fade. The rest (WebGL tearing, GSAP sprite scrubbing,
  synthesised audio) buys a fraction of the effect for a hundred times the code.
  <https://tympanus.net/codrops/2025/12/23/building-a-nostalgic-8-bit-universe-with-modern-tech-a-vibe-coding-journey/>

The through-line of both: **an 8-bit interface is one that shows its grid.** Soft
alpha, blurred shadows and smooth interpolation are the three tells, and this
codebase still has all three in the places nobody has looked yet.

---

## The fantasy layer

8-bit is a *rendering* constraint; it is not a genre. The app has been drifting
toward one anyway and nobody wrote it down: the mark is `hades.png`, the pending
sprite is a `TEMPLE`, `APPROVED` is a `SCROLL`, and the built-in template header
art is a Greek meander under a stepped pediment (`styles.ts:265`). That is a
genre, and it is a good one.

**The decision: NES-era fantasy, in the Greek-myth register.** Not swords and
dragons — oracles, temples, laurels and the underworld. It costs nothing extra
because half of it is already drawn, and it stays coherent with the header images
already in `packages/app/src/branding/template-headers/`. A generic fantasy pass
would fight that art; this one finishes it.

The NES-RPG conventions worth taking, and where each lands:

| Convention | Where it goes here |
|---|---|
| The **command window** — solid fill, double light frame, sharp inner corner | Dialogs, menus, the colour picker (task F1) |
| The **menu cursor** `▶` selecting a row, never a hover wash | Tier 1 task 3, already planned — this is its motivation |
| The **blinking `▼`** meaning "there is more" | Tier 1 task 2, already planned |
| **Numbers beside every bar**, never a bar alone | Approval progress (task F3) |
| **Item iconography** carrying meaning at 16px | Request kinds and template categories (task F2) |
| **Dither wipe** on entering a menu or an encounter | Tier 1 task 6, already planned |

Three of the six were already on the list for other reasons. The fantasy layer
mostly renames what they are *for*, which is the sign it is the right genre
rather than a costume over a costume.

### F1. The command window

The Dragon Quest frame: a double line with a gap between, not a single border.
Free in CSS via stacked shadows — no image, no `border-image`, and it composes
with the rounding that just shipped:

```
box-shadow:
  0 0 0 2px hsl(var(--sc-card)),      /* the gap */
  0 0 0 4px hsl(var(--sc-fg) / .85),  /* the outer rule */
  var(--sc-shadow);                    /* the hard offset we already have */
```

Applied to the two dialog primitives (`[class*="bui-DialogInner"]`,
`.MuiDialog-paper`) and the scheme picker — the surfaces that are already
*windows* rather than *pages*. Not applied to cards: every surface double-framed
is a page of noise, and the distinction between "a panel of content" and "a window
demanding a decision" is worth keeping.

**Files:** `styles.ts`. **Verify:** computed `box-shadow` has three layers;
screenshot the unregister dialog and the picker.

### F2. An item vocabulary

Five new 16×16 sprites in the existing `sprites.ts` grid format, chosen so each
is legible at 16px as a silhouette — the real constraint, and the reason to stay
with objects rather than creatures:

| Sprite | Meaning | Used by |
|---|---|---|
| `AMPHORA` | stored data | database / Postgres templates |
| `KEY` | a secret | templates declaring `secrets.schema`, the `SecretField` |
| `LAUREL` | granted | `APPROVED` state, replacing the reused `SCROLL` |
| `HELM` | an owning team | owner chips in the catalog and on request cards |
| `TORCH` | something is running | `IN_PROGRESS`, beside the marching bar |

`SCROLL` is freed up for what it should always have meant: documentation.
`STATE_SPRITES` gains no new keys — `APPROVED` just points somewhere better.

**Files:** `sprites.ts`, `sprites.test.ts` (the run-merge assertions), wherever
`STATE_SPRITES` is consumed. **Verify:** render each at 16px and eyeball the
silhouette; the existing sprite tests cover the grid shape.

### F3. Numbers beside the bar

The NES-RPG rule — HP is always `23/40`, never a bare bar — is also the
accessible one, which makes it the cheapest win in this document. The approval
progress on a request detail is currently a segmented bar alone. Add the literal
count (`2/3 APPROVALS`) in pixel type beside it.

Same for the retention countdown where a request is close to expiring: show the
days, do not encode them in a colour.

**Files:** the request detail component, `styles.ts`.

### F4. More scenes in the built-in header art

The Greek header art is one scene, and the supplied-image machinery
(`templateHeaders.ts`) already cycles N images across cards. Give the *built-in*
fallback the same treatment: three CSS-drawn scenes — the existing temple
frieze, plus an oracle flame and an underworld gate — cycling by
`:nth-child(3n + i)` exactly as the supplied images do.

This only shows when no images are dropped in, so it is the first impression for
a fresh install and currently repeats identically down the whole grid.

**Files:** `styles.ts`. **Verify:** with the drop-in folder emptied, assert three
distinct `background-image` values across the template grid.

### F5. Optional: screen names, not state names

`REQUESTS` → `QUESTS`, `CREATE` → `SUMMON`, the catalog → `ATLAS`. Config-gated
(`app.branding.flavour: fantasy`), default **off**.

The boundary that makes this safe is the same one the exclusions below draw: a
label naming a *screen* is decoration, and a user who cannot find "Requests"
finds it one click later. A label naming a *state* is a record — `QUEST FAILED`
in an audit trail is a support ticket. Screens may be renamed; states may not.

**Files:** `CustomNav.tsx`, `app-config.yaml`, the branding docs.

---

## Tier 1 — the core six

Ranked by visible flare per line of code. Each is independently shippable and
independently revertible.

### 1. Loading is a loading screen

Backstage's `Progress` is MUI v4 `LinearProgress` (`node_modules/@backstage/
core-components/dist/components/Progress/Progress.esm.js:3`), so `.MuiLinearProgress-root`
and `-bar` reach every native page's loading state — catalog, scaffolder, search,
TechDocs. Today it is a smooth indeterminate sweep: the single most modern-looking
thing left in the app.

- Track: 2px border, card background, square-ish corners, `height: 12px`.
- Bar: the existing `sc-march` block pattern, `steps(8)`, so it advances in
  discrete cells rather than sliding.
- Kill `transition` on `.MuiLinearProgress-bar` — MUI animates `transform` with
  a cubic-bezier by default and it will fight the steps.

**Files:** `styles.ts`. **Verify:** throttle the network in Playwright, screenshot
the catalog mid-load, assert `animation-timing-function` contains `steps`.

### 2. Tooltips become dialogue boxes

Two primitives in play — canon (`[class*="bui-Tooltip"]`) and MUI v4
(`.MuiTooltip-tooltip`). Both currently render a soft grey rounded pill.

- Card background, 2px border, hard offset shadow, pixel type at 12px, `color`
  from `--sc-fg` (not white-on-grey).
- A blinking `▼` continue marker in the bottom-right via `::after`, `steps(1)`,
  1s — the RPG "press A" tell. `content: '▼' / ''` so it stays out of the
  accessible name, the same trick the title caret needed.
- No arrow/beak: MUI's is a rotated square with a blur, and restyling it costs
  more than dropping it.

**Files:** `styles.ts`. **Verify:** hover a sidebar item, assert computed border
width `2px` and a `steps` timing function on the marker.

### 3. Rows select like a menu

The sidebar already marks its active row with `▶`. Nothing else does, and tables
are where users actually spend time.

- `.sc-table tbody tr:hover`, `:focus-within`, and `.MuiTableRow-root:hover`: the
  accent row highlight plus a `▶` in a 12px gutter on the first cell.
- Reserve the gutter permanently (`padding-left`) so rows do not shift when the
  cursor appears — a 12px reflow on every hover is worse than no cursor at all.

**Files:** `styles.ts`. **Verify:** measure `td:first-child` padding with and
without hover; they must be equal.

### 4. Pixel scrollbars

`::-webkit-scrollbar` (Chrome/Edge/Safari — the browsers this platform targets),
with `scrollbar-color`/`scrollbar-width` as the Firefox fallback.

- 14px wide, no radius on the thumb, 2px border, muted track, accent thumb on
  hover. No buttons, no gradient.

**Files:** `styles.ts`. **Verify:** screenshot a scrolling table; assert the
thumb's computed `border-radius` is `0px`.

### 5. Dither instead of alpha

The authentic constraint: the NES had no alpha channel, so tints were
checkerboards. Every `hsl(var(--x) / .12)` wash in the stylesheet is a modern
shortcut wearing pixel clothes.

- Add one token, `--sc-dither`, a 2px `repeating-conic-gradient` checkerboard,
  and use it for: badge fills, table row hover, disabled surfaces, the success
  notice, and the `IN_PROGRESS` badge.
- Keep alpha where it is load-bearing for contrast (the header text outline,
  the CRT layer). Re-check every changed pair against 4.5:1 afterwards —
  a checkerboard at 50% coverage reads roughly half a step lighter than the
  equivalent alpha wash, and that is enough to fail a badge.

**Files:** `styles.ts`. **Verify:** compute contrast for each changed badge in
both light and dark, all six schemes. This is the one task with a real
regression risk; it gets its own commit.

### 6. Pixel-mask dialog transition

The Codrops technique, at CSS cost. A 4×4 Bayer dither as a `mask-image` on the
dialog surface (`[class*="bui-DialogInner"], .MuiDialog-paper` — the pair that
already got the rounded-corner fix), animated `mask-size` in 4 steps so the box
materialises cell by cell instead of fading.

- 160ms total. Longer and it stops feeling like a scene change and starts
  feeling like a wait.
- Reduced motion: no mask, instant.
- If `mask-image` proves too fragile across the two dialog primitives, fall back
  to a 3-frame `steps(3)` opacity+scale pop. Decide by measurement, not taste.

**Files:** `styles.ts`. **Verify:** open the unregister dialog, assert the
animation resolves to `steps`, and that reduced-motion emulation removes it.

---

## Tier 2 — the fun ones

Cheap, visible, and each one is a single self-contained commit. Ship after Tier 1
lands, or cherry-pick.

### 7. `PRESS START` on the sign-in gate

`Sign in to continue` becomes a blinking `PRESS START` above the button. The one
screen where game-flavoured copy costs nothing: no task is in flight, no state is
being communicated, and it is the first thing anyone sees. The button keeps its
literal label (`Sign in with Keycloak`) so the actionable text stays honest.

**Files:** `packages/app/src/modules/auth.tsx`, `styles.ts`.

### 8. The tab tells you something is running

The favicon is already canvas-generated per accent (`SchemeRoot.tsx`), so the
machinery exists. While any request is `IN_PROGRESS`, cycle the document title
prefix through a 4-frame block spinner (`▖▘▝▗`) on a 1s `steps` interval, and
draw a small accent pip on the favicon.

Stop cycling when the tab is hidden (`document.hidden`) — a title animating in a
background tab is a battery drain and a distraction, and browsers throttle the
timer unpredictably anyway.

**Files:** `SchemeRoot.tsx` (favicon pip), a ~25-line `tabActivity.ts`.

### 9. Empty states become arcade panels

The bobbing sprite is already there. Give it a frame: a 2px-bordered panel, a
pixel `NO DATA` heading, and a muted hint line telling the user what would fill
it. Currently the empty list is a bare sentence.

**Files:** `components.tsx`, `styles.ts`.

### 10. Konami code

`↑↑↓↓←→←→BA` flips the palette to a fixed NES-hardware six and sends one sprite
walking across the footer. Resets on reload, stored nowhere, announced nowhere.
~20 lines, zero surface area, and it is the kind of thing people show each other.

**Files:** a ~20-line `konami.ts`, wired in `SchemeRoot.tsx`.

---

## Explicitly not doing

- **Sound.** Needs assets, an autoplay-policy dance, and a persisted mute
  preference — and an internal platform that beeps in an open office gets muted
  once and resented forever.
- **XP, points, streaks, achievements, leaderboards.** The original design ruled
  these out and the reasoning holds: this app approves production changes. Turning
  approvals into a score changes what people optimise for.
- **Game copy on state.** `QUEST ACCEPTED` instead of `SUBMITTED` makes an audit
  log unreadable. `PRESS START` on a login screen is a joke; `QUEST FAILED` on a
  failed provision is a support ticket. Screen names are a different case and are
  handled, off by default, in F5.
- **Creature sprites.** Dragons, wyverns, slimes. A 16×16 creature that reads as
  a creature takes several attempts and carries no meaning about a request;
  objects say what they mean at a glance and are drawn once.
- **A second, non-Greek fantasy register.** Runes, wizard hats, medieval
  heraldry. Mixing two mythologies in one 16px grid reads as neither.
- **WebGL / canvas pixelation of the UI.** Enormous cost, and it fights text
  rendering and screen readers.
- **Chunky notched borders (9-slice).** Directly contradicts the rounding pass
  that just shipped at the user's request.

## Risks

| Risk | Mitigation |
|---|---|
| Dither drops badge contrast below 4.5:1 | Task 5 is its own commit; measure all six schemes × light/dark before merging |
| `.MuiLinearProgress-bar` transition fights `steps()` | Explicit `transition: none` |
| `mask-image` inconsistent across the two dialog primitives | Documented `steps(3)` pop fallback |
| A stray backtick truncates `styles.ts` | `styles.test.ts` asserts length, markers and balanced braces — it has caught this three times |
| The double frame (F1) plus the hard shadow reads as heavy | Windows only, never cards; if it still crowds, drop the outer rule to `.6` alpha before dropping the technique |
| Five new sprites are five chances to draw something illegible at 16px | Silhouette-first, objects only, no creatures; the existing `sprites.test.ts` grid assertions catch structural mistakes but not ugly ones — these get eyeballed at 16px, not 64px |
| Motion accumulates into noise | Every addition gated on `prefers-reduced-motion`; Tier 1 adds exactly one new ambient loop (the tooltip marker), the rest are hover- or state-triggered |

## Verification

Per task as noted above. Before the branch merges, one Playwright pass that:
loads home, catalog, `/create`, a request detail and the sign-in gate; asserts no
animation resolves to a non-`steps` timing function; re-runs with reduced motion
emulated and asserts the ambient loops are gone; and diffs screenshots against
the current branch so every visual change is one somebody chose.
