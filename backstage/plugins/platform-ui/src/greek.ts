/**
 * Ancient Greek mode: the seventh potion, and the first that is a *mode*
 * rather than an accent.
 *
 * Everything here hangs off one root class, `sc-greek`, toggled by
 * `applyScheme()`. That works because `:root.sc-greek` is specificity (0,2,0)
 * and the injected accent sheet's `:root` is (0,1,0) — Greek wins regardless
 * of injection order, which is the same reason `sc-konami` can override the
 * picked accent. `:root.sc-greek.sc-dark` is (0,3,0) and settles the dark
 * register over both.
 *
 * Kept out of styles.ts deliberately: that file is 1382 lines of a single
 * template literal and has been silently truncated by a stray backtick twice.
 * A whole second art direction inline makes a known hazard worse.
 *
 * Colour values are solved, not chosen: every pair that carries text clears
 * 4.5:1, the gold rule clears 3:1 against its card, and the status set clears
 * 5.0:1 against both card and dithered cell. See statusTokens.ts.
 *
 * Colour alone does not make a theme Greek, though — a recoloured app is just a
 * recoloured app. The ornament is what carries it: the meander running under
 * every page title, the fluting down the sidebar, the rosettes at the corners
 * of a command window, the palmette on an empty shelf. Those are drawn from
 * sprite grids (sprites.ts) rather than approximated with gradients, so they
 * sit in the same pixel language as the rest of the app instead of looking like
 * a decal applied over it.
 */
import {
  COLUMN,
  MEANDER,
  OWL,
  PALMETTE,
  POMEGRANATE,
  ROSETTE,
  Sprite,
  spriteDataUri,
} from './sprites';

/**
 * The two metals, as literals.
 *
 * Baked rather than read from --sc-gold because these are painted into SVG data
 * URIs, and a data URI is its own document: it inherits neither currentColor nor
 * a custom property from the page. Two registers, two literals. They must track
 * --sc-border in each register below, and greek.test.ts checks that they do.
 */
const BRONZE = 'hsl(40 55% 46%)';
const GOLD = 'hsl(43 62% 46%)';

/** An ornament as a CSS url(), ready to interpolate. */
const art = (sprite: Sprite, fill: string) =>
  `url("${spriteDataUri(sprite, fill)}")`;

