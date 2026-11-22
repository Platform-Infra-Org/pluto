# Solid Signal Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Cosmic Capsule's diamond notification glyph with the approved option D filled bell.

**Architecture:** Keep `NotificationBell` behavior intact and replace only its decorative glyph with an inline, theme-colored SVG. Pin the visual contract in the existing component/style tests.

**Tech Stack:** React, TypeScript, inline SVG, Jest

**Spec:** `docs/superpowers/specs/2026-11-05-solid-signal-notification-design.md`

## Global Constraints

- Preserve notification polling, routing, unread badge behavior, accessible naming, theme tokens, and the 44px target.
- Add no dependency and change no sign-out or layout code.

## Review Focus

- Zero and nonzero unread counts retain their current badge behavior.
- The SVG remains decorative while the link keeps its accessible label.
- The icon inherits the active theme foreground.
- Mobile sizing remains unchanged.
- Existing notification error handling remains untouched.

---

### Task 1: Solid Signal glyph

**Files:**

- Modify: `backstage/plugins/platform-ui/src/NotificationBell.tsx`
- Modify: `backstage/plugins/platform-ui/src/styles.ts`
- Test: `backstage/plugins/platform-ui/src/styles.test.ts`

**Interfaces:**

- Consumes: existing `NotificationBell()` component and `.sc-topbar-action` visual contract.
- Produces: the same component interface with an inline filled-bell SVG.

- [ ] **Step 1: Write a failing test** asserting the notification glyph uses the Solid Signal SVG class and inherits `currentColor` without changing the 44px control.
- [ ] **Step 2: Run the focused test** and confirm it fails because the diamond glyph is still present.
- [ ] **Step 3: Replace the diamond span** with an `aria-hidden` inline SVG using the approved filled bell path; add only the minimal SVG sizing/fill rule.
- [ ] **Step 4: Run focused and full tests** and require all platform UI suites to pass.
- [ ] **Step 5: Verify live** that the filled bell, unread badge, theme color, and mobile layout render correctly.
