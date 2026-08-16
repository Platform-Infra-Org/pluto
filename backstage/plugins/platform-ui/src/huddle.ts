/**
 * Huddle mode: a considered directory rather than a marketplace.
 *
 * The reference calls itself a "quiet, editorial curation language" and is
 * explicit that it is "intentionally desaturated — no vivid neons, no
 * high-saturation accents." That restraint is the whole identity, so the
 * temptation to reach for its prettiest colours is the thing to resist: the
 * three pastels are a *status taxonomy* in the reference, never decoration, and
 * they are not used as surfaces here for that reason.
 *
 * What does port, and what makes this read as Huddle:
 *
 * 1. **Flat elevation.** "1px hairline borders replace shadows entirely; colour
 *    contrast and borders create separation." The pixel system's hard offset
 *    shadow is unset rather than restyled.
 * 2. **A radius vocabulary rather than a radius.** Badges 4px, cards 8px, list
 *    items 24px, pills 100px, the primary button 1000px. The jump between them
 *    is the pattern — a pill next to a near-square card is how the reference
 *    separates a secondary action from a surface.
 * 3. **The warm accent pairing.** Burnt amber borders with honey gold text on
 *    tags — "the only place gold appears, so it reads as a highlight." Measured
 *    at 4.61:1, so it clears AA as the reference draws it.
 * 4. **Micro-labels.** All-caps 12px section labels, which the pixel system
 *    already does — the one convention the two share.
 *
 * Palette from the published tokens: Paper White #ffffff, Ink Black #151515,
 * Graphite #23241f, Slate Gray #3a4444, Stone Border #333333, Bone #e5e6e1,
 * Deep Violet #453b60, Burnt Amber #65451d, Honey Gold #e4b976, plus the three
 * pastels.
 *
 * Deep Violet fills the primary action: the reference reserves it for "active
 * project emphasis, outlined borders", and it is the only token in the set with
 * enough weight to carry a label — at 10.38:1 against white it does so easily,
 * where the pastels sit around 1.3:1 and could not.
 *
 * The body face is Clash Grotesk, self-hosted. The reference's own face is Nng
 * with an Inter fallback; Clash Grotesk is the closest thing this app is
 * licensed to serve, and it shares the tight negative tracking that makes the
 * reference's headlines read as "dense and poster-like".
 */

