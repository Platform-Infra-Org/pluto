/**
 * Brand mode potions, generated from a table.
 *
 * Each row is a published design system rendered in this app's furniture. They
 * live as data rather than as a file each because what separates them is a
 * palette, a shape language and a face — not a whole ornament grammar. The
 * three hand-written modes (greek, anthropic, gsap) each carry something a
 * table cannot express: a meander band, a set of refusals, a gradient stroke.
 *
 * Every value is measured, not chosen. Each register clears 4.5:1 on every pair
 * that carries text and 3:1 on the rule against its card, and because each mode
 * moves `--sc-card`, the *default* status ink is re-measured against all twelve
 * of these surfaces in contrast.test.ts. None of them redefine status hue —
 * Greek spends the design system's one exception.
 *
 * Where a reference's own accent could not carry text at its published value,
 * the note on that row says so and gives the measured figure. That happens
 * often: a colour picked to sit on a brand's hero image is not automatically a
 * colour that can hold a button label.
 */

const WHITE = '0 0% 100%';

type Register = {
  bg: string;
  fg: string;
  card: string;
  muted: string;
  mutedFg: string;
  border: string;
  primary: string;
  primaryFg: string;
  accent: string;
  accentFg: string;
};

export type BrandDef = {
  /** Drives the root class (`sc-raycast`) and the scheme record's `mode`. */
  id: string;
  label: string;
  /** The bottle's liquid colour, and what SchemeRoot.test.ts measures. */
  bottle: string;
  bottleFg: string;
  light: Register;
  dark: Register;
  /** `--sc-radius`, and the card and button radii. */
  radius: { base: string; card: string; button: string };
  /** `--sc-border-w`. Franky's thick rules are the point of Franky's. */
  borderW: string;
  /** The `--sc-font-pixel` override — a stack this app is allowed to serve. */
  font: string;
  /** Set when the reference builds depth without a cast shadow. */
  flat: boolean;
  /** Uppercase chrome is a pixel-game convention; most of these drop it. */
  upper: boolean;
};

