/**
 * Brand mode potions, generated from a table.
 *
 * Each row is a published design rendered in this app's furniture, and each was
 * read from the site's own computed styles rather than from a description.
 * They live as data because what separates them is a palette, a radius set and
 * a rule weight — the two hand-written modes (greek, spiderverse) each carry
 * something a table cannot express.
 *
 * Every value is measured. Each register clears 4.5:1 on every pair carrying
 * text and 3:1 on the rule against its card, and because each mode moves
 * `--sc-card`, the *default* status ink is re-measured against all twelve of
 * these surfaces in contrast.test.ts. None redefine status hue — Greek spends
 * the design system's one exception.
 *
 * The recurring departure is worth stating once: every one of these sites uses
 * its accent as a *fill behind large display type*, which is a different job
 * from carrying a 13px button label. Four of the six needed the accent darkened
 * for the button and keep the published value for badges and marks. The figure
 * is recorded on the row.
 *
 * The dark rule is neutral where the accent is loud. A `border` that shares hue
 * AND saturation with `primary` makes every rule, focus ring, input outline and
 * divider glow in the brand colour, and the page then reads as one colour
 * rather than as a palette — `papers` shipped the two literally identical
 * (`57 88% 58%` for both). The published accent stays on `--sc-primary`, which
 * is where it belongs; contrast.test.ts pins the separation.
 *
 * Typeface is never set here. Clash Grotesk is the app's only family and these
 * modes differentiate by weight, size and case.
 */

const WHITE = '0 0% 100%';

type Register = {
  bg: string; fg: string; card: string; muted: string; mutedFg: string;
  border: string; primary: string; primaryFg: string; accent: string; accentFg: string;
};

export type BrandDef = {
  id: string;
  label: string;
  /** The bottle's liquid, and what SchemeRoot.test.ts measures. */
  bottle: string;
  bottleFg: string;
  light: Register;
  dark: Register;
  radius: { base: string; card: string; button: string };
  borderW: string;
  /** Reproduced only where the reference actually has one. */
  glow?: string;
  /** Set only where the reference's own chrome moves. */
  ease?: string;
};

