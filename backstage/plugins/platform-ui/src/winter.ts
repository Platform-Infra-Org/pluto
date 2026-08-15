/**
 * Winter mode: the second *mode* potion, and the blue one's new identity.
 *
 * Same mechanism as greek.ts — one root class, `sc-winter`, toggled by
 * `applyScheme()`, with everything hanging off it. `:root.sc-winter` is
 * specificity (0,2,0) and beats the injected accent sheet's `:root` (0,1,0)
 * whatever the injection order; `:root.sc-winter.sc-dark` is (0,3,0) and
 * settles the dark register over both.
 *
 * Two registers, as the light/dark toggle already implies: a bright frost above
 * and a glacier night below. Where the Greek mode is a metal on stone, this one
 * is light through ice — the accent is the coldest thing on the page rather
 * than the warmest.
 *
 * **Status colours are deliberately NOT redefined here.** The design system's
 * rule is that status hue is fixed, with mode potions the single exception, and
 * Greek already spends that exception. A second theme reinventing green means
 * SUCCEEDED has three different colours depending on the bottle, which is the
 * failure the rule exists to prevent. Winter still changes `--sc-card`, so the
 * default status text is re-measured against these surfaces in
 * contrast.test.ts — a mode that moves the paper has to re-check the ink even
 * when it keeps it.
 */
import { ICICLES, SNOWFLAKE, Sprite, spriteDataUri } from './sprites';

/**
 * The two ices, as literals.
 *
 * Baked rather than read from a custom property: these are painted into SVG
 * data URIs, and a data URI is its own document — it inherits neither
 * currentColor nor var(--x). They track `--sc-border` in each register, and
 * winter.test.ts checks that they still do.
 */
const FROST = 'hsl(200 55% 42%)';
const ICE = 'hsl(195 60% 55%)';

/** An ornament as a CSS url(), ready to interpolate. */
const art = (sprite: Sprite, fill: string) =>
  `url("${spriteDataUri(sprite, fill)}")`;

