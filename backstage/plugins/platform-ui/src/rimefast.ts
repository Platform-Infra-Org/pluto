/**
 * Rimefast: the Norse mode. Dark-first, cold, and much louder than the screen
 * convention.
 *
 * **There is no brown here, and that is the researched choice.** The Viking Age
 * painted loudly: orpiment yellow, lead-oxide red, hematite, copper green,
 * vivianite blue, madder and lichen purple, and woad, are all identified from
 * finds — pigment traces on the Oseberg cart, on wall planks, on carved
 * portals. "Medieval brown" is a modern screen convention borrowed from
 * television, not a fact about the period, so this mode does not use it.
 *
 * **Excluded iconography, deliberately and not by oversight.** The Valknut,
 * Othala, Sowilo (the sig-rune), the Tyr rune and the sunwheel do not appear
 * here, in the sprites or anywhere else. All five are genuine Norse forms and
 * all five are catalogued as appropriated extremist symbols; shipping one in a
 * corporate portal hands a reading to the viewer that we cannot take back.
 * Ravens, Yggdrasil, knotwork and a generic non-semantic futhark band carry no
 * such freight, and rimefast.test.ts asserts this sheet never names the five —
 * so a later "completing the set" fails a test rather than a shipping review.
 *
 * Colour values are solved, not chosen. Two of them look like mistakes and are
 * not:
 *
 * - **Madder is lifted.** The true pigment value (#C7503F) measures 3.60 on
 *   the card and fails outright. Anything here that carries text uses the
 *   lifted 9 68% 62.0%; the true value is fills-only.
 * - **The card sits at 5.5% lightness, deliberately.** At 8% the worst status
 *   pair drops to 4.78 and at 10% to 4.54, either of which would force a
 *   mode-specific StatusToken[] — an exception the design system has already
 *   spent once, on greek. Measured on this card: success 7.15 / cell 5.17,
 *   warn 8.23 / 5.27, error 6.26 / 5.08, muted 10.02 / 5.16.
 *
 * One adjacency to keep an eye on: aurora green (157) sits about five degrees
 * from the success status hue. Ornament in that colour must never land next to
 * a badge, or the decoration starts reading as state — the same trap greek
 * recorded when it pushed success sixty degrees to clear the stock amber.
 *
 * The ornament is what carries the mode, not the palette: a rune band under
 * every page title and the same band turned upright down the sidebar, an
 * interlace along the edges of a command window and down both jambs of the
 * sign-in page, a raven perched at each top corner of the card, Yggdrasil on
 * an empty shelf, and the aurora across the top rail.
 *
 * Kept out of styles.ts for the reason greek.ts records: that file is one
 * template literal and a stray backtick truncates the lot.
 */
import {
  AURORA,
  FUTHARK,
  KNOTWORK,
  RAVEN,
  YGGDRASIL,
  mirrorSprite,
  rotateSprite,
  spriteUrl,
} from './sprites';

/**
 * The ornament inks, as literals.
 *
 * Baked rather than read from a custom property: these are painted into SVG
 * data URIs, and a data URI is its own document — it inherits neither
 * currentColor nor var(). Two registers, two sets, tracking --sc-border and
 * --sc-aurora-ink below.
 */
const ORPIMENT = 'hsl(41 75% 51.4%)';
const OCHRE_DAY = 'hsl(28 70% 34%)';
const WOAD = 'hsl(205 45% 30%)';
const FROST = 'hsl(157 35% 40%)';
const AURORA_INK = 'hsl(157 60% 59.8%)';
const AURORA_DAY = 'hsl(157 55% 28%)';

/**
 * The pair at the door, and the rune band turned to run down a panel edge.
 *
 * Derived rather than authored twice: a mirrored raven drawn by hand drifts
 * from its twin the first time either is edited, and a hand-rotated futhark
 * stops matching the band under the page title.
 */
const RAVEN_L = RAVEN;
const RAVEN_R = mirrorSprite(RAVEN);
const STAVE = rotateSprite(FUTHARK);