export const BRAND_DEFS: BrandDef[] = [
  {
    id: 'gic',
    label: 'General Intelligence',
    // The reference fills its one button with Dusk and reserves Signal Blue for
    // outlines it never fills. Following that gives a near-black CTA, which is
    // also the only version that carries white text.
    bottle: '240 16% 14%',
    bottleFg: WHITE,
    light: {
      bg: '100 100% 99%',
      fg: '0 0% 9%',
      card: '0 0% 100%',
      muted: '100 14% 97%',
      mutedFg: '0 0% 36%',
      border: '0 0% 45%',
      primary: '240 16% 14%',
      primaryFg: '100 100% 99%',
      accent: '110 10% 94%',
      accentFg: '0 0% 14%',
    },
    dark: {
      bg: '0 0% 6%',
      fg: '100 100% 99%',
      card: '240 16% 10%',
      muted: '240 10% 22%',
      mutedFg: '0 0% 72%',
      border: '197 40% 60%',
      primary: '197 59% 60%',
      primaryFg: '0 0% 9%',
      accent: '240 12% 19%',
      accentFg: '100 100% 99%',
    },
    radius: { base: '8px', card: '16px', button: '6px' },
    borderW: '1px',
    font: "Fraunces, Georgia, 'Times New Roman', serif",
    flat: true,
    upper: false,
  },
  {
    id: 'tiger',
    label: 'Hungry Tiger',
    // Tiger Gold at its published 59% carries white at 1.9:1 — it is a poster
    // colour meant to sit on rust. On the dark register it fills the button and
    // takes dark spice as its label; on light the rust fills and the gold reads.
    bottle: '38 96% 59%',
    bottleFg: '20 58% 10%',
    light: {
      bg: '33 60% 95%',
      fg: '20 58% 12%',
      card: '36 70% 98%',
      muted: '33 45% 90%',
      mutedFg: '20 45% 26%',
      border: '20 60% 38%',
      primary: '20 76% 26%',
      primaryFg: '38 96% 88%',
      accent: '33 55% 90%',
      accentFg: '20 58% 16%',
    },
    dark: {
      bg: '20 70% 11%',
      fg: '38 96% 92%',
      card: '20 58% 8%',
      muted: '20 50% 22%',
      mutedFg: '38 50% 76%',
      border: '38 90% 55%',
      primary: '38 96% 59%',
      primaryFg: '20 58% 10%',
      accent: '20 55% 18%',
      accentFg: '38 96% 92%',
    },
    // "Buttons, badges, inputs: 9999px (full pill)"; cards stay nearly square.
    radius: { base: '6px', card: '6px', button: '9999px' },
    borderW: '1px',
    font: "'Bebas Neue', Antonio, Impact, system-ui, sans-serif",
    flat: true,
    upper: true,
  },
  {
    id: 'raycast',
    label: 'Raycast',
    // Coral Pulse is a brand mark, not a fill: on the dark register it carries
    // ink at 8.7:1. The light register darkens it to 40% so it can hold white.
    bottle: '0 100% 69%',
    bottleFg: '220 17% 5%',
    light: {
      bg: '0 0% 90%',
      fg: '0 0% 4%',
      card: '0 0% 97%',
      muted: '0 0% 86%',
      mutedFg: '0 0% 33%',
      border: '0 0% 45%',
      primary: '0 60% 40%',
      primaryFg: WHITE,
      accent: '0 20% 90%',
      accentFg: '0 0% 10%',
    },
    dark: {
      bg: '210 20% 2%',
      fg: WHITE,
      card: '220 17% 5%',
      muted: '220 5% 12%',
      mutedFg: '0 0% 68%',
      border: '220 2% 45%',
      primary: '0 100% 69%',
      primaryFg: '220 17% 5%',
      accent: '358 33% 14%',
      accentFg: WHITE,
    },
    radius: { base: '8px', card: '16px', button: '8px' },
    borderW: '1px',
    font: "Inter, system-ui, -apple-system, sans-serif",
    flat: false,
    upper: false,
  },
  {
    id: 'portal',
    label: 'Portal',
    // iOS blue at its published #007aff carries white at 3.9:1, just under AA;
    // 36% lightness is the nearest value that holds a label.
    bottle: '211 100% 36%',
    bottleFg: WHITE,
    light: {
      bg: '0 0% 97%',
      fg: '0 0% 4%',
      card: WHITE,
      muted: '0 0% 93%',
      mutedFg: '0 0% 33%',
      border: '0 0% 45%',
      primary: '211 100% 36%',
      primaryFg: WHITE,
      accent: '211 60% 93%',
      accentFg: '211 60% 16%',
    },
    dark: {
      bg: '220 20% 5%',
      fg: '0 0% 98%',
      card: '220 16% 9%',
      muted: '220 12% 20%',
      mutedFg: '0 0% 72%',
      border: '211 40% 58%',
      primary: '211 100% 66%',
      primaryFg: '220 20% 6%',
      accent: '211 35% 16%',
      accentFg: '0 0% 98%',
    },
    // "Buttons/badges: 50px (full pills). Cards/nav: 22-30px."
    radius: { base: '16px', card: '26px', button: '50px' },
    borderW: '1px',
    font: "Inter, system-ui, -apple-system, sans-serif",
    flat: true,
    upper: false,
  },
  {
    id: 'franky',
    label: "Franky's",
    // The one reference whose instincts match this app's own: flat surfaces,
    // thick black rules, a pixel face. Buy Green fills the single CTA.
    bottle: '146 78% 24%',
    bottleFg: '14 50% 96%',
    light: {
      bg: '14 42% 91%',
      fg: '0 0% 0%',
      card: '14 50% 95%',
      muted: '14 25% 86%',
      mutedFg: '0 0% 30%',
      border: '0 0% 0%',
      primary: '146 78% 24%',
      primaryFg: '14 50% 96%',
      accent: '36 96% 86%',
      accentFg: '0 0% 8%',
    },
    dark: {
      bg: '0 0% 5%',
      fg: '14 42% 91%',
      card: '0 0% 8.5%',
      muted: '0 0% 22%',
      mutedFg: '0 0% 70%',
      border: '36 96% 55%',
      primary: '36 96% 55%',
      primaryFg: '0 0% 8%',
      accent: '0 0% 18%',
      accentFg: '14 42% 91%',
    },
    radius: { base: '6px', card: '12px', button: '6px' },
    // "Thick black borders" is the whole look, so this one goes up, not down.
    borderW: '2px',
    font: "'VT323', 'Press Start 2P', ui-monospace, monospace",
    flat: true,
    upper: true,
  },
  {
    id: 'slush',
    label: 'Slush',
    // Carbon fills the CTA and the blue is a wash, per the reference. The
    // bottle takes the blue anyway — a black bottle on the shelf reads as an
    // empty slot rather than a colour.
    bottle: '211 100% 65%',
    bottleFg: '0 0% 4%',
    light: {
      bg: WHITE,
      fg: '0 0% 0%',
      card: WHITE,
      muted: '207 100% 93%',
      mutedFg: '0 0% 32%',
      border: '0 0% 40%',
      primary: '0 0% 0%',
      primaryFg: WHITE,
      accent: '207 100% 93%',
      accentFg: '0 0% 10%',
    },
    dark: {
      bg: '0 0% 4%',
      fg: WHITE,
      card: '0 0% 8%',
      muted: '0 0% 18%',
      mutedFg: '0 0% 70%',
      border: '211 100% 66%',
      primary: '211 100% 65%',
      primaryFg: '0 0% 4%',
      accent: '250 40% 18%',
      accentFg: WHITE,
    },
    // "Buttons/nav/pills: 1600px" — which is a pill by any other name.
    radius: { base: '20px', card: '28px', button: '9999px' },
    borderW: '1px',
    font: "'Aeonik Pro', Inter, system-ui, sans-serif",
    flat: true,
    upper: false,
  },
];