export function huddleCss(): string {
  return `
/* ===== Huddle — light register: paper ===== */
:root.sc-huddle {
  --sc-bg: 0 0% 100%;
  --sc-fg: 0 0% 8%;
  --sc-card: 0 0% 100%;
  --sc-card-fg: 0 0% 8%;
  --sc-muted: 68 9% 90%;
  --sc-muted-fg: 180 8% 26%;
  --sc-border: 0 0% 20%;
  --sc-input: 0 0% 20%;
  --sc-primary: 257 24% 30%;
  --sc-primary-fg: 0 0% 100%;
  --sc-primary-shade: 240 10% 8%;
  --sc-ring: 257 24% 30%;
  --sc-accent: 192 39% 87%;
  --sc-accent-fg: 0 0% 10%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  /* The warm pairing, and the bone hairline. Not shadcn tokens. */
  --sc-amber: 36 55% 25%;
  --sc-honey: 35 66% 68%;
  --sc-hairline: 68 9% 90%;
}
/* ===== dark register ===== */
:root.sc-huddle.sc-dark {
  --sc-bg: 0 0% 6%;
  --sc-fg: 68 9% 93%;
  --sc-card: 0 0% 9%;
  --sc-card-fg: 68 9% 93%;
  --sc-muted: 0 0% 20%;
  --sc-muted-fg: 68 6% 72%;
  --sc-border: 68 6% 45%;
  --sc-input: 68 6% 45%;
  --sc-primary: 257 30% 72%;
  --sc-primary-fg: 0 0% 7%;
  --sc-primary-shade: 0 0% 100%;
  --sc-ring: 257 30% 72%;
  --sc-accent: 257 18% 18%;
  --sc-accent-fg: 68 9% 93%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  --sc-amber: 36 45% 30%;
  --sc-honey: 35 66% 68%;
  --sc-hairline: 0 0% 20%;
}

/* ===== Character ===== */
:root.sc-huddle {
  /* "1px hairline borders replace shadows entirely." */
  --sc-shadow: none;
  --sc-radius: 8px;
  --sc-radius-sm: 4px;
  --sc-border-w: 1px;
  --sc-font-pixel: 'Clash Grotesk', Inter, system-ui, -apple-system, sans-serif;
}

/* Cards: 8px and a hairline, flat. */
:root.sc-huddle .MuiCard-root,
:root.sc-huddle .MuiPaper-elevation1,
:root.sc-huddle .MuiPaper-elevation2,
:root.sc-huddle .sc-card {
  border-radius: 8px !important;
  border-width: 1px !important;
  border-color: hsl(var(--sc-hairline)) !important;
  box-shadow: none !important;
}

/* A surface holding a table takes no radius at all — see the note in the base
   sheet: clipped cuts the table, rounded lets its square corner cover the arc. */
:root.sc-huddle .MuiCard-root:has(table),
:root.sc-huddle .MuiPaper-elevation1:has(table),
:root.sc-huddle .MuiPaper-elevation2:has(table),
:root.sc-huddle .sc-card:has(table) {
  border-radius: 0 !important;
}

/* The radius vocabulary. A pill beside a near-square card is how the reference
   separates a secondary action from a surface, so the jump matters more than
   any single value. */
:root.sc-huddle .MuiButton-root,
:root.sc-huddle .sc-btn,
:root.sc-huddle button[class*="bui-Button"],
:root.sc-huddle a[class*="bui-Button"] {
  border-radius: 100px !important;
  box-shadow: none !important;
  text-transform: none;
  letter-spacing: 0;
}
:root.sc-huddle .MuiButton-containedPrimary,
:root.sc-huddle .sc-btn-primary,
:root.sc-huddle [data-variant="primary"][class*="bui-Button"] {
  border-radius: 1000px !important;
}
:root.sc-huddle .sc-badge {
  border-radius: 4px !important;
}
:root.sc-huddle .MuiChip-root {
  border-radius: 100px !important;
}
:root.sc-huddle .sc-nav-item {
  border-radius: 24px;
}

/* The warm accent pairing: burnt amber border, honey gold text. The reference
   names this as the only place gold appears, which is what makes it read as a
   highlight rather than a second accent. */
:root.sc-huddle .MuiChip-root {
  border: 1px solid hsl(var(--sc-amber)) !important;
  color: hsl(var(--sc-honey)) !important;
  background: transparent !important;
}

/* Type sits tight — the reference's -0.021em at display size is what makes its
   headlines "dense and poster-like" — and cased normally except the micro
   labels, which are all-caps 12px in both systems. */
:root.sc-huddle .sc-h1 {
  letter-spacing: -0.021em;
  font-weight: 500;
  text-transform: none;
}
:root.sc-huddle .sc-card-title,
:root.sc-huddle .sc-nav-tx,
:root.sc-huddle .sc-nav-word,
:root.sc-huddle .MuiTableCell-head {
  text-transform: none;
  letter-spacing: -0.01em;
}
:root.sc-huddle .sc-label {
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.02em;
}

/* Flat: the mark is a solid violet tile, not a gradient with a cast shadow. */
:root.sc-huddle .sc-nav-mark,
:root.sc-huddle .sc-login-mark {
  background: hsl(var(--sc-primary)) !important;
  box-shadow: none !important;
}

/* Hairline dividers do the separating, per the reference. */
:root.sc-huddle .MuiDivider-root,
:root.sc-huddle .MuiTableCell-root {
  border-color: hsl(var(--sc-hairline)) !important;
}
`;
}
