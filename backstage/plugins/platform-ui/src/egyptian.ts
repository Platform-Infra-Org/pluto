/**
 * Ancient Egyptian: the sixteenth potion, light-led by day and tomb-dark by
 * night.
 *
 * **The palette is pigment, not sand.** "Egyptian" on a screen usually means
 * beige, which is what four thousand years of weathering left rather than what
 * anyone painted. The finds are loud: Egyptian blue (the first synthetic
 * pigment, calcium copper silicate, fired from the Fourth Dynasty on), lapis
 * lazuli traded in from Badakhshan, gold leaf, malachite green, red ochre and
 * carnelian, kohl black, and the two grounds this mode is built on — limestone
 * and papyrus. Nothing here is faded on purpose.
 *
 * Light register is a scribe's page in daylight: papyrus ground, limestone
 * card, lapis and gold ornament. Dark register is a tomb interior with a lamp
 * in it: gold leaf and Egyptian blue lit against black.
 *
 * Colour values are solved backwards from the status set, not chosen:
 *
 * - **The light card is 96% and the floor is 95%.** Warning ink on its
 *   dithered badge cell measures 5.08 at 95% and 4.99 at 94%, so 94% would
 *   break the shared status tokens outright. Shipped at 96% (5.15) for the
 *   margin. Measured there: success 7.65 card / 5.71 cell, warning 6.86 /
 *   5.15, error 8.10 / 5.71, muted 7.15 / 5.15.
 * - **The dark card is 6% and the ceiling is 7%.** At 8% the worst pair drops
 *   to 4.90 and fails; at 7% it is 5.01, which is a coin toss rather than a
 *   value. Measured at 6%: success 7.13 / 5.17, warning 8.19 / 5.21, error
 *   6.24 / 5.15, muted 10.02 / 5.13.
 *
 * Two colours are **decorative only** and must never carry text or a
 * meaning-bearing border:
 *
 * - **Carnelian** (10 72% 42%) measures 4.96 against the page ground. That is
 *   AA and not this repo's 5.0 bar, so it fills the sun disk and nothing else.
 * - **Malachite** is placement-restricted rather than contrast-restricted. Its
 *   hue sits 16deg from the success status hue, and green ornament in the same
 *   sight line as a badge turns decoration into state — the trap greek
 *   recorded and rimefast repeated. It is therefore used on the sign-in page
 *   only, which is the one screen in the app with no status badge on it, and
 *   it may not move anywhere else.
 *
 * The ornament is what carries the mode: a lotus frieze under every page
 * title and along both edges of a command window, papyrus stalks down the
 * sidebar, djed pillars flanking the sign-in page, a pair of wedjat eyes
 * facing in over the sign-in card, an ankh on an empty shelf, and Khepri
 * rolling the sun disk along the bottom rail. Which motifs were drawn and
 * dropped, and why, is recorded in sprites.ts beside the grids.
 *
 * Kept out of styles.ts for the reason greek.ts records: that file is one
 * template literal and a stray backtick truncates the lot.
 */
import {
  ANKH,
  DJED,
  LOTUS_BAND,
  PAPYRUS,
  SCARAB_STRIP,
  SUN_DISK,
  WEDJAT,
  mirrorSprite,
  spriteUrl,
} from './sprites';

/**
 * The ornament inks, as literals.
 *
 * Baked rather than read from a custom property: these are painted into SVG
 * data URIs, and a data URI is its own document — it inherits neither
 * currentColor nor var(). Two registers, two sets. The first four track
 * --sc-primary and --sc-border in their register; the last three track the
 * two ornament tokens below. egyptian.test.ts checks that they stay in step.
 */
const LAPIS = 'hsl(221 62% 32%)';
const OCHRE = 'hsl(40 70% 38%)';
const GOLD_LEAF = 'hsl(44 82% 55%)';
const EGYPT_BLUE = 'hsl(204 62% 50%)';
const MALACHITE_DAY = 'hsl(168 52% 26%)';
const MALACHITE_NIGHT = 'hsl(168 45% 55%)';
const CARNELIAN = 'hsl(10 72% 42%)';

