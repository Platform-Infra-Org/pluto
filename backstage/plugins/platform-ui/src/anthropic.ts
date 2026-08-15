/**
 * Anthropic mode: warm parchment, Clay, and a serif that is not a pixel font.
 *
 * Hand-written rather than a row in modes.ts because this mode changes more
 * than colour. The reference system's character is defined by three negatives —
 * no drop shadows, no gradients, no pure white — plus soft radii and a
 * serif/sans pairing. Every one of those fights a default the pixel design
 * system asserts everywhere, so they have to be unset deliberately.
 *
 * Palette from the published tokens: Slate Dark #141413, Ivory Medium #f0eee6,
 * Ivory Light #faf9f5, Cloud Medium #b0aea5, Cloud Dark #87867f, Stone #cccbc8,
 * Slate Medium #3d3d3a, Oat Warm #e3dacc, Clay #d97757.
 *
 * Two deliberate departures from the reference, both forced by measurement:
 *
 * 1. **Clay carries ink, not white.** The reference uses Clay as the CTA fill.
 *    White on Clay measures 3.11:1, below AA; Slate Dark on Clay measures
 *    5.94:1. This repo's rule is that contrast is measured rather than
 *    eyeballed, so the foreground flips.
 * 2. **The dark canvas is deeper than Slate Dark's tonal step suggests.** A card
 *    at the reference's lighter value left the default status ink at 4.28:1 on
 *    its dithered fill. Dropping the canvas to 5% and the card to 8% restores
 *    the tonal step while clearing AA at 4.68:1 worst case.
 *
 * The fonts are the published *fallbacks* — Georgia and Source Serif Pro for
 * the serif, system-ui and Inter for the sans — because the real faces are
 * licensed and this app self-hosts everything it serves (the CSP is
 * `font-src 'self'`). Naming a webfont here would either fail the CSP or ship a
 * font we have no right to.
 */

export function anthropicCss(): string {
  return `
/* ===== Anthropic mode — light register: parchment ===== */
:root.sc-anthropic {
  --sc-bg: 48 25% 92%;
  --sc-fg: 60 3% 8%;
  --sc-card: 48 33% 97%;
  --sc-card-fg: 60 3% 8%;
  --sc-muted: 37 29% 85%;
  --sc-muted-fg: 52 4% 34%;
  --sc-border: 53 4% 46%;
  --sc-input: 53 4% 46%;
  --sc-primary: 15 63% 60%;
  --sc-primary-fg: 60 3% 8%;
  --sc-primary-shade: 0 0% 100%;
  --sc-ring: 15 63% 60%;
  --sc-accent: 37 29% 85%;
  --sc-accent-fg: 60 3% 14%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  /* Stone, the hairline. Lighter than --sc-border, which has to clear 3:1. */
  --sc-hairline: 45 4% 79%;
}
/* ===== dark register: slate ===== */
:root.sc-anthropic.sc-dark {
  --sc-bg: 60 3% 5%;
  --sc-fg: 48 33% 97%;
  --sc-card: 60 3% 8%;
  --sc-card-fg: 48 33% 97%;
  --sc-muted: 60 3% 23%;
  --sc-muted-fg: 49 7% 67%;
  --sc-border: 53 4% 52%;
  --sc-input: 53 4% 52%;
  --sc-primary: 15 63% 60%;
  --sc-primary-fg: 60 3% 8%;
  --sc-primary-shade: 0 0% 100%;
  --sc-ring: 15 63% 60%;
  --sc-accent: 60 3% 16%;
  --sc-accent-fg: 48 33% 97%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  --sc-hairline: 60 3% 23%;
}

/* ===== Character =====
   The three negatives the reference is built on, plus the shapes. These are
   overrides of defaults the rest of the design system asserts globally, which
   is exactly why this mode is hand-written. */
:root.sc-anthropic {
  /* No drop shadows: elevation is a tonal shift, not a cast. The pixel system's
     hard offset shadow is its loudest signature, so this is the single biggest
     visual change in the file. */
  --sc-shadow: none;
  /* Softer corners: 12px on controls, 24px on cards below. */
  --sc-radius: 12px;
  --sc-radius-sm: 8px;
  --sc-border-w: 1px;
  /* The published fallback stacks. Named as one variable because the whole
     design system reads --sc-font-pixel; overriding it here is what carries the
     face into every .sc surface and, through theme.tsx, into MUI's own. */
  --sc-font-pixel: Georgia, 'Source Serif Pro', 'Times New Roman', serif;
  --sc-font-ui: system-ui, -apple-system, 'Inter', 'Segoe UI', sans-serif;
}

/* Cards take the reference's 24px and a hairline rather than a chunky rule. */
:root.sc-anthropic .MuiCard-root,
:root.sc-anthropic .MuiPaper-elevation1,
:root.sc-anthropic .MuiPaper-elevation2,
:root.sc-anthropic .sc-card {
  border-radius: 24px !important;
  border-width: 1px !important;
  border-color: hsl(var(--sc-hairline)) !important;
  box-shadow: none !important;
}

/* Chrome — nav, buttons, badges, table headers — takes the sans. Body text and
   headings keep the serif, which is the pairing the reference describes. */
:root.sc-anthropic .sc-nav,
:root.sc-anthropic .sc-btn,
:root.sc-anthropic .sc-badge,
:root.sc-anthropic .sc-label,
:root.sc-anthropic .MuiButton-root,
:root.sc-anthropic .MuiTableCell-head {
  font-family: var(--sc-font-ui);
  letter-spacing: 0;
}

/* Uppercased chrome is a pixel-game convention, not this one. */
:root.sc-anthropic .sc-h1,
:root.sc-anthropic .sc-card-title,
:root.sc-anthropic .sc-btn,
:root.sc-anthropic .sc-badge,
:root.sc-anthropic .sc-nav-tx,
:root.sc-anthropic .sc-nav-word,
:root.sc-anthropic .sc-label {
  text-transform: none;
}

/* Persistent underlines on links, which the reference calls out by name. */
:root.sc-anthropic .sc-link,
:root.sc-anthropic a[class*="bui-Link"] {
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* Buttons: Clay, flat, soft. No gradient and no cast shadow anywhere. */
:root.sc-anthropic .MuiButton-containedPrimary,
:root.sc-anthropic .sc-btn-primary,
:root.sc-anthropic [data-variant="primary"][class*="bui-Button"] {
  background-image: none !important;
  box-shadow: none !important;
  border-radius: 8px !important;
}

/* The brand mark is a gradient everywhere else; here it is a flat Clay tile,
   because a gradient is one of the three things this system does not do. */
:root.sc-anthropic .sc-nav-mark,
:root.sc-anthropic .sc-login-mark {
  background: hsl(var(--sc-primary)) !important;
  box-shadow: none !important;
}
`;
}
