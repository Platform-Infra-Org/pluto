# /visualizer, /catalog-import, and the dark rebalance — Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal (two, unrelated):**

1. `/visualizer` and `/catalog-import` render vanilla Backstage instead of the
   picked potion. Both have a single root cause each, and neither is the one
   originally reported.
2. Every dark register reads as one colour. The cause is `border` sharing hue
   **and** saturation with `primary` — not a contrast failure. All ten registers
   already clear the numeric bar.

---

## The two root causes, stated once

**`/catalog-import` mounts its own JSS class-name generator.** Measured on a
production build: 83 of 90 MUI classes on that route arrive counter-suffixed
(`MuiStepLabel-label-234`, `MuiBox-root-27`), against 0 of ~90 on `/catalog`,
`/create` and `/visualizer`. A CSS class selector matches **whole tokens**, so
`.MuiStepLabel-label` cannot match `class="MuiStepLabel-label-234"`. Every
`.Mui*` rule in `styles.ts` misses on this one route. That is the stepper, the
Papers, the Typography and the indigo links — one bug, one fix.

Ruled out already, do not re-investigate: no duplicate `@material-ui/core`
(single 4.12.4), no duplicate `@material-ui/styles`, no app-level
`StylesProvider`/`generateClassName`. The *why* does not change the fix.

**The earlier proposal to rename `Mui-active` → `MuiStepIcon-active` is wrong
and must not be applied.** `styles.ts:1518-1521` already carries the correct v4
spelling with `!important` and still misses, because of the suffix.

**`/visualizer`'s tree bypasses the theme overrides.** The four
`BackstageDependencyGraph*` keys in `theme.tsx` are correct and live — edges
measurably follow the mode. The plugin passes its own `renderNode`, which
hardcodes `#90caf9` / `#9e9e9e` / `#2196f3` / `#757575` / `#000000` as React
props on `"rect"` and `"text"`. Those land as **SVG presentation attributes**,
which sit at the bottom of the cascade at specificity 0 — a plain author rule
beats them with no `!important`. Node kind is distinguishable without a class:
`rx="0"` is an extension node, `rx="20"` is a group.

---

## Decisions taken before coding

1. **`styles.ts` has exactly one owner in this plan — Task A.** It is one
   template literal; two agents editing it produce a conflict whose failure mode
   is a truncated stylesheet that `tsc` does not notice. All three CSS changes
   (import route, `bui-PluginHeader`, visualizer tree) are therefore one task,
   serialised inside that task. `styles.test.ts` belongs to the same owner for
   the same reason. **No other task may open either file.**
2. **The dark rebalance has exactly one owner too — Task B.** `brands.ts`,
   `foudre.ts` and `spiderverse.ts` each carry a `--sc-card` that
   `statusTokens.ts`'s `MODE_CARDS` mirrors, and `brands.test.ts`,
   `foudre.test.ts` and `spiderverse.test.ts` all assert the two agree. Splitting
   the three palette files across agents leaves every intermediate state red and
   nothing able to verify itself. One agent, four source files, one test file.
3. **A substring selector is a strict superset of the exact one it replaces.**
   `[class*="MuiStepIcon-root"]` matches `MuiStepIcon-root` and
   `MuiStepIcon-root-238`. So inside `.sc-route-import` the exact-class rules are
   *rewritten in place*, not duplicated — a route-scoped rule covers no other
   route, so keeping both spellings there would be 60 dead lines. The **global**
   rules at `styles.ts:1518-1523` are a different matter: they are not
   route-scoped, they do cover other routes, and `styles.test.ts` pins them.
   They stay untouched.
4. **The visualizer rules are scoped by `#dependency-graph`, not a route class.**
   That id is `DEPENDENCY_GRAPH_SVG` in `@backstage/core-components` and is the
   only element in this app that carries it — our catalog graph and relations
   graph are React Flow (`.react-flow__node`), which a `rect[rx="0"]` selector
   cannot reach. No entry is added to `routeClass.ts`; nothing would use it.
