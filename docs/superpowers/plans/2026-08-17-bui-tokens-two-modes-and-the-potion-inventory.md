# Canon tokens, two modes, and the potion inventory — Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** seven work items, partitioned into four tasks over two waves.

1. Stop entity/group/user pages rendering vanilla Backstage (`--bui-*` mapping,
   suffix-tolerant Mui rules, the ownership-tile gradient, three small misses).
2. Shrink the create-template title **plate** — not the type.
3. Take the neon out of Greek's dark register.
4. Remove the owl from the quickstart tour.
5. Add the `dairy` and `obsidian` modes.
6. Make the potion box collapsible, with sparkles on the equipped bottle.
7. Give it an expand control that opens the inventory.

**Inputs (authoritative, already verified live — do not re-litigate):**
`~/.claude/jobs/38187c3c/tmp/findings/pages.md`,
`~/.claude/jobs/38187c3c/tmp/findings/modes.md`,
`~/.claude/jobs/38187c3c/tmp/findings/recon.md`.

---

## Decisions taken before coding

1. **`styles.ts` has exactly one owner per wave, and the waves are strictly
   serialised.** It is one template literal: a stray backtick truncates the whole
   sheet and a backslash before digits fails the app build while `tsc` stays
   silent. Two agents in it at once produce a conflict whose failure mode is
   invisible to the type checker. **Task A owns it in wave 1. Task F owns it in
   wave 2, starting from A's committed result. No other task may open it — nor
   `styles.test.ts`, which belongs to the same owner for the same reason.**
2. **`statusTokens.ts` belongs to Task D (the two new modes), outright.**
   Task C (Greek) does *not* touch it, because C's only colour change is
   `--sc-primary`, and `--sc-primary` has no `cell` mirror. The `cell` fields
   that *do* duplicate `greek.ts` (`success`/`warning`/`destructive`, recon §3)
   are therefore left alone — and C adds a **read-only** test in `greek.test.ts`
   that pins the pairing, so the coupling stops being invisible the next time
   somebody does want to move one.
3. **`SchemeRoot.tsx` belongs to Task D in wave 1 and Task F in wave 2.** D needs
   the `MODES` tuple and `SCHEMES`; F needs the `SchemePicker` component. They
   are the same file, so they cannot run concurrently — F depends on D. This is
   the reason there are two waves at all. (Deriving `MODES` from `BRAND_DEFS`
   would break the dependency, but it collapses `type Mode` to `string` and buys
   parallelism we do not need. Not doing it.)
4. **`MODE_CARDS` is all-or-nothing.** `brands.test.ts`, `foudre.test.ts` and
   `spiderverse.test.ts` all assert the emitted card equals the `MODE_CARDS`
   entry, and `contrast.test.ts` measures status ink against it. A half-updated
   state is red in four files. One agent, one commit.
5. **`greek.ts` and `greek.test.ts` are one task.** Items 3 and 4 both edit both
   files; splitting them guarantees a conflict for no gain.
