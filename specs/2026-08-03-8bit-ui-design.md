# Design: 8-bit pixel-game motif for the platform UI

**Status:** approved decisions, awaiting spec review
**Branch:** `feat/8bit-ui`

## Goal

Restyle the platform portal around an 8-bit pixel-game motif — pixel type, pixel
art, hard edges, retro animation — without making it worse at its job. It is an
approval tool people use during incidents; the costume changes, the behaviour
does not.

The colour picker survives intact: six swatches, same code path, same
`--sc-primary` contract.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Motif intensity | **Pixel chrome, readable body** | Headings, nav, buttons, badges and numbers in pixel type; body copy, tables and JSON stay Inter/mono. Request descriptions and workflow output are read under pressure |
| Mark | **Pixel temple + per-state sprites** | Keeps the existing identity (a temple on its platform) and carries the motif into the pages that matter |
| Font | **Silkscreen**, self-hosted | ~30% narrower than Press Start 2P, so `PENDING APPROVAL` still fits a badge. SIL OFL, 3.4KB woff2 (latin subset) |
| Animation | **State-driven + ambient**, reduced-motion gated | Motion tied to real state changes, plus light idle presence |
| Palette | **Saturate the existing six** | Same hues and identities, pushed toward NES-era saturation. The picker is untouched |
| Mechanics | **None** | No XP, points, achievements, leaderboards or sound. A motif, not a game loop |

## Architecture

The change lands in the existing design layer rather than beside it.
`platform-ui` already owns the whole look: `styles.ts` injects one CSS string
(`SHADCN_CSS`) carrying the `--sc-*` tokens, the `.sc-*` component classes and
the `[FRAGILE]` overrides that reskin Backstage's own MUI components.
`components.tsx` owns the primitives. Retuning that layer means one design
system, not two.