5. **The Detailed tab's chips keep their hues.** `getOutputColor` assigns a
   distinct hue per output type and computes its own text contrast. That is
   categorical data encoding — the same category as the documented "status
   colours deliberately ignore the picked scheme". Flattening them to one token
   destroys the legend. Theme the chrome, leave the hues, and say so in a
   comment so the next reader does not "fix" it.
6. **The dark values are copied verbatim, not re-derived.** They were verified
   independently: 0 failures across all ten modes, `border/card` ≥ 3 everywhere,
   and **worst composited status ink at 4.54 against a 4.5 bar — a 0.04 margin.**
   Every `card` lightness is load-bearing: the status dither cell composites over
   `card`, so raising one drops the ink below AA. These values were already
   pulled back 2-3 points for exactly that reason.

---

## Task list

### Task A — the two vanilla pages (`styles.ts`)

**Depends on:** nothing. Runs concurrently with Task B.

**May edit ONLY:**
`backstage/plugins/platform-ui/src/styles.ts`,
`backstage/plugins/platform-ui/src/styles.test.ts`.
**It must not edit any other file** — in particular not `theme.tsx`
(`GRAPH_OVERRIDES` is measured correct and live), not `routeClass.ts`, and not
any palette file.

- [ ] **Step 1: Make the `/catalog-import` rules suffix-proof.** In the
      `===== Register an existing component =====` section (`styles.ts` ~1122-1184),
      rewrite every `.sc-route-import .MuiX` selector into
      `.sc-route-import [class*="MuiX"]`. Declarations are unchanged. The full
      selector list to convert:

      MuiStepper-root, MuiStepLabel-label, MuiStepIcon-root, MuiStepIcon-text,
      MuiStepConnector-line, MuiPaper-root, MuiTypography-h6, MuiFormLabel-root,
      MuiInputLabel-root, MuiTypography-body1, MuiTypography-body2,
      MuiOutlinedInput-root, MuiListItem-root, MuiLinearProgress-root.

      Two selectors change shape rather than just spelling, because
      `.MuiStepLabel-label.Mui-active` is a compound of two classes and the
      suffix breaks both halves:

      ```css
      .sc-route-import [class*="MuiStepLabel-active"],
      .sc-route-import [class*="MuiStepLabel-completed"] {
        color: hsl(var(--sc-fg)) !important;
        font-weight: 600 !important;
      }
      .sc-route-import [class*="MuiStepIcon-active"],
      .sc-route-import [class*="MuiStepIcon-completed"] {
        color: hsl(var(--sc-primary)) !important;
        border-color: hsl(var(--sc-primary));
      }
      ```

- [ ] **Step 2: Add the missing link rule to the same block.** The indigo links
      are the same bug: the global rule at `styles.ts:325` names
      `.MuiLink-root` exactly and misses here.

      ```css
      .sc-route-import [class*="MuiLink-root"],
      .sc-route-import [class*="MuiTypography-colorPrimary"] {
        color: hsl(var(--sc-primary)) !important;
      }
      ```

- [ ] **Step 3: Replace the section's header comment** so the next reader gets
      the census rather than the symptom. State: this route mounts its own JSS
      counter; 83 of 90 MUI classes arrive suffixed against 0 of ~90 on
      `/catalog`; a class selector matches whole tokens; substring form matches
      both spellings so it is correct in dev and in the image; the exact-class
      rules were replaced rather than duplicated because a route-scoped rule
      covers no other route. Do not use a backtick anywhere in it.

- [ ] **Step 4: Theme the bui plugin header.** Measured on the production build:
      `background-color: rgb(255,255,255)`, `color: rgb(0,0,0)`, while greek's
      `--sc-card` is `42 45% 98%`. `bui-*` survives production and zero rules
      exist for it. This affects all ten potions, so it is app-wide, not
      route-scoped. Put it beside the `[class*="bui-HeaderTitle"]` rule
      (`styles.ts` ~235):

      ```css
      /* The one bui surface with no rule here: PluginHeader ships its own white
         ground and black ink, measured rgb(255,255,255) on a production build
         while the mode's card was 42 45% 98%. Every potion is affected. */
      [class*="bui-PluginHeader"] {
        background: hsl(var(--sc-card)) !important;
        color: hsl(var(--sc-fg)) !important;
        border-bottom: var(--sc-border-w) solid hsl(var(--sc-border));
      }
      ```

