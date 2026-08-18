/**
 * Hanami: the Japanese mode, and the first potion in this app that leads
 * *light*.
 *
 * Every other mode here was drawn dark-first and lightened afterwards. Japanese
 * traditional colour does not work that way — the ground is gofun, the crushed
 * shell white a screen or a scroll is primed with, and the palette is a set of
 * named dyes laid on top of it. So the light register is the designed one and
 * the dark register is the same garden after sundown, not the other way round.
 *
 * Colour values are solved, not chosen. Each one below was walked to the lowest
 * lightness that still clears this repo's 5.0:1 bar against BOTH the card and
 * the dithered badge cell (statusTokens.ts explains the cell), which is above
 * AA's 4.5 on purpose: a minimum-passing value breaks on the next small change.
 *
 * Two consequences worth writing down, because both look like mistakes:
 *
 * - **kurenai (#C93756) is not the primary.** It is the obvious safflower red
 *   and it measures 4.96 on the card — it clears AA and misses our bar by
 *   four hundredths. Rather than move the bar for one pretty colour, enji
 *   (355 59% 38.8%, 7.38 against gofun) takes the slot and kurenai stays a
 *   fill.
 * - **The dark card sits at 5.5% lightness.** That is a floor, not a starting
 *   point: destructive-on-cell lands at exactly 5.00 there. Lift the card and
 *   the status set stops clearing, which would force a mode-specific
 *   StatusToken[] — an exception the design system has already spent once, on
 *   greek.
 *
 * Two colours here are DECORATIVE ONLY and must never carry text or a
 * meaning-bearing border: sakura-iro (1.45 on the card) and yamabuki (1.95 in
 * the light register; it is safe as text in the dark register alone, at 9.64).
 * They are declared as their own variables so that stays visible — the next
 * person will otherwise reach for the pretty pink.
 *
 * The ornament, not the palette, is what makes this read as Japanese: seigaiha
 * under every page title, a torii on an empty shelf, a wave field at the
 * threshold, and sakura falling across the whole viewport. All from sprite
 * grids (sprites.ts), so they sit in the same pixel language as the rest of the
 * app rather than looking like a decal over it.
 *
 * Kept out of styles.ts for the reason greek.ts records: that file is one
 * template literal and a stray backtick truncates the lot.
 */
import { BLOSSOM, PETAL_STRIP, SEIGAIHA, TORII, spriteUrl } from './sprites';

/**
 * The ornament inks, as literals.
 *
 * Baked rather than read from a custom property because these are painted into
 * SVG data URIs, and a data URI is its own document: it inherits neither
 * currentColor nor var(). Two registers, two sets. They track --sc-ai and
 * --sc-primary in each register below.
 */
const AI = 'hsl(189 31% 21.6%)'; // ai-iro, the indigo of a woodblock outline
const ASAGI = 'hsl(187 38% 64.7%)'; // asagi, the same indigo lifted for night
const ENJI = 'hsl(355 59% 38.8%)'; // enji, the vermilion a torii is painted
const BENI = 'hsl(348 79% 70.2%)'; // beni, safflower red for the dark register
const SAKURA = 'hsl(14 92% 86%)'; // sakura-iro. Decoration only, never text.