export const BRAND_DEFS: BrandDef[] = [
  {
    id: 'newform',
    label: 'New Form',
    // Electric green #2bee4b is a display fill: it carries white at 1.8:1 and
    // ink at 11.9:1. The button takes a darkened green.
    // The dark register ran the fill itself at 85% saturation, which is the
    // site's poster value and, spread over a working screen, glowed. Down to
    // 48% (8.08:1 on its ink) it is still unmistakably this green without
    // lighting the room. The glow is this reference's one real effect so it
    // stays, at roughly half its former strength and reach.
    bottle: '129 60% 30%',
    bottleFg: WHITE,
    light: { bg:'120 12% 98%', fg:'135 10% 8%', card:'0 0% 100%', muted:'120 20% 95%',
      mutedFg:'135 9% 28%', border:'135 9% 42%', primary:'129 60% 30%', primaryFg:WHITE,
      accent:'129 60% 92%', accentFg:'135 10% 12%' },
    dark: { bg:'135 10% 5%', fg:'120 12% 97%', card:'135 9% 10%', muted:'135 8% 20%',
      mutedFg:'120 10% 72%', border:'135 8% 42%', primary:'129 48% 52%', primaryFg:'135 10% 6%',
      accent:'135 10% 16%', accentFg:'120 12% 97%' },
    radius: { base:'12px', card:'16px', button:'10px' },
    borderW: '1px',
    glow: '1px 4px 14px hsl(129 45% 20% / .24)',
    ease: 'cubic-bezier(.2, .8, .2, 1)',
  },
  {
    id: 'hermes',
    label: 'Hermes',
    // Pure #0000f2 carries white at 3.6:1. Both registers move it: down to 40%
    // on light, up to 76% on dark, which is the only way a brutalist blue holds
    // a label at either end. 76 rather than 72 because the blue also has to
    // carry the active nav item, whose ground is the accent rather than the
    // card — at 72% that pairing measured 4.04:1 on screen and at 74% it was
    // still 4.43. Measured against the ground the browser actually paints,
    // not against the token. Darkening the accent instead
    // would have fixed the ratio and cost the state its surface: the accent
    // sits at 15% against a 10% card, and dropping it to 11% makes the active
    // row indistinguishable from the panel it sits on.
    bottle: '240 100% 40%',
    bottleFg: WHITE,
    light: { bg:'0 0% 96%', fg:'0 0% 0%', card:'0 0% 100%', muted:'0 0% 92%',
      mutedFg:'0 0% 30%', border:'240 100% 47%', primary:'240 100% 40%', primaryFg:WHITE,
      accent:'240 100% 95%', accentFg:'240 100% 20%' },
    dark: { bg:'0 0% 4%', fg:'0 0% 96%', card:'0 0% 10%', muted:'0 0% 18%',
      mutedFg:'0 0% 72%', border:'0 0% 40%', primary:'240 100% 76%', primaryFg:'0 0% 4%',
      accent:'240 25% 15%', accentFg:'0 0% 96%' },
    // The reference is square — 4px on one element and nothing else — but a
    // square surface reads as unfinished beside the rest of the app, so the
    // corners come up to the house radius. What carries the brutalism here is
    // the rule weight and the pure-blue accent, both untouched.
    radius: { base:'12px', card:'16px', button:'10px' },
    borderW: '1px',
  },
  {
    id: 'papers',
    label: 'Flying Papers',
    // Acid yellow #f4ed36 is 414 elements of text on dark and cannot fill a
    // light button at all (1.2:1 with white). Light fills with the periwinkle;
    // dark lets the yellow do what it does on the site.
    bottle: '57 88% 58%',
    bottleFg: '0 0% 10%',
    light: { bg:'27 33% 96%', fg:'0 0% 10%', card:'0 0% 100%', muted:'241 26% 90%',
      mutedFg:'0 0% 26%', border:'0 0% 10%', primary:'241 27% 45%', primaryFg:WHITE,
      accent:'57 88% 88%', accentFg:'0 0% 10%' },
    dark: { bg:'0 0% 5%', fg:'27 33% 96%', card:'0 0% 9%', muted:'241 20% 22%',
      mutedFg:'27 20% 76%', border:'0 0% 40%', primary:'57 88% 58%', primaryFg:'0 0% 8%',
      accent:'241 26% 24%', accentFg:'27 33% 96%' },
    radius: { base:'12px', card:'16px', button:'100px' },
    // 3px black rules on 32 elements — the heaviest thing on the page, and the
    // reason this mode still reads as itself at a softer corner.
    borderW: '3px',
  },
  {
    id: 'discord',
    label: 'Discord',
    // Blurple #5865f2 carries white at 4.1:1 — just under. 50% on light clears
    // it; the dark register lifts to 72% so it reads against the grey.
    bottle: '235 60% 50%',
    bottleFg: WHITE,
    light: { bg:'0 0% 100%', fg:'0 0% 0%', card:'0 0% 100%', muted:'235 60% 96%',
      mutedFg:'0 0% 28%', border:'0 0% 42%', primary:'235 60% 50%', primaryFg:WHITE,
      accent:'235 60% 95%', accentFg:'235 50% 18%' },
    dark: { bg:'228 10% 7%', fg:'0 0% 98%', card:'227 9% 11%', muted:'228 6% 26%',
      mutedFg:'220 8% 74%', border:'228 8% 42%', primary:'235 86% 72%', primaryFg:'228 8% 10%',
      accent:'235 18% 24%', accentFg:'0 0% 98%' },
    // 16px on 76 elements is the shape of this product.
    radius: { base:'16px', card:'16px', button:'40px' },
    borderW: '1px',
    ease: 'cubic-bezier(.4, 0, .2, 1)',
  },
  {
    id: 'claude',
    label: 'Claude',
    // NOT measured from the app: claude.ai serves an automated browser a
    // Cloudflare interstitial, so the DOM available was the challenge page.
    // Built from Anthropic's published tokens instead — Slate Dark #141413,
    // Ivory #f0eee6/#faf9f5, Clay #d97757 — and said so rather than passing a
    // challenge page off as research. Clay carries white at 3.1:1, so the
    // light button darkens it to 42%.
    bottle: '15 63% 60%',
    bottleFg: '240 10% 8%',
    light: { bg:'48 25% 92%', fg:'60 3% 8%', card:'48 33% 97%', muted:'37 29% 85%',
      mutedFg:'52 4% 34%', border:'53 4% 46%', primary:'15 63% 42%', primaryFg:WHITE,
      accent:'37 29% 85%', accentFg:'60 3% 14%' },
    dark: { bg:'60 3% 5%', fg:'48 33% 97%', card:'60 3% 8%', muted:'60 3% 23%',
      mutedFg:'49 7% 67%', border:'53 4% 52%', primary:'15 63% 60%', primaryFg:'60 3% 8%',
      accent:'60 3% 16%', accentFg:'48 33% 97%' },
    radius: { base:'12px', card:'20px', button:'8px' },
    borderW: '1px',
  },
];