- [ ] **Step 5: Recolour the visualizer tree.** At `styles.ts:341`, replace the
      single `#dependency-graph` rule with:

      ```css
      /* The tree the visualizer draws is NOT the DependencyGraph default node:
         the plugin passes its own renderNode, which bypasses the four
         BackstageDependencyGraph* overrides in theme.tsx and hardcodes #90caf9,
         #9e9e9e, #2196f3, #757575 and #000000. They are React props on "rect"
         and "text", so they render as SVG presentation attributes — bottom of
         the cascade, specificity 0 — and a plain author rule beats them without
         !important. The plugin distinguishes its two node kinds only by corner
         radius (rx=0 an extension node, rx=20 a group), so that is what these
         read. Scoped by the svg's own id, DEPENDENCY_GRAPH_SVG in
         core-components: nothing else in this app carries it, and our three
         graphs are React Flow. */
      #dependency-graph {
        background-color: hsl(var(--sc-bg));
        border-radius: var(--sc-radius);
      }
      #dependency-graph rect[rx="0"] {
        fill: hsl(var(--sc-card));
        stroke: hsl(var(--sc-border));
      }
      #dependency-graph rect[rx="20"] {
        fill: hsl(var(--sc-muted));
        stroke: hsl(var(--sc-border));
      }
      /* The label is the rect's next sibling inside the node's own g, so this
         cannot reach an edge label, which theme.tsx already owns. */
      #dependency-graph rect + text { fill: hsl(var(--sc-card-fg)); }
      ```

      Note the canvas changes from the hardcoded `#05050c` to `hsl(var(--sc-bg))`.
      That is deliberate: with the nodes now on `--sc-card`, a fixed near-black
      canvas is the last thing on the page not following the potion, and in light
      mode it reads as broken. The starfield stays where it was designed to live —
      the React Flow catalog graph (`.sc-graph-canvas`), which is untouched and
      still the only consumer of `STARFIELD.bg` that `styles.test.ts` pins.

- [ ] **Step 6: Record why the Detailed tab keeps its hues.** One comment beside
      the visualizer rules: `getOutputColor` assigns a distinct hue per output
      type (`#4caf50` reactElement, `#ffeb3b` routePath, `#9c27b0` routeRef,
      `#2196f3` apiFactory, plus a rotating palette) and computes its own text
      contrast. It is categorical data encoding, the same exception the
      experience bar's status colours take. Do not add rules for it.

- [ ] **Step 7: Tests, in `styles.test.ts`.** Three new cases:

      1. *reaches the JSS-suffixed classes /catalog-import mounts* —
         `expect(SHADCN_CSS).not.toMatch(/\.sc-route-import\s+\.Mui/)` (no exact
         class survives inside the route block) **and**
         `expect(SHADCN_CSS).toContain('.sc-route-import [class*="MuiStepIcon-root"]')`.
         Comment it with the 83-of-90 census — the regex is meaningless without it.
      2. *themes the bui plugin header* —
         `expect(SHADCN_CSS).toMatch(/\[class\*="bui-PluginHeader"\]\s*\{[^}]*hsl\(var\(--sc-card\)\)/)`.
      3. *recolours the visualizer tree, which bypasses the theme overrides* —
         assert `#dependency-graph rect[rx="0"]` is present, that the sheet
         contains no `#90caf9`, and that `#dependency-graph {` carries
         `background-color: hsl(var(--sc-bg))` rather than a hex.

      Do not weaken the existing guards. In particular the truncation, balanced
      brace, control-character and *uses no class name that a production build
      discards* cases stay exactly as they are — the new `[class*="Mui*"]` and
      `[class*="bui-PluginHeader"]` selectors already satisfy the last one, and
      the global `.MuiStepIcon-root.MuiStepIcon-active` selectors that the
      *routes MUI primary colours through the picked accent* case pins must
      still be in the file when you are done.

