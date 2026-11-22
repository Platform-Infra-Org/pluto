# Sidebar Notifications and Sign-out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the global top row and move notification count and sign-out into the desktop sidebar.

**Architecture:** Extract the existing unread polling into a small badge component consumed by `CustomNav`. Rework `SignOutButton` as the sidebar footer control, then remove the obsolete topbar composition and CSS.

**Tech Stack:** React, TypeScript, Backstage APIs, Jest, CSS

**Spec:** `docs/superpowers/specs/2026-11-05-sidebar-notifications-signout-design.md`

## Global Constraints

- Preserve `/notifications`, unread polling, `99+` capping, identity sign-out, accessibility, and theme tokens.
- Keep the sidebar hidden below 600px; add no mobile replacement.
- Add no dependency.

## Review Focus

- A zero unread count renders no badge while positive counts and `99+` remain correct.
- Notification API failures do not break the sidebar.
- Expanded and collapsed sidebar controls remain aligned and usable.
- Sign-out remains keyboard accessible and calls `identityApi.signOut()` once.
- No obsolete topbar surface or content offset remains.

---

### Task 1: Sidebar notification badge and sign-out footer

**Files:**

- Modify: `backstage/plugins/platform-ui/src/CustomNav.tsx`
- Modify: `backstage/plugins/platform-ui/src/NotificationBell.tsx`
- Modify: `backstage/plugins/platform-ui/src/SignOutButton.tsx`
- Create: `backstage/plugins/platform-ui/src/CustomNav.test.tsx`
- Modify: `backstage/plugins/platform-ui/src/styles.ts`

**Interfaces:**

- Consumes: discovered nav items, `notificationsApiRef`, and `identityApiRef`.
- Produces: Notifications row badge and `.sc-nav-footer` sign-out control.

- [ ] **Step 1:** Write failing tests for unread badge placement/capping and bottom sidebar sign-out.
- [ ] **Step 2:** Run focused tests and confirm failure from missing sidebar controls.
- [ ] **Step 3:** Implement the minimal badge and footer composition with expanded/collapsed CSS.
- [ ] **Step 4:** Run focused tests and confirm they pass.

### Task 2: Remove the top row

**Files:**

- Modify: `backstage/plugins/platform-ui/src/AppLayoutContent.tsx`
- Modify: `backstage/plugins/platform-ui/src/AppLayoutContent.test.tsx`
- Modify: `backstage/plugins/platform-ui/src/styles.ts`
- Modify: `backstage/plugins/platform-ui/src/styles.test.ts`

**Interfaces:**

- Consumes: sidebar controls produced by Task 1.
- Produces: app layout with no `.sc-app-topbar` or Cosmic Capsule rules.

- [ ] **Step 1:** Replace the existing topbar test with a failing absence test and CSS contract.
- [ ] **Step 2:** Run focused tests and confirm failure because the top row still renders.
- [ ] **Step 3:** Remove topbar markup/imports and obsolete styles.
- [ ] **Step 4:** Run focused and full platform UI tests, then verify the live desktop layout.
