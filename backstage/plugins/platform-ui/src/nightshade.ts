/**
 * Nightshade: the witch mode. Dark-first, green over violet, gold filigree.
 *
 * **What this is.** The read it is after — fine gold linework on a saturated,
 * cool dark ground — is art nouveau, and that lineage is documented rather than
 * guessed: Jen Zee has repeatedly named Mucha and Klimt as the reference behind
 * Supergiant's look, and the cool green/grey shift is Hades II's own departure
 * from the first game's red-and-orange underworld. This mode takes the
 * *grammar* — an ornamental frame, a botanical motif, a witch-green key light
 * against violet dark — and draws it on our pixel grid.
 *
 * **What it is not, deliberately.** No Melinoe or Hecate, as characters or as
 * silhouettes: the bob-plus-crescent profile is a recognisable character mark,
 * not a genre convention. No four-goddess braid detail. No Hades II logotype
 * or laurel lockup. Not the game's own UI frame geometry. And not the
 * boon-rarity ramp (white/blue/purple/red) — which we could not use anyway,
 * because it would collide head-on with our status semantics.
 *
 * **Why this is not "greek at night".** `greek` already owns gold-on-dark, with
 * the meander and the palmette carrying it. A second gold-on-dark mode would be
 * the same potion twice. Nightshade therefore leads with witch green over
 * violet, and the gold is filigree only — corners and rules, never the accent.
 *
 * Colour values are solved, not chosen: every value below was walked to the
 * lowest lightness clearing this repo's 5.0:1 bar against BOTH the card and the
 * dithered badge cell (statusTokens.ts), which is deliberately above AA's 4.5.
 * Measured on the dark card: success 7.25 / cell 5.35, warn 8.35 / 5.35, error
 * 6.35 / 5.06, muted 10.17 / 5.27.
 *
 * Two adjacency rules that are not obvious from the values alone:
 *
 * - **Never pair witch green with filigree gold directly.** Both are mid-light
 *   and they vibrate against each other. Separate them with the card — which is
 *   why the cauldron's iron is silver and not gold.
 * - **Selene silver is an ornament colour.** It is not a second text tone; two
 *   near-white inks on one surface is how a hierarchy stops meaning anything.
 *
 * The ornament is what carries the mode, not the palette: a sprig band under
 * every page title and the same sprig printed across the whole sidebar as a
 * field, filigree
 * medallions at the corners of a command window, a corner bracket at each
 * corner of the sign-in card, crescent and torch flanking it, a cauldron on an
 * empty shelf, and the moon going through its phases in the corner of the
 * viewport.
 *
 * Kept out of styles.ts for the reason greek.ts records: that file is one
 * template literal and a stray backtick truncates the lot.
 */
import {
  CAULDRON,
  CRESCENT_FLAME,
  FILIGREE,
  MOON_STRIP,
  SCROLL_CORNER,
  SPRIG,
  TORCH,
  rotateSprite,
  spriteUrl,
} from './sprites';

/**
 * The ornament inks, as literals.
 *
 * Baked rather than read from a custom property: these are painted into SVG
 * data URIs, and a data URI is its own document — it inherits neither
 * currentColor nor var(). Two registers, two sets, tracking --sc-filigree,
 * --sc-witch and --sc-selene below.
 */
const GOLD = 'hsl(41 67% 54.9%)';
const GOLD_DAY = 'hsl(41 60% 40%)';
const WITCH = 'hsl(142 67% 66.3%)';
const WITCH_DAY = 'hsl(152 62% 26%)';
const SELENE = 'hsl(219 40% 84.9%)';
const SELENE_DAY = 'hsl(219 30% 60%)';

/**
 * The ground tint, for ornament that is a SURFACE rather than a line.
 *
 * A field is not a band: the sprig in filigree gold across a whole sidebar is
 * a page of pattern with an app somewhere behind it. The tint sits a few
 * points off its own surface, which is what a printed paper does, and
 * --sc-ground holds the same value in each register so the literal here can be
 * checked against the sheet.
 */
