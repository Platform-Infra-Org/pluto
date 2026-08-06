# Home, quickstart and the experience bar — plan

Three additions, in the order they matter to somebody new:

1. **Home** learns what you use — recently visited pages, favourite templates.
2. **Quickstart** walks a first-time user round the platform, and can be replayed.
3. **The experience bar** turns a running workflow into something worth watching.

Planning only. Nothing here is built.

---

## What already exists (and what does not)

Checked rather than assumed, because two of these change the design:

| Need | State |
|---|---|
| Favourite templates | **Already there.** `starredEntitiesApiRef` + `useStarredEntities` ship in `@backstage/plugin-catalog-react`, already a dependency, and the star is already on every template card at `/create`. Nothing is needed to *set* a favourite — only to read them. |
| Recently visited | **Not there.** `@backstage/plugin-home` (which owns `visitsApi`) is **not installed**. |
| Per-user persistence | `@backstage/plugin-user-settings` is installed and exports `UserSettingsStorage`, a server-backed `StorageApi`. Whether the app binds it is unverified — see the open question below. |
| Workflow node phases | Available today: `/requests/:id/workflow` returns nodes with `type` and `phase`. Live types seen: `Steps`, `StepGroup`, `Pod`, `Suspend`. |
| Motion vocabulary | 9 keyframes, all `steps()`, all inside `prefers-reduced-motion: no-preference`. |
| Sprites | 13, on a 16×16 grid, now with two-layer support (`'#'` glass / `'~'` liquid) added for the potions. |

**Do not install `@backstage/plugin-home` for this.** Its `visitsApi` is the only part we want, and it arrives with cards in a different design language that we would immediately have to reskin — the same trade that made the first 8-bit pass expensive. A visit log is a list of `{ref, title, path, at}` capped at N; that is about forty lines against the `StorageApi` we already have.

---

## 1. Home: recently visited, favourite templates

Two cards beside the existing Quick actions / Owned resources / Standing requests / Pending approvals.

### Recently visited

A `useVisits()` hook in `platform-ui`, recording into `StorageApi` under a `platform.visits` bucket:

```ts
interface Visit { path: string; title: string; at: string }
```

- Recorded from one place — the same `useCurrentPath()` mechanism `CustomNav` already uses to track the active route, so there is one router-independent source of navigation truth rather than two.
- The title comes from `document.title` after a short settle, because the page sets it after its data loads. A visit recorded too early is titled "Platform" and useless.
- **Dedupe by path, keep the newest**, cap at 20 stored / 5 shown. Otherwise a page you bounced through five times crowds out four you actually used.
- **Excluded:** `/`, the sign-in gate, and any path with a `state=` query. A home card listing "Home" is noise.

### Favourite templates

Read `useStarredEntities()`, filter to `kind: Template`, resolve titles through `catalogApi.getEntitiesByRefs`, and link each to `/create/templates/default/<name>`.

- Empty state (the common one, since nobody has starred anything yet) uses the `EmptyState` component with a hint pointing at the star on the template cards. This is the one card that has to teach its own feature.
- Cap at 6. Beyond that it stops being a favourites list.

**New files:** `platform-ui/src/useVisits.ts` (+ test), `platform-requests/src/components/HomeVisits.tsx`, `HomeFavourites.tsx`. **Modified:** `HomePage.tsx`, `app-config.yaml` (the existing `home.sections` config gains two keys).

---

## 2. Quickstart

A five-step guided tour, shown once automatically, replayable from a button.

### Shape

A fixed **dialogue box** at the bottom-right — the same command-window frame the dialogs already use — with a step counter (`1/5`), a `▼` continue marker, and Back / Next / Skip. Each step highlights one element by drawing a 3px accent outline around it and dimming the rest of the page with a dither overlay.

Steps: the sidebar → Create → the request lifecycle → Requests → the potion shelf. Each step is `{ selector, title, body }` in one array, so adding a step is one entry, not a component.

**Why a box and not a modal per step:** the point is to show people the app, and a modal hides the app.

### Anchoring, and the one hard part

A tour breaks when it points at something that is not there. The step list must therefore be **resilient by construction**:

- Every step names a selector that already exists in the app (`.sc-nav`, `.sc-picker-float`, a nav item by `href`).
- A step whose selector matches nothing is **skipped silently, not shown as a broken frame** — and logged in dev so it is caught during development rather than by a user.
- The highlight uses `getBoundingClientRect` on each step change plus a `ResizeObserver`; the sidebar is drag-resizable, so a fixed offset would drift.

### Seen-once, and where that is stored

Storage decides whether the tour follows the person or the browser:

- `StorageApi` bound to `UserSettingsStorage` → per user, server-side, survives a new laptop. **Preferred.**
- Plain `WebStorage` → per browser; a returning user on a second machine gets the tour again.

The app's binding is **unverified** — nothing in `packages/app/src` references `storageApiRef`, so it is likely the default. **First task in implementation: determine which, and if it is `WebStorage`, decide whether to bind `UserSettingsStorage` (a small app-level change) or accept per-browser.** Do not build on the assumption.

Key: `platform.quickstart.completedVersion`. Storing a **version rather than a boolean** means a materially changed tour can be re-offered later without a migration.

### The replay button

In Quick actions on Home: **"Take the tour"**, always present, no dot or badge. It reads as a normal action rather than an unread notification.