- [ ] **Step 8: Verify.**
      `cd backstage && CI=true yarn test plugins/platform-ui/src/styles.test.ts`
      then `CI=true yarn tsc`.
      `CI=true` is **required** — without it backstage-cli enters watch mode and
      never returns.

- [ ] **Step 9: Commit.** Conventional commit, e.g.
      `fix(ui): reach catalog-import's suffixed MUI classes and the visualizer tree`.
      Do not push.

---

### Task B — the dark rebalance (palettes)

**Depends on:** nothing. Runs concurrently with Task A.

**May edit ONLY:**
`backstage/plugins/platform-ui/src/brands.ts`,
`backstage/plugins/platform-ui/src/foudre.ts`,
`backstage/plugins/platform-ui/src/spiderverse.ts`,
`backstage/plugins/platform-ui/src/statusTokens.ts`,
`backstage/plugins/platform-ui/src/contrast.test.ts`.
**It must not edit any other file** — in particular not `styles.ts`,
`styles.test.ts`, `greek.ts`, `greek.test.ts` or `slush.ts`.

**Do not modify claude, greek or slush.** Their dark registers are already
right: claude's border is a neutral warm grey, greek's is a gold against an
ember primary — a different hue family, and pinned by `greek.test.ts` — and
slush's is pure white, a deliberate cut edge. Touching any of them is a
regression, not a fix.

**Copy every triplet below character for character.** Do not round, do not
"tidy", do not re-derive. The margin on the worst composited status ink is 0.04.

- [ ] **Step 1: `brands.ts` — replace five `dark:` registers.** Light registers,
      radii, border widths, glow and easing are all unchanged.

      ```ts
      // newform
      dark: { bg:'135 10% 5%', fg:'120 12% 97%', card:'135 9% 10%', muted:'135 8% 20%',
        mutedFg:'120 10% 72%', border:'135 8% 42%', primary:'129 85% 55%',
        primaryFg:'135 10% 6%', accent:'135 10% 16%', accentFg:'120 12% 97%' },

      // tiger
      dark: { bg:'20 45% 6%', fg:'38 95% 59%', card:'20 40% 9%', muted:'20 28% 22%',
        mutedFg:'38 45% 78%', border:'20 20% 44%', primary:'38 95% 59%',
        primaryFg:'20 58% 10%', accent:'20 28% 17%', accentFg:'38 30% 90%' },

      // hermes
      dark: { bg:'0 0% 4%', fg:'0 0% 96%', card:'0 0% 10%', muted:'0 0% 18%',
        mutedFg:'0 0% 72%', border:'0 0% 40%', primary:'240 100% 72%',
        primaryFg:'0 0% 4%', accent:'240 25% 15%', accentFg:'0 0% 96%' },

      // papers
      dark: { bg:'0 0% 5%', fg:'27 33% 96%', card:'0 0% 9%', muted:'241 20% 22%',
        mutedFg:'27 20% 76%', border:'0 0% 40%', primary:'57 88% 58%',
        primaryFg:'0 0% 8%', accent:'241 26% 24%', accentFg:'27 33% 96%' },

      // discord
      dark: { bg:'228 10% 7%', fg:'0 0% 98%', card:'227 9% 11%', muted:'228 6% 26%',
        mutedFg:'220 8% 74%', border:'228 8% 42%', primary:'235 86% 72%',
        primaryFg:'228 8% 10%', accent:'235 18% 24%', accentFg:'0 0% 98%' },
      ```

      Leave `claude` exactly as it is.

- [ ] **Step 2: `brands.ts` — extend the module comment.** One paragraph, not an
      essay: the dark rule is neutral where the accent is loud. A `border` that
      shares hue and saturation with `primary` makes every rule, focus ring,
      input outline and divider glow in the brand colour, and the page reads as
      one colour rather than as a palette. `papers` had them *literally
      identical* (`57 88% 58%` for both). The published accent stays on
      `--sc-primary`, which is where it belongs.