Rejected alternatives: a parallel `PIXEL_CSS` with a toggle (doubles the
surface, and every `[FRAGILE]` override would need two variants); tokens-only
(cheapest, but can't deliver sprites, the nav treatment or animation, so it
doesn't meet the goal).

Files touched:

| File | Change |
|---|---|
| `styles.ts` | Token retune, `@font-face`, pixel component classes, keyframes; the `[FRAGILE]` block leaves for `theme.tsx` (see below) |
| `sprites.ts` *(new)* | Pixel-grid format + the sprite set; replaces `markShapes.ts` |
| `components.tsx` | `PlatformMark` renders from the grid; `Button`/`Badge` gain press depth and sprite slots |
| `CustomNav.tsx` | Pixel nav rows, `▶` active marker, sprite icons |
| `SchemeRoot.tsx` | Saturated `SCHEMES` values; favicon draws the pixel temple |
| `theme.tsx` | Gains a `components` block: the migrated Backstage overrides, radius 0, Silkscreen for headings |
| `packages/app/public/fonts/` *(new)* | `silkscreen.woff2` |

## The token layer

```
--sc-radius        0.5rem  →  0        every corner is square
--sc-border-w      1px     →  2px      new token; hard outlines
--sc-shadow        blur    →  2px 2px 0 hsl(var(--sc-fg) / .9)
--sc-font-pixel    —       →  'Silkscreen', monospace   (new)
--sc-unit          —       →  4px      spacing snaps to a 4px grid (new)
```

Shadows are the significant one: every soft `box-shadow` becomes a hard offset
with no blur, which is what reads as pixel art more than any other single
property.

The accent values move to their saturated equivalents in `SCHEMES`
(`250 52% 55%` → `250 75% 60%`, and so on for the other five). The picker, its
persistence, the favicon generator and the `--sc-primary` contract are unchanged
— only the six literals move.

## Sprites

`markShapes.ts` becomes `sprites.ts` with a grid format instead of SVG path data:

```ts
export const TEMPLE_16 = [
  '......####......',
  '....########....',
  '..############..',
  '################',
  '..#..#..#..#....',
  // …16 rows of 16
];
```

One renderer turns a grid into `<rect>` elements for SVG and into `fillRect`
calls for the favicon canvas — both already exist in some form, and the grid is
simpler than the path data it replaces.

The set:

| Sprite | Used for |
|---|---|
| `TEMPLE_16` | The mark: sidebar tile, sign-in card, favicon |
| `HOURGLASS` | `PENDING_APPROVAL` |
| `SCROLL` | `APPROVED` |
| `GEAR` | `IN_PROGRESS` (animated, see below) |
| `CHEST` | `SUCCEEDED` |
| `SKULL` | `FAILED` |
| `CROSS` | `REJECTED` |

State sprites sit beside the state badge on the requests list, the request
detail header and the home page tiles. They are decorative: `aria-hidden`, with
the state text staying the accessible name.

## Animation

Every rule below lives inside `@media (prefers-reduced-motion: no-preference)`.
With reduced motion the sprites are static, the bar is a plain filled bar, and
the CRT layer is absent — nothing conveys state through motion alone.

**State-driven**

| Trigger | Animation |
|---|---|
| `IN_PROGRESS` | Marching progress bar — 4px blocks stepping right, `steps(8)`, 800ms loop |
| `IN_PROGRESS` | `GEAR` sprite rotates in 90° steps, 1s loop |
| Transition to `SUCCEEDED` | One-shot flash: chest sprite swaps in, accent ring pulses twice, 400ms |
| Transition to `FAILED`/`REJECTED` | One-shot 2px horizontal shake, 200ms |
| Button press | 2px translate down-right, hard shadow collapses — the press *is* the depth |
| Nav hover | `▶` marker steps in from the left, `steps(2)` |

**Ambient**

| Where | Animation |
|---|---|
| App shell | CRT scanline overlay: 2px repeating gradient at 3% opacity, no motion — texture, not flicker |
| Empty states | Sprite bobs 2px, 1.2s loop |
| Page headings | Blinking block cursor after the title, 1s `steps(1)` |

Timing rule: every animation uses `steps()`, never `ease`. Smooth interpolation
is what makes a pixel interface look like a modern interface wearing a costume.

## Surface by surface

| Surface | Treatment |
|---|---|
| Sidebar | Pixel labels, `▶` active marker, sprite icons, square 2px-bordered mark tile |
| Home | Section headings in pixel type; owned resources and pending approvals as bordered tiles with state sprites |
| Requests list | Pixel column headers and state badges; body rows stay Inter |
| Request detail | Sprite + state badge in the header; the approval timeline becomes a segmented pixel bar |
| Buttons / inputs | Square, 2px border, hard shadow, press depth; focus ring is a 2px offset outline, never a glow |
| Dialogs | Square, hard shadow, pixel title bar |
| `JsonTree` | Unchanged monospace body; pixel type for keys and the expand markers |
| Sign-in | Pixel mark tile, pixel heading, pixel button; the rest calm |
| TechDocs pages | Untouched — long-form documentation stays in the reading typeface |

## Accessibility

- Contrast is re-checked after saturation: every accent must clear 4.5:1 against
  `--sc-primary-fg` and against the card background in both schemes.
- Silkscreen is used at 12px minimum, never for paragraphs.
- Sprites are `aria-hidden`; state is conveyed by text, not by pixel art or
  colour alone.
- Focus rings become *more* visible, not less — 2px offset outlines beat the
  current subtle ring.
- The scanline overlay is `pointer-events: none` and drops out under reduced
  motion.

## Retiring the `[FRAGILE]` overrides

`styles.ts` reskins Backstage's own components by matching hashed class
prefixes — `[class*="BackstageHeader-title"]` and friends, eight of them, each
carrying a comment about re-deriving the prefix after an upgrade. Restyling
those for pixel would double down on the fragility.

It turns out none of it is necessary. `createUnifiedTheme` accepts a
`components` block (`UnifiedThemeOptions.components?: ThemeOptions['components']`),
and `@backstage/core-components` publishes a typed override map — every
component we hack at has a key and named slots:

```ts
type HeaderClassKey =
  | 'header' | 'title' | 'subtitle' | 'type'
  | 'leftItemsBox' | 'rightItemsBox' | 'breadcrumb' | …;
```

So the pixel pass migrates them instead of extending them:

| Today, in `styles.ts` | Becomes, in `theme.tsx` |
|---|---|
| `[class*="BackstageHeader-header"]` | `BackstageHeader.styleOverrides.header` |
| `[class*="BackstageHeader-title"]` | `BackstageHeader.styleOverrides.title` |
| `[class*="BackstageHeader-subtitle"]` / `-type` | `.subtitle` / `.type` |
| `[class*="HeaderLabel-label"]` | `BackstageHeaderLabel.styleOverrides.label` |
| `[class*="BackstageInfoCard-header"]` | `BackstageInfoCard.styleOverrides.header` |
| `[class*="ItemCardHeader"]` | `BackstageItemCardHeader.styleOverrides.root` |
| `[class*="BackstageSidebarPage-root"]` | `BackstageSidebarPage.styleOverrides.root` |
| `[class*="PluginCatalogGraph"]` / `DependencyGraph*` | delete — the relations card is disabled in `app-config.yaml:25` and replaced by ours. Verify the standalone graph page first |

What this buys, beyond the restyle:

- **The hash stops mattering.** The class hash is what changes between versions;
  the component key and slot name are the public contract.
- **Breakage becomes a build error.** Slot names are typed, so a removed slot
  fails `tsc` instead of silently rendering an unstyled header.
- **`!important` mostly goes away.** Theme overrides apply at the right
  specificity; the CSS layer only fought MUI because it was injected from
  outside.

Residual risk, stated honestly: `createUnifiedTheme` takes MUI v5 shapes and
Backstage transforms them for its v4 components, so each migrated override needs
a visual check rather than a blind port. And the override map covers
`core-components` only — anything a plugin styles privately (TechDocs chrome,
for one) still needs CSS. The `[FRAGILE]` marker survives for that remainder,
which should be two or three rules rather than eight.

This work lands **before** the pixel pass: migrate first, verify the app looks
identical, then square the corners. Mixing the two would make a regression
impossible to attribute. It also means `docs/explanation/upgrade-surface.md`
needs updating when it's done — that page currently describes re-deriving hashed
prefixes as the standing upgrade tax.

## Risks

**Font width.** Silkscreen is narrower than Press Start 2P but still wider than
Inter. Nav labels, badges and table headers need checking at the collapsed
sidebar width (68px) before the labels are considered final.

**Saturation vs. contrast.** Pushing lightness up can break text contrast on the
lighter accents (amber especially). The contrast check is a gate, not a
formality — if a value fails, the palette moves, not the threshold.

## Verification

- The existing 65 tests stay green; `tsc` and `lint:all` clean.
- The override migration is verified **before** any pixel work: screenshots of a
  catalog entity page, a table and the app shell, compared against the same
  pages on `main`. They must be indistinguishable.
- A unit test for the sprite renderer: a known grid produces the expected rect
  count and coordinates.
- A component test that `PlatformMark` renders the grid, extending the existing
  `components.test.tsx`.
- Playwright screenshots of the sign-in card, the sidebar, the requests list and
  a request detail page, captured at 6× and reviewed — the same method used to
  verify the trident mark and the generated favicon.
- A reduced-motion pass: same screenshots with the media feature forced, to
  confirm nothing depends on motion.

## Out of scope

XP, points, streaks, achievements, leaderboards, sound effects, game-flavoured
copy (`QUEST ACCEPTED` in place of `SUBMITTED`), and any change to TechDocs
content pages. No changes to backend behaviour, the request model or the API.
