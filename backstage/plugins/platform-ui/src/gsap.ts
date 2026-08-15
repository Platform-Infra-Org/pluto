/**
 * GSAP mode: a near-black stage, cream type, and one shockingly green accent.
 *
 * Hand-written for the same reason as anthropic.ts — the character is a set of
 * refusals and shape changes the pixel system asserts globally, not a palette
 * swap. Here that is: no shadows at all, 100px pill buttons, a gradient stroke
 * on the primary action, and hairline dividers.
 *
 * Palette from the published tokens: just-black #0e100f, surface-cream #fffce1,
 * surface-50 #7c7c6f, surface-25 #42433d, off-black #191919, shockingly-green
 * #0ae448, light-green #abff84.
 *
 * The reference names one constraint outright — "the warmth of #fffce1 cream
 * and #0e100f off-black is what gives the system its character; do not
 * substitute pure white/black" — so neither register uses either. The light
 * register is not in the reference at all, which is a dark-canvas system; it is
 * built here as the inversion that keeps both signature colours, cream as the
 * canvas and just-black as the type, rather than inventing a third palette.
 *
 * One departure, forced by measurement: on the light register the green is
 * darkened to 26% lightness. Shockingly-green at its published 47% carries
 * cream at 1.9:1 and ink at 9.4:1 — it is a colour designed to sit on black.
 * Keeping it unchanged on a cream canvas would have meant an accent that fails
 * against everything the reference puts on it.
 *
 * Status hues are not redefined: Greek spends the design system's one
 * exception. The cards move, so contrast.test.ts re-measures the default ink
 * against these surfaces.
 */

export function gsapCss(): string {
  return `
/* ===== GSAP mode — light register: the inversion, cream stage ===== */
:root.sc-gsap {
  --sc-bg: 55 100% 94%;
  --sc-fg: 150 5% 6%;
  --sc-card: 55 100% 97%;
  --sc-card-fg: 150 5% 6%;
  --sc-muted: 52 40% 88%;
  --sc-muted-fg: 65 6% 30%;
  --sc-border: 65 6% 42%;
  --sc-input: 65 6% 42%;
  --sc-primary: 140 92% 26%;
  --sc-primary-fg: 55 100% 94%;
  --sc-primary-shade: 150 5% 6%;
  --sc-ring: 140 92% 26%;
  --sc-accent: 52 45% 88%;
  --sc-accent-fg: 150 5% 12%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  /* The gradient pair, and the hairline. Not shadcn tokens. */
  --sc-green: 137 92% 30%;
  --sc-green-lit: 101 100% 42%;
  --sc-hairline: 70 5% 70%;
}
/* ===== dark register: the stage the system was designed on ===== */
:root.sc-gsap.sc-dark {
  --sc-bg: 150 5% 6%;
  --sc-fg: 55 100% 94%;
  --sc-card: 0 0% 9.8%;
  --sc-card-fg: 55 100% 94%;
  --sc-muted: 70 5% 21%;
  --sc-muted-fg: 60 6% 68%;
  --sc-border: 60 6% 46%;
  --sc-input: 60 6% 46%;
  --sc-primary: 140 92% 47%;
  --sc-primary-fg: 150 5% 6%;
  --sc-primary-shade: 55 100% 94%;
  --sc-ring: 140 92% 47%;
  --sc-accent: 0 0% 14%;
  --sc-accent-fg: 55 100% 94%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  --sc-green: 137 92% 47%;
  --sc-green-lit: 101 100% 76%;
  --sc-hairline: 70 5% 25%;
}

/* ===== Character =====
   Motion-library confidence: no elevation at all, pills instead of boxes, and
   type that sits tight rather than spaced out like a game menu. */
:root.sc-gsap {
  /* "Elevation: None — depth via gradients and surface-step shifts only." */
  --sc-shadow: none;
  --sc-radius: 8px;
  --sc-radius-sm: 6px;
  --sc-border-w: 1px;
  --sc-font-pixel: 'Inter Tight', 'DM Sans', system-ui, -apple-system, sans-serif;
  --sc-font-ui: 'Inter Tight', 'DM Sans', system-ui, -apple-system, sans-serif;
}

/* Cards: 8px, hairline, flat. */
:root.sc-gsap .MuiCard-root,
:root.sc-gsap .MuiPaper-elevation1,
:root.sc-gsap .MuiPaper-elevation2,
:root.sc-gsap .sc-card {
  border-radius: 8px !important;
  border-width: 1px !important;
  border-color: hsl(var(--sc-hairline)) !important;
  box-shadow: none !important;
  overflow: hidden;
}

/* Every button is a pill. The reference specifies a 100px radius ghost pill
   with a 1px cream border, which is the single most recognisable thing about
   this system's chrome. */
:root.sc-gsap .MuiButton-root,
:root.sc-gsap .sc-btn,
:root.sc-gsap button[class*="bui-Button"],
:root.sc-gsap a[class*="bui-Button"] {
  border-radius: 100px !important;
  border: 1px solid hsl(var(--sc-fg) / .85) !important;
  box-shadow: none !important;
  text-transform: none;
  letter-spacing: 0;
}

/* The primary action takes the green gradient stroke the reference calls for.
   Painted as two backgrounds with border-box/padding-box clipping — that is how
   a gradient border is done without a wrapper element, and it composes with the
   pill radius where a border-image would not. */
:root.sc-gsap .MuiButton-containedPrimary,
:root.sc-gsap .sc-btn-primary,
:root.sc-gsap [data-variant="primary"][class*="bui-Button"] {
  border: 2px solid transparent !important;
  background-image:
    linear-gradient(hsl(var(--sc-bg)), hsl(var(--sc-bg))),
    linear-gradient(114.41deg, hsl(var(--sc-green)), hsl(var(--sc-green-lit))) !important;
  background-origin: border-box !important;
  background-clip: padding-box, border-box !important;
  color: hsl(var(--sc-fg)) !important;
  filter: none !important;
}

/* Dividers are a 1px hairline, full width, no padding. */
:root.sc-gsap .MuiDivider-root,
:root.sc-gsap .MuiTableCell-root {
  border-color: hsl(var(--sc-hairline)) !important;
}
:root.sc-gsap .MuiTableCell-head {
  border-top: none !important;
}

/* Type sits tight and cased normally — the display face of a motion library,
   not the chrome of an arcade cabinet. */
:root.sc-gsap .sc-h1,
:root.sc-gsap .sc-card-title,
:root.sc-gsap .sc-badge,
:root.sc-gsap .sc-nav-tx,
:root.sc-gsap .sc-nav-word,
:root.sc-gsap .sc-label,
:root.sc-gsap .MuiTableCell-head {
  text-transform: none;
  letter-spacing: -0.01em;
}
:root.sc-gsap .sc-h1 {
  letter-spacing: -0.03em;
  font-weight: 600;
}

/* The mark is a flat green tile: this system has no drop shadows and its brand
   colour is the accent, not a gradient of the picked scheme. */
:root.sc-gsap .sc-nav-mark,
:root.sc-gsap .sc-login-mark {
  background: hsl(var(--sc-primary)) !important;
  box-shadow: none !important;
}
`;
}