- [ ] **Step 3: `foudre.ts` — five values in `:root.sc-foudre.sc-dark` only.**
      `--sc-border`, `--sc-input`, `--sc-primary` and the light register are all
      unchanged; foudre's lilac rule is already a different hue family from its
      bubblegum primary. This is the uneven-ramp touch-up only (bg was 100%
      saturation against a 60% card).

      ```
      --sc-bg: 153 70% 4%;
      --sc-card: 153 45% 8%;
      --sc-muted: 153 30% 20%;
      --sc-muted-fg: 12 50% 84%;
      --sc-accent: 153 32% 17%;
      ```

      `--sc-card-fg` follows `--sc-fg` and does not change.

- [ ] **Step 4: `spiderverse.ts` — six values in `:root.sc-spiderverse.sc-dark`
      only.** The magenta border sat 35° from the red primary and read as a
      second accent rather than a rule.

      ```
      --sc-bg: 260 30% 6%;
      --sc-card: 260 25% 11%;
      --sc-muted: 260 20% 22%;
      --sc-muted-fg: 45 20% 76%;
      --sc-border: 260 15% 44%;
      --sc-input: 260 15% 44%;
      --sc-accent: 260 22% 18%;
      ```

      `--sc-plate-r`, `--sc-plate-c`, `--sc-caption`, `--sc-halftone`,
      `--sc-primary` and the whole light register are unchanged — the plates and
      the halftone are the mode's identity and none of them is a rule.

- [ ] **Step 5: `statusTokens.ts` — update `MODE_CARDS` to match.** Seven dark
      entries move; every light entry stays. `brands.test.ts`, `foudre.test.ts`
      and `spiderverse.test.ts` each assert the emitted CSS equals this table, so
      a miss here is a red test, not a silent drift.

      | mode | dark card, was | dark card, now |
      |---|---|---|
      | newform | `135 10% 9%` | `135 9% 10%` |
      | tiger | `20 55% 8%` | `20 40% 9%` |
      | hermes | `0 0% 8%` | `0 0% 10%` |
      | papers | `0 0% 8%` | `0 0% 9%` |
      | discord | `227 9% 10%` | `227 9% 11%` |
      | foudre | `153 60% 7%` | `153 45% 8%` |
      | spiderverse | `260 40% 10%` | `260 25% 11%` |

      `default`, `greek`, `slush` and `claude` are unchanged.

- [ ] **Step 6: Add the guard that would have caught this, in
      `contrast.test.ts`.** The file already has `srgbOf`, `luminanceOf`,
      `contrast` and a `registerOf(selector)` helper scoped inside the greek
      describe — lift `registerOf` to take the css string as an argument and
      reuse it. One new case:

      *the rule is never a second helping of the accent* — for every dark
      register (the six `BRAND_DEFS`, plus `:root.sc-foudre.sc-dark` and
      `:root.sc-spiderverse.sc-dark` parsed out of their css), assert that
      `border` differs from `primary` by **either** ≥ 20° of hue (measured
      circularly) **or** by dropping to ≤ 25% saturation. Comment it with the
      reason: a rule sharing hue *and* saturation with the accent is what made
      every dark mode read as one colour, and `papers` shipped them identical.

      Values as written pass: newform 6°/8%, tiger 18°/20%, hermes 240°,
      papers 57°, discord 7°/8%, claude 38°, foudre 92°, spiderverse 95°.

      Do not add greek or slush to the loop — greek is pinned by `greek.test.ts`
      and slush's border is a deliberate pure white.

- [ ] **Step 7: Verify.**
      ```
      cd backstage
      CI=true yarn test plugins/platform-ui/src/contrast.test.ts \
                        plugins/platform-ui/src/brands.test.ts \
                        plugins/platform-ui/src/foudre.test.ts \
                        plugins/platform-ui/src/spiderverse.test.ts \
                        plugins/platform-ui/src/greek.test.ts
      CI=true yarn tsc
      ```
      `greek.test.ts` is in the list on purpose: it is the tripwire proving
      nothing leaked into the mode that must not move.

      **If any `card` value ends up differing from the table in Step 1, 3, 4 or
      5 — for any reason — re-run
      `node $CLAUDE_JOB_DIR/tmp/run-verify2.mjs` before committing** and do not
      commit until it prints `ALL PROPOSED MODES PASS`.