/** The status fills stay on their default hues — see the module comment. */
const SHARED = `  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;`;

function block(selector: string, r: Register): string {
  // --sc-primary-shade is the opposite of the foreground: it outlines text sat
  // on header art, so light text gets a dark edge and dark text a light one.
  const shade = r.primaryFg === WHITE ? '240 10% 8%' : WHITE;
  return `${selector} {
  --sc-bg: ${r.bg};
  --sc-fg: ${r.fg};
  --sc-card: ${r.card};
  --sc-card-fg: ${r.fg};
  --sc-muted: ${r.muted};
  --sc-muted-fg: ${r.mutedFg};
  --sc-border: ${r.border};
  --sc-input: ${r.border};
  --sc-primary: ${r.primary};
  --sc-primary-fg: ${r.primaryFg};
  --sc-primary-shade: ${shade};
  --sc-ring: ${r.primary};
  --sc-accent: ${r.accent};
  --sc-accent-fg: ${r.accentFg};
${SHARED}
}`;
}

export function brandsCss(): string {
  return BRAND_DEFS.map(
    b => `${block(`:root.sc-${b.id}`, b.light)}
${block(`:root.sc-${b.id}.sc-dark`, b.dark)}
:root.sc-${b.id} {
  --sc-radius: ${b.radius.base};
  --sc-radius-sm: ${b.radius.button === '9999px' ? b.radius.base : b.radius.button};
  --sc-border-w: ${b.borderW};
  --sc-font-pixel: ${b.font};${b.flat ? '\n  --sc-shadow: none;' : ''}
}
/* Cards and buttons take the reference's own shapes. */
:root.sc-${b.id} .MuiCard-root,
:root.sc-${b.id} .MuiPaper-elevation1,
:root.sc-${b.id} .MuiPaper-elevation2,
:root.sc-${b.id} .sc-card {
  border-radius: ${b.radius.card} !important;
  border-width: ${b.borderW} !important;${b.flat ? '\n  box-shadow: none !important;' : ''}
}
/* A card carrying a table takes a smaller radius: a table is a rectangle with
   its own filled header, and past about 12px its square corners show through
   the curve. Reducing the radius fixes that without clipping the content, which
   would cut the table's own edge off instead. */
:root.sc-${b.id} .MuiCard-root:has(table),
:root.sc-${b.id} .MuiPaper-elevation1:has(table),
:root.sc-${b.id} .sc-card:has(table) {
  border-radius: 10px !important;
}
:root.sc-${b.id} .MuiButton-root,
:root.sc-${b.id} .sc-btn,
:root.sc-${b.id} button[class*="bui-Button"],
:root.sc-${b.id} a[class*="bui-Button"] {
  border-radius: ${b.radius.button} !important;${b.flat ? '\n  box-shadow: none !important;' : ''}
}${
      b.upper
        ? ''
        : `
/* Uppercased chrome is a pixel-game convention, not this system's. */
:root.sc-${b.id} .sc-h1,
:root.sc-${b.id} .sc-card-title,
:root.sc-${b.id} .sc-btn,
:root.sc-${b.id} .sc-badge,
:root.sc-${b.id} .sc-nav-tx,
:root.sc-${b.id} .sc-nav-word,
:root.sc-${b.id} .sc-label,
:root.sc-${b.id} .MuiTableCell-head {
  text-transform: none;
  letter-spacing: 0;
}`
    }${
      b.flat
        ? `
/* Flat: the mark is a solid tile rather than the gradient every scheme paints. */
:root.sc-${b.id} .sc-nav-mark,
:root.sc-${b.id} .sc-login-mark {
  background: hsl(var(--sc-primary)) !important;
  box-shadow: none !important;
}`
        : `
/* Raycast's signature is a keyboard-key stack rather than a cast shadow: an
   inset highlight along the top edge and an inset shade along the bottom, so a
   surface reads as pressed into the page instead of floating above it. */
:root.sc-${b.id} .MuiCard-root,
:root.sc-${b.id} .sc-card {
  box-shadow:
    inset 0 1px 0 hsl(0 0% 100% / .07),
    inset 0 -1px 0 hsl(0 0% 0% / .5) !important;
}
:root.sc-${b.id} .sc-nav-mark,
:root.sc-${b.id} .sc-login-mark {
  background: hsl(var(--sc-primary)) !important;
  box-shadow: inset 0 1px 0 hsl(0 0% 100% / .25) !important;
}`
    }`,
  ).join('\n');
}
