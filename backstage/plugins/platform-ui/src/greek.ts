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
 * every page title, the key printed across the whole sidebar as a field, the
 * rosettes at the corners of a command window, the palmette on an empty shelf. Those are drawn from
 * sprite grids (sprites.ts) rather than approximated with gradients, so they
 * sit in the same pixel language as the rest of the app instead of looking like
 * a decal applied over it.
 */
import {
  FRET,
  MEANDER,
  PALMETTE,
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

/**
 * The ground tint, for ornament that is a SURFACE rather than a line.
 *
 * A field is not a band. The key in bronze across a whole sidebar is a page of
 * pattern with an app somewhere behind it — which is the failure the mode's
 * old ornament had at the other end of the scale, a narrow strip down one edge
 * that read as a seam rather than as decoration. The tint sits a few points off
 * its own surface, the way a pattern printed into plaster does, and --sc-ground
 * holds the same value in each register so the literal can be checked against
 * the sheet.
 */
const CHALK = 'hsl(40 38% 94%)'; // the tint by day
const SHADE = 'hsl(265 20% 15%)'; // and in the Underworld

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
  /* The ground tint the sidebar field is printed in. Not a shadcn token. */
  --sc-ground: 40 38% 94%;
  /* The hearth ember. Deep bronze rather than the filigree gold: gold at 46%
     lightness on 96% parchment is a spark nobody can see, which is exactly
     what was reported. 26deg off the destructive hue and far darker, so a
     rising ember never reads as a failure badge drifting up the page. */
  --sc-ember: 38 78% 34%;
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
  /* Saturation only: 88% read as neon against the violet ground. The hue stays
     at 14 (29deg off the gold rule's 43 — walking it warmer closes that gap),
     and the lightness stays at 55% because --sc-primary-fg here is DARK ink, so
     desaturating RAISES the ratio while dropping L takes it back through the
     floor: 88% = 5.43, 58% = 5.11, but 62%/L48% = 4.13, an AA failure. */
  --sc-primary: 14 58% 55%;
  --sc-primary-fg: 240 10% 8%;
  --sc-primary-shade: 0 0% 100%;
  --sc-ring: 14 58% 55%;
  --sc-accent: 265 20% 16%;
  --sc-accent-fg: 40 28% 92%;
  --sc-success: 58 62% 42%;
  --sc-warning: 188 65% 45%;
  --sc-destructive: 12 78% 50%;
  --sc-gold: 43 62% 46%;
  --sc-ground: 265 20% 15%;
  /* Gold, unchanged: against the Underworld violet it already reads. */
  --sc-ember: 43 62% 46%;
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
/* Substring form, so these reach the routes that render under a nested MUI
   ThemeProvider: there the generator emits MuiCard-root-186 and the counter
   moves between visits, so a class selector matches nothing. The two elevation
   classes keep their clean spelling beside an ANCHORED suffix match, because
   [class*="MuiPaper-elevation1"] also matches elevation10 through 19. Same
   form as the global rules in styles.ts; styles.test.ts explains it at length. */
:root.sc-greek [class*="MuiCard-root"],
:root.sc-greek .MuiPaper-elevation1, :root.sc-greek [class*="MuiPaper-elevation1-"],
:root.sc-greek .MuiPaper-elevation2, :root.sc-greek [class*="MuiPaper-elevation2-"],
:root.sc-greek .sc-card {
  border-color: hsl(var(--sc-gold)) !important;
  box-shadow:
    inset 0 0 0 1px hsl(var(--sc-gold) / .3),
    var(--sc-shadow) !important;
}

/* The command window, in gold. Same three-shadow construction the base sheet
   already uses for dialogs, retinted, plus an ember bloom behind it. */
:root.sc-greek [class*="bui-DialogInner"],
:root.sc-greek [class*="MuiDialog-paper"] {
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
:root.sc-greek [class*="MuiDialog-paper"] {
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

/* The sign-in page as a temple wall: a frieze along the top edge, and a field
   of palmettes printed across the rest of it.

   NOT the two columns this used to be. A 14px sprite tiled down each edge of
   the viewport is a 14px-wide vertical strip, and at most window sizes that is
   what it looked like — two glitch artefacts rather than a facade. The failure
   is structural and worth stating, because the fluted column is a genuinely
   good sprite: a tall narrow motif needs to be tall on the SCREEN, and a
   repeat-y tile is not tall, it is one short tile stacked over and over with a
   visible seam at every joint. Whatever the tile draws, the eye reads the
   seams.

   A field has no seams to find, and a frieze runs along an edge the way a
   frieze actually does. The palmette ground is in the tint for the reason the
   sidebar's is: a full-page pattern in bronze is a page of pattern with a
   sign-in form somewhere behind it.

   Deliberately only here, which is the restraint the columns already kept: a
   motif reads as intent where it means something and as wallpaper everywhere
   else. A threshold is worth a facade; a data grid is not. */
:root.sc-greek .sc-login {
  background-image: ${art(MEANDER, BRONZE)}, ${art(PALMETTE, CHALK)};
  background-repeat: repeat-x, repeat;
  background-size: 24px 12px, 32px 32px;
  background-position: left top, left top;
}
:root.sc-greek.sc-dark .sc-login {
  background-image: ${art(MEANDER, GOLD)}, ${art(PALMETTE, SHADE)};
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

/* The sidebar as a plastered wall: the key printed across the whole panel, in
   the ground tint rather than in bronze.
   A FIELD, not a strip. An ornament that runs down one edge of a panel reads
   as a seam — something the layout did — where the same motif tiled across the
   surface reads as the wall the navigation is painted on. It is also the only
   form that survives the nav collapsing to icon width, because a field has no
   edge to be anchored to.
   Quiet is the whole requirement here: the nav carries navigation, and every
   label on it has to win. Hence the tint and hence FRET, which is the key drawn
   at one pixel a line instead of MEANDER's two. */
:root.sc-greek .sc-nav {
  background-image: ${art(FRET, CHALK)};
  background-repeat: repeat;
  background-size: 24px 24px;
  background-position: left top;
}
:root.sc-greek.sc-dark .sc-nav {
  background-image: ${art(FRET, SHADE)};
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

/* The fluted COLUMN is no longer drawn anywhere in this mode, and that is a
   decision rather than an oversight: see the note on the sign-in page above.
   The sprite stays in sprites.ts, unreferenced, beside the pomegranate and the
   owl — it is a good drawing that has no place at the size CSS can give it. */

/* The sign-in card carries no watermark. The pomegranate sat in its corner and
   read as a stray dot on a form rather than as the fruit it is — at 28px there
   is not enough of it left to be recognisable, and the frieze and palmette
   field behind the card already say Greek. The sprite stays in sprites.ts,
   unreferenced. */

/* The tour box carries no ornament: it is a coach mark that sits over live
   content, and the owl that used to perch in its corner competed with the
   thing being pointed at. The sprite stays in sprites.ts, unreferenced. */

/* Primary buttons carry the gold rule too. */
:root.sc-greek [class*="MuiButton-containedPrimary"],
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
:root.sc-greek [class*="MuiButton-containedPrimary"],
:root.sc-greek .sc-btn-primary,
:root.sc-greek [data-variant="primary"][class*="bui-Button"] {
  filter: drop-shadow(0 0 5px hsl(var(--sc-primary) / .5));
}
@media (prefers-reduced-motion: no-preference) {
  @keyframes sc-greek-ember {
    0%, 100% { filter: drop-shadow(0 0 5px hsl(var(--sc-primary) / .5)); }
    50% { filter: drop-shadow(0 0 9px hsl(var(--sc-primary) / .8)); }
  }
  :root.sc-greek [class*="MuiButton-containedPrimary"],
  :root.sc-greek .sc-btn-primary,
  :root.sc-greek [data-variant="primary"][class*="bui-Button"] {
    animation: sc-greek-ember 1.6s steps(2) infinite;
  }
}

/* ===== Hestia's hearth: embers rising off the base of the screen.

   This mode's counterpart to hanami's petals, nightshade's moon and rimefast's
   aurora — the scene ornament that carries the theme when nothing is happening.
   Fire rather than weather, because every other Greek ornament here is stone or
   metal (meander, fluting, rosette, palmette) and the room they furnish wants a
   hearth in it. It RISES, which is also what keeps it from reading as the
   sakura overlay recoloured: the two motions are opposites at a glance.

   An ember is a pixel. No sprite and no gradient — a hard 7px square, with a
   ring of glow around it. A soft radial here would be the one blurred thing in
   the whole design system.

   SIZE AND COUNT ARE THE DESIGN, not defaults nobody revisited. This shipped
   as six 4px squares in the filigree gold, and the report back was that the
   animation could not be seen at all: 4px is below the size at which a moving
   speck registers in peripheral vision, six of them across a desktop viewport
   is a spark every few hundred pixels, and mid-gold on 96% parchment has
   almost nothing to separate it from the page. All three had to move together
   — a bigger square in a paler ink is still invisible. Twelve at 7px in the
   deep bronze --sc-ember reads as a hearth throwing sparks; more than that, or
   larger, and the page is a fireworks display with a form on it.

   The still frame is designed, not frozen: outside the motion query the embers
   are a scattered arrangement resting near the hearth line at full opacity,
   which is the picture a reader who asked for less motion is meant to get. ===== */
:root.sc-greek .sc-greek-embers { display: block; }
:root.sc-greek .sc-greek-embers i {
  position: absolute;
  display: block;
  width: 7px;
  height: 7px;
  opacity: 1;
  background: hsl(var(--sc-ember));
  /* drop-shadow, not box-shadow, for the same reason the button ember uses it:
     styles.ts sets box-shadow with !important on MUI surfaces, and an important
     author declaration beats both a normal one and the animation origin.
     3px of glow rather than 2: the halo has to stay proportionate to a square
     that is now most of twice the size, or the ember looks like a lost pixel. */
  filter: drop-shadow(0 0 3px hsl(var(--sc-ember) / .5));
}
:root.sc-greek .sc-greek-embers i:nth-child(1) { left: 4%; bottom: 12%; }
:root.sc-greek .sc-greek-embers i:nth-child(2) { left: 13%; bottom: 5%; }
:root.sc-greek .sc-greek-embers i:nth-child(3) { left: 21%; bottom: 18%; }
:root.sc-greek .sc-greek-embers i:nth-child(4) { left: 30%; bottom: 8%; }
:root.sc-greek .sc-greek-embers i:nth-child(5) { left: 38%; bottom: 15%; }
:root.sc-greek .sc-greek-embers i:nth-child(6) { left: 47%; bottom: 4%; }
:root.sc-greek .sc-greek-embers i:nth-child(7) { left: 55%; bottom: 20%; }
:root.sc-greek .sc-greek-embers i:nth-child(8) { left: 63%; bottom: 10%; }
:root.sc-greek .sc-greek-embers i:nth-child(9) { left: 72%; bottom: 6%; }
:root.sc-greek .sc-greek-embers i:nth-child(10) { left: 80%; bottom: 17%; }
:root.sc-greek .sc-greek-embers i:nth-child(11) { left: 88%; bottom: 9%; }
:root.sc-greek .sc-greek-embers i:nth-child(12) { left: 94%; bottom: 13%; }

@media (prefers-reduced-motion: no-preference) {
  /* Each steps() is load-bearing. rise moves whole pixel rows, so a 4px square
     never straddles two of them and turns into an 8px smudge; waver is the
     thermal wander, on three coarse steps rather than the petals four because
     a spark is lighter than a leaf and jumps rather than glides; flicker is the
     ember dimming, and its 0%/100% equals the static opacity above so the
     designed frame and the animated one agree. */
  /* The climb starts below the fold via the transform, never via a negative
     offset — ornament in this mode is positioned on positive coordinates only,
     which greek.test.ts enforces. */
  @keyframes sc-greek-rise { from { transform: translateY(6px); } to { transform: translateY(-104vh); } }
  /* Sways right from its resting column rather than either side of it: a
     symmetric wander would need a negative margin-left, and this mode bans
     negative offsets on ornament. That rule's word-boundary match reaches
     inside margin-left too, which is the point: it catches the shorthand. */
  @keyframes sc-greek-waver { from { margin-left: 0; } to { margin-left: 18px; } }
  @keyframes sc-greek-flicker { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }

  :root.sc-greek .sc-greek-embers i {
    bottom: 0;
    animation: sc-greek-rise 13s steps(26) infinite,
               sc-greek-waver 3.4s steps(3) infinite alternate,
               sc-greek-flicker 1.4s steps(2) infinite;
  }
  /* Negative delays start each ember mid-climb, and no two share a triple:
     twelve sparks leaving the hearth in formation would read as a machine, not
     a fire, and the more of them there are the more obvious the formation. */
  :root.sc-greek .sc-greek-embers i:nth-child(2) { animation-duration: 16s, 4.1s, 1.9s; animation-delay: -4s, -.6s, -.5s; }
  :root.sc-greek .sc-greek-embers i:nth-child(3) { animation-duration: 11s, 2.8s, 1.1s; animation-delay: -8s, -1.2s, -.9s; }
  :root.sc-greek .sc-greek-embers i:nth-child(4) { animation-duration: 15s, 3.7s, 1.6s; animation-delay: -2s, -.3s, -.2s; }
  :root.sc-greek .sc-greek-embers i:nth-child(5) { animation-duration: 12s, 3.1s, 1.3s; animation-delay: -10s, -1.7s, -.7s; }
  :root.sc-greek .sc-greek-embers i:nth-child(6) { animation-duration: 14s, 4.4s, 1.8s; animation-delay: -6s, -.9s, -1.1s; }
  :root.sc-greek .sc-greek-embers i:nth-child(7) { animation-duration: 17s, 3.4s, 1.5s; animation-delay: -12s, -2.1s, -.4s; }
  :root.sc-greek .sc-greek-embers i:nth-child(8) { animation-duration: 10s, 4.7s, 1.2s; animation-delay: -3s, -1.5s, -1s; }
  :root.sc-greek .sc-greek-embers i:nth-child(9) { animation-duration: 13s, 2.6s, 1.7s; animation-delay: -9s, -.4s, -.6s; }
  :root.sc-greek .sc-greek-embers i:nth-child(10) { animation-duration: 18s, 3.9s, 1.4s; animation-delay: -5s, -2.4s, -1.2s; }
  :root.sc-greek .sc-greek-embers i:nth-child(11) { animation-duration: 11s, 4.2s, 2s; animation-delay: -14s, -1.1s, -.3s; }
  :root.sc-greek .sc-greek-embers i:nth-child(12) { animation-duration: 15s, 2.9s, 1.5s; animation-delay: -7s, -1.9s, -.8s; }
}
`;
}
