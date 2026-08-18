# Create Page Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink the template card's oversized title and its translucent plate, and bring back the two top-right buttons that reach the Template entity and favourite it.

**Architecture:** CSS only. There is no custom template card in this repo — the Create page is stock Backstage and the whole treatment is route-scoped CSS in `styles.ts`. The buttons are Backstage's own `TemplateDetailButton` and `FavoriteEntity`, which live inside the card header's `<h3>` subtitle; one rule hides that `<h3>` to drop the type text and takes the buttons with it. The fix narrows the rule instead of replacing the component, so no page override and no new upgrade surface.

**Tech Stack:** CSS in a TypeScript template literal, jest assertions over the generated stylesheet.

**Spec:** `docs/superpowers/specs/2026-08-18-create-page-design.md`

## Global Constraints

- All Node commands run from `backstage/` (Yarn 4 via corepack, Node 22).
- `plugins/platform-ui/src/styles.ts` is **one template literal**: no backticks anywhere inside it, including CSS comments, and no backslash immediately before a digit.
- `styles.test.ts` asserts against the raw CSS string. Two of its assertions pin exactly what this plan changes; updating them is part of the work, not collateral.
- Comments in `styles.ts` state measured values. If a value changes, its comment changes with it — a stale comment here is worse than none, because the next person will trust it.
- The categories half of the spec (`spec.type` per template) is **already done**; this plan is only the cards.

---

### Task 1: Shrink the title and restore the buttons

**Files:**
- Modify: `backstage/plugins/platform-ui/src/styles.ts:746-775`
- Test: `backstage/plugins/platform-ui/src/styles.test.ts:240-247` and `:519-537`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing importable. Behavioural contract: the card header's `<h3>` is visible and holds only its button group; the `<h4>` title renders at 16px.

Background the implementer needs: `ItemCardHeader` renders the subtitle (`component="h3"`) before the title (`component="h4"`), which is why the CSS reorders them with flex. Commit `edc2ef1` hid the whole `<h3>` to kill the type text.

**The DOM, verified against `@backstage/plugin-scaffolder-react@2.0.2`** (`CardHeader.esm.js`, `ItemCardHeader.esm.js`) — an earlier revision of this plan described it wrongly and produced a selector that hid the buttons too:

```
h3
└── div.subtitleWrapper        <- the h3's ONLY child (flex, space-between)
    ├── div                    <- the type text
    └── div                    <- TemplateDetailButton + FavoriteEntity
```

So the type text is `h3 > div > div:first-child`, **not** `h3 > div:first-child` — the latter is the wrapper, and hiding it hides everything.

- [ ] **Step 1: Write the failing tests**

In `backstage/plugins/platform-ui/src/styles.test.ts`, **replace** the test at `:240` (`drops the type subtitle from a template card`) with:

```ts
  it('drops the type text from a template card but keeps its buttons', () => {
    // The card led with its type rather than its name, and the type repeats
    // what the template's own copy already says. Hiding the whole h3 also hid
    // the detail and favourite buttons that live in it, which are the only way
    // from a card to the Template entity.
    expect(SHADCN_CSS).toMatch(
      /\.sc-route-create[^{]*> h3 > div > div:first-child \{\s*display:\s*none/,
    );
    expect(SHADCN_CSS).not.toMatch(
      /\.sc-route-create[^{]*> h3 \{[^}]*display:\s*none/,
    );
  });
```

And in the test at `:519` (`makes the template name the card headline`), change the font-size expectation:

```ts
    expect(SHADCN_CSS).toMatch(
      /\.sc-route-create[^{]*> h4 \{[^}]*font-size:\s*16px/,
    );
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backstage && yarn test plugins/platform-ui/src/styles.test.ts -t 'template'`
Expected: two FAILs — the `h3 > div:first-child` rule does not exist yet, and the title is still 22px.

- [ ] **Step 3: Narrow the hiding rule**

In `backstage/plugins/platform-ui/src/styles.ts`, replace the rule at `:775`:

```
.sc-route-create [class*="MuiCard-root"] > .MuiBox-root:first-child > h3 { display: none; }
```

with:

```
/* The h3 wraps ONE flex row holding two children: the type text, and the
   detail + favourite buttons. Only the type text is unwanted — hiding the
   whole h3 (as this rule did until now) also removed the only route from a
   card to its Template entity, and hiding the wrapper does the same thing.
   order 0 lifts the surviving button row above the title in the flex column,
   and flex-end parks it against the card's right edge. */
.sc-route-create [class*="MuiCard-root"] > .MuiBox-root:first-child > h3 {
  order: 0;
  align-self: flex-end;
  margin: 0;
  line-height: 1;
}
.sc-route-create [class*="MuiCard-root"] > .MuiBox-root:first-child > h3 > div > div:first-child { display: none; }
```

- [ ] **Step 4: Shrink the title and the plate**

In the `> h4` block at `:748-774`, change `font-size: 22px !important;` to `font-size: 16px !important;` and `padding: 1px 6px;` to `padding: 1px 4px;`.

Then fix the two comments that now misstate the facts:

- the comment above `font-size` says the name arrived at the header's inherited size — still true, keep it, but drop any implication that 22px is the answer;
- the plate comment ends with *"font-size is pinned at 22px by styles.test.ts and the pin is correct"*. Rewrite that sentence to name 16px, and recompute the band: at `font-size: 16px` and `line-height: 1.2` the line box is 19.2px, so `padding: 1px` gives a 21.2px band rather than the 28.4px quoted.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backstage && yarn test plugins/platform-ui/src/styles.test.ts`
Expected: PASS — the two edited assertions plus every existing guard (truncation, balanced braces, no control characters, the `.sc-route-*` scoping audit).

- [ ] **Step 6: Type-check and lint**

Run: `cd backstage && yarn tsc && yarn lint:all`
Expected: clean.

- [ ] **Step 7: Verify in the browser**

Run: `bash scripts/backstage-up.sh` then `cd backstage && yarn start`, and open `/create`. Confirm:

1. every card shows two icons at the top right, and the type text is gone;
2. the detail icon navigates to the Template entity page, the star toggles a favourite;
3. both icons are keyboard-reachable — the header art must not have swallowed pointer or focus events;
4. the title is visibly smaller and its plate hugs the text;
5. a long template title still wraps inside the card rather than escaping the plate;
6. the icons are legible against all three cycling header scenes (`styles.ts:777-872` cycles `3n+1/3n+2/3n+3`), in light and dark.

If the icons are hard to see on a scene, add colour — not geometry — to the `h3` rule: the header art is fixed, the icons are not.

- [ ] **Step 8: Commit**

```bash
git add backstage/plugins/platform-ui/src/styles.ts backstage/plugins/platform-ui/src/styles.test.ts
git commit -m "fix: restore template card actions and shrink the title plate"
```
