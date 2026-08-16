/**
 * Agence Foudre mode: an editorial magazine, rendered as a control plane.
 *
 * The reference is a single-column magazine site whose whole argument is
 * typographic — oversized display type, almost no chrome, and colour used as
 * "emotional punctuation" rather than fill. Three of its patterns port cleanly
 * onto an app and are what make this mode read as Foudre rather than as pink:
 *
 * 1. **Deliberately flat.** "No shadows, gradients, or glass effects — depth
 *    comes from colour contrast and typographic scale." That is the direct
 *    opposite of the pixel system's hard offset shadow, so the shadow is unset
 *    rather than restyled.
 * 2. **The two dots.** The reference's only furniture is a pair of 50px magenta
 *    circles pinned to the top corners — "the only two dots on the page." The
 *    brand mark becomes one of them: a full circle, flat magenta, no tile.
 * 3. **Colour dialogue.** Loud Lipstick Magenta against whispered Blush Cream,
 *    with Bubblegum in between. Headings take the magenta; the page keeps its
 *    Warm Chalk ground and Forest Ink body text, which is the pairing that
 *    stops the pink reading as decoration.
 *
 * Palette from the published tokens: Lipstick Magenta #db3c8a, Forest Ink
 * #00522d, Blush Cream #fce5df, Warm Chalk #fff8f6, Lilac Mist #d1cfe4,
 * Bubblegum #f29ebd, Cotton Pink #e878b2.
 *
 * Two departures, both forced by measurement:
 *
 * 1. **Magenta darkens to 38% where it fills.** At its published #db3c8a it
 *    carries white at 3.3:1, below AA — it is a display-type colour, not a
 *    button fill. It keeps its full intensity as *type*, which is how the
 *    reference actually uses it.
 * 2. **Lilac Mist stays a hairline, not the rule.** At #d1cfe4 it measures
 *    about 1.4:1 on the card and cannot carry a border that means anything, so
 *    `--sc-border` takes a magenta-leaning tone that clears 3:1 and the lilac
 *    is kept as `--sc-hairline` for dividers, which is its job in the
 *    reference too.
 *
 * The fonts are the published *fallbacks* — Antonio and Impact for Beni's
 * condensed display, Inter and system-ui for Clash Grotesk — because the real
 * faces are licensed and this app self-hosts everything it serves (the CSP is
 * `font-src 'self'`).
 */

