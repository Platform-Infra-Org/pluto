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

/** The `:root` and `:root.sc-dark` declarations, for interpolation into SHADCN_CSS. */
export function statusTokenCss(): string {
  const light = STATUS_TOKENS.map(t => `  --sc-${t.name}: ${t.light};`).join('\n');
  const dark = STATUS_TOKENS.map(t => `  --sc-${t.name}: ${t.dark};`).join('\n');
  return `:root {\n${light}\n}\n:root.sc-dark {\n${dark}\n}`;
}
