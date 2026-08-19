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
 * **The light register is blue, not paper.** It used to be papyrus and ochre
 * gold, and it read as the same room as greek's parchment-and-bronze: two warm
 * neutral grounds carrying a warm metal is one design with two names. So the
 * light register moved somewhere greek cannot follow it — lapis and Egyptian
 * blue against a COOL limestone white, with gold demoted from the structure to
 * an accent. Blue carries the rules, the inputs, the focus ring and the
 * friezes; gold is left for the four things that are meant to catch the eye
 * (the eyes over the sign-in card, the cartouche under it, the ankh on an
 * empty shelf, and the Aten). Dark register is unchanged — a tomb interior
 * with a lamp in it, gold leaf and Egyptian blue lit against black.
 *
 * Colour values are solved backwards from the status set, not chosen:
 *
 * - **The light card is 97% and the floor is 96%.** Moving the ground from
 *   warm papyrus to cool limestone re-opened this, so it was re-solved: on
 *   `205 32% L` warning ink on its dithered badge cell measures 5.08 at 96%
 *   and 4.99 at 95%, so 95% would break the shared status tokens outright.
 *   Shipped at 97% (5.17) for the margin. Measured there: success 7.70 card /
 *   5.75 cell, warning 6.91 / 5.17, error 8.15 / 5.73, muted 7.20 / 5.18.
 * - **The dark card is 6% and the ceiling is 7%.** At 8% the worst pair drops
 *   to 4.90 and fails; at 7% it is 5.01, which is a coin toss rather than a
 *   value. Measured at 6%: success 7.13 / 5.17, warning 8.19 / 5.21, error
 *   6.24 / 5.15, muted 10.02 / 5.13.
 *
 * The rest of the light register, measured: fg on bg 13.99, fg on card 16.05,
 * muted-fg on card 7.39, primary-fg on primary 9.98, accent-fg on accent
 * 10.18, border on card 6.36 and on bg 5.54 — the rule clears the 3:1 UI
 * guideline on both surfaces, which the old ochre one did not.
 *
 * One colour is **decorative only** and must never carry text or a
 * meaning-bearing border:
 *
 * - **Malachite** is placement-restricted rather than contrast-restricted. Its
 *   hue sits 16deg from the success status hue, and green ornament in the same
 *   sight line as a badge turns decoration into state — the trap greek
 *   recorded and rimefast repeated. It is therefore used on the sign-in page
 *   only, which is the one screen in the app with no status badge on it, and
 *   it may not move anywhere else.
 *
 * (Carnelian is gone with the scarab it filled. The gold accent that replaced
 * it measures 3.34 on the page ground and 3.83 on the card, so unlike
 * carnelian it would survive being a rule — it is still only ever a fill.)
 *
 * The ornament is what carries the mode, and it is **hieroglyphic**: a glyph
 * register under every page title and along both edges of a command window, a
 * cartouche and a facing pair of wedjat eyes on the sign-in card, djed pillars
 * flanking the sign-in page, papyrus stalks down the sidebar, an ankh on an
 * empty shelf, and the Aten stepping its rays in the corner. The signs are
 * real and individually legible; the arrangement deliberately is not a
 * sentence. sprites.ts states that at length beside the grids and says why
 * turning it into one would be the bug.
 *
 * Kept out of styles.ts for the reason greek.ts records: that file is one
 * template literal and a stray backtick truncates the lot.
 */
import {
  ANKH,
  ATEN_STRIP,
  CARTOUCHE,
  DJED,
  GLYPH_BAND,
  PAPYRUS,
  WEDJAT,
  mirrorSprite,
  spriteUrl,
} from './sprites';

/**
 * The ornament inks, as literals.
 *
 * Baked rather than read from a custom property: these are painted into SVG
 * data URIs, and a data URI is its own document — it inherits neither
 * currentColor nor var(). Two registers, two sets: LAPIS and NILE_BLUE are
 * the light register's --sc-primary and --sc-border, GOLD_LEAF is the dark
 * register's --sc-primary, and the last three track the two ornament tokens
 * below. egyptian.test.ts checks that every one of them stays in step.
 *
 * There is no dark-register blue ink. The dark ornament is gold on black
 * throughout, and the Egyptian blue down there is the RULE colour only —
 * baking it into a sprite as well would put the same blue on the divider and
 * on the thing beside the divider.
 */
