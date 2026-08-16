/**
 * Handsome Frank mode: a curator's atelier, framed in hairlines.
 *
 * The reference is an illustration gallery, and its structural motif is a
 * "1-2px solid black hairline border used as a framing device throughout,
 * creating museum-like presentation without drop shadows." That is the pattern
 * this mode is built on: every surface is a frame, nothing floats.
 *
 * Its second idea is how colour is deployed. The chromatic spectrum lives in
 * the full-bleed artwork, and "remaining UI stays achromatic with isolated
 * accent bursts reserved for links, tags, and CTAs." So the palette here is not
 * spread evenly — the grounds stay cream and indigo, and the bright colours are
 * given jobs.
 *
 * **Colour with a job, per register.** The reference's accents are not
 * interchangeable, because most of them only work against one of the two
 * grounds. Measured against each register's own card:
 *
 *   Electric Teal    1.60 light / 11.71 dark  → a dark-register colour
 *   Tangerine Pop    2.66 light /  7.03 dark  → a dark-register colour
 *   Plum Velvet     14.19 light /  1.32 dark  → a light-register colour
 *   Crimson          4.58 light /  4.08 dark  → light only, and only just
 *   Cobalt Stage     8.61 on white            → the light register's action
 *
 * Spreading all of them across both registers would have produced a theme where
 * half the accents are invisible in half the app. Each is therefore declared
 * only in the register that can carry it, which is what "colourful" has to mean
 * once contrast is measured rather than assumed.
 *
 * Palette from the published tokens: Indigo Frame #160572, Cream Paper #f2ebe6,
 * Pure White #ffffff, Obsidian #000000, Slate Ink #2c2c2c, Fog Wash #eef4fb,
 * Cobalt Stage #2544a0, Electric Teal #24e3dc, Tangerine Pop #ff7701, Plum
 * Velvet #4b0f4d, Crimson Spotlight #ea0706, Daffodil #f9e44d.
 *
 * The dark register is an inversion the reference does not define: it is a
 * gallery site on cream. Indigo Frame — "the deepest anchor" — becomes the wall
 * rather than the frame, which keeps the register recognisably Frank instead of
 * inventing a neutral charcoal.
 *
 * Fonts are unchanged: Clash Grotesk, as the rest of the app now uses.
 */

