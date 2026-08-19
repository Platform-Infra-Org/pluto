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
  /**
   * Set only where the reference's *speed* is what makes it recognisable.
   *
   * `obsidian` shares `discord`'s curve byte-for-byte — measured verbatim on
   * 296 elements — so without this the two modes animate identically and the
   * one measured difference between them is thrown away. Both members are
   * measured values, not a single number split in two: colour, background and
   * border move at 75-200ms while transform is firmly 200ms.
   */
  dur?: { colour: string; transform: string };
};

/** What every row animated at before any row measured its own. */
const HOUSE_DUR = { colour: '.18s', transform: '.18s' };

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
    id: 'github',
    label: 'GitHub',
    // Read from Primer's own custom properties rather than from the rendered
    // page: github.com exposes --bgColor-default, --fgColor-muted and the rest
    // on :root, and switches them on data-color-mode, so both registers came
    // off the same document. The marketing homepage is dark whatever the
    // browser asks for, which is why the light half is read from the attribute
    // rather than from prefers-color-scheme.
    // Accent #0969da carries white at 5.02:1, so unusually for these rows it
    // fills a button at its published value with no darkening at all.
    bottle: '212 92% 45%',
    bottleFg: WHITE,
    // Two departures, both forced by the 3:1 bar on a rule. Primer's borders
    // are hairlines -- #d1d9e0 measures 1.42:1 on white and #3d444d 1.75:1 on
    // its own card -- which works on a page that leans on whitespace and would
    // leave a form here with edges nobody can see.
    light: { bg:'210 29% 97%', fg:'213 13% 14%', card:'0 0% 100%', muted:'210 20% 92%',
      mutedFg:'211 11% 39%', border:'210 12% 56%', primary:'212 92% 45%', primaryFg:WHITE,
      accent:'199 100% 93%', accentFg:'212 92% 20%' },
    // The dark muted surface is 18%, not the 20% that would sit evenly between
    // card and border: at 20% the published #9198a1 ink measured 4.47 on it.
    dark: { bg:'216 28% 7%', fg:'210 67% 96%', card:'214 25% 11%', muted:'214 20% 18%',
      mutedFg:'214 8% 60%', border:'215 10% 44%', primary:'214 93% 62%', primaryFg:'216 28% 7%',
      accent:'214 25% 18%', accentFg:'210 67% 96%' },
    // 6px is Primer's --borderRadius-medium (.375rem) and the most common
    // corner on the page; the house scale rounds it to the nearest step.
    radius: { base:'8px', card:'12px', button:'8px' },
    borderW: '1px',
    ease: 'cubic-bezier(.2, .4, .2, 1)',
    dur: { colour: '.2s', transform: '.2s' },
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
  {
    id: 'dairy',
    label: 'Family Dairy',
    // The rare accent needing NO darkening: forest 166 93% 17% is 8.98:1 on
    // white. The button is nudged to 19% only so the fill is not crushed
    // near-black. Cream teal 179 67% 60% is 1.64 on white, so it is a display
    // fill in light and becomes the DARK register's primary over near-black
    // ink; butter 48 87% 84% is the light `accent` surface.
    bottle: '166 93% 19%',
    bottleFg: WHITE, // 7.83
    light: { bg:'172 22% 97%', fg:'0 0% 20%', card:'0 0% 100%', muted:'179 40% 92%',
      mutedFg:'172 16% 30%', border:'172 10% 44%', primary:'166 93% 19%', primaryFg:WHITE,
      accent:'48 87% 84%', accentFg:'170 25% 14%' },
    // LOAD-BEARING: the dark card is 7%, NOT 10%. At `168 30% 10%` all four
    // status tokens fail the dithered-badge case (4.34-4.48 against 4.5); at 7%
    // the worst case is 4.80. Do not lighten it without re-running
    // contrast.test.ts's status-cell check.
    //
    // Also load-bearing: `border 172 10% 44%` sits 6deg from the light
    // `primary 166 93% 19%` (7deg from the dark one), which the "dark rules"
    // assertion allows ONLY through its `borderS <= 25` escape leg. The site's
    // real border is a 2px full-saturation forest and would fail outright.
    dark: { bg:'168 42% 4%', fg:'48 40% 96%', card:'168 30% 7%', muted:'168 20% 18%',
      mutedFg:'172 14% 74%', border:'172 10% 44%', primary:'179 67% 60%', primaryFg:'168 45% 7%',
      accent:'168 24% 15%', accentFg:'48 40% 96%' },
    radius: { base:'12px', card:'16px', button:'20px' },
    // 2px is the entire visual weight of the reference — there is not one
    // box-shadow on the whole page, hence no glow.
    borderW: '2px',
    ease: 'cubic-bezier(.4, 0, .2, 1)',
  },
  {
    id: 'obsidian',
    label: 'Obsidian',
    // Copper fails a light button outright — 2.70 against white — so the light
    // register darkens it to `25 60% 33%` (6.83) and the published value stays
    // on the bottle, the badges and the marks.
    bottle: '25 50% 60%',
    bottleFg: '240 20% 5%', // 6.90
    // `border 235 8% 45%` / `230 8% 42%` is NOT the reference's own
    // `240 3.7% 15.9%`, which measures 2.58:1 on the card. 42% is the first
    // step clearing 3:1. The site gets away with 16% by leaning on translucent
    // white hairlines over a photographic ground; a form-heavy app cannot.
    // `mutedFg 230 9% 66%` likewise comes off the #9194a1 ramp rather than the
    // site's `--muted-foreground`, which is two points short on `muted`.
    light: { bg:'240 10% 97%', fg:'240 10% 8%', card:'0 0% 100%', muted:'240 9% 93%',
      mutedFg:'240 6% 34%', border:'235 8% 45%', primary:'25 60% 33%', primaryFg:WHITE,
      accent:'38 60% 91%', accentFg:'25 45% 16%' },
    dark: { bg:'240 20% 3%', fg:'0 0% 100%', card:'228 12% 8%', muted:'240 5% 16%',
      mutedFg:'230 9% 66%', border:'230 8% 42%', primary:'25 50% 62%', primaryFg:'240 20% 5%',
      accent:'28 18% 15%', accentFg:'38 45% 92%' },
    // The pill is the single most characteristic shape on the reference — 42
    // elements of it — and the corner radius is what tells you a thing is
    // clickable at all there.
    radius: { base:'12px', card:'12px', button:'9999px' },
    borderW: '1px',
    // The hairline ring measured as rgba(255,255,255,.2), softened to .12; the
    // copper bloom reproduces the upward gradient behind the hero chart. This
    // is the mode's one real effect, and copper appears roughly twice a screen.
    glow: '0 0 0 1px hsl(0 0% 100% / .12), 0 0 40px hsl(25 60% 45% / .18)',
    ease: 'cubic-bezier(.4, 0, .2, 1)',
    dur: { colour: '.075s', transform: '.2s' },
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
    const d = b.dur ?? HOUSE_DUR;
    const motion = b.ease
      ? `
@media (prefers-reduced-motion: no-preference) {
  :root.sc-${b.id} .sc-btn,
  :root.sc-${b.id} [class*="MuiButton-root"],
  :root.sc-${b.id} .sc-nav-item,
  :root.sc-${b.id} .sc-card,
  :root.sc-${b.id} [class*="MuiCard-root"] {
    transition:
      transform ${d.transform} ${b.ease},
      background-color ${d.colour} ${b.ease},
      border-color ${d.colour} ${b.ease},
      color ${d.colour} ${b.ease} !important;
  }
  /* Press settles rather than displaces — a translate on :active slides the
     control out from under the pointer, which the base sheet bans app-wide. */
  :root.sc-${b.id} .sc-btn:active:not(:disabled),
  :root.sc-${b.id} [class*="MuiButton-root"]:active:not(.Mui-disabled) {
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
/* Substring form, so these reach the routes that render under a nested MUI
   ThemeProvider: there the generator emits MuiCard-root-186 and the counter
   moves between visits, so a class selector matches nothing. The two elevation
   classes keep their clean spelling beside an ANCHORED suffix match, because
   [class*="MuiPaper-elevation1"] also matches elevation10 through 19. Same
   form as the global rules in styles.ts; styles.test.ts explains it at length.
   No backticks in this comment: it lives inside a template literal. */
:root.sc-${b.id} [class*="MuiCard-root"],
:root.sc-${b.id} .MuiPaper-elevation1, :root.sc-${b.id} [class*="MuiPaper-elevation1-"],
:root.sc-${b.id} .MuiPaper-elevation2, :root.sc-${b.id} [class*="MuiPaper-elevation2-"],
:root.sc-${b.id} .sc-card {
  border-radius: ${b.radius.card} !important;
  border-width: ${b.borderW} !important;
  box-shadow: ${shadow} !important;
}
/* A surface holding a table keeps its corners and clips the table to them, the
   same as the base sheet — the header no longer paints an opaque square into
   the arc, so there is nothing left to fight it. */
:root.sc-${b.id} [class*="MuiCard-root"]:has(table),
:root.sc-${b.id} .MuiPaper-elevation1:has(table), :root.sc-${b.id} [class*="MuiPaper-elevation1-"]:has(table),
:root.sc-${b.id} .MuiPaper-elevation2:has(table), :root.sc-${b.id} [class*="MuiPaper-elevation2-"]:has(table),
:root.sc-${b.id} .sc-card:has(table) {
  overflow: hidden !important;
}
:root.sc-${b.id} [class*="MuiButton-root"],
:root.sc-${b.id} .sc-btn,
:root.sc-${b.id} button[class*="bui-Button"],
:root.sc-${b.id} a[class*="bui-Button"] {
  border-radius: ${b.radius.button} !important;
  box-shadow: none !important;
}
:root.sc-${b.id} .sc-badge,
:root.sc-${b.id} [class*="MuiChip-root"] {
  border-radius: ${b.radius.button} !important;
}
:root.sc-${b.id} .sc-nav-mark,
:root.sc-${b.id} .sc-login-mark {
  background: hsl(var(--sc-primary)) !important;
  box-shadow: none !important;
}${motion}`;
  }).join('\n');
}