6. **The collapse gets no transition at all.** The nav's `transition: width .16s
   ease` (`styles.ts:1080`) is a documented existing exception and must not be
   copied. Collapsing the picker is a *content swap* (render one child instead of
   eleven), not a width animation, so the correct amount of motion is none.
7. **The sparkle is decoration and nothing else.** Which potion is equipped is
   carried by `aria-pressed`, the button's `title`/`aria-label`, and the fact
   that the collapsed view shows exactly one bottle. With motion disabled the
   stars are still drawn — the *lit* frame is the static default, the Greek ember
   precedent (`greek.ts:275-289`). Nothing conveys state through motion.
8. **`PixelStar` is the sparkle.** `components.tsx:90-105`, already exported from
   the package index, already used as the six-star burst on the tour button
   (`styles.ts:966-980`). Same inline-SVG-`<rect>` technique as the bottles. No
   second technique is invented.
9. **`ease` on the new modes follows the `brands.ts` precedent, not
   `CLAUDE.md`.** `newform` and `discord` already ship `cubic-bezier`. This is a
   standing inconsistency (see Risks); the findings resolved it that way and the
   findings are authoritative here.

---

## Wave grouping

| Wave | Tasks (run concurrently) | Why they can share a wave |
|---|---|---|
| **1** | **A**, **C**, **D** | Disjoint file sets. A owns `styles.ts`/`styles.test.ts`/`theme.tsx`; C owns `greek.ts`/`greek.test.ts`; D owns `brands.ts`/`brands.test.ts`/`statusTokens.ts`/`SchemeRoot.tsx`/`SchemeRoot.test.ts`. |
| **2** | **F** | Needs `styles.ts` after A and `SchemeRoot.tsx` after D. |

Wave 2 does not start until every wave-1 task is committed and
`CI=true yarn test` is green on the merged result.

---

## Task list

### Task A — the vanilla chrome, and the title plate

**Depends on:** nothing. Runs concurrently with C and D.

**May edit ONLY:**
`backstage/plugins/platform-ui/src/styles.ts`,
`backstage/plugins/platform-ui/src/styles.test.ts`,
`backstage/plugins/platform-ui/src/theme.tsx`.

**It must not edit any other file** — in particular not `SchemeRoot.tsx`, not
`statusTokens.ts`, not `brands.ts`, not `greek.ts`, and not `routeClass.ts`
(F3's fix is explicitly *not* a new route entry).

- [ ] **Step 1 (F1 + F2): map the canon `--bui-*` tokens, on a selector that is
      alive in dark.** The block at `styles.ts:113-119` maps five of ~140 canon
      variables; everything else on an entity page is a Backstage hex. Replace
      the `:root {` opener with **exactly**:

      ```css
      :root,
      [data-theme-mode="light"],
      [data-theme-mode="dark"] {
      ```

      **Do not write a bare `:root`.** Canon declares its light set at
      `:root, [data-theme-mode='light']` and its dark set at
      `[data-theme-mode='dark']`, and the app puts `data-theme-mode` on
      `<body>`. Custom properties inherit, so `<body>`'s own declaration beats
      anything inherited from `<html>` — measured: `html --bui-bg-solid =
      hsl(14 88% 55%)` (ours) while `body --bui-bg-solid = #9cc9ff` (canon's).
      Our five existing overrides are dead in dark today.

      The canon token file is `node_modules/@backstage/ui/dist/css/styles.css`
      (light block from line 37, dark from line 229). **Read it and enumerate the
      names before writing** — the full list is there, and it is the only
      authority on which names exist.

      Map at minimum:

      | canon | ours |
      |---|---|
      | `--bui-bg-app` | `hsl(var(--sc-bg))` |
      | `--bui-bg-neutral-1` | `hsl(var(--sc-card))` |
      | `--bui-bg-neutral-2` | `hsl(var(--sc-muted))` |
      | `--bui-bg-neutral-3` | `hsl(var(--sc-accent))` |
      | `--bui-bg-neutral-4` | `hsl(var(--sc-border) / .35)` |
      | `--bui-bg-neutral-N-hover` / `-pressed` / `-disabled` | the same token at `/ .92`, `/ .85`, `/ .5` |
      | `--bui-fg-primary` | `hsl(var(--sc-fg))` |
      | `--bui-fg-secondary` | `hsl(var(--sc-muted-fg))` |
      | `--bui-fg-disabled` | `hsl(var(--sc-muted-fg) / .55)` |
      | `--bui-fg-link` | `hsl(var(--sc-primary))` (already there) |
      | `--bui-fg-solid`, `--bui-accent-fg` | `hsl(var(--sc-primary-fg))` |
      | `--bui-border-1` | `hsl(var(--sc-border))` |
      | `--bui-border-2` | `hsl(var(--sc-border) / .6)` |
      | `--bui-border-focus`, `--bui-ring` | `hsl(var(--sc-ring))` |
      | `--bui-accent-bg` (+`-hover`, `-disabled`) | `hsl(var(--sc-primary))` at `1` / `.9` / `.5` |
      | `--bui-shadow` | `var(--sc-shadow)` |
      | `--bui-radius-1`…`-3` | `var(--sc-radius-sm)` |
      | `--bui-radius-4`…`-6` | `var(--sc-radius)` |

      **`--bui-radius-full` stays untouched** — it is the pill and must remain
      9999px. **`--bui-bg-inherit` needs no entry**: canon already defines it as
      `var(--bui-bg-app)` at a plain `:root` (line ~611), so mapping `bg-app`
      carries it.

      The **status family is wholesale or not at all**. That means every member
      of `--bui-fg-positive|negative|warning`, `--bui-bg-success|danger|warning|
      info`, `--bui-border-success|danger|warning|info`, `--bui-fg-*-on-bg`, and
      the four `--bui-positive-*` / `--bui-negative-*` / `--bui-warning-*` /
      `--bui-announcement-*` ramps (`-bg`, `-bg-hover`, `-bg-disabled`,
      `-bg-subdued`, `-bg-subdued-hover`, `-bg-subdued-disabled`, `-border`,
      `-fg`, `-fg-disabled`, `-fg-subdued`, `-fg-subdued-disabled`). Source the
      inks from `--sc-on-success` / `--sc-on-warning` / `--sc-on-destructive`
      (already both-register-correct, `statusTokens.ts`) and the fills from
      `--sc-success` / `--sc-warning` / `--sc-destructive` at `/ .16`; `subdued`
      at `/ .10`; `announcement-*` from `--sc-primary`. **Map every member of a
      family or none of it** — a half-mapped family gives one themed badge beside
      one vanilla one, which reads as a bug rather than as a palette.

      **Skip `--bui-gray-1..11` unless a measured element resolves through one.**
      They are canon's raw neutral ramp; a mode-token ladder mapped onto them can
      invert in one register, and the audit did not name an element that needs
      them.

- [ ] **Step 2 (F3): make the global Mui rules suffix-tolerant.** Three routes
      (`/catalog-import`, `/docs/default/component/<name>`, the entity TechDocs
      tab) render under a nested `ThemeProvider`, so `@material-ui/styles`
      returns counter-suffixed class names (`MuiLink-root-190`). The counter is
      not stable across visits, so no numeric selector can ever work, and the
      route-scoped workaround reaches only one of the three — `routeClass.ts` has
      no `/docs` entry and the entity docs tab matches no prefix.

      Convert these **global** selectors to the `[class*="…"]` form:

      `MuiCard-root`, `MuiAccordion-root`, `MuiButton-root`,
      `MuiButton-containedPrimary`, `MuiButton-outlinedPrimary`,
      `MuiButton-textPrimary`, `MuiCardHeader-title`,
      `MuiOutlinedInput-notchedOutline`, `MuiSvgIcon-root`,
      `MuiIconButton-root`, `MuiTypography-h1`…`MuiTypography-h5`,
      `MuiToolbar-root`, `MuiDivider-root`, `MuiSlider-root`,
      `MuiSlider-colorPrimary`, `MuiLink-root`, `MuiTypography-colorPrimary`.

      Substring collisions are safe for all of the above —
      `MuiButtonBase-root` does **not** contain `MuiButton-root`, and
      `MuiCardHeader-root` does not contain `MuiCard-root`.

      **The two elevation classes are the exception and must not take the plain
      form.** `[class*="MuiPaper-elevation1"]` also matches
      `MuiPaper-elevation10` through `-19` (MUI v4 goes to 24), which would give
      menus and popovers the card treatment. Write them anchored instead:

      ```css
      .MuiPaper-elevation1, [class*="MuiPaper-elevation1-"],
      .MuiPaper-elevation2, [class*="MuiPaper-elevation2-"],
      ```

      The generator emits `${key}-${counter}`, so the trailing dash matches every
      suffixed spelling and nothing else.

      `MuiSlider-*`, `MuiToolbar-root` and `MuiDivider-root` currently have **no
      rule at all** — write them from tokens (`--sc-primary` for the slider rail
      and thumb, `--sc-card`/`--sc-fg` for the toolbar, `--sc-border` for the
      divider), then apply the substring form.

- [ ] **Step 3 (F3, second half): delete only the genuinely duplicating
      `.sc-route-import` rules.** The findings say "delete the block"; that is
      too broad and would go red. `styles.ts:1247-1290` — `MuiStepper-root`,
      `MuiStepLabel-label`, `MuiStepLabel-active`/`-completed`,
      `MuiStepIcon-root`/`-active`/`-completed`/`-text`, `MuiStepConnector-line`
      — has **no global counterpart**, and `styles.test.ts:264` and
      `styles.test.ts:293-303` pin two of them by name. **Keep every stepper
      rule.**

      Delete only those whose declarations are now carried by a suffix-tolerant
      global rule. Check each candidate against the global sheet first and keep
      (converted in place) any that has no counterpart:
      `MuiPaper-root`, `MuiTypography-h6`/`MuiFormLabel-root`/`MuiInputLabel-root`,
      `MuiTypography-body1`/`-body2`, `MuiLink-root`/`MuiTypography-colorPrimary`,
      `MuiOutlinedInput-root`, `MuiListItem-root`, `MuiLinearProgress-root`.

- [ ] **Step 4 (F4): the ownership tiles, in `theme.tsx`.** On
      `/catalog/default/group/*` and `/user/*` the loudest element is a hardcoded
      `linear-gradient(90deg, rgb(99,102,241), rgb(139,92,246))` — `PRIMARY` and
      `ACCENT` (`theme.tsx:23-25`) baked by `genPageTheme` at theme construction,
      in all modes and both registers. It is not reachable as a token.

      `pageTheme` entries are plain objects. Hand-write them instead of calling
      `genPageTheme`, keeping the existing `shape` SVG data URI per entry and
      replacing only the gradient:

      ```ts
      backgroundImage: `url("…the shape svg…"), linear-gradient(90deg, hsl(var(--sc-primary)), hsl(var(--sc-primary) / .65))`
      ```

      Same trick as `GRAPH_OVERRIDES` (`theme.tsx:79-102`) and `--sc-header-art`
      (`theme.tsx:131`). Take the shape URI from what `genPageTheme` currently
      produces rather than inventing one — call it once at module scope and reuse
      its `backgroundImage`'s `url(...)` half if that is shorter than transcribing.

- [ ] **Step 5 (F5): `.sc-graph-empty` fails AA in light — 2.96:1.**
      `styles.ts:447-449` colours it `--sc-muted-fg`, a *page* token, while
      `styles.ts:471` pins the canvas to `STARFIELD.bg`, which is deliberately
      dark in both registers. One line: use the node text colour the canvas
      already uses, `#e7e7ef` (`styles.ts:453`).

- [ ] **Step 6 (F6): our own graph controls render raw OS chrome.**
      `GraphFilters.tsx` / `GraphDirection.tsx` put a bare
      `<input type="checkbox">` inside `.sc-row` (native blue) and a bare
      `<select>` (native arrow). CSS only — do not edit those components:

      ```css
      .sc-row input[type="checkbox"] { accent-color: hsl(var(--sc-primary)); }
      ```

      Give the `<select>` the same treatment the sheet already gives inputs
      (token background, `--sc-border` rule, `--sc-radius`), scoped to `.sc-row`.

- [ ] **Step 7 (F7): `.MuiAvatar-root` has no rule.** `/settings`'s Profile card
      is MUI's default `#bdbdbd` circle. One rule: `--sc-accent` ground,
      `--sc-accent-fg` ink, `--sc-border-w` rule in `--sc-border`.

- [ ] **Step 8: shrink the create-template title PLATE.** `styles.ts:523-543`.
      **Do not touch `font-size` — `styles.test.ts:340-346` pins `22px` and the
      pin is correct.** Change `padding: 4px 8px` to `padding: 1px 6px`: the
      plate goes 34.39px → 28.4px (−17%) and the descender still has 2.24px of
      clearance inside the line box. `line-height: 1.2` stays; 1.05 is available
      if 28.4px is still too tall, and 1.0 is the true floor.

      Do **not** tidy the selector into a named class — it depends on
      `> .MuiBox-root:first-child > h4` because MUI drops its `makeStyles` name
      in production (`styles.ts:506-513`), and `styles.test.ts:349` fails on any
      production-discarded class name.

- [ ] **Step 9: tests, all in `styles.test.ts`.**
      - **New, and the most important one in this task:** the `--bui-*` block's
        selector list contains **both** `data-theme-mode` values. A dark-only
        failure is invisible in light, which is how the current one shipped.
        Match quote-agnostically (canon uses single quotes, we use double):
        `/\[data-theme-mode=.light.\][\s\S]{0,80}\[data-theme-mode=.dark.\]\s*\{/`.
      - **New:** no bare `.Mui` selector survives for any class in the Step-2
        list — e.g. `expect(SHADCN_CSS).not.toMatch(/(^|[\s,])\.MuiLink-root/m)`
        for each. The two elevation classes are exempt by construction.
      - **New:** `[class*="MuiPaper-elevation1"]` never appears without the
        trailing dash.
      - **New:** the `.sc-graph-empty` rule does not name `--sc-muted-fg`.
      - **New:** every `pageTheme` entry's `backgroundImage` contains
        `hsl(var(--sc-primary))` and no `#` literal (export `pageThemes` from
        `theme.tsx` the way `GRAPH_OVERRIDES` is exported, so the test can see
        it — the built theme is not introspectable).
      - **Update:** extend `makes the template name the card headline` to keep
        the `22px` assertion *and* add that the same block's vertical padding is
        at most 2px.
      - **Update:** `reaches the JSS-suffixed classes /catalog-import mounts` —
        its `not.toMatch(/\.sc-route-import\s+\.Mui/)` still holds; keep the
        `MuiStepIcon-root` assertion, since that rule survives Step 3.

- [ ] **Step 10: verify.**
      ```bash
      cd /Users/adelin/Projects/Platform/new-ui/backstage
      CI=true yarn test plugins/platform-ui/src/styles.test.ts
      CI=true yarn tsc
      ```

- [ ] **Step 11: commit.** Do not push.

---

### Task C — Greek's dark register, and the owl

**Depends on:** nothing. Runs concurrently with A and D.

**May edit ONLY:**
`backstage/plugins/platform-ui/src/greek.ts`,
`backstage/plugins/platform-ui/src/greek.test.ts`.

**It must not edit any other file** — in particular **not `statusTokens.ts`**
(Task D owns it), not `styles.ts`, not `SchemeRoot.tsx`, not `sprites.ts`
(`OWL` stays exported; only its two render sites go).

- [ ] **Step 1: take the neon out of the dark register.** The lever is
      `--sc-primary` / `--sc-ring` at `greek.ts:88` and `:91`, currently
      `14 88% 55%` — the only token in the register above 70% saturation that is
      read live through `var()` everywhere and baked nowhere.

      **Set both to `14 58% 55%`.**

      The hue does **not** move: 14 against the gold rule's 43 is a 29° gap, and
      `contrast.test.ts:210-244`'s hue-gap rule (which deliberately excludes
      greek) would start to matter if the ember walked toward the gold.

      **The lightness does not come down.** The recon note that "L must come DOWN
      alongside S" is about perceived brightness and is wrong as an instruction
      here: `--sc-primary-fg` is dark ink (`240 10% 8%`), so desaturating *raises*
      the ratio and dropping L takes it straight back through the floor.
      Measured with `contrast.test.ts`'s own maths:

      | value | vs `--sc-primary-fg` |
      |---|---|
      | `14 88% 55%` (today) | 5.43 |
      | **`14 58% 55%`** | **5.11** ✅ |
      | `14 62% 48%` | 4.13 ❌ |
      | `14 70% 50%` | 4.54 — no headroom |

      Anything at `L 55%` with `S ≥ 50` clears 5.0. If you pick a different
      value, re-run it through `contrast.test.ts`'s `srgbOf`/`luminanceOf`/`ratio`
      before writing it.

- [ ] **Step 2: change nothing else in the palette, and say why in the file.**
      - `BRONZE`/`GOLD` (`greek.ts:47-48`) are string literals baked into SVG
        data URIs — a data URI inherits neither `currentColor` nor `var()`. Six
        coordinated edits across `greek.ts:48,86,87,97` and
        `greek.test.ts:278,296` to move them, for a token that is the mode's
        identity. Not worth it.
      - `--sc-success` / `--sc-warning` / `--sc-destructive` stay. They are
        duplicated as the `cell` fields in `statusTokens.ts:106,113,120` and
        nothing enforces the pair; moving one side silently invalidates every AA
        claim `contrast.test.ts` makes. Step 4 adds the missing enforcement
        instead.
      - The ember's `drop-shadow` alpha stays. It applies in **both** registers
        (`:root.sc-greek`, not `.sc-dark`), so calming it for dark would flatten
        light too. It follows `--sc-primary` through `var()` and therefore calms
        itself as a consequence of Step 1.
      - The ember's static filter (`greek.ts:278`) and its `0%, 100%` keyframe
        (`greek.ts:282`) must stay **byte-identical**; `greek.test.ts:164-188`
        asserts it. Since neither changes in this task, nothing to do — but do
        not "tidy" one of them.

- [ ] **Step 3: remove the owl.** Delete `greek.ts:248-258` (both the light
      `.sc-qs-box` rule and its `.sc-dark` override) and drop `OWL` from the
      import at `greek.ts:31`. Those two rules are the *only* thing in the
      codebase that paints it: it is not in `STATE_SPRITES`, not in the favicon
      path, not in `components.tsx`, not exported from `index.ts`, and
      `styles.ts` has zero owl references (its own `.sc-qs-box` rules at 879-889,
      891, 896, 905-907 and 1477 set colour, border, shadow and caret only).

      Then delete `OWL` from the ornament list at `greek.test.ts:275` and from
      that file's import at `greek.test.ts:7`. Without that,
      `greek.test.ts:267-285` ("renders every ornament it defines, none left
      unused") fails — it asserts `greekCss()` contains
      `spriteDataUri(OWL, 'hsl(40 55% 46%)')` or the dark equivalent.

      Leave `sprites.ts:578-596` alone: `export const OWL` costs nothing, the
      bundler strips an unreferenced export, and `sprites.test.ts` never imports
      it.

- [ ] **Step 4: add the missing coupling test to `greek.test.ts`.** Import
      `GREEK_STATUS_TOKENS` from `./statusTokens` (read-only — do not edit that
      file) and assert that `greekCss()`'s `--sc-success`, `--sc-warning` and
      `--sc-destructive` equal the `cell` values of `on-success`, `on-warning`
      and `on-destructive`. This is the tripwire recon §3 says does not exist:
      desaturate one side only, and `contrast.test.ts` keeps measuring the old
      cell while the AA claim quietly becomes false on screen.

- [ ] **Step 5: verify.**
      ```bash
      cd /Users/adelin/Projects/Platform/new-ui/backstage
      CI=true yarn test plugins/platform-ui/src/greek.test.ts
      CI=true yarn test plugins/platform-ui/src/contrast.test.ts
      ```
      `contrast.test.ts:182-208` re-measures the six greek pairs in both
      registers automatically; `primary-fg` on `primary` is the tight one and
      must land at 5.11.

- [ ] **Step 6: commit.** Do not push.

---

### Task D — `dairy` and `obsidian`

**Depends on:** nothing. Runs concurrently with A and C.

**May edit ONLY:**
`backstage/plugins/platform-ui/src/brands.ts`,
`backstage/plugins/platform-ui/src/brands.test.ts`,
`backstage/plugins/platform-ui/src/statusTokens.ts`,
`backstage/plugins/platform-ui/src/SchemeRoot.tsx`,
`backstage/plugins/platform-ui/src/SchemeRoot.test.ts`.

**It must not edit any other file** — not `styles.ts` (`brandsCss()` is already
interpolated at `styles.ts:84`), not `contrast.test.ts` (it derives its registers
from `BRAND_DEFS` and `MODE_TOKENS`/`MODE_CARDS`, so it picks both modes up with
no edit), not `greek.ts`, not `SchemePicker.test.tsx`.

**Every colour below is copied verbatim from `modes.md`. Do not re-derive,
round, or "tidy" a value.**

- [ ] **Step 1: add two rows to `BRAND_DEFS` (`brands.ts:56-165`).**

      **`dairy` / "Family Dairy"** — bottle `166 93% 19%`, bottleFg `0 0% 100%`
      (7.83).

      ```
      light: bg 172 22% 97%   fg 0 0% 20%       card 0 0% 100%
             muted 179 40% 92%  mutedFg 172 16% 30%
             border 172 10% 44%  primary 166 93% 19%  primaryFg 0 0% 100%
             accent 48 87% 84%   accentFg 170 25% 14%
      dark:  bg 168 42% 4%    fg 48 40% 96%     card 168 30% 7%
             muted 168 20% 18%  mutedFg 172 14% 74%
             border 172 10% 44%  primary 179 67% 60%  primaryFg 168 45% 7%
             accent 168 24% 15%  accentFg 48 40% 96%
      radius: base 12px / card 16px / button 20px
      borderW: 2px      glow: (none)
      ease: cubic-bezier(.4, 0, .2, 1)
      ```

      Two comments are **load-bearing** and must go on the row:
      - `card` dark is **7%, not 10%**. At `168 30% 10%` all four status tokens
        fail the dithered-badge case (4.34-4.48 against 4.5). At 7% the worst
        case is 4.80. Do not lighten it without re-running the status-cell check.
      - `border 172 10% 44%` sits 6° from `primary 166 93% 19%`, which is allowed
        **only** by the `borderS <= 25` escape leg in `contrast.test.ts`'s
        "dark rules". The site's real border is 2px full-saturation forest and
        would fail that test outright.

      **`obsidian` / "Obsidian"** — bottle `25 50% 60%`, bottleFg `240 20% 5%`
      (6.90).

      ```
      light: bg 240 10% 97%   fg 240 10% 8%     card 0 0% 100%
             muted 240 9% 93%   mutedFg 240 6% 34%
             border 235 8% 45%   primary 25 60% 33%  primaryFg 0 0% 100%
             accent 38 60% 91%   accentFg 25 45% 16%
      dark:  bg 240 20% 3%    fg 0 0% 100%      card 228 12% 8%
             muted 240 5% 16%   mutedFg 230 9% 66%
             border 230 8% 42%   primary 25 50% 62%  primaryFg 240 20% 5%
             accent 28 18% 15%   accentFg 38 45% 92%
      radius: base 12px / card 12px / button 9999px
      borderW: 1px
      glow: 0 0 0 1px hsl(0 0% 100% / .12), 0 0 40px hsl(25 60% 45% / .18)
      ease: cubic-bezier(.4, 0, .2, 1)
      ```

      Also load-bearing, and also comment-worthy:
      - `border 230 8% 42%` is **not** the site's `240 3.7% 15.9%`, which
        measures 2.58:1 on the card. 42% is the first step clearing 3:1. The site
        gets away with 16% by leaning on translucent hairlines over a
        photographic ground; a form-heavy app cannot.
      - `mutedFg 230 9% 66%` is from the `#9194a1` ramp, not the site's
        `--muted-foreground`, which is two points short on the muted surface.
      - Copper **fails a light button outright** (2.70 vs white). `25 60% 33%` is
        the required light darkening; the published `25 50% 60%` is kept for the
        bottle and marks.
      - The pill (`button: 9999px`) is the single most characteristic shape,
        42 elements.

- [ ] **Step 2: `statusTokens.ts`.** Add `'dairy'` and `'obsidian'` to
      `SchemeMode` (`:65-75`); add both to `MODE_TOKENS` (`:130-145`) pointing at
      `STATUS_TOKENS` — **neither mode redefines status hue**, Greek spends the
      design system's one exception; add both to `MODE_CARDS` (`:147-158`):

      ```ts
      dairy:    { light: '0 0% 100%',  dark: '168 30% 7%' },
      obsidian: { light: '0 0% 100%',  dark: '228 12% 8%' },
      ```

      `statusTokenCss()` needs **no** new block — both modes use the default
      tokens already emitted at `:root` and `:root.sc-dark`.

- [ ] **Step 3: `SchemeRoot.tsx`.** Add `'dairy'` and `'obsidian'` to the
      `MODES` tuple (`:67-78`). Nothing else: `SCHEMES` already spreads
      `...BRAND_DEFS.map(...)` at `:116-122`, so both bottles appear on the shelf
      the moment their rows exist.

- [ ] **Step 4: update the three tests that pin the shelf by hand.**
      - `SchemeRoot.test.ts:34` — the id array.
      - `SchemeRoot.test.ts:39` — the sorted mode array.
      - `SchemeRoot.test.ts:56` — the `ALL` class array.
      - `brands.test.ts:128` — **`expect(glowing.map(b => b.id)).toEqual(
        ['newform'])`** becomes `['newform', 'obsidian']`. The findings do not
        mention this and it is red the moment obsidian's `glow` lands.
      - `brands.test.ts:139` — **`expect(moving).toEqual(['newform',
        'discord'])`** becomes `['newform', 'discord', 'dairy', 'obsidian']`
        (order = `BRAND_DEFS` order; put the new rows at the end of the array to
        keep this readable).

      Everything else in `brands.test.ts` and all of `contrast.test.ts` iterate
      `BRAND_DEFS` / `MODE_TOKENS` and need no edit.

- [ ] **Step 5: verify.**
      ```bash
      cd /Users/adelin/Projects/Platform/new-ui/backstage
      CI=true yarn test plugins/platform-ui/src/brands.test.ts
      CI=true yarn test plugins/platform-ui/src/contrast.test.ts
      CI=true yarn test plugins/platform-ui/src/SchemeRoot.test.ts
      CI=true yarn test plugins/platform-ui/src/foudre.test.ts plugins/platform-ui/src/spiderverse.test.ts
      CI=true yarn tsc
      ```

- [ ] **Step 6: eyeball obsidian beside claude and greek.** `modes.md` flag 2 is
      explicit that this cannot be skipped: obsidian's copper is hue 25, claude's
      clay is 15, greek's ember is 10/14. Separation is supposed to come from the
      **neutrals** — claude on warm ivory/olive, greek on cream+purple, obsidian
      on cool blue-grey against near-pure-black. Run `yarn start` and switch
      between the three in both registers. **If obsidian still reads as a third
      bronze mode, the lever is the ground, not the accent**: push its greys
      further blue (hue 240, sat 14%). Moving the copper only walks it into
      greek's gold border at 40-43.

- [ ] **Step 7: commit.** Do not push.

---

### Task F — the collapsible potion box and its inventory

**Depends on:** Task A (owns `styles.ts` in wave 1) **and** Task D (owns
`SchemeRoot.tsx` in wave 1). Start only from their committed result.

**May edit ONLY:**
`backstage/plugins/platform-ui/src/SchemeRoot.tsx`,
`backstage/plugins/platform-ui/src/SchemePicker.test.tsx`,
`backstage/plugins/platform-ui/src/styles.ts`,
`backstage/plugins/platform-ui/src/styles.test.ts`.

**It must not edit any other file** — not `components.tsx` (`PixelStar` is reused
as-is and is already exported from the package index), not `sprites.ts`, not
`CustomNav.tsx` (its collapse is the pattern to *copy*, not to change), and
**not `packages/app/src/modules/auth.tsx`**.

- [ ] **Step 1: add the `collapsed` state, floating-only.** In `SchemePicker`
      (`SchemeRoot.tsx:385`), copy the sidebar's proven shape —
      `CustomNav.tsx:69-73` for the lazy read and `:87-102` for the persisting
      effect:

      ```ts
      const [collapsed, setCollapsed] = useState(
        () =>
          typeof localStorage !== 'undefined' &&
          localStorage.getItem('platform-picker-collapsed') === '1',
      );
      useEffect(() => {
        if (!floating) return;
        try {
          localStorage.setItem('platform-picker-collapsed', collapsed ? '1' : '0');
        } catch { /* ignore */ }
      }, [floating, collapsed]);
      ```

      **The default is expanded (`false`).** The shelf is what exists today, and
      `SchemePicker.test.tsx:57-65` reads `potions(container)[1]` on a freshly
      rendered floating picker. Defaulting to collapsed would make that test's
      premise false for no user benefit. (If a reviewer wants collapsed-by-
      default later, it is one comparison plus one test update.)

      Unlike the nav, **no `document.documentElement.dataset` flag is needed**:
      the collapse is entirely inside this component's own subtree, so a class on
      its root div is enough. Do not add a fourth root-level data attribute.

- [ ] **Step 2: render the two states without changing the DOM contract.**
      `SchemePicker.test.tsx` queries `.sc-picker` / `.sc-picker-float` on the
      container and `.sc-potion` as a flat `querySelectorAll`. `SchemeRoot.test.ts:30`
      pins one potion per design system. So:

      - The root stays the same `<div className="sc sc-picker …">` with the same
        pointer handlers and the same `role="group"`. Add
        `${collapsed && floating ? ' sc-picker-collapsed' : ''}` to its class.
      - **Do not wrap the buttons in a new element.** Keep `.sc-potion` buttons
        as direct children in both states.
      - Collapsed **and** floating: render only the entry whose `id === scheme`
        (fall back to `SCHEMES[0]` if the persisted id no longer exists, the same
        rule `applyScheme` uses at `SchemeRoot.tsx:322-323`), plus its sparkles.
      - Expanded, or not floating: render all of `SCHEMES`, exactly as today.

- [ ] **Step 3: the expand control.** A single `<button type="button"
      className="sc-picker-toggle">`, rendered **only when `floating`** — guard
      it the same way the drag is guarded at `SchemeRoot.tsx:478`, because
      `packages/app/src/modules/auth.tsx:154` mounts a second, non-floating
      picker inside the sign-in card and neither the collapse nor the expand
      control may appear there.

      ```tsx
      {floating && (
        <button
          type="button"
          className="sc-picker-toggle"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Show all potions' : 'Hide potions'}
          title={collapsed ? 'Show all potions' : 'Hide potions'}
          onClick={() => setCollapsed(c => !c)}
        >
          {collapsed ? '»' : '«'}
        </button>
      )}
      ```

      The expanded shelf **is** the inventory: every bottle is already a button
      whose click equips that potion (`onClick={() => setScheme(s.id)}`), already
      named by `aria-label`/`title`, and already marked by `aria-pressed`. That
      satisfies "an inventory of all equippable potions, each with an equip
      action" with no new component.

      *Deliberate simplification — mark it with a `ponytail:` comment.* If a
      reviewer wants a real inventory panel (a labelled row per potion with an
      explicit **Equip** button), it is a `.sc-picker-inv` popover rendered
      alongside — but it must keep the `.sc-potion` buttons queryable as flat
      descendants or `SchemePicker.test.tsx` goes red. Add it when someone asks,
      not before.

- [ ] **Step 4: the sparkles.** Inside the collapsed potion's button, after the
      `<PixelPotion>`, render:

      ```tsx
      <span className="sc-potion-stars" aria-hidden="true">
        {[0, 1, 2].map(i => (
          <PixelStar key={i} className={`sc-potion-star sc-potion-star-${i}`} />
        ))}
      </span>
      ```

      `PixelStar` is imported from `./components` — the same import line that
      already brings in `PixelPotion` (`SchemeRoot.tsx:12`). **Do not invent a
      second sparkle technique**; this is the same inline-SVG-`<rect>` path the
      bottles use, and the same one `.sc-tour-stars` already uses.

- [ ] **Step 5: the CSS, in `styles.ts`, in the picker section (~1150-1214).**

      - **The toggle reuses the nav's.** Add `.sc-picker-toggle` to the existing
        `.sc-nav-toggle` rule at `styles.ts:1094-1097` and to its `:hover`. That
        is the whole appearance; only placement is new (`align-self: center;
        margin-left: 4px;` — the shelf is `display: flex; align-items:
        flex-end`).
      - Collapsed shelf: `.sc-picker-collapsed { flex-wrap: nowrap; }` — the
        `max-width: calc(var(--sc-nav-w) - 16px)` cap at `styles.ts:1173` still
        applies and one bottle plus a 26px toggle fits inside the 68px rail.
      - Sparkles, modelled on `.sc-tour-star*` (`styles.ts:966-980`):

        ```css
        .sc-potion-stars { position: absolute; inset: -6px; pointer-events: none; }
        .sc-potion-star, .sc-potion-star * { color: hsl(var(--sc-primary)); }
        .sc-potion-star { position: absolute; width: 6px; height: 6px; opacity: 1; }
        .sc-potion-star-0 { top: -1px; left: -2px; }
        .sc-potion-star-1 { top: 30%; right: -3px; }
        .sc-potion-star-2 { bottom: 0; left: 20%; }
        ```

        `.sc-potion` needs `position: relative` added to its rule at
        `styles.ts:1198-1200` for the absolute children to anchor.
        **`opacity: 1` is the static default** — the lit frame, per the Greek
        ember precedent. Motion may only take it *away* and put it back.
      - The twinkle, and only inside the reduced-motion guard, using `steps()`
        — the precedent is `.sc-picker-float[data-dragging] .sc-potion svg` at
        `styles.ts:1429-1432`, which staggers by `--sc-i`:

        ```css
        @keyframes sc-sparkle { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }
        /* inside @media (prefers-reduced-motion: no-preference) */
        .sc-picker-collapsed .sc-potion-star {
          animation: sc-sparkle 1.2s steps(2) infinite;
          animation-delay: calc(var(--sc-i, 0) * .3s);
        }
        ```

        Set `style={{ ['--sc-i']: i }}` on each star, the same way the shelf
        already staggers the rattle (`SchemeRoot.tsx:594`).
        **`steps()`, never `ease`. No transition on the collapse itself** — the
        nav's `transition: width .16s ease` at `styles.ts:1080` is a documented
        existing exception and is not to be copied.

- [ ] **Step 6: tests.**
      - `SchemePicker.test.tsx`, **new:** a floating picker renders every potion
        by default; clicking `.sc-picker-toggle` leaves exactly one; the survivor
        carries `aria-pressed="true"`; `localStorage['platform-picker-collapsed']`
        is `'1'`; a re-render reads it back and starts collapsed.
      - `SchemePicker.test.tsx`, **new:** the non-floating instance renders **no**
        `.sc-picker-toggle` — this is the `auth.tsx:154` guard, and the only
        thing standing between the sign-in card and a stray control.
      - `SchemePicker.test.tsx`, **new (the accessibility contract):** in the
        collapsed state the equipped potion is identifiable from `aria-pressed`
        and `aria-label` alone, and every `.sc-potion-star` carries
        `aria-hidden`. This is what makes the sparkle decorative rather than a
        state signal.
      - `SchemePicker.test.tsx`, **unchanged:** all six existing cases must still
        pass without edits. If one needs changing, the DOM contract was broken —
        fix the component, not the test.
      - `styles.test.ts`, **new:** `sc-sparkle` is declared inside the
        `prefers-reduced-motion: no-preference` block, uses `steps(`, and its
        `0%, 100%` frame is `opacity: 1` (the static default, not a frozen
        mid-cycle). The house already has this exact assertion shape in
        `greek.test.ts:167-188`.
      - `styles.test.ts`, **new:** no `transition` is declared on
        `.sc-picker-collapsed` or `.sc-picker-toggle`.

- [ ] **Step 7: verify.**
      ```bash
      cd /Users/adelin/Projects/Platform/new-ui/backstage
      CI=true yarn test plugins/platform-ui/src/SchemePicker.test.tsx
      CI=true yarn test plugins/platform-ui/src/styles.test.ts
      CI=true yarn workspace @internal/plugin-platform-ui test
      ```

- [ ] **Step 8: eyeball it.** `yarn start`, then: collapse and expand at the
      default nav width, at 180px, and collapsed (68px); drag the shelf away from
      the corner and confirm the toggle still works when
      `data-picker-moved='true'` drops the `max-width` cap; sign out and confirm
      the card's picker has no toggle; toggle **Reduce motion** in the OS and
      confirm the stars are still drawn and the equipped bottle is still obvious.

- [ ] **Step 9: commit.** Do not push.

---

### Closing (after wave 2)

- [ ] **Full CI, in order:**
      ```bash
      cd /Users/adelin/Projects/Platform/new-ui/backstage
      CI=true yarn tsc && CI=true yarn lint:all && CI=true yarn test && CI=true yarn build:all
      ```
      `CI=true` is required on every `yarn test` — `backstage-cli` otherwise
      enters watch mode and never returns.
- [ ] **`bash scripts/prod-image-up.sh`** and re-check the three suffixed routes
      (`/catalog-import`, `/docs/default/component/<name>`, an entity's Docs tab)
      in the **production** image. The suffix trap only exists there and on
      nested-theme routes; a dev-server check proves nothing about it.
- [ ] **Do not push to remote.**

---

## Risks, and where I disagree with the findings

**1. F3 cannot be a wholesale delete, and the plan says so.** The findings say
"DELETE the `.sc-route-import` duplicate block." Roughly half of it —
`MuiStepper-root`, `MuiStepLabel-*`, `MuiStepIcon-*`, `MuiStepConnector-line` —
has **no global counterpart at all**, and `styles.test.ts:264` and `:293-303`
pin two of those rules by name. Deleting the block as written is an immediate
red build plus an unstyled stepper. Task A Step 3 scopes the deletion to the
rules that genuinely duplicate a now-suffix-tolerant global.

**2. The elevation substring is a new bug the findings would have shipped.**
`[class*="MuiPaper-elevation1"]` matches `MuiPaper-elevation10` … `-19` as well.
MUI v4 defines up to 24, and elevation 8 is the default menu Paper. The findings'
selector list includes both elevation classes with no note. The anchored form
`[class*="MuiPaper-elevation1-"]` is the fix and is spelled out in Step 2.

**3. F2's mechanism is stronger than the findings claim, and that is good news.**
Canon ships its tokens inside `@layer tokens` (`styles.css:35`), and an unlayered
author declaration beats *any* layered one regardless of specificity or order —
so our sheet does not depend on being injected last. The finding's *diagnosis* is
still exactly right, though, and the fix is unchanged: the real contest is not
cascade at all, it is **inheritance versus an own declaration** on `<body>`, and
an element's own declaration always wins. Which is why the selector must name
both `data-theme-mode` values.

**4. The recon's Greek lightness advice is wrong as an instruction.** "Dropping S
at fixed L=55% RAISES luminance, so L must come DOWN alongside S" is true about
brightness and false about the constraint: `--sc-primary-fg` is *dark* ink, so
raising luminance raises the ratio, and following the advice literally lands at
`14 62% 48% = 4.13`, an AA failure. Measured grid is in Task C Step 1.
`14 58% 55%` = 5.11 is the recommendation.

**5. `brands.test.ts` pins two id arrays by hand and the findings never mention
them.** `glowing.map(b => b.id)` must equal `['newform']` and `moving` must equal
`['newform','discord']`. Obsidian has both a glow and an ease, so both go red the
instant its row lands. Called out in Task D Step 4 — but it is exactly the kind
of thing that reads as a mysterious failure at the end of a long task.

**6. `steps()` versus `cubic-bezier`, unresolved.** `CLAUDE.md` says *all*
animation uses `steps()`, never `ease`. `brands.ts` already ships `cubic-bezier`
on `newform` and `discord`; this plan adds two more rows and deepens the
inconsistency. `modes.md` flag 5 notes obsidian's 75ms colour transition is short
enough that `steps(3)` is indistinguishable. **My view: the doc should either be
amended to permit a mode to own its curve, or the four rows should all move to
`steps()`.** Do not settle it inside Task D — that would put a fifth concern in
an already load-bearing task. Raise it, ship the rows following the existing
precedent, and settle it in its own change.

**7. Obsidian's durations are lost.** `modes.md` says the *durations* (75-200ms)
are what separate obsidian from discord, which shares its exact curve — but
`brands.ts` hardcodes `.18s` in `brandsCss()`. As written, the two modes animate
identically. An optional `dur?: string` field defaulting to `.18s` is three
lines; I left it out because it interacts with risk 6 and because nobody will see
it until risk 6 is settled. Add it then.

**8. The `--bui-*` status family is the largest silent-failure surface in the
plan.** Around 45 names across four ramps, wholesale-or-nothing, and a
half-mapped family shows one themed badge beside one vanilla one on the same
card. The canon file is right there in `node_modules` — enumerate, do not guess.

**9. Mapping `--bui-radius-*` changes shape in every mode at once.** It is the
right call (a canon card with an 8px corner beside our 12px one is exactly the
"vanilla" complaint), but it is the change most likely to look wrong somewhere
unexpected. `--bui-radius-full` must stay 9999px or every canon pill becomes a
rounded rectangle.

**10. The picker's DOM contract is more fragile than it looks.** Six tests query
`.sc-picker`, `.sc-picker-float` and a flat `.sc-potion` list, and
`SchemeRoot.test.ts:30` pins one potion per design system. The collapse is
implemented as a *conditional list length*, not a wrapper, specifically so none
of them has to change. If Task F finds itself editing an existing
`SchemePicker.test.tsx` case, that is the signal it broke the contract.

**11. Two modes land on the shelf in the same change that reworks the shelf.**
Eleven bottles is where the 224px two-row box starts to fold to three rows —
which is an argument *for* the collapse, but it means wave 2's eyeball pass is
the first time anyone sees the real thing. Do it at 180px nav width, not just at
the default.