export function rimefastCss(): string {
  return `
/* ===== Rimefast — light register: the same coast under snow-light =====
   Written first because the cascade needs it first, not because it leads. */
:root.sc-rimefast {
  --sc-bg: 44 30% 95%;
  --sc-fg: 205 30% 12%;
  --sc-card: 44 40% 98%;
  --sc-card-fg: 205 30% 12%;
  --sc-muted: 44 20% 91%;
  --sc-muted-fg: 205 12% 36%;
  --sc-border: 205 45% 30%;
  --sc-input: 205 45% 30%;
  --sc-primary: 28 70% 34%;
  --sc-primary-fg: 0 0% 100%;
  --sc-primary-shade: 240 10% 8%;
  --sc-ring: 28 70% 34%;
  --sc-accent: 44 25% 91%;
  --sc-accent-fg: 205 30% 20%;
  /* Status stays stock: every mode since greek maps to STATUS_TOKENS, and
     these three are the dither CELL colours those tokens were measured
     against. Move one and contrast.test.ts stops describing the screen. */
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  /* Ornament inks. Not shadcn tokens — the chrome reads them. */
  --sc-aurora-ink: 157 55% 28%;
  --sc-lichen: 272 40% 40%;
  /* Madder, and this is the LIFTED value. The true pigment (#C7503F) is 3.60
     against the card and may be used as a fill only. */
  --sc-madder: 9 60% 40%;
}
/* ===== dark register: polar night, which is the designed one ===== */
:root.sc-rimefast.sc-dark {
  --sc-bg: 205 50% 4.7%;
  --sc-fg: 44 29% 87.3%;
  /* 5.5%, and no higher. See the docstring: 8% takes the worst status pair to
     4.78 and 10% to 4.54, either of which breaks the shared status set. */
  --sc-card: 205 43% 5.5%;
  --sc-card-fg: 44 29% 87.3%;
  --sc-muted: 205 30% 14%;
  --sc-muted-fg: 201 12% 63.7%;
  /* Frost green. 157 sits 116deg from the orpiment primary, so the rule cannot
     read as a second helping of the accent — the separation contrast.test.ts
     enforces. Held at 40% rather than the ornament aurora's 59.8%, because
     every divider, input outline and focus ring in the app takes this value. */
  --sc-border: 157 35% 40%;
  --sc-input: 157 35% 40%;
  --sc-primary: 41 75% 51.4%;
  --sc-primary-fg: 240 10% 8%;
  --sc-primary-shade: 0 0% 100%;
  --sc-ring: 41 75% 51.4%;
  --sc-accent: 205 30% 14%;
  --sc-accent-fg: 44 29% 87.3%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  --sc-aurora-ink: 157 60% 59.8%;
  --sc-lichen: 272 42% 68.2%;
  /* Madder, lifted, for anything carrying text. */
  --sc-madder: 9 68% 62%;
}

/* ===== Chrome. Woad linework on bone by day, frost green on polar night. ===== */

/* Cards take the rule and a thin inner line.
   Substring form on the MUI names, so these reach the routes that render under
   a nested MUI ThemeProvider — there the generator emits MuiCard-root-186 and
   the counter moves between visits, so a plain class selector matches nothing.
   The two elevation classes keep their clean spelling beside an ANCHORED
   suffix match, because [class*="MuiPaper-elevation1"] also matches elevation10
   through 19. brands.test.ts pins both halves. */
:root.sc-rimefast [class*="MuiCard-root"],
:root.sc-rimefast .MuiPaper-elevation1, :root.sc-rimefast [class*="MuiPaper-elevation1-"],
:root.sc-rimefast .MuiPaper-elevation2, :root.sc-rimefast [class*="MuiPaper-elevation2-"],
:root.sc-rimefast .sc-card {
  border-color: hsl(var(--sc-border)) !important;
  box-shadow:
    inset 0 0 0 1px hsl(var(--sc-border) / .28),
    var(--sc-shadow) !important;
}

/* The command window as a carved portal: the rule doubled, and an interlace
   band along its top and bottom edges.
   A band rather than four corner medallions — which is what greek and the two
   modes since do — because interlace is a running ornament: a knot cropped to
   an 8x8 corner has no over and no under left in it, which is the whole of
   what makes it a knot. Inset 4px rather than outset, because styles.ts sets
   overflow: hidden here and anything outside the padding box is clipped. */
:root.sc-rimefast [class*="bui-DialogInner"],
:root.sc-rimefast [class*="MuiDialog-paper"] {
  position: relative;
  border-color: hsl(var(--sc-border)) !important;
  box-shadow:
    0 0 0 2px hsl(var(--sc-card)),
    0 0 0 4px hsl(var(--sc-border)),
    0 0 14px hsl(var(--sc-primary) / .22),
    var(--sc-shadow) !important;
  background-image: ${spriteUrl(KNOTWORK, WOAD)}, ${spriteUrl(KNOTWORK, WOAD)};
  background-repeat: repeat-x;
  background-size: 16px 16px;
  background-position: left top 4px, left bottom 4px;
}
:root.sc-rimefast.sc-dark [class*="bui-DialogInner"],
:root.sc-rimefast.sc-dark [class*="MuiDialog-paper"] {
  background-image: ${spriteUrl(KNOTWORK, FROST)}, ${spriteUrl(KNOTWORK, FROST)};
}

/* A rune band under every page title. Read by theme.tsx through these
   variables, because a selector naming the page-header component is dead in a
   production build — its makeStyles class hashes to jss<n>. */
:root.sc-rimefast {
  --sc-header-art: ${spriteUrl(FUTHARK, OCHRE_DAY)};
  --sc-header-art-size: 24px 24px;
  --sc-header-art-repeat: repeat-x;
  --sc-header-art-pos: left bottom;
}
:root.sc-rimefast.sc-dark {
  --sc-header-art: ${spriteUrl(FUTHARK, ORPIMENT)};
}

/* The same band, half height, as the rule under a section heading. round, not
   repeat-x: the band is exactly as wide as the words and a title is rarely a
   whole number of tiles, so the last stave would be cut in half. The caret is
   taken out of the flow for the reason greek.ts records at length — its glyph
   carries about 30px of side bearing. */
:root.sc-rimefast .sc-h1 {
  position: relative;
  width: fit-content;
  max-width: 100%;
  padding-bottom: 6px;
  background-image: ${spriteUrl(FUTHARK, OCHRE_DAY)};
  background-repeat: round no-repeat;
  background-size: 16px 16px;
  background-position: left bottom;
}
:root.sc-rimefast .sc-h1::after {
  position: absolute;
  left: 100%;
  top: 0;
}
:root.sc-rimefast.sc-dark .sc-h1 {
  background-image: ${spriteUrl(FUTHARK, ORPIMENT)};
}

/* The sign-in page as a carved doorway: an interlace jamb down each side,
   running the full height. Deliberately only here, the same restraint greek
   keeps — a motif reads as intent where it means something and as wallpaper
   everywhere else, and a data grid is not a threshold. */
:root.sc-rimefast .sc-login {
  background-image: ${spriteUrl(KNOTWORK, WOAD)}, ${spriteUrl(KNOTWORK, WOAD)};
  background-repeat: repeat-y, repeat-y;
  background-size: 16px 16px;
  background-position: left 18px top, right 18px top;
}
:root.sc-rimefast.sc-dark .sc-login {
  background-image: ${spriteUrl(KNOTWORK, FROST)}, ${spriteUrl(KNOTWORK, FROST)};
}

/* A raven perched at each top corner of the sign-in card, facing inward.
   The mirror is generated, not drawn: two birds facing the same way are one
   drawing used twice, which is what the eye notices first.
   On the CARD and nowhere else. Ravens are a pair at a threshold; a bird in
   the corner of every panel is an infestation. */
:root.sc-rimefast .sc-login-card {
  background-image: ${spriteUrl(RAVEN_L, OCHRE_DAY)}, ${spriteUrl(RAVEN_R, OCHRE_DAY)};
  background-repeat: no-repeat;
  background-size: 20px 20px;
  background-position: left 8px top 8px, right 8px top 8px;
}
:root.sc-rimefast.sc-dark .sc-login-card {
  background-image: ${spriteUrl(RAVEN_L, ORPIMENT)}, ${spriteUrl(RAVEN_R, ORPIMENT)};
}

/* The sidebar takes the same rune band as the page titles, turned upright and
   run down its inner edge — which is how a rune band is carved when it has to
   follow a vertical face, glyphs perpendicular to the band rather than lying
   on their sides. Against the inner edge in a 16px column, so it survives the
   nav collapsing to icon width: an ornament centred in a panel that changes
   width is an ornament that moves. */
:root.sc-rimefast .sc-nav {
  background-image: ${spriteUrl(STAVE, OCHRE_DAY)};
  background-repeat: repeat-y;
  background-size: 16px 16px;
  background-position: right 2px top;
}
:root.sc-rimefast.sc-dark .sc-nav {
  background-image: ${spriteUrl(STAVE, ORPIMENT)};
}

/* An empty shelf gets Yggdrasil — a tree is a better thing to meet than a
   blank rectangle, and this one is the axis the whole cosmology hangs on. */
:root.sc-rimefast .sc-empty {
  background-image: ${spriteUrl(YGGDRASIL, OCHRE_DAY)};
  background-repeat: no-repeat;
  background-position: center 12px;
  background-size: 32px 32px;
  padding-top: 52px;
}
:root.sc-rimefast.sc-dark .sc-empty {
  background-image: ${spriteUrl(YGGDRASIL, ORPIMENT)};
}

/* Primary buttons take the orpiment rule and an orpiment bloom.
   GOLD, not aurora green, and that is this mode's own rule rather than a
   colour whim: aurora green sits about five degrees from the success status
   hue, and a green halo around a button that sits in the same sight line as a
   status badge turns decoration into state. The aurora keeps to the top rail,
   as far from a badge as the viewport allows; everything nearer than that
   glows in the primary.
   filter: drop-shadow(), not box-shadow: styles.ts claims box-shadow with
   !important on the button root, and an important author declaration beats
   both a normal one at any specificity AND the animation origin, so a
   box-shadow glow here would never paint. Nothing claims filter.
   The unanimated declaration below is the LIT frame, so a reader who asked for
   stillness gets the intended picture rather than a glow frozen halfway. */
:root.sc-rimefast [class*="MuiButton-containedPrimary"],
:root.sc-rimefast .sc-btn-primary,
:root.sc-rimefast [data-variant="primary"][class*="bui-Button"] {
  border: var(--sc-border-w) solid hsl(var(--sc-primary)) !important;
  filter: drop-shadow(0 0 5px hsl(var(--sc-primary) / .45));
}
@media (prefers-reduced-motion: no-preference) {
  /* Two frames, stepped, and slower than the aurora above it: a forge glows,
     it does not blink. */
  @keyframes sc-rimefast-forge {
    0%, 100% { filter: drop-shadow(0 0 5px hsl(var(--sc-primary) / .45)); }
    50% { filter: drop-shadow(0 0 9px hsl(var(--sc-primary) / .75)); }
  }
  :root.sc-rimefast [class*="MuiButton-containedPrimary"],
  :root.sc-rimefast .sc-btn-primary,
  :root.sc-rimefast [data-variant="primary"][class*="bui-Button"] {
    animation: sc-rimefast-forge 2s steps(2) infinite;
  }
}

/* ===== The aurora =====/* ===== The aurora =====
   SchemeRoot mounts .sc-mode-art once for every mode; this claims the top rail.
   The class name is .sc-rune-rule because it is the rule across the top of the
   viewport, and in this mode that rule is painted as an aurora.
   The still frame comes FIRST and is a designed picture: the same strip, fully
   painted and correctly coloured on frame one. Someone who asked for less
   motion gets the northern sky, not an empty band.
   NOT placed near a badge, and this is a rule rather than a layout accident:
   aurora green is five degrees from the success status hue, so the two must
   never share a sight line. The top rail is as far from a status badge as the
   viewport allows. */
:root.sc-rimefast .sc-rune-rule {
  display: block;
  top: 0;
  left: 0;
  right: 0;
  height: 24px;
  opacity: 1;
  background-image: ${spriteUrl(AURORA, AURORA_DAY)};
  background-repeat: repeat-x;
  /* The 32x8 strip at 3x, so one tile is 96px wide. */
  background-size: 96px 24px;
  background-position: 0 0;
}
:root.sc-rimefast.sc-dark .sc-rune-rule {
  background-image: ${spriteUrl(AURORA, AURORA_INK)};
}

@media (prefers-reduced-motion: no-preference) {
  /* 192px over six steps is 32px a step — a third of the 96px tile, so the
     curtain visibly moves — and 192 is exactly two tiles, so the loop closes
     with no jump. 800ms a frame reads as a shimmer rather than a scroll; at a
     smooth interpolation it reads as a banner sliding past, which is the one
     thing an aurora does not do. */
  @keyframes sc-aurora { to { background-position: -192px 0; } }
  :root.sc-rimefast .sc-rune-rule { animation: sc-aurora 4.8s steps(6) infinite; }
}
`;
}