/**
 * The pair over the door.
 *
 * Generated, not drawn twice: two eyes looking the same way are one drawing
 * used twice, which is the first thing anyone notices. The wedjat is
 * deliberately asymmetric (the tail hangs off the outer corner only), so the
 * mirror is a genuinely different glyph.
 */
const WEDJAT_L = mirrorSprite(WEDJAT);
const WEDJAT_R = WEDJAT;

export function egyptianCss(): string {
  return `
/* ===== Ancient Egyptian — light register: a scribe's page in daylight ===== */
:root.sc-egyptian {
  /* Papyrus for the page, limestone for the card: the card is the LIGHTER of
     the two, which is the opposite of how these two materials weather and the
     right way round for a surface that has to hold status ink. */
  --sc-bg: 40 34% 92%;
  --sc-fg: 25 14% 10%;
  /* 96%. The floor is 95% and 94% fails outright — see the docstring. */
  --sc-card: 40 44% 96%;
  --sc-card-fg: 25 14% 10%;
  --sc-muted: 40 28% 88%;
  --sc-muted-fg: 30 10% 35%;
  --sc-border: 40 70% 38%;
  --sc-input: 40 70% 38%;
  --sc-primary: 221 62% 32%;
  --sc-primary-fg: 0 0% 100%;
  --sc-primary-shade: 240 10% 8%;
  --sc-ring: 221 62% 32%;
  --sc-accent: 40 30% 89%;
  --sc-accent-fg: 25 14% 20%;
  /* Status stays stock. Every mode since greek maps to STATUS_TOKENS, and
     these three are the dither CELL colours those tokens were measured
     against — move one and contrast.test.ts stops describing the screen. */
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  /* Ornament inks. Not shadcn tokens — the chrome reads them.
     Malachite is SIGN-IN ONLY: 16deg from the success status hue, so it may
     never share a screen with a badge. The sun ink is carnelian by day, and it
     is a fill and never text: 4.96 on the page ground, under the 5.0 bar. */
  --sc-malachite: 168 52% 26%;
  --sc-sun-ink: 10 72% 42%;
}
/* ===== dark register: the tomb interior, which is the designed one ===== */
:root.sc-egyptian.sc-dark {
  --sc-bg: 212 48% 4.5%;
  --sc-fg: 44 32% 90%;
  /* 6%, and no higher. 7% takes the worst status pair to 5.01 and 8% to 4.90,
     which breaks the shared status set. */
  --sc-card: 212 44% 6%;
  --sc-card-fg: 44 32% 90%;
  --sc-muted: 212 30% 14%;
  --sc-muted-fg: 40 10% 65%;
  /* Egyptian blue. 204 sits 160deg from the gold primary, so the rule cannot
     read as a second helping of the accent — the separation contrast.test.ts
     enforces. It clears 5.48 on the card, which every divider, input outline
     and focus ring in the app needs, because they all take this value. */
  --sc-border: 204 62% 50%;
  --sc-input: 204 62% 50%;
  --sc-primary: 44 82% 55%;
  --sc-primary-fg: 240 10% 8%;
  --sc-primary-shade: 0 0% 100%;
  --sc-ring: 44 82% 55%;
  --sc-accent: 212 30% 14%;
  --sc-accent-fg: 44 32% 90%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  --sc-malachite: 168 45% 55%;
  /* Gold leaf, not a lifted carnelian: a red disk on a black ground reads as a
     stop light, and the tomb registers paint the sun in metal anyway. */
  --sc-sun-ink: 44 82% 55%;
}

/* ===== Chrome. Lapis and gold on limestone by day, gold leaf and Egyptian
   blue on black by night. ===== */

/* Cards take the rule and a thin inner line.
   Substring form on the MUI names, so these reach the routes that render under
   a nested MUI ThemeProvider — there the generator emits MuiCard-root-186 and
   the counter moves between visits, so a plain class selector matches nothing.
   The two elevation classes keep their clean spelling beside an ANCHORED
   suffix match, because [class*="MuiPaper-elevation1"] also matches elevation10
   through 19. brands.test.ts pins both halves. */
:root.sc-egyptian [class*="MuiCard-root"],
:root.sc-egyptian .MuiPaper-elevation1, :root.sc-egyptian [class*="MuiPaper-elevation1-"],
:root.sc-egyptian .MuiPaper-elevation2, :root.sc-egyptian [class*="MuiPaper-elevation2-"],
:root.sc-egyptian .sc-card {
  border-color: hsl(var(--sc-border)) !important;
  box-shadow:
    inset 0 0 0 1px hsl(var(--sc-border) / .28),
    var(--sc-shadow) !important;
}

/* The command window as a painted wall: the rule doubled, and the lotus frieze
   running along its top and bottom edges.
   A band rather than four corner medallions — which is what greek does — for
   the reason a frieze exists at all: the ornament is the repetition, and one
   flower cropped into an 8x8 corner is a smudge with a stem.
   Inset 4px rather than outset, because styles.ts sets overflow: hidden here
   and anything outside the padding box is clipped. */
:root.sc-egyptian [class*="bui-DialogInner"],
:root.sc-egyptian [class*="MuiDialog-paper"] {
  position: relative;
  border-color: hsl(var(--sc-border)) !important;
  box-shadow:
    0 0 0 2px hsl(var(--sc-card)),
    0 0 0 4px hsl(var(--sc-border)),
    0 0 14px hsl(var(--sc-primary) / .22),
    var(--sc-shadow) !important;
  background-image: ${spriteUrl(LOTUS_BAND, LAPIS)}, ${spriteUrl(LOTUS_BAND, LAPIS)};
  background-repeat: repeat-x;
  background-size: 16px 16px;
  background-position: left top 4px, left bottom 4px;
}
:root.sc-egyptian.sc-dark [class*="bui-DialogInner"],
:root.sc-egyptian.sc-dark [class*="MuiDialog-paper"] {
  background-image: ${spriteUrl(LOTUS_BAND, GOLD_LEAF)}, ${spriteUrl(LOTUS_BAND, GOLD_LEAF)};
}

/* The frieze under every page title. Read by theme.tsx through these
   variables, because a selector naming the page-header component is dead in a
   production build — its makeStyles class hashes to jss<n>. */
:root.sc-egyptian {
  --sc-header-art: ${spriteUrl(LOTUS_BAND, OCHRE)};
  --sc-header-art-size: 24px 24px;
  --sc-header-art-repeat: repeat-x;
  --sc-header-art-pos: left bottom;
}
:root.sc-egyptian.sc-dark {
  --sc-header-art: ${spriteUrl(LOTUS_BAND, GOLD_LEAF)};
}

/* The same frieze, smaller, as the rule under a section heading. round, not
   repeat-x: the band is exactly as wide as the words and a title is rarely a
   whole number of tiles, so the last flower would be cut in half. The caret is
   taken out of the flow for the reason greek.ts records at length — its glyph
   carries about 30px of side bearing. */
:root.sc-egyptian .sc-h1 {
  position: relative;
  width: fit-content;
  max-width: 100%;
  padding-bottom: 6px;
  background-image: ${spriteUrl(LOTUS_BAND, OCHRE)};
  background-repeat: round no-repeat;
  background-size: 16px 16px;
  background-position: left bottom;
}
:root.sc-egyptian .sc-h1::after {
  position: absolute;
  left: 100%;
  top: 0;
}
:root.sc-egyptian.sc-dark .sc-h1 {
  background-image: ${spriteUrl(LOTUS_BAND, GOLD_LEAF)};
}

/* The sign-in page between two djed pillars, running the full height.
   Malachite, and ONLY here: the ink sits 16deg from the success status hue, so
   it is confined to the one screen in the app that never shows a badge. Move
   it and the decoration starts reading as state.
   Deliberately only here for the second reason greek gives as well — a motif
   reads as intent where it means something and as wallpaper everywhere else.
   A threshold is worth a pillar; a data grid is not. */
:root.sc-egyptian .sc-login {
  background-image: ${spriteUrl(DJED, MALACHITE_DAY)}, ${spriteUrl(DJED, MALACHITE_DAY)};
  background-repeat: repeat-y, repeat-y;
  background-size: 16px 32px;
  background-position: left 18px top, right 18px top;
}
:root.sc-egyptian.sc-dark .sc-login {
  background-image: ${spriteUrl(DJED, MALACHITE_NIGHT)}, ${spriteUrl(DJED, MALACHITE_NIGHT)};
}

/* A wedjat at each top corner of the sign-in card, facing inward — the eye
   that guards a threshold, which is exactly what a sign-in card is.
   On the CARD and nowhere else: a pair of eyes at a door is a ward, and the
   same pair on every panel is a poster.
   The mirror is generated, so the two cannot drift apart when either is
   edited. */
:root.sc-egyptian .sc-login-card {
  background-image: ${spriteUrl(WEDJAT_L, OCHRE)}, ${spriteUrl(WEDJAT_R, OCHRE)};
  background-repeat: no-repeat;
  background-size: 20px 20px;
  background-position: left 8px top 8px, right 8px top 8px;
}
:root.sc-egyptian.sc-dark .sc-login-card {
  background-image: ${spriteUrl(WEDJAT_L, GOLD_LEAF)}, ${spriteUrl(WEDJAT_R, GOLD_LEAF)};
}

/* Papyrus stalks down the inner edge of the sidebar — the marsh the whole
   civilisation was written on, and the one motif here that is native to a tall
   narrow strip. Against the inner edge in a 16px column, so it survives the
   nav collapsing to icon width: an ornament centred in a panel that changes
   width is an ornament that moves. */
:root.sc-egyptian .sc-nav {
  background-image: ${spriteUrl(PAPYRUS, OCHRE)};
  background-repeat: repeat-y;
  background-size: 16px 32px;
  background-position: right 3px top;
}
:root.sc-egyptian.sc-dark .sc-nav {
  background-image: ${spriteUrl(PAPYRUS, GOLD_LEAF)};
}

/* An empty shelf gets the ankh — life, and a better thing to meet than a blank
   rectangle. It is also the only glyph in the set that is unmistakable at 32px
   to someone who has never seen the others. */
:root.sc-egyptian .sc-empty {
  background-image: ${spriteUrl(ANKH, OCHRE)};
  background-repeat: no-repeat;
  background-position: center 12px;
  background-size: 32px 32px;
  padding-top: 52px;
}
:root.sc-egyptian.sc-dark .sc-empty {
  background-image: ${spriteUrl(ANKH, GOLD_LEAF)};
}

/* Primary buttons take the rule and a bloom in the primary — lapis by day,
   gold leaf by night.
   filter: drop-shadow(), not box-shadow: styles.ts claims box-shadow with
   !important on the button root, and an important author declaration beats
   both a normal one at any specificity AND the animation origin, so a
   box-shadow glow here would never paint. Nothing claims filter.
   The unanimated declaration below is the LIT frame, so a reader who asked for
   stillness gets the intended picture rather than a glow frozen halfway. */
:root.sc-egyptian [class*="MuiButton-containedPrimary"],
:root.sc-egyptian .sc-btn-primary,
:root.sc-egyptian [data-variant="primary"][class*="bui-Button"] {
  border: var(--sc-border-w) solid hsl(var(--sc-primary)) !important;
  filter: drop-shadow(0 0 5px hsl(var(--sc-primary) / .45));
}
@media (prefers-reduced-motion: no-preference) {
  /* Two frames, stepped: gold leaf catches a lamp, it does not throb. */
  @keyframes sc-egyptian-gild {
    0%, 100% { filter: drop-shadow(0 0 5px hsl(var(--sc-primary) / .45)); }
    50% { filter: drop-shadow(0 0 9px hsl(var(--sc-primary) / .75)); }
  }
  :root.sc-egyptian [class*="MuiButton-containedPrimary"],
  :root.sc-egyptian .sc-btn-primary,
  :root.sc-egyptian [data-variant="primary"][class*="bui-Button"] {
    animation: sc-egyptian-gild 2s steps(2) infinite;
  }
}

/* ===== Khepri =====
   SchemeRoot mounts .sc-mode-art once for every mode; this claims the scarab
   and the disk it pushes. The beetle rolling the sun is the whole of what
   Khepri means, so the mode's one scene animation is that and not a texture.

   On the BOTTOM rail, not the top one. The mythology would prefer the sky, but
   the app header owns the top 64px and .sc-mode-art sits at z-index 1 beneath
   it — a scarab crossing up there spends most of its walk behind a toolbar.
   The bottom rail is empty on every route.

   The disk is a child rather than a second background layer because it needs
   its own box: a background layer wide enough to hold both would show the
   second walk frame beside the first, since a background is clipped to the
   element and nothing else. Being a child, it inherits the parent transform
   and is pushed rather than followed.

   The still frame comes FIRST and is a designed picture: beetle and disk at
   rest a little in from the left, fully painted and on walk frame one.
   Someone who asked for less motion gets Khepri at the horizon, not a gap. */
:root.sc-egyptian .sc-khepri {
  display: block;
  left: 24px;
  bottom: 14px;
  width: 22px;
  height: 22px;
  opacity: 1;
  background-image: ${spriteUrl(SCARAB_STRIP, LAPIS)};
  background-repeat: no-repeat;
  /* The 32x16 strip at 22px a frame, so the box shows exactly one beetle. */
  background-size: 44px 22px;
  background-position: 0 0;
}
:root.sc-egyptian .sc-khepri i {
  position: absolute;
  display: block;
  left: 24px;
  bottom: 0;
  width: 28px;
  height: 28px;
  opacity: 1;
  background-image: ${spriteUrl(SUN_DISK, CARNELIAN)};
  background-repeat: no-repeat;
  background-size: 28px 28px;
}
:root.sc-egyptian.sc-dark .sc-khepri {
  background-image: ${spriteUrl(SCARAB_STRIP, EGYPT_BLUE)};
}
:root.sc-egyptian.sc-dark .sc-khepri i {
  background-image: ${spriteUrl(SUN_DISK, GOLD_LEAF)};
}

@media (prefers-reduced-motion: no-preference) {
  /* 48 steps over 24 seconds is one hop every half second, and on a 1440px
     screen each hop is about 30px — a third of the pair's own width, so the
     beetle visibly shoves rather than slides. A smooth translate here would be
     the one gliding thing in an app whose every other motion is stepped.
     The walk is 1s over two frames, which puts a new leg position under every
     single hop; any other duration and the legs beat against the steps.
     translateX starts off-screen so the loop has no pop-in. It is done with a
     transform rather than a negative left, because ornament in this mode is
     positioned on positive coordinates only and a background hung outside the
     border box paints nothing at all. */
  @keyframes sc-khepri-roll {
    from { transform: translateX(-80px); }
    to { transform: translateX(100vw); }
  }
  @keyframes sc-khepri-walk { to { background-position: -44px 0; } }
  :root.sc-egyptian .sc-khepri {
    animation: sc-khepri-roll 24s steps(48) infinite,
               sc-khepri-walk 1s steps(2) infinite;
  }
}
`;
}