export function hanamiCss(): string {
  return `
/* ===== Hanami — light register: the garden at noon ===== */
:root.sc-hanami {
  --sc-bg: 20 69% 94.9%;
  --sc-fg: 24 12% 8%;
  --sc-card: 45 100% 98.4%;
  --sc-card-fg: 24 12% 8%;
  --sc-muted: 20 45% 91%;
  --sc-muted-fg: 180 8% 33.3%;
  --sc-border: 189 31% 21.6%;
  --sc-input: 189 31% 21.6%;
  --sc-primary: 355 59% 38.8%;
  --sc-primary-fg: 45 100% 98.4%;
  --sc-primary-shade: 240 10% 8%;
  --sc-ring: 355 59% 38.8%;
  --sc-accent: 20 60% 91%;
  --sc-accent-fg: 24 12% 20%;
  /* Status stays stock. A mode may redefine status hue and greek spends that
     exception; everything since maps to STATUS_TOKENS, and these three are the
     dither CELL colours those tokens were measured against. Change one and the
     measurement in contrast.test.ts stops describing the screen. */
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  /* Ornament inks. Not shadcn tokens — the chrome reads them. */
  --sc-ai: 189 31% 21.6%;
  /* DECORATION ONLY, both of them. sakura-iro is 1.45 against the card and
     yamabuki is 1.95: neither may carry text or a border that means anything. */
  --sc-sakura: 14 92% 86%;
  --sc-yamabuki: 39 100% 50%;
}
/* ===== dark register: the same garden at night, lit by the lanterns ===== */
:root.sc-hanami.sc-dark {
  --sc-bg: 197 26% 5.3%;
  --sc-fg: 45 100% 98.4%;
  /* 5.5%, and no higher. See the file docstring: destructive-on-cell is 5.00
     here, so this is the ceiling on lightness rather than a taste. */
  --sc-card: 195 29% 5.5%;
  --sc-card-fg: 45 100% 98.4%;
  --sc-muted: 195 20% 14%;
  --sc-muted-fg: 40 6% 63.5%;
  /* 187 sits 161deg from the beni primary, so the rule cannot read as a second
     helping of the accent — the separation contrast.test.ts enforces. Held at
     44% rather than asagi's own 64.7% because every divider, input outline and
     focus ring in the app takes this value, and at 65% they all glow. */
  --sc-border: 187 38% 44%;
  --sc-input: 187 38% 44%;
  --sc-primary: 348 79% 70.2%;
  --sc-primary-fg: 240 10% 8%;
  --sc-primary-shade: 0 0% 100%;
  --sc-ring: 348 79% 70.2%;
  --sc-accent: 195 22% 15%;
  --sc-accent-fg: 45 100% 98.4%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  --sc-ai: 187 38% 64.7%;
  --sc-sakura: 14 92% 86%;
  /* Safe as text HERE and only here: 9.64 against the night card. */
  --sc-yamabuki: 39 100% 50%;
}

/* ===== Chrome. Indigo outline on gofun in the light register, asagi on a
   near-black lacquer in the dark one. No image assets beyond the sprite URIs
   below: box-shadow, borders and backgrounds. ===== */

/* Cards take the indigo rule and a thin inner line, the woodblock keyline.
   Substring form on the MUI names, so these reach the routes that render under
   a nested MUI ThemeProvider — there the generator emits MuiCard-root-186 and
   the counter moves between visits, so a plain class selector matches nothing.
   The two elevation classes keep their clean spelling beside an ANCHORED
   suffix match, because [class*="MuiPaper-elevation1"] also matches elevation10
   through 19. brands.test.ts pins both halves. */
:root.sc-hanami [class*="MuiCard-root"],
:root.sc-hanami .MuiPaper-elevation1, :root.sc-hanami [class*="MuiPaper-elevation1-"],
:root.sc-hanami .MuiPaper-elevation2, :root.sc-hanami [class*="MuiPaper-elevation2-"],
:root.sc-hanami .sc-card {
  border-color: hsl(var(--sc-ai)) !important;
  box-shadow:
    inset 0 0 0 1px hsl(var(--sc-ai) / .22),
    var(--sc-shadow) !important;
}

/* The command window as a lacquer box: the indigo rule doubled, and a blossom
   at each of the four corners. Four corners from ONE sprite as four background
   layers, because an element has two pseudo-elements and this needs four; the
   blossom is symmetric under a quarter turn, so the same tile is correct at
   every corner. Inset 4px rather than outset, because styles.ts sets
   overflow: hidden here and anything outside the padding box is clipped. */
:root.sc-hanami [class*="bui-DialogInner"],
:root.sc-hanami [class*="MuiDialog-paper"] {
  position: relative;
  border-color: hsl(var(--sc-ai)) !important;
  box-shadow:
    0 0 0 2px hsl(var(--sc-card)),
    0 0 0 4px hsl(var(--sc-ai)),
    var(--sc-shadow) !important;
  background-image: ${spriteUrl(BLOSSOM, SAKURA)}, ${spriteUrl(BLOSSOM, SAKURA)},
    ${spriteUrl(BLOSSOM, SAKURA)}, ${spriteUrl(BLOSSOM, SAKURA)};
  background-repeat: no-repeat;
  background-size: 8px 8px;
  background-position:
    left 4px top 4px, right 4px top 4px,
    left 4px bottom 4px, right 4px bottom 4px;
}

/* Seigaiha running under every page title. Read by theme.tsx through these
   variables, because a selector naming the page-header component is dead in a
   production build — its makeStyles class hashes to jss<n>. */
:root.sc-hanami {
  --sc-header-art: ${spriteUrl(SEIGAIHA, AI)};
  --sc-header-art-size: 24px 24px;
  --sc-header-art-repeat: repeat-x;
  --sc-header-art-pos: left bottom;
}
:root.sc-hanami.sc-dark {
  --sc-header-art: ${spriteUrl(SEIGAIHA, ASAGI)};
}

/* The same wave, half height, as the rule under a section heading. round, not
   repeat-x: the band is exactly as wide as the words and a title is rarely a
   whole number of tiles, so the last one would be cut mid-arc and read as a
   stray bracket. The caret is taken out of the flow for the reason greek.ts
   records at length — its glyph carries about 30px of side bearing. */
:root.sc-hanami .sc-h1 {
  position: relative;
  width: fit-content;
  max-width: 100%;
  padding-bottom: 6px;
  background-image: ${spriteUrl(SEIGAIHA, AI)};
  background-repeat: round no-repeat;
  background-size: 16px 16px;
  background-position: left bottom;
}
:root.sc-hanami .sc-h1::after {
  position: absolute;
  left: 100%;
  top: 0;
}
:root.sc-hanami.sc-dark .sc-h1 {
  background-image: ${spriteUrl(SEIGAIHA, ASAGI)};
}

/* The sign-in page stands at the shore: a wave field along the bottom edge and
   nothing else. Deliberately only here, the same restraint greek keeps — a
   motif reads as intent where it means something and as wallpaper everywhere
   else, and a data grid is not a threshold. */
:root.sc-hanami .sc-login {
  background-image: ${spriteUrl(SEIGAIHA, AI)};
  background-repeat: repeat-x;
  background-size: 32px 32px;
  background-position: left bottom;
}
:root.sc-hanami.sc-dark .sc-login {
  background-image: ${spriteUrl(SEIGAIHA, ASAGI)};
}

/* An empty shelf gets a torii — vermilion, which is what a torii is painted,
   and a friendlier thing to meet than a blank rectangle. */
:root.sc-hanami .sc-empty {
  background-image: ${spriteUrl(TORII, ENJI)};
  background-repeat: no-repeat;
  background-position: center 12px;
  background-size: 32px 32px;
  padding-top: 52px;
}
:root.sc-hanami.sc-dark .sc-empty {
  background-image: ${spriteUrl(TORII, BENI)};
}

/* ===== Sakura =====
   The petals are a real overlay (SchemeRoot mounts .sc-mode-art once for every
   mode), not a pseudo-element, because nine of them need nine boxes.
   The still frame comes FIRST and is a designed picture: nine petals scattered
   over the viewport at rest, full opacity. Someone who asked for less motion
   gets a garden after the wind has dropped, not an empty screen. */
:root.sc-hanami .sc-sakura { display: block; inset: 0; }
:root.sc-hanami .sc-sakura i {
  position: absolute;
  display: block;
  width: 16px;
  height: 16px;
  opacity: 1;
  background-image: ${spriteUrl(PETAL_STRIP, SAKURA)};
  background-repeat: no-repeat;
  /* The strip is four 8x8 frames rendered at 2x, so one frame is 16px wide and
     the whole strip is 64. An 8px petal is a speck on a 1440p viewport. */
  background-size: 64px 16px;
}
:root.sc-hanami .sc-sakura i:nth-child(1) { left: 6%; top: 14%; }
:root.sc-hanami .sc-sakura i:nth-child(2) { left: 17%; top: 61%; }
:root.sc-hanami .sc-sakura i:nth-child(3) { left: 28%; top: 33%; }
:root.sc-hanami .sc-sakura i:nth-child(4) { left: 39%; top: 78%; }
:root.sc-hanami .sc-sakura i:nth-child(5) { left: 51%; top: 8%; }
:root.sc-hanami .sc-sakura i:nth-child(6) { left: 63%; top: 47%; }
:root.sc-hanami .sc-sakura i:nth-child(7) { left: 74%; top: 22%; }
:root.sc-hanami .sc-sakura i:nth-child(8) { left: 85%; top: 69%; }
:root.sc-hanami .sc-sakura i:nth-child(9) { left: 93%; top: 38%; }

@media (prefers-reduced-motion: no-preference) {
  /* Each steps() is required, not stylistic. fall moves whole pixel rows so the
     sprite never lands on a sub-pixel and blurs; turn advances the four-frame
     tumble strip, which would otherwise smear between frames; drift is the
     lateral wander that stops nine petals falling like nine bricks. */
  @keyframes sc-petal-fall { from { transform: translateY(-16px); } to { transform: translateY(102vh); } }
  @keyframes sc-petal-drift { from { margin-left: -14px; } to { margin-left: 14px; } }
  @keyframes sc-petal-turn { to { background-position: -64px 0; } }

  :root.sc-hanami .sc-sakura i {
    top: 0;
    animation: sc-petal-fall 11s steps(28) infinite,
               sc-petal-drift 2.6s steps(4) infinite alternate,
               sc-petal-turn 1.2s steps(4) infinite;
  }
  /* Negative delays start each petal mid-flight, so there is no synchronised
     burst on load and the nine never line up again afterwards. */
  :root.sc-hanami .sc-sakura i:nth-child(2) { animation-duration: 14s, 3.1s, 1.6s; animation-delay: -3s, 0s, -.4s; }
  :root.sc-hanami .sc-sakura i:nth-child(3) { animation-duration: 9s, 2.2s, 1s; animation-delay: -6s, -1s, -.8s; }
  :root.sc-hanami .sc-sakura i:nth-child(4) { animation-duration: 13s, 2.9s, 1.4s; animation-delay: -1s, -.5s, -.2s; }
  :root.sc-hanami .sc-sakura i:nth-child(5) { animation-duration: 10s, 2.4s, 1.1s; animation-delay: -8s, -1.4s, -.6s; }
  :root.sc-hanami .sc-sakura i:nth-child(6) { animation-duration: 15s, 3.4s, 1.7s; animation-delay: -4s, -.9s, -1s; }
  :root.sc-hanami .sc-sakura i:nth-child(7) { animation-duration: 12s, 2.7s, 1.3s; animation-delay: -9s, -1.8s, -.3s; }
  :root.sc-hanami .sc-sakura i:nth-child(8) { animation-duration: 8s, 2.1s, .9s; animation-delay: -2s, -.3s, -.7s; }
  :root.sc-hanami .sc-sakura i:nth-child(9) { animation-duration: 16s, 3.6s, 1.8s; animation-delay: -11s, -2.2s, -1.2s; }
}
`;
}
