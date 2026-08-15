/**
 * The seasonal and elemental mode potions, generated from a table.
 *
 * `greek.ts` and `winter.ts` are hand-written because each carries a whole
 * ornament grammar — a meander band, an icicle fringe, corner medallions. These
 * five carry a palette and the thing floating in their bottle, and that is
 * deliberate rather than unfinished: seven bottles each stamping ornament on
 * every surface would leave the app with no quiet state at all. The lesson from
 * the Greek round is that a motif reads as intent where it means something and
 * as noise everywhere.
 *
 * So they live as data. One row per mode, two registers each, and a generator
 * that emits `:root.sc-<id>` and `:root.sc-<id>.sc-dark`. Adding the eighth is
 * a row, not a file.
 *
 * Every value here is measured, not chosen. Each register clears 4.5:1 on every
 * pair that carries text and 3:1 on the rule against its card, and because each
 * mode moves `--sc-card`, the *default* status ink is re-measured against each
 * of these surfaces in contrast.test.ts. None of them redefine status hue: the
 * design system allows a mode that exception and Greek already spends it, so a
 * third and fourth green would leave SUCCEEDED looking different depending on
 * which bottle you happen to hold.
 */
import { BOLT, LEAF, PLANET, SAPLING, Sprite, SUN } from './sprites';

const WHITE = '0 0% 100%';
const INK = '240 10% 8%';

/** The ten values that differ per register; the rest are derived or shared. */
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

export type ModeDef = {
  /** Drives the root class (`sc-spring`) and the scheme record's `mode`. */
  id: string;
  /** What floats in the bottle. */
  inner: Sprite;
  light: Register;
  dark: Register;
};

