# Cosmic Capsule Top Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the shared Home/actions row as a Cosmic Capsule whose full palette follows Pluto's live theme tokens.

**Architecture:** Keep Backstage's Home header and Pluto's action components intact. Use the stable `bui-PluginHeaderToolbar*` class hooks and the existing absolutely positioned `.sc-app-topbar` to make both DOM owners read as one capsule, with all visual values derived from existing CSS variables.

**Tech Stack:** React, TypeScript, CSS-in-TypeScript, Backstage UI, Jest

**Spec:** `docs/superpowers/specs/2026-11-05-cosmic-capsule-topbar-design.md`

## Global Constraints

- Use only `--sc-primary`, `--sc-primary-fg`, `--sc-card`, `--sc-fg`, `--sc-accent`, and `--sc-ring` for the capsule's palette.
- Preserve current navigation, notification count, sign-out behavior, accessible names, and keyboard focus.
- Keep every action target at least 44px by 44px.
- Add no dependency, new theme configuration, fixed design colors, continuous animation, or layout-shifting interaction.
- The layout must not create horizontal overflow at the mobile breakpoint.

## Review Focus

- A very light or dark custom primary still receives `--sc-primary-fg` text on Home; the CSS contract test pins both tokens.
- A theme switch updates the capsule without React state or fixed colors; the CSS contract test rejects hex/rgb declarations in the relevant blocks.
- Notification badges remain visible outside the circular button; existing overflow remains visible and the focused block test checks no clipping.
- Keyboard focus is not hidden by the floating capsule; the contract test retains the ring and positive z-index.
- Narrow viewports retain 44px targets with tighter padding; the responsive CSS contract test pins the mobile target size and inset.

---

### Task 1: Theme-responsive Cosmic Capsule

**Files:**

- Modify: `backstage/plugins/platform-ui/src/styles.test.ts`
- Modify: `backstage/plugins/platform-ui/src/styles.ts`

**Interfaces:**

- Consumes: Existing Backstage class hooks `bui-PluginHeaderToolbar`, `bui-PluginHeaderToolbarContent`, and existing Pluto classes `.sc-app-topbar`, `.sc-topbar-action`.
- Produces: A CSS-only shared capsule presentation; no exported TypeScript interface changes.

- [ ] **Step 1: Write the failing capsule contract tests**

Add tests named `styles the Home row as a theme-responsive Cosmic Capsule` and `keeps Cosmic Capsule controls usable on narrow screens`. Assert that the toolbar, Home content, action group, and action button blocks use the required semantic tokens; use a pill radius; keep 44px-or-larger controls; retain a positive z-index, visible overflow, and ring focus; and contain no hex or `rgb()` colors.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `CI=true PATH=/opt/homebrew/opt/node@22/bin:/Users/macbook/ilay/pluto/pluto/backstage/node_modules/.bin:/usr/bin:/bin /opt/homebrew/opt/node@22/bin/node backstage/.yarn/releases/yarn-4.13.0.cjs --cwd backstage workspace @internal/plugin-platform-ui test --runInBand styles.test.ts`

Expected: FAIL because the current header and actions are separate plain surfaces without the capsule/token contracts.

- [ ] **Step 3: Implement the minimal token-driven CSS**

In `styles.ts`, turn the plugin header toolbar into the translucent card-colored outer pill, style its content/Home area with a primary gradient and primary foreground, and restyle `.sc-app-topbar` plus `.sc-topbar-action` as the quiet right-side segment. Use only the allowed tokens and alpha forms of those tokens. Add short color/elevation transitions and disable them under `prefers-reduced-motion`. At `max-width: 600px`, reduce gaps/insets while keeping controls 44px square.

- [ ] **Step 4: Run focused tests to verify they pass**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 5: Run the full platform-ui suite**

Run: `CI=true PATH=/opt/homebrew/opt/node@22/bin:/Users/macbook/ilay/pluto/pluto/backstage/node_modules/.bin:/usr/bin:/bin /opt/homebrew/opt/node@22/bin/node backstage/.yarn/releases/yarn-4.13.0.cjs --cwd backstage workspace @internal/plugin-platform-ui test --runInBand`

Expected: all suites PASS.

- [ ] **Step 6: Verify the live layout**

On the authenticated Home page, confirm the Home pill and both actions form one topmost capsule in desktop and mobile widths, and switch at least one theme/custom color to confirm live recoloring.