export function winterCss(): string {
  return `
/* ===== Winter mode — light register: frost ===== */
:root.sc-winter {
  --sc-bg: 205 40% 96%;
  --sc-fg: 215 38% 14%;
  --sc-card: 200 50% 99%;
  --sc-card-fg: 215 38% 14%;
  --sc-muted: 205 35% 92%;
  --sc-muted-fg: 210 22% 36%;
  --sc-border: 200 55% 42%;
  --sc-input: 200 55% 42%;
  --sc-primary: 205 85% 34%;
  --sc-primary-fg: 0 0% 100%;
  --sc-primary-shade: 240 10% 8%;
  --sc-ring: 205 85% 34%;
  --sc-accent: 205 40% 90%;
  --sc-accent-fg: 215 35% 20%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  /* The rime used by the chrome. Not a shadcn token. */
  --sc-rime: 200 55% 42%;
}
/* ===== dark register: glacier night ===== */
:root.sc-winter.sc-dark {
  --sc-bg: 215 48% 5%;
  --sc-fg: 200 30% 95%;
  --sc-card: 215 42% 8.5%;
  --sc-card-fg: 200 30% 95%;
  --sc-muted: 215 30% 20%;
  --sc-muted-fg: 205 22% 72%;
  --sc-border: 195 60% 55%;
  --sc-input: 195 60% 55%;
  --sc-primary: 195 90% 62%;
  --sc-primary-fg: 215 45% 8%;
  --sc-primary-shade: 0 0% 100%;
  --sc-ring: 195 90% 62%;
  --sc-accent: 215 32% 17%;
  --sc-accent-fg: 200 30% 95%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  --sc-rime: 195 60% 55%;
}

/* ===== Ice chrome =====
   Restrained on purpose. The Greek mode learned this the expensive way: a
   motif on every surface stops being a motif. Snow lands on the edges that
   frame something — a window, an empty shelf, the top of a page — and nowhere
   else. */

/* Cards get a rime line inside their edge, the way frost creeps in from a
   window's frame rather than covering the glass. */
:root.sc-winter .MuiCard-root,
:root.sc-winter .MuiPaper-elevation1,
:root.sc-winter .MuiPaper-elevation2,
:root.sc-winter .sc-card {
  border-color: hsl(var(--sc-rime) / .7) !important;
  box-shadow:
    inset 0 1px 0 hsl(var(--sc-rime) / .35),
    var(--sc-shadow) !important;
}

/* A command window, frozen: a pale double rule and a crystal at each corner.
   Four corners from one sprite as four background layers — the snowflake is
   symmetric under a quarter turn, so the same tile is correct at every corner.
   Inset, never outset: styles.ts sets overflow: hidden on this element, and a
   background is clipped to the border box regardless, so ornament hung outside
   paints nothing at all. */
:root.sc-winter [class*="bui-DialogInner"],
:root.sc-winter .MuiDialog-paper {
  border-color: hsl(var(--sc-rime)) !important;
  box-shadow:
    0 0 0 2px hsl(var(--sc-card)),
    0 0 0 4px hsl(var(--sc-rime) / .8),
    0 0 16px hsl(var(--sc-primary) / .28),
    var(--sc-shadow) !important;
  background-image: ${art(SNOWFLAKE, FROST)}, ${art(SNOWFLAKE, FROST)},
    ${art(SNOWFLAKE, FROST)}, ${art(SNOWFLAKE, FROST)};
  background-repeat: no-repeat;
  background-size: 9px 9px;
  background-position:
    left 5px top 5px, right 5px top 5px,
    left 5px bottom 5px, right 5px bottom 5px;
}
:root.sc-winter.sc-dark [class*="bui-DialogInner"],
:root.sc-winter.sc-dark .MuiDialog-paper {
  background-image: ${art(SNOWFLAKE, ICE)}, ${art(SNOWFLAKE, ICE)},
    ${art(SNOWFLAKE, ICE)}, ${art(SNOWFLAKE, ICE)};
}

/* Icicles hanging from the top of every page header. Read by theme.tsx through
   these variables, because a selector naming the page-header component is dead
   in a production build (its makeStyles class hashes to jss<n>). Pinned to the
   top edge: ice hangs from a ledge, it does not sit under one. */
:root.sc-winter {
  --sc-header-art: ${art(ICICLES, FROST)};
  --sc-header-art-size: 26px 16px;
  --sc-header-art-repeat: repeat-x;
  --sc-header-art-pos: left top;
}
:root.sc-winter.sc-dark {
  --sc-header-art: ${art(ICICLES, ICE)};
}

/* An empty shelf gets a single crystal rather than a blank rectangle. */
:root.sc-winter .sc-empty {
  background-image: ${art(SNOWFLAKE, FROST)};
  background-repeat: no-repeat;
  background-position: center 12px;
  background-size: 30px 30px;
  padding-top: 50px;
}
:root.sc-winter.sc-dark .sc-empty {
  background-image: ${art(SNOWFLAKE, ICE)};
}

/* The cold bloom on primary surfaces.
   filter: drop-shadow(), not box-shadow: styles.ts claims box-shadow with
   !important on the button root, and an important author declaration beats both
   a normal one at any specificity AND the animation origin — a box-shadow glow
   here would never paint, animated or not. Nothing claims filter. */
:root.sc-winter .MuiButton-containedPrimary,
:root.sc-winter .sc-btn-primary,
:root.sc-winter [data-variant="primary"][class*="bui-Button"] {
  filter: drop-shadow(0 0 5px hsl(var(--sc-primary) / .45));
}

/* The snowflake suspended in the winter bottle.
   NOT scoped to :root.sc-winter, and that is deliberate: the shelf shows every
   bottle in every mode, so the flake has to drift whichever theme is active.
   It is the one rule in this file that describes an object rather than a mode.
   Four discrete positions with steps(1), which holds each frame until the next
   — the drift of something settling through water, not a smooth glide. The
   unanimated default is the centre of the loop, so stillness looks deliberate
   rather than caught mid-fall. */
.sc-potion .sc-flake {
  fill: hsl(0 0% 100% / .92);
}
@media (prefers-reduced-motion: no-preference) {
  @keyframes sc-flake-drift {
    0%   { transform: translate(0, 0); }
    25%  { transform: translate(0.9px, 1.1px); }
    50%  { transform: translate(0, 2px); }
    75%  { transform: translate(-0.9px, 1.1px); }
    100% { transform: translate(0, 0); }
  }
  .sc-potion .sc-flake {
    animation: sc-flake-drift 3.2s steps(1) infinite;
  }
}
`;
}