export const MODE_DEFS: ModeDef[] = [
  {
    id: 'spring',
    inner: SAPLING,
    light: {
      bg: '100 32% 96%',
      fg: '125 32% 12%',
      card: '100 42% 99%',
      muted: '100 26% 92%',
      mutedFg: '125 18% 32%',
      border: '130 45% 34%',
      primary: '142 68% 27%',
      primaryFg: WHITE,
      accent: '100 32% 90%',
      accentFg: '125 32% 18%',
    },
    dark: {
      bg: '140 38% 4.5%',
      fg: '100 26% 94%',
      card: '140 32% 8%',
      muted: '140 24% 18%',
      mutedFg: '100 20% 72%',
      border: '132 48% 50%',
      primary: '140 70% 58%',
      primaryFg: '140 40% 6%',
      accent: '140 26% 15%',
      accentFg: '100 26% 94%',
    },
  },
  {
    id: 'summer',
    inner: SUN,
    light: {
      bg: '35 48% 97%',
      fg: '12 38% 13%',
      card: '40 52% 99%',
      muted: '30 36% 93%',
      mutedFg: '15 24% 34%',
      border: '10 62% 40%',
      primary: '5 78% 36%',
      primaryFg: WHITE,
      accent: '30 46% 91%',
      accentFg: '12 38% 19%',
    },
    dark: {
      bg: '5 42% 5%',
      fg: '35 32% 95%',
      card: '5 36% 8.5%',
      muted: '5 26% 19%',
      mutedFg: '25 22% 72%',
      border: '10 68% 56%',
      primary: '8 88% 62%',
      primaryFg: '5 40% 7%',
      accent: '5 28% 16%',
      accentFg: '35 32% 95%',
    },
  },
  {
    id: 'autumn',
    inner: LEAF,
    light: {
      bg: '32 42% 96%',
      fg: '25 42% 12%',
      card: '36 46% 99%',
      muted: '30 32% 92%',
      mutedFg: '25 26% 32%',
      border: '25 68% 34%',
      primary: '22 88% 32%',
      primaryFg: WHITE,
      accent: '30 42% 90%',
      accentFg: '25 42% 18%',
    },
    dark: {
      bg: '20 48% 4.5%',
      fg: '35 36% 94%',
      card: '20 42% 8%',
      muted: '20 30% 18%',
      mutedFg: '30 24% 71%',
      border: '26 72% 54%',
      primary: '27 92% 58%',
      primaryFg: '20 45% 6%',
      accent: '20 32% 15%',
      accentFg: '35 36% 94%',
    },
  },
  {
    id: 'space',
    inner: PLANET,
    light: {
      bg: '260 36% 97%',
      fg: '265 38% 12%',
      card: '265 46% 99%',
      muted: '260 30% 93%',
      mutedFg: '265 22% 34%',
      border: '265 48% 40%',
      primary: '265 72% 38%',
      primaryFg: WHITE,
      accent: '260 36% 91%',
      accentFg: '265 38% 18%',
    },
    dark: {
      bg: '265 52% 3.5%',
      fg: '265 26% 94%',
      card: '265 46% 7%',
      muted: '265 32% 18%',
      mutedFg: '265 22% 72%',
      border: '270 58% 60%',
      primary: '270 88% 68%',
      primaryFg: '265 50% 6%',
      accent: '265 34% 14%',
      accentFg: '265 26% 94%',
    },
  },
  {
    id: 'zeus',
    inner: BOLT,
    light: {
      bg: '220 22% 96%',
      fg: '220 32% 12%',
      card: '220 26% 99%',
      muted: '220 20% 92%',
      mutedFg: '220 16% 33%',
      // Lightning is yellow, and a yellow bright enough to read as lightning
      // cannot carry white text — 1.72:1. The foreground flips to ink, which
      // is also what a bolt looks like against a storm sky.
      border: '45 88% 33%',
      primary: '48 100% 47%',
      primaryFg: INK,
      accent: '220 22% 90%',
      accentFg: '220 32% 18%',
    },
    dark: {
      bg: '220 40% 4.5%',
      fg: '210 25% 95%',
      card: '220 34% 8%',
      muted: '220 26% 19%',
      mutedFg: '215 20% 72%',
      border: '50 88% 60%',
      primary: '52 100% 62%',
      primaryFg: '220 40% 7%',
      accent: '220 28% 15%',
      accentFg: '210 25% 95%',
    },
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

export function modesCss(): string {
  const palettes = MODE_DEFS.map(
    m => `${block(`:root.sc-${m.id}`, m.light)}
${block(`:root.sc-${m.id}.sc-dark`, m.dark)}
/* The mode's own glow on primary surfaces. filter, not box-shadow: styles.ts
   claims box-shadow with !important on the button root, and an important author
   declaration beats both a normal one at any specificity AND the animation
   origin, so a box-shadow glow here would never paint. Nothing claims filter. */
:root.sc-${m.id} .MuiButton-containedPrimary,
:root.sc-${m.id} .sc-btn-primary,
:root.sc-${m.id} [data-variant="primary"][class*="bui-Button"] {
  filter: drop-shadow(0 0 5px hsl(var(--sc-primary) / .45));
}`,
  ).join('\n');

  return `
/* ===== Mode potions, generated from the table in modes.ts ===== */
${palettes}

/* ===== What floats in a bottle =====
   Deliberately NOT scoped to any one mode: the shelf shows every bottle
   whichever theme is active, so the sapling has to sway and the flake has to
   drift before you have switched to them. This describes an object, not a mode.

   Four discrete positions with steps(1), which holds each frame until the next
   rather than gliding between them — the drift of something suspended in
   liquid. The unanimated default is the middle of that loop, so stillness under
   prefers-reduced-motion looks deliberate rather than caught mid-fall. */
.sc-potion .sc-potion-inner {
  fill: hsl(0 0% 100% / .92);
}
@media (prefers-reduced-motion: no-preference) {
  @keyframes sc-potion-drift {
    0%   { transform: translate(0, 0); }
    25%  { transform: translate(0.9px, 1.1px); }
    50%  { transform: translate(0, 2px); }
    75%  { transform: translate(-0.9px, 1.1px); }
    100% { transform: translate(0, 0); }
  }
  .sc-potion .sc-potion-inner {
    animation: sc-potion-drift 3.2s steps(1) infinite;
  }
}
`;
}