export function frankCss(): string {
  return `
/* ===== Handsome Frank — light register: cream paper ===== */
:root.sc-frank {
  --sc-bg: 23 27% 92%;
  --sc-fg: 0 0% 0%;
  --sc-card: 0 0% 100%;
  --sc-card-fg: 0 0% 0%;
  --sc-muted: 210 54% 96%;
  --sc-muted-fg: 0 0% 17%;
  --sc-border: 0 0% 0%;
  --sc-input: 0 0% 0%;
  --sc-primary: 225 62% 39%;
  --sc-primary-fg: 0 0% 100%;
  --sc-primary-shade: 240 10% 8%;
  --sc-ring: 225 62% 39%;
  --sc-accent: 210 54% 92%;
  --sc-accent-fg: 250 91% 23%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  /* The bursts this ground can carry. Not shadcn tokens. */
  --sc-spotlight: 0 97% 47%;
  --sc-deep: 299 67% 18%;
  --sc-indigo: 250 91% 23%;
  --sc-highlight: 54 94% 64%;
}
/* ===== dark register: the indigo wall ===== */
:root.sc-frank.sc-dark {
  --sc-bg: 250 91% 9%;
  --sc-fg: 23 27% 94%;
  --sc-card: 250 85% 14%;
  --sc-card-fg: 23 27% 94%;
  --sc-muted: 250 45% 26%;
  --sc-muted-fg: 23 20% 78%;
  --sc-border: 178 60% 55%;
  --sc-input: 178 60% 55%;
  --sc-primary: 178 78% 62%;
  --sc-primary-fg: 250 91% 10%;
  --sc-primary-shade: 0 0% 100%;
  --sc-ring: 178 78% 62%;
  --sc-accent: 250 55% 22%;
  --sc-accent-fg: 23 27% 94%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  /* Teal and tangerine only read against the indigo — see the module note. */
  --sc-spotlight: 28 100% 50%;
  --sc-deep: 178 78% 62%;
  --sc-indigo: 23 27% 94%;
  --sc-highlight: 54 94% 64%;
}

/* ===== Character: the gallery frame ===== */
:root.sc-frank {
  /* "No elevation. Separation achieved through hairline borders and flat
     colour-blocking, never shadows." */
  --sc-shadow: none;
  /* Cards 10px, buttons a 30px pill, navigation square. */
  --sc-radius: 10px;
  --sc-radius-sm: 6px;
  --sc-border-w: 1px;
}

/* Every surface is a frame: a hairline in the foreground colour, which is the
   motif the reference repeats throughout rather than a tinted border. */
:root.sc-frank .MuiCard-root,
:root.sc-frank .MuiPaper-elevation1,
:root.sc-frank .MuiPaper-elevation2,
:root.sc-frank .sc-card {
  border-radius: 10px !important;
  border-width: 1px !important;
  border-color: hsl(var(--sc-fg) / .85) !important;
  box-shadow: none !important;
}
/* A surface holding a table takes no radius at all — see the note in the base
   sheet: clipped cuts the table, rounded lets its square corner cover the arc. */
:root.sc-frank .MuiCard-root:has(table),
:root.sc-frank .MuiPaper-elevation1:has(table),
:root.sc-frank .MuiPaper-elevation2:has(table),
:root.sc-frank .sc-card:has(table) {
  border-radius: 0 !important;
}

/* Buttons are 30px pills with the same hairline; the primary one fills. */
:root.sc-frank .MuiButton-root,
:root.sc-frank .sc-btn,
:root.sc-frank button[class*="bui-Button"],
:root.sc-frank a[class*="bui-Button"] {
  border-radius: 30px !important;
  border: 1px solid hsl(var(--sc-fg) / .85) !important;
  box-shadow: none !important;
  text-transform: none;
  letter-spacing: 0;
}

/* Navigation is square — the reference gives it a 0px radius, which is what
   separates structural chrome from the content it frames. */
:root.sc-frank .sc-nav-item,
:root.sc-frank .sc-nav-mark,
:root.sc-frank .sc-login-mark {
  border-radius: 0 !important;
}
:root.sc-frank .sc-nav-mark,
:root.sc-frank .sc-login-mark {
  background: hsl(var(--sc-indigo)) !important;
  box-shadow: none !important;
}

/* The isolated bursts. Each is used where the reference uses it — links, tags,
   and the one spotlight — rather than spread across the surfaces. */
:root.sc-frank .sc-link,
:root.sc-frank a[class*="bui-Link"] {
  color: hsl(var(--sc-deep));
  text-decoration: underline;
  text-underline-offset: 3px;
}
:root.sc-frank .MuiChip-root {
  border: 1px solid hsl(var(--sc-fg) / .85) !important;
  background: hsl(var(--sc-highlight)) !important;
  color: hsl(0 0% 0%) !important;
  border-radius: 30px !important;
}
:root.sc-frank .sc-badge-destructive {
  color: hsl(var(--sc-spotlight)) !important;
}

/* Type: cased normally and tracked tight, the way the reference sets its
   display serif. The face itself is unchanged — Clash Grotesk, as everywhere. */
:root.sc-frank .sc-h1 {
  letter-spacing: -0.03em;
  font-weight: 700;
  text-transform: none;
}
:root.sc-frank .sc-card-title,
:root.sc-frank .sc-nav-tx,
:root.sc-frank .sc-nav-word,
:root.sc-frank .sc-btn,
:root.sc-frank .sc-badge,
:root.sc-frank .MuiTableCell-head {
  text-transform: none;
  letter-spacing: -0.01em;
}

/* Dividers are the same hairline, full strength — the frame again. */
:root.sc-frank .MuiDivider-root,
:root.sc-frank .MuiTableCell-root {
  border-color: hsl(var(--sc-fg) / .35) !important;
}
`;
}