const DUSK_DAY = 'hsl(258 22% 94%)'; // the tint by day
const DUSK = 'hsl(254 30% 13%)'; // and at night

/**
 * The four corner brackets of the nouveau frame.
 *
 * One authored grid and three quarter turns, rather than four hand-drawn
 * corners that drift apart the first time one of them is edited. This is the
 * other half of the corner problem: FILIGREE is symmetric under a quarter turn
 * so ONE tile serves four corners, and the price of that symmetry is that it
 * has no corner in it — it is a medallion sitting near one. A bracket has two
 * rails meeting at an elbow, so it has to know which corner it is on.
 */
const CORNER_TL = SCROLL_CORNER;
const CORNER_TR = rotateSprite(CORNER_TL);
const CORNER_BR = rotateSprite(CORNER_TR);
const CORNER_BL = rotateSprite(CORNER_BR);

export function nightshadeCss(): string {
  return `
/* ===== Nightshade — light register: the crossroads at dawn =====
   Written first because the cascade needs it first, not because it leads. This
   mode is designed dark; the light register is the same shrine in daylight. */
:root.sc-nightshade {
  --sc-bg: 40 20% 96%;
  --sc-fg: 254 25% 12%;
  --sc-card: 260 30% 99%;
  --sc-card-fg: 254 25% 12%;
  --sc-muted: 260 15% 93%;
  --sc-muted-fg: 256 12% 38%;
  --sc-border: 41 60% 40%;
  --sc-input: 41 60% 40%;
  --sc-primary: 152 62% 26%;
  --sc-primary-fg: 0 0% 100%;
  --sc-primary-shade: 240 10% 8%;
  --sc-ring: 152 62% 26%;
  --sc-accent: 260 25% 93%;
  --sc-accent-fg: 254 25% 20%;
  /* Status stays stock: every mode since greek maps to STATUS_TOKENS, and
     these three are the dither CELL colours those tokens were measured
     against. Move one and contrast.test.ts stops describing the screen. */
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  /* Ornament inks. Not shadcn tokens — the chrome reads them. */
  --sc-filigree: 41 60% 40%;
  --sc-witch: 152 62% 26%;
  --sc-moonlight: 269 50% 42%;
  /* ORNAMENT ONLY. Silver is not a second text tone; see the docstring. */
  --sc-selene: 219 30% 60%;
  /* The ground tint the sidebar field is printed in. */
  --sc-ground: 258 22% 94%;
}
/* ===== dark register: the crossroads at night, which is the designed one ===== */
:root.sc-nightshade.sc-dark {
  --sc-bg: 251 41% 5.3%;
  --sc-fg: 263 39% 93.5%;
  --sc-card: 254 39% 6.5%;
  --sc-card-fg: 263 39% 93.5%;
  --sc-muted: 254 25% 15%;
  --sc-muted-fg: 256 24% 69.6%;
  /* Moonlight violet, dimmed. 269 sits 127deg from the witch-green primary, so
     the rule cannot read as a second helping of the accent — the separation
     contrast.test.ts enforces. Held well below the ornament violet's 69.8%
     because every divider, input outline and focus ring takes this value. */
  --sc-border: 269 45% 52%;
  --sc-input: 269 45% 52%;
  --sc-primary: 142 67% 66.3%;
  --sc-primary-fg: 240 10% 8%;
  --sc-primary-shade: 0 0% 100%;
  --sc-ring: 142 67% 66.3%;
  --sc-accent: 254 26% 16%;
  --sc-accent-fg: 263 39% 93.5%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  --sc-filigree: 41 67% 54.9%;
  --sc-witch: 142 67% 66.3%;
  --sc-moonlight: 269 68% 69.8%;
  --sc-selene: 219 40% 84.9%;
  --sc-ground: 254 30% 13%;
}

/* ===== Chrome. Gold linework on a violet dark, and the same linework in a
   darker gold on bone by day. ===== */

/* Cards take the gold rule and a thin inner line.
   Substring form on the MUI names, so these reach the routes that render under
   a nested MUI ThemeProvider — there the generator emits MuiCard-root-186 and
   the counter moves between visits, so a plain class selector matches nothing.
   The two elevation classes keep their clean spelling beside an ANCHORED
   suffix match, because [class*="MuiPaper-elevation1"] also matches elevation10
   through 19. brands.test.ts pins both halves. */
:root.sc-nightshade [class*="MuiCard-root"],
:root.sc-nightshade .MuiPaper-elevation1, :root.sc-nightshade [class*="MuiPaper-elevation1-"],
:root.sc-nightshade .MuiPaper-elevation2, :root.sc-nightshade [class*="MuiPaper-elevation2-"],
:root.sc-nightshade .sc-card {
  border-color: hsl(var(--sc-filigree)) !important;
  box-shadow:
    inset 0 0 0 1px hsl(var(--sc-filigree) / .28),
    var(--sc-shadow) !important;
}

/* The command window as a nouveau frame: the gold rule doubled, a filigree
   medallion at each of the four corners, and a violet bloom behind it.
   Four corners from ONE sprite as four background layers, because an element
   has two pseudo-elements and this needs four; the medallion is symmetric
   under a quarter turn, so the same tile is correct at every corner. Inset
   4px rather than outset, because styles.ts sets overflow: hidden here and
   anything painted outside the padding box is clipped away. */
:root.sc-nightshade [class*="bui-DialogInner"],
:root.sc-nightshade [class*="MuiDialog-paper"] {
  position: relative;
  border-color: hsl(var(--sc-filigree)) !important;
  box-shadow:
    0 0 0 2px hsl(var(--sc-card)),
    0 0 0 4px hsl(var(--sc-filigree)),
    0 0 14px hsl(var(--sc-moonlight) / .3),
    var(--sc-shadow) !important;
  background-image: ${spriteUrl(FILIGREE, GOLD_DAY)}, ${spriteUrl(FILIGREE, GOLD_DAY)},
    ${spriteUrl(FILIGREE, GOLD_DAY)}, ${spriteUrl(FILIGREE, GOLD_DAY)};
  background-repeat: no-repeat;
  background-size: 8px 8px;
  background-position:
    left 4px top 4px, right 4px top 4px,
    left 4px bottom 4px, right 4px bottom 4px;
}
:root.sc-nightshade.sc-dark [class*="bui-DialogInner"],
:root.sc-nightshade.sc-dark [class*="MuiDialog-paper"] {
  background-image: ${spriteUrl(FILIGREE, GOLD)}, ${spriteUrl(FILIGREE, GOLD)},
    ${spriteUrl(FILIGREE, GOLD)}, ${spriteUrl(FILIGREE, GOLD)};
}

/* A nightshade sprig running under every page title. Read by theme.tsx through
   these variables, because a selector naming the page-header component is dead
   in a production build — its makeStyles class hashes to jss<n>. */
:root.sc-nightshade {
  --sc-header-art: ${spriteUrl(SPRIG, GOLD_DAY)};
  --sc-header-art-size: 24px 24px;
  --sc-header-art-repeat: repeat-x;
  --sc-header-art-pos: left bottom;
}
:root.sc-nightshade.sc-dark {
  --sc-header-art: ${spriteUrl(SPRIG, GOLD)};
}

/* The same vine, half height, as the rule under a section heading. round, not
   repeat-x: the band is exactly as wide as the words and a title is rarely a
   whole number of tiles, so the last one would be cut mid-leaf. The caret is
   taken out of the flow for the reason greek.ts records at length — its glyph
   carries about 30px of side bearing. */
:root.sc-nightshade .sc-h1 {
  position: relative;
  width: fit-content;
  max-width: 100%;
  padding-bottom: 6px;
  background-image: ${spriteUrl(SPRIG, GOLD_DAY)};
  background-repeat: round no-repeat;
  background-size: 16px 16px;
  background-position: left bottom;
}
:root.sc-nightshade .sc-h1::after {
  position: absolute;
  left: 100%;
  top: 0;
}
:root.sc-nightshade.sc-dark .sc-h1 {
  background-image: ${spriteUrl(SPRIG, GOLD)};
}

/* The sign-in page as a crossroads shrine: a crescent cradling a green flame
   standing at each side, and a witchfire torch planted below each of them —
   the crescent-and-torch pair the whole mode is built on, and the one place
   both halves of it are shown together. Two layers means two URIs per crescent
   and six background layers in total — a data URI inherits no custom property,
   so a two-colour motif is two images that have to stay in step by hand.
   The torches burn green rather than gold: the flame is the light in this
   mode, and gold beside green is the one pairing this mode does not make.
   Deliberately only here, the same restraint greek keeps: a motif reads as
   intent where it means something and as wallpaper everywhere else. */
:root.sc-nightshade .sc-login {
  background-image:
    ${spriteUrl(CRESCENT_FLAME, SELENE_DAY)}, ${spriteUrl(CRESCENT_FLAME, WITCH_DAY, '~')},
    ${spriteUrl(CRESCENT_FLAME, SELENE_DAY)}, ${spriteUrl(CRESCENT_FLAME, WITCH_DAY, '~')},
    ${spriteUrl(TORCH, WITCH_DAY)}, ${spriteUrl(TORCH, WITCH_DAY)};
  background-repeat: no-repeat;
  background-size: 32px 32px;
  background-position:
    left 20px center, left 20px center,
    right 20px center, right 20px center,
    left 24px bottom 32px, right 24px bottom 32px;
}
:root.sc-nightshade.sc-dark .sc-login {
  background-image:
    ${spriteUrl(CRESCENT_FLAME, SELENE)}, ${spriteUrl(CRESCENT_FLAME, WITCH, '~')},
    ${spriteUrl(CRESCENT_FLAME, SELENE)}, ${spriteUrl(CRESCENT_FLAME, WITCH, '~')},
    ${spriteUrl(TORCH, WITCH)}, ${spriteUrl(TORCH, WITCH)};
}

/* The sign-in card inside its own frame: a corner bracket at each of the four
   corners, each one the authored top-left grid turned to face its corner.
   On the CARD rather than on the dialog, which keeps its filigree medallions:
   a bracket needs two rails and an elbow, and the dialog's own gold rule is
   already those rails. Doubling them would draw a frame inside a frame. */
:root.sc-nightshade .sc-login-card {
  background-image: ${spriteUrl(CORNER_TL, GOLD_DAY)}, ${spriteUrl(CORNER_TR, GOLD_DAY)},
    ${spriteUrl(CORNER_BR, GOLD_DAY)}, ${spriteUrl(CORNER_BL, GOLD_DAY)};
  background-repeat: no-repeat;
  background-size: 14px 14px;
  background-position:
    left 4px top 4px, right 4px top 4px,
    right 4px bottom 4px, left 4px bottom 4px;
}
:root.sc-nightshade.sc-dark .sc-login-card {
  background-image: ${spriteUrl(CORNER_TL, GOLD)}, ${spriteUrl(CORNER_TR, GOLD)},
    ${spriteUrl(CORNER_BR, GOLD)}, ${spriteUrl(CORNER_BL, GOLD)};
}

/* The sidebar as printed paper: the sprig tiled across the whole panel in the
   ground tint, a nouveau wallpaper rather than a rail.
   A FIELD, not a strip. The vine used to run down the inner edge in a 16px
   column, and a band down one edge of a panel reads as a seam — something the
   layout did — where the same motif tiled across the surface reads as the wall
   the navigation hangs on. A field also has no edge to be anchored to, so it
   survives the nav collapsing to its icon width.
   Still the same botanical motif as the page-title band, which was always the
   point: one plant, several places. Quiet is the requirement — the nav carries
   navigation, and every label on it has to win. */
:root.sc-nightshade .sc-nav {
  background-image: ${spriteUrl(SPRIG, DUSK_DAY)};
  background-repeat: repeat;
  background-size: 32px 32px;
  background-position: left top;
}
:root.sc-nightshade.sc-dark .sc-nav {
  background-image: ${spriteUrl(SPRIG, DUSK)};
}

/* An empty shelf gets the cauldron, iron in silver and brew in witch green.
   Silver rather than gold for the iron: gold beside green is the one pairing
   this mode does not make. */
:root.sc-nightshade .sc-empty {
  background-image:
    ${spriteUrl(CAULDRON, SELENE_DAY)}, ${spriteUrl(CAULDRON, WITCH_DAY, '~')};
  background-repeat: no-repeat;
  background-position: center 12px, center 12px;
  background-size: 32px 32px;
  padding-top: 52px;
}
:root.sc-nightshade.sc-dark .sc-empty {
  background-image:
    ${spriteUrl(CAULDRON, SELENE)}, ${spriteUrl(CAULDRON, WITCH, '~')};
}

/* Primary buttons take the gold rule the cards and the frame carry, and a
   moonlight bloom behind it.
   VIOLET, not witch green, and that is the mode's own adjacency rule rather
   than a colour whim: the button is already gold, and gold beside green is the
   pairing this mode does not make — the two are both mid-light and they
   vibrate. Violet is what the dialog blooms with, so the two lit surfaces in
   the mode agree.
   filter: drop-shadow(), not box-shadow: styles.ts claims box-shadow with
   !important on the button root, and an important author declaration beats
   both a normal one at any specificity AND the animation origin, so a
   box-shadow glow here would never paint. Nothing claims filter.
   The unanimated declaration below is the LIT frame, so a reader who asked for
   stillness gets the intended picture rather than a glow frozen halfway. */
:root.sc-nightshade [class*="MuiButton-containedPrimary"],
:root.sc-nightshade .sc-btn-primary,
:root.sc-nightshade [data-variant="primary"][class*="bui-Button"] {
  border: var(--sc-border-w) solid hsl(var(--sc-filigree)) !important;
  filter: drop-shadow(0 0 5px hsl(var(--sc-moonlight) / .5));
}
@media (prefers-reduced-motion: no-preference) {
  /* Two frames, stepped. A candle gutters; it does not fade. */
  @keyframes sc-nightshade-gutter {
    0%, 100% { filter: drop-shadow(0 0 5px hsl(var(--sc-moonlight) / .5)); }
    50% { filter: drop-shadow(0 0 9px hsl(var(--sc-moonlight) / .8)); }
  }
  :root.sc-nightshade [class*="MuiButton-containedPrimary"],
  :root.sc-nightshade .sc-btn-primary,
  :root.sc-nightshade [data-variant="primary"][class*="bui-Button"] {
    animation: sc-nightshade-gutter 1.8s steps(2) infinite;
  }
}

/* ===== The moon =====/* ===== The moon =====
   SchemeRoot mounts .sc-mode-art once for every mode; this claims the moon.
   The still frame comes FIRST and is a designed picture: frame one of the
   strip, one crescent, at full opacity. Someone who asked for less motion gets
   a moon, not a blank corner. */
:root.sc-nightshade .sc-moon {
  display: block;
  top: 24px;
  right: 24px;
  width: 32px;
  height: 32px;
  opacity: 1;
  background-image: ${spriteUrl(MOON_STRIP, SELENE_DAY)};
  background-repeat: no-repeat;
  /* Eight 8x8 frames rendered at 4x: one frame is 32px, the strip is 256. An
     8px moon in the corner of a 1440p viewport is a speck. */
  background-size: 256px 32px;
  background-position: 0 0;
}
:root.sc-nightshade.sc-dark .sc-moon {
  background-image: ${spriteUrl(MOON_STRIP, SELENE)};
}

@media (prefers-reduced-motion: no-preference) {
  /* steps(8) is mandatory, not stylistic: interpolation slides the strip
     between frames and shows two half-moons at once. Eight seconds for the
     whole lunation, one second a phase. */
  @keyframes sc-moonphase { to { background-position: -256px 0; } }
  :root.sc-nightshade .sc-moon { animation: sc-moonphase 8s steps(8) infinite; }
}
`;
}