export function greekCss(): string {
  return `
/* ===== Ancient Greek mode — light register: Olympus ===== */
:root.sc-greek {
  --sc-bg: 40 30% 96%;
  --sc-fg: 30 14% 13%;
  --sc-card: 42 45% 98%;
  --sc-card-fg: 30 14% 13%;
  --sc-muted: 40 20% 92%;
  --sc-muted-fg: 35 14% 34%;
  --sc-border: 40 55% 46%;
  --sc-input: 40 55% 46%;
  --sc-primary: 10 68% 34%;
  --sc-primary-fg: 0 0% 100%;
  --sc-primary-shade: 240 10% 8%;
  --sc-ring: 10 68% 34%;
  --sc-accent: 40 25% 90%;
  --sc-accent-fg: 30 14% 20%;
  --sc-success: 58 62% 42%;
  --sc-warning: 188 65% 45%;
  --sc-destructive: 12 78% 50%;
  /* The filigree gold, used by the chrome. Not a shadcn token. */
  --sc-gold: 40 55% 46%;
}
/* ===== dark register: the Underworld ===== */
:root.sc-greek.sc-dark {
  --sc-bg: 265 32% 6%;
  --sc-fg: 40 28% 92%;
  --sc-card: 265 26% 10%;
  --sc-card-fg: 40 28% 92%;
  --sc-muted: 265 18% 18%;
  --sc-muted-fg: 40 14% 70%;
  --sc-border: 43 62% 46%;
  --sc-input: 43 62% 46%;
  --sc-primary: 14 88% 55%;
  --sc-primary-fg: 240 10% 8%;
  --sc-primary-shade: 0 0% 100%;
  --sc-ring: 14 88% 55%;
  --sc-accent: 265 20% 16%;
  --sc-accent-fg: 40 28% 92%;
  --sc-success: 58 62% 42%;
  --sc-warning: 188 65% 45%;
  --sc-destructive: 12 78% 50%;
  --sc-gold: 43 62% 46%;
}

/* ===== Ornate chrome. One grammar, two brightnesses: the light register is
   the same filigree in bronze on bone, the dark one is gold on obsidian with
   the glow doing real work. No image assets — box-shadow and gradients. ===== */

/* Cards get a gold rule and a thin inner line. Single frame only.
   ponytail: the spec's clipped corner notches (clip-path) are dropped — the
   gold rule plus the inset line already reads as a distinct surface, and
   clip-path would clip away the hard offset shadow every surface in this
   design system carries.
   No backticks in this comment: it lives inside a template literal, and one
   stray backtick truncates the whole sheet. */
:root.sc-greek .MuiCard-root,
:root.sc-greek .MuiPaper-elevation1,
:root.sc-greek .MuiPaper-elevation2,
:root.sc-greek .sc-card {
  border-color: hsl(var(--sc-gold)) !important;
  box-shadow:
    inset 0 0 0 1px hsl(var(--sc-gold) / .3),
    var(--sc-shadow) !important;
}

/* The command window, in gold. Same three-shadow construction the base sheet
   already uses for dialogs, retinted, plus an ember bloom behind it. */
:root.sc-greek [class*="bui-DialogInner"],
:root.sc-greek .MuiDialog-paper {
  position: relative;
  border-color: hsl(var(--sc-gold)) !important;
  box-shadow:
    0 0 0 2px hsl(var(--sc-card)),
    0 0 0 4px hsl(var(--sc-gold)),
    0 0 14px hsl(var(--sc-primary) / .3),
    var(--sc-shadow) !important;
}
/* Rosette medallions at all FOUR corners of a command window — the ornate
   corner accent a Hades menu frame carries.
   Four corners from one sprite, as four background layers rather than
   pseudo-elements: an element has only two of those, which is what previously
   capped this at two corners. The rosette is symmetric under a quarter turn,
   so the same tile is correct at every corner.
   Inset 4px, not outset: styles.ts sets overflow: hidden on this element so its
   header and footer edges follow the rounded corners, and that clips anything
   painted outside the padding box. */
:root.sc-greek [class*="bui-DialogInner"],
:root.sc-greek .MuiDialog-paper {
  background-image: ${art(ROSETTE, GOLD)}, ${art(ROSETTE, GOLD)},
    ${art(ROSETTE, GOLD)}, ${art(ROSETTE, GOLD)};
  background-repeat: no-repeat;
  background-size: 8px 8px;
  background-position:
    left 4px top 4px, right 4px top 4px,
    left 4px bottom 4px, right 4px bottom 4px;
}

/* The meander — the Greek key — running under every page title.
   Read by theme.tsx through these variables, because a selector naming the
   page-header component is dead in a production build (its makeStyles class
   hashes to jss<n>). The band sits at the bottom edge of the header so it
   reads as the rule beneath the title rather than a texture behind it. */
:root.sc-greek {
  --sc-header-art: ${art(MEANDER, BRONZE)};
  --sc-header-art-size: 24px 12px;
  --sc-header-art-repeat: repeat-x;
  --sc-header-art-pos: left bottom;
}
:root.sc-greek.sc-dark {
  --sc-header-art: ${art(MEANDER, GOLD)};
}

/* The sign-in page as a temple facade: a fluted Doric column standing at each
   side of the card, running the full height of the viewport.
   Deliberately only here. Columns down the sidebar and a key along every table
   header turned the ornament into wallpaper — a motif reads as intent when it
   appears where it means something and as noise when it appears everywhere. A
   threshold is worth a facade; a data grid is not. */
:root.sc-greek .sc-login {
  background-image: ${art(COLUMN, BRONZE)}, ${art(COLUMN, BRONZE)};
  background-repeat: repeat-y, repeat-y;
  background-size: 14px 36px, 14px 36px;
  background-position: left 18px top, right 18px top;
}
:root.sc-greek.sc-dark .sc-login {
  background-image: ${art(COLUMN, GOLD)}, ${art(COLUMN, GOLD)};
}

/* A meander rule under section headings, the same band at half height.
   The band is painted on the heading's own box, so the box has to measure the
   words. Two things were stretching it, and both had to go: an h1 is a block,
   so it took the whole column; and the block caret is an ::after whose glyph
   carries about 30px of side bearing, so even a shrink-wrapped box ran a full
   caret-width past the last letter. Taking the caret out of the flow leaves
   the frieze exactly as wide as the title — measured at 268px against 268px
   of text — and the caret still lands where it always did, just after it. */
:root.sc-greek .sc-h1 {
  position: relative;
  width: fit-content;
  max-width: 100%;
  padding-bottom: 6px;
  background-image: ${art(MEANDER, BRONZE)};
  /* round, not repeat-x: the band is now as wide as the words, and a title is
     rarely an exact multiple of the tile — at 268px the last 20px tile was
     cut mid-figure and read as a stray bracket. round scales the tile by the
     fraction needed to fit a whole number, which is what a frieze does on a
     real wall. */
  background-repeat: round no-repeat;
  background-size: 20px 10px;
  background-position: left bottom;
}
:root.sc-greek .sc-h1::after {
  position: absolute;
  left: 100%;
  top: 0;
}
:root.sc-greek.sc-dark .sc-h1 {
  background-image: ${art(MEANDER, GOLD)};
}

/* An empty shelf gets a palmette — the akroterion at the peak of a temple, and
   a friendlier thing to meet than a blank rectangle. */
:root.sc-greek .sc-empty {
  background-image: ${art(PALMETTE, BRONZE)};
  background-repeat: no-repeat;
  background-position: center 12px;
  background-size: 32px 32px;
  padding-top: 52px;
}
:root.sc-greek.sc-dark .sc-empty {
  background-image: ${art(PALMETTE, GOLD)};
}

/* Deliberately NOT decorating .sc-login-mark or .sc-nav-mark: the mark's whole
   appearance is a background gradient, so any background-image here replaces
   the tile rather than adding to it. Columns flanking it would also have to sit
   outside the border box, where a background is never painted. The mark keeps
   its accent tile; the ornament goes around it, not on it. */

/* The sign-in card is the threshold, so it carries the pomegranate — the fruit
   Persephone ate below, and the reason she has to come back. Set low in the
   corner as a watermark: the card is a form first. */
:root.sc-greek .sc-login-card {
  background-image: ${art(POMEGRANATE, BRONZE)};
  background-repeat: no-repeat;
  background-size: 28px 28px;
  background-position: right 14px bottom 14px;
}
:root.sc-greek.sc-dark .sc-login-card {
  background-image: ${art(POMEGRANATE, GOLD)};
}

/* Athena's owl watches over the tour. A guide is the one place in the app where
   wisdom-by-the-shoulder is the literal subject. */
:root.sc-greek .sc-qs-box {
  background-image: ${art(OWL, BRONZE)};
  background-repeat: no-repeat;
  background-size: 22px 22px;
  background-position: right 12px top 12px;
}
:root.sc-greek.sc-dark .sc-qs-box {
  background-image: ${art(OWL, GOLD)};
}

/* Primary buttons carry the gold rule too. */
:root.sc-greek .MuiButton-containedPrimary,
:root.sc-greek .sc-btn-primary {
  border: var(--sc-border-w) solid hsl(var(--sc-gold)) !important;
}

/* The ember bloom on primary surfaces. Two frames, stepped — no interpolation,
   which is the rule the whole design system follows. The unanimated default
   below is the LIT frame, so someone who asked for stillness gets the intended
   look rather than a glow frozen halfway.
   filter: drop-shadow(), not box-shadow: styles.ts claims box-shadow with
   !important on the button root, and an important author declaration beats
   both a normal one at any specificity AND the animation origin — so a
   box-shadow glow here would never paint, animated or not. Nothing claims
   filter. */
:root.sc-greek .MuiButton-containedPrimary,
:root.sc-greek .sc-btn-primary,
:root.sc-greek [data-variant="primary"][class*="bui-Button"] {
  filter: drop-shadow(0 0 5px hsl(var(--sc-primary) / .5));
}
@media (prefers-reduced-motion: no-preference) {
  @keyframes sc-greek-ember {
    0%, 100% { filter: drop-shadow(0 0 5px hsl(var(--sc-primary) / .5)); }
    50% { filter: drop-shadow(0 0 9px hsl(var(--sc-primary) / .8)); }
  }
  :root.sc-greek .MuiButton-containedPrimary,
  :root.sc-greek .sc-btn-primary,
  :root.sc-greek [data-variant="primary"][class*="bui-Button"] {
    animation: sc-greek-ember 1.6s steps(2) infinite;
  }
}
`;
}