const LAPIS = 'hsl(221 62% 32%)';
const NILE_BLUE = 'hsl(204 68% 33%)';
const GOLD_LEAF = 'hsl(44 82% 55%)';
const GOLD_DAY = 'hsl(40 80% 36%)';
const MALACHITE_DAY = 'hsl(168 52% 26%)';
const MALACHITE_NIGHT = 'hsl(168 45% 55%)';

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
/* ===== Ancient Egyptian — light register: lapis on cool limestone ===== */
:root.sc-egyptian {
  /* Cool limestone for the page, a cooler white for the card. Cool is the
     whole point: warm paper under a warm metal is greek's room, and this mode
     kept walking into it. */
  --sc-bg: 205 24% 91%;
  --sc-fg: 220 30% 12%;
  /* 97%. The floor is 96% and 95% fails outright — see the docstring. */
  --sc-card: 205 32% 97%;
  --sc-card-fg: 220 30% 12%;
  --sc-muted: 205 20% 86%;
  --sc-muted-fg: 215 14% 33%;
  /* Egyptian blue, darkened until it works as a rule: 6.36 on the card and
     5.54 on the page. Every divider, input outline and focus ring takes it. */
  --sc-border: 204 68% 33%;
  --sc-input: 204 68% 33%;
  --sc-primary: 221 62% 32%;
  --sc-primary-fg: 0 0% 100%;
  --sc-primary-shade: 240 10% 8%;
  --sc-ring: 221 62% 32%;
  --sc-accent: 204 42% 87%;
  --sc-accent-fg: 221 62% 22%;
  /* Status stays stock. Every mode since greek maps to STATUS_TOKENS, and
     these three are the dither CELL colours those tokens were measured
     against — move one and contrast.test.ts stops describing the screen. */
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  /* Ornament inks. Not shadcn tokens — the chrome reads them.
     Malachite is SIGN-IN ONLY: 16deg from the success status hue, so it may
     never share a screen with a badge. The sun ink is the gold accent, and it
     is the ONLY gold in the light register that is not on a small ornament —
     which is what keeps gold from becoming the structure again. */
  --sc-malachite: 168 52% 26%;
  --sc-sun-ink: 40 80% 36%;
}
/* ===== dark register: the tomb interior, unchanged and still the best one = */
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
  /* Gold leaf: the tomb registers paint the sun in metal, and a red disk on a
     black ground reads as a stop light. */
  --sc-sun-ink: 44 82% 55%;
}

/* ===== Chrome. Lapis and Egyptian blue on cool limestone by day, gold leaf
   and Egyptian blue on black by night. ===== */

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

/* The command window as a painted wall: the rule doubled, and the glyph
   register running along its top and bottom edges.
   A band rather than four corner medallions — which is what greek does — for
   the reason a register exists at all: the ornament is the repetition, and one
   sign cropped into an 8x8 corner is a smudge.
   The tile is 64x16 and holds four signs, so it is laid at 64px wide: at
   anything narrower the signs stop being individually legible, which is the
   only thing keeping this from reading as a texture.
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
  background-image: ${spriteUrl(GLYPH_BAND, LAPIS)}, ${spriteUrl(GLYPH_BAND, LAPIS)};
  background-repeat: repeat-x;
  background-size: 64px 16px;
  background-position: left top 4px, left bottom 4px;
}
:root.sc-egyptian.sc-dark [class*="bui-DialogInner"],
:root.sc-egyptian.sc-dark [class*="MuiDialog-paper"] {
  background-image: ${spriteUrl(GLYPH_BAND, GOLD_LEAF)}, ${spriteUrl(GLYPH_BAND, GOLD_LEAF)};
}

/* The register under every page title. Read by theme.tsx through these
   variables, because a selector naming the page-header component is dead in a
   production build — its makeStyles class hashes to jss<n>. */
:root.sc-egyptian {
  --sc-header-art: ${spriteUrl(GLYPH_BAND, NILE_BLUE)};
  --sc-header-art-size: 96px 24px;
  --sc-header-art-repeat: repeat-x;
  --sc-header-art-pos: left bottom;
}
:root.sc-egyptian.sc-dark {
  --sc-header-art: ${spriteUrl(GLYPH_BAND, GOLD_LEAF)};
}

/* The same register, smaller, as the rule under a section heading. round, not
   repeat-x: the band is exactly as wide as the words and a title is rarely a
   whole number of tiles, so the last sign would be cut in half. The caret is
   taken out of the flow for the reason greek.ts records at length — its glyph
   carries about 30px of side bearing. */