/** Status fills stay on their default hues — see the module comment. */
const SHARED = `  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;`;

function block(selector: string, r: Register): string {
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
  return BRAND_DEFS.map(b => {
    const shadow = b.glow ? b.glow : 'none';
    const motion = b.ease
      ? `
@media (prefers-reduced-motion: no-preference) {
  :root.sc-${b.id} .sc-btn,
  :root.sc-${b.id} .MuiButton-root,
  :root.sc-${b.id} .sc-nav-item,
  :root.sc-${b.id} .sc-card,
  :root.sc-${b.id} .MuiCard-root {
    transition:
      transform .18s ${b.ease},
      background-color .18s ${b.ease},
      border-color .18s ${b.ease},
      color .18s ${b.ease} !important;
  }
  /* Press settles rather than displaces — a translate on :active slides the
     control out from under the pointer, which the base sheet bans app-wide. */
  :root.sc-${b.id} .sc-btn:active:not(:disabled),
  :root.sc-${b.id} .MuiButton-root:active:not(.Mui-disabled) {
    transform: scale(.98);
  }
  :root.sc-${b.id} .sc-nav-item:hover {
    transform: translateX(2px);
  }
}`
      : '';
    return `${block(`:root.sc-${b.id}`, b.light)}
${block(`:root.sc-${b.id}.sc-dark`, b.dark)}
:root.sc-${b.id} {
  --sc-radius: ${b.radius.base};
  --sc-radius-sm: ${b.radius.base};
  --sc-border-w: ${b.borderW};
  --sc-shadow: ${shadow};
}
:root.sc-${b.id} .MuiCard-root,
:root.sc-${b.id} .MuiPaper-elevation1,
:root.sc-${b.id} .MuiPaper-elevation2,
:root.sc-${b.id} .sc-card {
  border-radius: ${b.radius.card} !important;
  border-width: ${b.borderW} !important;
  box-shadow: ${shadow} !important;
}
/* A surface holding a table takes no radius at all — clipped cuts the table,
   rounded lets its square corner cover the arc. See the base sheet. */
:root.sc-${b.id} .MuiCard-root:has(table),
:root.sc-${b.id} .MuiPaper-elevation1:has(table),
:root.sc-${b.id} .MuiPaper-elevation2:has(table),
:root.sc-${b.id} .sc-card:has(table) {
  border-radius: 0 !important;
}
:root.sc-${b.id} .MuiButton-root,
:root.sc-${b.id} .sc-btn,
:root.sc-${b.id} button[class*="bui-Button"],
:root.sc-${b.id} a[class*="bui-Button"] {
  border-radius: ${b.radius.button} !important;
  box-shadow: none !important;
}
:root.sc-${b.id} .sc-badge,
:root.sc-${b.id} .MuiChip-root {
  border-radius: ${b.radius.button} !important;
}
:root.sc-${b.id} .sc-nav-mark,
:root.sc-${b.id} .sc-login-mark {
  background: hsl(var(--sc-primary)) !important;
  box-shadow: none !important;
}${motion}`;
  }).join('\n');
}
