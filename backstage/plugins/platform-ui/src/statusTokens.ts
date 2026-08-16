/**
 * Status text colours, as a light/dark pair each.
 *
 * These lived as fixed literals in the stylesheet, chosen against a white card,
 * and every one failed WCAG AA on the dark card — badges, experience-bar counts
 * and the success notice all sat at 2.2-2.6 against a requirement of 4.5. The
 * pattern that produced it is the point: a literal is written in whichever mode
 * its author had open, and nothing notices the other one.
 *
 * Held here as data so `contrast.test.ts` checks the same values the stylesheet
 * emits. A new status colour either gets a pair, or it gets no colour.
 */
export type StatusToken = {
  /** CSS custom property name, without the `--sc-` prefix. */
  name: string;
  /** "H S% L%" for the light theme. */
  light: string;
  /** "H S% L%" for the dark theme. */
  dark: string;
  /** The dither cell this text sits on, for the worst-case contrast check. */
  cell: string;
  /** That cell's alpha, from the `--sc-cell` declaration in styles.ts. */
  cellAlpha: number;
};

/** `--sc-card`, the surface all of these sit on. */
export const CARD_LIGHT = '0 0% 100%';
export const CARD_DARK = '240 10% 6.5%';

export const STATUS_TOKENS: StatusToken[] = [
  // Dark values are the lowest lightness clearing 5.0:1 against BOTH the card
  // and the covered dither pixel — headroom over AA's 4.5, because a
  // minimum-passing value breaks on the next small change.
  {
    name: 'on-success',
    light: '152 60% 22%',
    dark: '152 55% 45%',
    cell: '152 42% 40%',
    cellAlpha: 0.26,
  },
  {
    name: 'on-warning',
    light: '38 95% 24%',
    dark: '38 90% 48%',
    cell: '35 68% 47%',
    cellAlpha: 0.3,
  },
  {
    name: 'on-destructive',
    light: '0 70% 34%',
    dark: '0 80% 67%',
    cell: '0 60% 51%',
    cellAlpha: 0.24,
  },
  {
    name: 'on-muted',
    light: '240 5% 34%',
    dark: '240 8% 75%',
    cell: '240 5% 62%',
    cellAlpha: 0.38,
  },
];

/** Which palette a scheme drives. `default` is the six accent-only potions. */
export type SchemeMode =
  | 'default'
  | 'greek'
  | 'foudre'
  | 'slush'
  | 'spiderverse'
  | 'newform'
  | 'hermes'
  | 'papers'
  | 'discord'
  | 'claude';

/** `--sc-card` in the Greek registers, from greek.ts. */
export const GREEK_CARD_LIGHT = '42 45% 98%';
export const GREEK_CARD_DARK = '265 26% 10%';


/**
 * Ancient Greek status colours: laurel-gold, Styx cyan, ember.
 *
 * This mode deliberately redefines status hue, which the rest of the design
 * system does not do — see docs/explanation/design-system.md. Success is at
 * 60deg rather than a straight gold so it sits 25deg off the stock amber that
 * means *running* in the other six schemes, instead of the 15deg a plain gold
 * gave. Every value here is the lowest lightness clearing 5.0:1 against BOTH
 * the Greek card and the covered dither pixel — the same method as above.
 *
 * `cell` and `cellAlpha` mirror what styles.ts actually paints, not what this
 * mode would like painted: .26 success, .3 warning, .26 destructive (the worse
 * of the badge's .24 and the fail notice's .26), .38 muted. Measuring against
 * invented alphas is how a "5.0:1" claim ends up untrue on screen.
 * `on-muted`'s cell is the hardcoded grey `240 5% 62%` in `.sc-badge-muted` —
 * a literal, not a token, so no mode can recolour it.
 */
export const GREEK_STATUS_TOKENS: StatusToken[] = [
  {
    name: 'on-success',
    light: '60 95% 19%',
    dark: '60 72% 41%',
    cell: '58 62% 42%',
    cellAlpha: 0.26,
  },
  {
    name: 'on-warning',
    light: '188 95% 22%',
    dark: '188 72% 50%',
    cell: '188 65% 45%',
    cellAlpha: 0.3,
  },
  {
    name: 'on-destructive',
    light: '12 88% 33%',
    dark: '12 92% 66%',
    cell: '12 78% 50%',
    cellAlpha: 0.26,
  },
  {
    name: 'on-muted',
    light: '38 12% 32%',
    dark: '38 14% 74%',
    cell: '240 5% 62%',
    cellAlpha: 0.38,
  },
];

export const MODE_TOKENS: Record<SchemeMode, StatusToken[]> = {
  default: STATUS_TOKENS,
  greek: GREEK_STATUS_TOKENS,
  // Foudre keeps the default status colours on purpose — the design system
  // allows a mode to redefine status hue, and Greek already spends that
  // exception. What Foudre DOES change is the card underneath, so the same ink
  // has to be re-measured against new paper.
  foudre: STATUS_TOKENS,
  slush: STATUS_TOKENS,
  spiderverse: STATUS_TOKENS,
  newform: STATUS_TOKENS,
  hermes: STATUS_TOKENS,
  papers: STATUS_TOKENS,
  discord: STATUS_TOKENS,
  claude: STATUS_TOKENS,
};

export const MODE_CARDS: Record<SchemeMode, { light: string; dark: string }> = {
  default: { light: CARD_LIGHT, dark: CARD_DARK },
  greek: { light: GREEK_CARD_LIGHT, dark: GREEK_CARD_DARK },
  foudre: { light: '0 0% 100%', dark: '153 45% 8%' },
  slush: { light: '0 0% 100%', dark: '0 0% 8%' },
  spiderverse: { light: '45 60% 98%', dark: '260 25% 11%' },
  newform: { light: '0 0% 100%', dark: '135 9% 10%' },
  hermes: { light: '0 0% 100%', dark: '0 0% 10%' },
  papers: { light: '0 0% 100%', dark: '0 0% 9%' },
  discord: { light: '0 0% 100%', dark: '227 9% 11%' },
  claude: { light: '48 33% 97%', dark: '60 3% 8%' },
};

/** The `:root` declarations for every mode, for interpolation into SHADCN_CSS. */
export function statusTokenCss(): string {
  const block = (selector: string, tokens: StatusToken[], key: 'light' | 'dark') =>
    `${selector} {\n${tokens
      .map(t => `  --sc-${t.name}: ${t[key]};`)
      .join('\n')}\n}`;
  // ORDER IS LOAD-BEARING. `:root.sc-dark` and `:root.sc-greek` are both
  // specificity (0,2,0), so whichever is written last wins when both match.
  // The greek light block must therefore follow the default dark block, and
  // `:root.sc-greek.sc-dark` — (0,3,0) — settles greek-in-dark outright.
  return [
    block(':root', STATUS_TOKENS, 'light'),
    block(':root.sc-dark', STATUS_TOKENS, 'dark'),
    block(':root.sc-greek', GREEK_STATUS_TOKENS, 'light'),
    block(':root.sc-greek.sc-dark', GREEK_STATUS_TOKENS, 'dark'),
  ].join('\n');
}