:root.sc-egyptian .sc-h1 {
  position: relative;
  width: fit-content;
  max-width: 100%;
  padding-bottom: 6px;
  background-image: ${spriteUrl(GLYPH_BAND, NILE_BLUE)};
  background-repeat: round no-repeat;
  background-size: 64px 16px;
  background-position: left bottom;
}
:root.sc-egyptian .sc-h1::after {
  position: absolute;
  left: 100%;
  top: 0;
}
:root.sc-egyptian.sc-dark .sc-h1 {
  background-image: ${spriteUrl(GLYPH_BAND, GOLD_LEAF)};
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

/* A wedjat at each top corner of the sign-in card facing inward, and a
   cartouche centred under them — the eye that guards a threshold, over the
   ring that would carry a name. Both in gold, which is the whole of gold's job
   in the light register now: small things, on purpose.
   The cartouche holds an ankh and NOT a name, and not a plausible-looking
   string of signs either. See sprites.ts: the glyph vocabulary is used as
   ornament, and any name we could put in a name-ring would be a lie.
   On the CARD and nowhere else: a pair of eyes at a door is a ward, and the
   same pair on every panel is a poster.
   The mirror is generated, so the two eyes cannot drift apart when either is
   edited. */
:root.sc-egyptian .sc-login-card {
  background-image: ${spriteUrl(WEDJAT_L, GOLD_DAY)}, ${spriteUrl(WEDJAT_R, GOLD_DAY)}, ${spriteUrl(CARTOUCHE, GOLD_DAY)};
  background-repeat: no-repeat;
  background-size: 20px 20px, 20px 20px, 18px 18px;
  background-position: left 8px top 8px, right 8px top 8px, center top 6px;
}
:root.sc-egyptian.sc-dark .sc-login-card {
  background-image: ${spriteUrl(WEDJAT_L, GOLD_LEAF)}, ${spriteUrl(WEDJAT_R, GOLD_LEAF)}, ${spriteUrl(CARTOUCHE, GOLD_LEAF)};
}

/* Papyrus stalks down the inner edge of the sidebar — the marsh the whole
   civilisation was written on, and the one motif here that is native to a tall
   narrow strip. Against the inner edge in a 16px column, so it survives the
   nav collapsing to icon width: an ornament centred in a panel that changes
   width is an ornament that moves. */
:root.sc-egyptian .sc-nav {
  background-image: ${spriteUrl(PAPYRUS, NILE_BLUE)};
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
  background-image: ${spriteUrl(ANKH, GOLD_DAY)};
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

/* ===== The Aten =====
   SchemeRoot mounts .sc-mode-art once for every mode; this claims the sun.

   WHY THIS AND NOT A CREATURE. The mode used to walk a scarab along the bottom
   rail pushing a disk, and a beetle crossing the screen is a thing moving
   THROUGH the page rather than a thing the page is made of — it pulled the eye
   off whatever was being read, and it read as a bug on the monitor. The Aten
   does not travel. It sits in one corner and its rays step.

   That is also why it is cheap: eight rays around a disk map onto themselves
   under a 45deg turn, so the entire rotation is TWO frames — rays on the axes,
   then rays on the diagonals. There is no in-between position for a smooth
   interpolation to invent, which is the argument for steps() made by the
   subject rather than by the style guide. The disk itself never moves.

   Bottom right, not the sky the mythology would prefer: the app header owns
   the top 64px and .sc-mode-art sits at z-index 1 beneath it, so anything up
   there spends its life behind a toolbar. The bottom rail is empty on every
   route, and a sun low on the right is a designed picture rather than a
   compromise.

   The still frame comes FIRST and is deliberate: the Aten fully painted with
   its rays on the axes, which is frame one. Someone who asked for less motion
   gets the sun, not a gap. */
:root.sc-egyptian .sc-aten {
  display: block;
  right: 28px;
  bottom: 20px;
  width: 26px;
  height: 26px;
  opacity: 1;
  background-image: ${spriteUrl(ATEN_STRIP, GOLD_DAY)};
  background-repeat: no-repeat;
  /* The 32x16 strip at 26px a frame, so the box shows exactly one sun. */
  background-size: 52px 26px;
  background-position: 0 0;
}
:root.sc-egyptian.sc-dark .sc-aten {
  background-image: ${spriteUrl(ATEN_STRIP, GOLD_LEAF)};
}

@media (prefers-reduced-motion: no-preference) {
  /* 1.6s over two frames is a ray position held for 800ms — slow enough to
     read as light turning rather than as a flicker, and nothing else in the
     mode beats against it. The loop has to close on exactly 52px, which is the
     strip's own width at this scale: any other distance leaves the sun
     mid-frame at the wrap and it smears. */
  @keyframes sc-egyptian-aten { to { background-position: -52px 0; } }
  :root.sc-egyptian .sc-aten {
    animation: sc-egyptian-aten 1.6s steps(2) infinite;
  }
}
`;
}
