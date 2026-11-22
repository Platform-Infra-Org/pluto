# Unified Top Navigation Implementation Plan

> **For agent:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the separate top action strip and place notification/sign-out alongside the existing Home header row.

**Architecture:** Preserve the current React composition and change the global topbar from a full-width flow container into a right-aligned positioned action group. The existing Backstage plugin header remains the owner of Home and supplies the shared row beneath the positioned actions.

**Tech Stack:** React, TypeScript, CSS-in-TypeScript, Jest

**Spec:** `docs/superpowers/specs/2026-11-05-unified-top-navigation-design.md`

**Constraints:** Keep current controls, handlers, accessibility labels, and responsive sizing unchanged. Avoid changes to Backstage internals.

**Review focus:** Confirm the topbar no longer consumes vertical space or draws a separate surface, actions remain clickable above the header, and mobile insets remain usable.

---

### Task 1: Make the global actions share the Home row

**Files:**

- Modify: `backstage/plugins/platform-ui/src/styles.test.ts`
- Modify: `backstage/plugins/platform-ui/src/styles.ts`

**Step 1: Write the failing test**

Add a CSS contract test asserting `.sc-app-topbar` uses absolute positioning at the top-right, has a stacking order, and does not set a background or bottom border that would recreate the removed row.

**Step 2: Run the focused test to verify it fails**

Run: `yarn test platform-ui --runInBand styles.test.ts` from `backstage/`.

Expected: FAIL because `.sc-app-topbar` is still a full-width flex row in normal flow.

**Step 3: Write the minimal implementation**

Update `.sc-app-topbar` to be an absolutely positioned, transparent action group anchored at the top-right. Retain flex alignment, gap, current desktop/mobile padding, and control sizing. Remove the row-specific minimum height, background, and bottom border.

**Step 4: Run the focused test to verify it passes**

Run: `yarn test platform-ui --runInBand styles.test.ts` from `backstage/`.

Expected: PASS.

**Step 5: Run related layout tests**

Run: `yarn test platform-ui --runInBand AppLayoutContent.test.tsx styles.test.ts` from `backstage/`.

Expected: PASS.

**Step 6: Visually verify the running app**

Open the Home page and confirm Home is left-aligned, notification and sign-out are right-aligned on the same top row, and there is no separate black strip above them.