**New files:** `platform-ui/src/quickstart/steps.ts` (data + test), `Quickstart.tsx`, `useQuickstart.ts`. **Modified:** `HomePage.tsx`, `styles.ts`, wherever the app root mounts (alongside `SchemeRoot`).

---

## 3. The experience bar

The request page's workflow progress, drawn as an XP bar: a rupee beside it, creatures running along it while work is in flight, and a one-shot celebration or failure at the end.

### What fills it

Progress is **completed leaf steps over total leaf steps**, from the nodes we already fetch.

The trap: Argo's `status.nodes` includes `Steps`, `StepGroup` and `DAG` wrapper nodes alongside the real ones. A live run of `review-gate` showed **7 nodes for 3 actual steps** — counting them all would have the bar at 57% before anything ran. **Count `Pod` and `Suspend` only.**

| Situation | Bar |
|---|---|
| Running | `succeeded leaves / total leaves`, creatures running |
| `AWAITING_INPUT` | Frozen at its current fill, **creatures stop and face the viewer** — the workflow is not progressing and the bar must not imply it is |
| `SUCCEEDED` | 100%, level-up |
| `FAILED` / stopped | Frozen where it died, game-over |

Total leaves grow as Argo expands the DAG, so the bar can jump backwards mid-run. **Track the high-water mark and never render a decrease** — a progress bar that goes backwards reads as a bug even when it is accurate.

### The rupee

A new `RUPEE` sprite, two layers like the potion: `'#'` facet edges, `'~'` the fill in `--sc-primary`. It sits left of the bar and shows the count — `3/7 STEPS` — because the NES rule from the last pass holds: **numbers beside every bar, never a bar alone.**

### The creatures

A new `CREEP` sprite in two frames (legs apart / legs together), 8×8 rather than 16×16 so several fit on a 12px bar. Two or three run along the filled portion, animated `steps(2)`, 400ms, offset so they do not march in lockstep. They live **inside** the fill, so their travel is bounded by real progress — the animation cannot claim more than the workflow has done.

Under `prefers-reduced-motion`, the creatures are absent — not frozen in place. A static creep on a bar is a smudge.

### Level up, game over

One-shot, 600ms, `steps()`, both gated on reduced motion:

- **Level up** — the bar flashes white to accent twice, a `LEVEL UP` pixel banner rises 8px and fades, and a chevron symbol stamps beside the rupee.
- **Game over** — the bar desaturates to the destructive colour, shakes 2px twice (`sc-shake` exists), and the `SKULL` sprite stamps in with a `GAME OVER` banner.

**The state badge does not change.** It still reads `SUCCEEDED` or `FAILED`.

This is the boundary the whole 8-bit pass rests on and it is worth restating here, because this feature is the one most tempted to cross it: **a label naming a state is a record.** `GAME OVER` is decoration that plays over the top and then goes away; `FAILED` is what the badge, the list, the API and the audit trail keep saying. Someone reading a failed provision in a support thread must not find the word "GAME OVER" in it.

Fires **on transition, not on mount**. Opening a page for a request that failed last week must not throw a game-over at you.

**New files:** `platform-ui/src/sprites.ts` gains `RUPEE` and `CREEP`; `platform-requests/src/components/ExperienceBar.tsx` (+ a test for the pure progress maths). **Modified:** `RequestPage.tsx`, `styles.ts`.

---

## Risks

| Risk | Mitigation |
|---|---|
| Progress jumps backwards as the DAG expands | High-water mark; never render a decrease |
| Wrapper nodes inflate the denominator | Count `Pod` and `Suspend` only; assert it in a test against a real `status.nodes` fixture (7 nodes / 3 steps) |
| The tour points at an element that no longer exists | Unmatched selector skips the step silently; dev-only warning |
| The tour highlight drifts | Recompute on step change + `ResizeObserver`; the sidebar is resizable |
| Game-over fires on an old failed request | Trigger on state transition, never on mount |
| "GAME OVER" leaks into the record | Decoration only; badge, list, API and audit keep `FAILED` |
| Creatures imply progress that has not happened | Confined to the filled portion; stopped under `AWAITING_INPUT` |
| Visit log grows unbounded | Cap 20 stored, dedupe by path |
| Quickstart state stored per browser, not per user | Resolve the `StorageApi` binding **first**; decide deliberately |

## Verification

- **Unit:** progress maths (wrapper nodes excluded, high-water mark, division by zero before any node exists); visit dedupe and cap; step-list selectors are all non-empty strings and unique.
- **Live:** run `review-gate` — the bar should read `1/3` after plan, freeze at the suspend with the creatures stopped, then reach `3/3` with the level-up on resume. Stop a second run and confirm game-over plus a badge that still says `FAILED`.
- **Motion:** the whole-app sweep from the last pass, extended to the new keyframes — every animation resolves to `steps()`, and reduced motion removes the creatures, the celebration and the failure animation.

## Open questions

1. **Is `StorageApi` bound to `UserSettingsStorage`?** Decides whether quickstart-seen and visits follow the user or the browser. Resolve before building either.
2. **Should the tour auto-run for existing users?** They have never seen it, and by the storage key they look identical to a new user. Suggest yes, once, since the platform has changed considerably — but it is a judgement call about interrupting people who already know their way around.
3. **XP across requests?** This plan gives each request its own bar. An account-level level that accumulates is a different feature, and one the original design excluded as game mechanics — worth a deliberate decision rather than drift.