export function foudreCss(): string {
  return `
/* ===== Agence Foudre — light register: warm chalk ===== */
:root.sc-foudre {
  --sc-bg: 13 100% 98%;
  --sc-fg: 153 100% 12%;
  --sc-card: 0 0% 100%;
  --sc-card-fg: 153 100% 12%;
  --sc-muted: 13 71% 93%;
  --sc-muted-fg: 153 40% 24%;
  --sc-border: 330 45% 45%;
  --sc-input: 330 45% 45%;
  --sc-primary: 330 68% 38%;
  --sc-primary-fg: 13 100% 98%;
  --sc-primary-shade: 240 10% 8%;
  --sc-ring: 330 68% 38%;
  --sc-accent: 13 71% 93%;
  --sc-accent-fg: 153 100% 14%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  /* The display voice, at full intensity — magenta is type here, not fill. */
  --sc-display: 330 68% 55%;
  --sc-bubblegum: 330 80% 78%;
  --sc-hairline: 250 26% 85%;
}
/* ===== dark register: forest ink ===== */
:root.sc-foudre.sc-dark {
  --sc-bg: 153 60% 5%;
  --sc-fg: 13 100% 96%;
  --sc-card: 153 40% 8%;
  --sc-card-fg: 13 100% 96%;
  --sc-muted: 153 25% 20%;
  --sc-muted-fg: 13 40% 78%;
  --sc-border: 330 60% 62%;
  --sc-input: 330 60% 62%;
  --sc-primary: 330 71% 66%;
  --sc-primary-fg: 153 60% 6%;
  --sc-primary-shade: 0 0% 100%;
  --sc-ring: 330 71% 66%;
  --sc-accent: 330 30% 16%;
  --sc-accent-fg: 13 100% 96%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  --sc-display: 330 71% 69%;
  --sc-bubblegum: 330 80% 78%;
  --sc-hairline: 153 25% 24%;
}

/* ===== Character ===== */
:root.sc-foudre {
  /* "Deliberately flat. No shadows, gradients, or glass effects." */
  --sc-shadow: none;
  /* Cards 20px, badges and buttons 10px, tags fully round — from the
     reference's own radius scale. */
  --sc-radius: 10px;
  --sc-radius-sm: 10px;
  --sc-border-w: 1px;
  --sc-font-pixel: Inter, 'General Sans', system-ui, -apple-system, sans-serif;
  --sc-font-display: Antonio, 'Archivo Narrow', Impact, 'Haettenschweiler', sans-serif;
}

/* Cards: 20px, hairline, flat. */
:root.sc-foudre .MuiCard-root,
:root.sc-foudre .MuiPaper-elevation1,
:root.sc-foudre .MuiPaper-elevation2,
:root.sc-foudre .sc-card {
  border-radius: 20px !important;
  border-width: 1px !important;
  border-color: hsl(var(--sc-hairline)) !important;
  box-shadow: none !important;
}
/* A surface holding a table takes no radius at all. Clipping it cuts the
   table's own corners off; leaving it rounded lets the table's opaque square
   corner paint over the arc, so the border reads as broken. Square meeting
   square is the only geometry where neither happens. */
:root.sc-foudre .MuiCard-root:has(table),
:root.sc-foudre .MuiPaper-elevation1:has(table),
:root.sc-foudre .MuiPaper-elevation2:has(table),
:root.sc-foudre .sc-card:has(table) {
  border-radius: 0 !important;
}

/* The display voice. Beni is set at line-height 0.70 — tight enough that the
   headline reads as a block rather than a line — and it is the one place the
   magenta runs at full intensity. */
:root.sc-foudre .sc-h1 {
  font-family: var(--sc-font-display);
  font-weight: 900;
  font-size: 34px;
  line-height: 0.78;
  letter-spacing: -0.02em;
  text-transform: uppercase;
  color: hsl(var(--sc-display));
}
:root.sc-foudre .sc-card-title {
  font-family: var(--sc-font-display);
  font-weight: 900;
  letter-spacing: -0.01em;
  text-transform: uppercase;
}

/* Everything else is Clash Grotesk's stand-in, cased normally: the reference
   uses its body face for "all UI, body text, labels, navigation". */
:root.sc-foudre .sc-btn,
:root.sc-foudre .sc-badge,
:root.sc-foudre .sc-nav-tx,
:root.sc-foudre .sc-nav-word,
:root.sc-foudre .sc-label,
:root.sc-foudre .MuiTableCell-head {
  text-transform: none;
  letter-spacing: 0;
}

/* Tags and badges are fully round; buttons take the 10px badge radius. */
:root.sc-foudre .sc-badge,
:root.sc-foudre .MuiChip-root {
  border-radius: 9999px !important;
  background: hsl(var(--sc-accent)) !important;
}
:root.sc-foudre .MuiButton-root,
:root.sc-foudre .sc-btn,
:root.sc-foudre button[class*="bui-Button"],
:root.sc-foudre a[class*="bui-Button"] {
  border-radius: 10px !important;
  box-shadow: none !important;
}

/* The two dots. The reference's only furniture is a pair of magenta circles
   pinned to the page's top corners; the brand mark becomes one of them —
   a flat circle rather than a tile with a gradient and a cast shadow. */
:root.sc-foudre .sc-nav-mark,
:root.sc-foudre .sc-login-mark {
  background: hsl(var(--sc-display)) !important;
  border-radius: 9999px !important;
  border: none !important;
  box-shadow: none !important;
}

/* Links carry the forest ink and stay underlined, the way body copy does in a
   magazine rather than a dashboard. */
:root.sc-foudre .sc-link,
:root.sc-foudre a[class*="bui-Link"] {
  color: hsl(var(--sc-fg));
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* Dividers are the lilac hairline — its actual job in the reference. */
:root.sc-foudre .MuiDivider-root,
:root.sc-foudre .MuiTableCell-root {
  border-color: hsl(var(--sc-hairline)) !important;
}
`;
}