- [ ] **Step 8: Commit.** e.g.
      `fix(ui): stop the dark rules sharing hue and saturation with the accent`.
      Do not push.

---

### Task C — the gate

**Depends on:** Task A **and** Task B, both committed.

**May edit:** only files needed to fix a failure the gate surfaces, and only in
the task that owns that file — if the gate goes red in `styles.ts`, the fix
belongs to whoever runs as Task A.

- [ ] **Step 1: Full CI, in order.**
      ```
      cd backstage
      CI=true yarn tsc && CI=true yarn lint:all && CI=true yarn test && CI=true yarn build:all
      ```
      `build:all` is not optional here: a backslash before digits inside
      `styles.ts` fails the app bundle while `tsc` stays silent, and Task A adds
      CSS containing `rx="0"` attribute selectors.

- [ ] **Step 2: Rebuild the image.** `bash scripts/prod-image-up.sh` from the
      repo root. Docker's disk fills after repeated rebuilds and takes Postgres
      down with it; `docker image prune -f && docker builder prune -f` is the
      documented remedy and must **never** include `--volumes`.

- [ ] **Step 3: Look at the running app on :7007, in a dark register.** The
      production build is the only place the JSS-suffix bug is visible, which is
      the whole reason it survived this long.
      - `/catalog-import`: stepper bubbles on `--sc-primary`, Papers on
        `--sc-card`, links on the accent, header no longer white.
      - `/visualizer`: tree nodes on `--sc-card` with `--sc-border` strokes,
        group nodes on `--sc-muted`, labels legible, canvas following the mode.
        Switch potion and confirm it moves.
      - Any two dark potions side by side: the rules should read as rules, not as
        a second helping of the accent.

- [ ] **Step 4: Do not push.** The branch stays local.

---

## Parallel execution

| Wave | Tasks | Why |
|---|---|---|
| 1 | **A** and **B** concurrently | Disjoint file sets. A owns `styles.ts` + `styles.test.ts`; B owns the four palette files + `contrast.test.ts`. Neither imports a symbol the other renames. |
| 2 | **C** | Needs both commits present. |

There is no third parallel task available. The obvious candidates — splitting
the import fix from the visualizer fix, or splitting the five brand registers
from the two hand-written ones — both land in a file another agent is already
holding, and both would leave an intermediate state that cannot verify itself.

---

## Risks

- **`styles.ts` is one template literal.** A stray backtick truncates the whole
  stylesheet; a backslash before digits fails the app build while `tsc` stays
  silent. `styles.test.ts` guards both and must not be weakened. Every comment
  Task A writes is prose in a template literal — no backticks in it.
- **0.04 of margin.** The worst composited status ink clears AA at 4.54. Any
  `card` value that drifts from the table takes it under. This is why Task B has
  a single owner and a named re-verify script.
- **`[class*="MuiStepLabel-label"]` also matches `MuiStepLabel-labelContainer`.**
  Harmless — the container is a bare wrapper span and the label inherits the same
  declarations anyway — but worth knowing before someone reports it as a bug.
- **`[class*="MuiPaper-root"]` is broad by construction.** It is route-scoped to
  `/catalog-import`, whose only Papers are the analysis result and the form, and
  the exact-class rule it replaces had the same reach. If a future page-level
  Paper appears on that route it will take a card background.
- **The visualizer canvas changes colour.** It moves off the hardcoded `#05050c`
  it shared with the React Flow catalog graph. Deliberate — see Task A Step 5 —
  but it is the one change here a reviewer might want reverted on taste, and
  reverting it is a one-line edit that breaks nothing else.
- **Greek is the tripwire, not a target.** `greek.test.ts` pins its register and
  its status hues. If it goes red, something reached a mode this plan promised
  not to touch.
