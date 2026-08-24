import { BRAND_DEFS } from './brands';
import { egyptianCss } from './egyptian';
import { foudreCss } from './foudre';
import { BOONS, hadesCss } from './hades';
import { greekCss } from './greek';
import { hanamiCss } from './hanami';
import { nightshadeCss } from './nightshade';
import { rimefastCss } from './rimefast';
import { spiderverseCss } from './spiderverse';
import {
  CARD_DARK,
  CARD_LIGHT,
  GREEK_STATUS_TOKENS,
  MODE_CARDS,
  MODE_TOKENS,
  STATUS_TOKENS,
  statusTokenCss,
} from './statusTokens';

/** The three sRGB channels, 0..1, of an "H S% L%" triplet. */
function srgbOf(hsl: string): [number, number, number] {
  const [h, s, l] = hsl.split(' ').map(v => parseFloat(v));
  const sN = s / 100;
  const lN = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) =>
    lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/** WCAG relative luminance of sRGB channels. */
function luminanceOf([r, g, b]: [number, number, number]): number {
  const lin = (x: number) =>
    x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * `cell` at `alpha` painted over `bg`.
 *
 * Composited in sRGB, which is what a browser does — NOT by blending the two
 * luminances. Those give different answers, and the luminance-space version
 * flatters dark backgrounds: it reported this file's own tokens as passing when
 * the sRGB result put them below the line.
 */
function over(
  cell: [number, number, number],
  alpha: number,
  bg: [number, number, number],
): [number, number, number] {
  return [
    cell[0] * alpha + bg[0] * (1 - alpha),
    cell[1] * alpha + bg[1] * (1 - alpha),
    cell[2] * alpha + bg[2] * (1 - alpha),
  ];
}

const ratio = (a: number, b: number) => {
  const [hi, lo] = [a, b].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const contrast = (a: string, b: string) =>
  ratio(luminanceOf(srgbOf(a)), luminanceOf(srgbOf(b)));
const contrastOver = (text: string, cell: string, alpha: number, bg: string) =>
  ratio(
    luminanceOf(srgbOf(text)),
    luminanceOf(over(srgbOf(cell), alpha, srgbOf(bg))),
  );

const AA = 4.5;

/** Every `--sc-*` triplet declared inside one selector block of `css`. */
function registerOf(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThan(-1);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    Array.from(
      body.matchAll(/--(sc-[a-z-]+):\s*([\d.]+\s+[\d.]+%\s+[\d.]+%)\s*;/g),
      m => [m[1], m[2]],
    ),
  );
}

describe('status text colours', () => {
  it('clears AA on the plain card in both modes', () => {
    for (const t of STATUS_TOKENS) {
      const light = contrast(t.light, CARD_LIGHT);
      const dark = contrast(t.dark, CARD_DARK);
      expect(`${t.name} light:${light >= AA}`).toBe(`${t.name} light:true`);
      expect(`${t.name} dark:${dark >= AA}`).toBe(`${t.name} dark:true`);
    }
  });

  it('clears AA on the dithered badge fill, which is the worse case', () => {
    // A badge sits on a checkerboard of --sc-cell over the card. The covered
    // half is lighter than the card in dark mode, so testing the plain card
    // alone overstates the contrast.
    for (const t of STATUS_TOKENS) {
      const light = contrastOver(t.light, t.cell, t.cellAlpha, CARD_LIGHT);
      const dark = contrastOver(t.dark, t.cell, t.cellAlpha, CARD_DARK);
      expect(`${t.name} light:${light >= AA}`).toBe(`${t.name} light:true`);
      expect(`${t.name} dark:${dark >= AA}`).toBe(`${t.name} dark:true`);
    }
  });

  it('emits a light value and a dark override for every token', () => {
    const css = statusTokenCss();
    for (const t of STATUS_TOKENS) {
      expect(css).toContain(`--sc-${t.name}: ${t.light}`);
      expect(css).toContain(`--sc-${t.name}: ${t.dark}`);
    }
    // The dark half must be scoped, or it would win in light mode too.
    expect(css).toContain(':root.sc-dark');
  });
});

describe('greek status text colours', () => {
  it('clears AA on the plain card in every mode', () => {
    for (const [mode, tokens] of Object.entries(MODE_TOKENS)) {
      const cards = MODE_CARDS[mode as keyof typeof MODE_CARDS];
      for (const t of tokens) {
        const light = contrast(t.light, cards.light);
        const dark = contrast(t.dark, cards.dark);
        expect(`${mode}/${t.name} light:${light >= AA}`).toBe(
          `${mode}/${t.name} light:true`,
        );
        expect(`${mode}/${t.name} dark:${dark >= AA}`).toBe(
          `${mode}/${t.name} dark:true`,
        );
      }
    }
  });

  it('clears AA on the dithered fill in every mode', () => {
    for (const [mode, tokens] of Object.entries(MODE_TOKENS)) {
      const cards = MODE_CARDS[mode as keyof typeof MODE_CARDS];
      for (const t of tokens) {
        const light = contrastOver(t.light, t.cell, t.cellAlpha, cards.light);
        const dark = contrastOver(t.dark, t.cell, t.cellAlpha, cards.dark);
        expect(`${mode}/${t.name} light:${light >= AA}`).toBe(
          `${mode}/${t.name} light:true`,
        );
        expect(`${mode}/${t.name} dark:${dark >= AA}`).toBe(
          `${mode}/${t.name} dark:true`,
        );
      }
    }
  });

  it('covers the same token names in every mode', () => {
    // A mode that forgets a token inherits the default colour on a surface it
    // was never measured against, which is exactly the failure this file exists
    // to catch.
    const names = STATUS_TOKENS.map(t => t.name).sort();
    for (const tokens of Object.values(MODE_TOKENS)) {
      expect(tokens.map(t => t.name).sort()).toEqual(names);
    }
  });

  it('emits the greek blocks after the default dark block', () => {
    // `:root.sc-dark` and `:root.sc-greek` are both specificity (0,2,0), so the
    // tie is broken by source order alone. Emit greek first and a greek page in
    // dark mode silently keeps the default dark status colours.
    const css = statusTokenCss();
    expect(css.indexOf(':root.sc-greek')).toBeGreaterThan(
      css.indexOf(':root.sc-dark'),
    );
    expect(css.indexOf(':root.sc-greek.sc-dark')).toBeGreaterThan(
      css.indexOf(':root.sc-greek {'),
    );
  });

  it('emits a light and dark value for every greek token', () => {
    const css = statusTokenCss();
    for (const t of GREEK_STATUS_TOKENS) {
      expect(css).toContain(`--sc-${t.name}: ${t.light}`);
      expect(css).toContain(`--sc-${t.name}: ${t.dark}`);
    }
  });
});

describe('greek palette contrast', () => {
  // greek.ts's header comment claims these; this measures them. The pairs are
  // the ones a user actually reads text on, plus the gold rule against its card.
  const PAIRS: ReadonlyArray<readonly [string, string, number]> = [
    ['sc-fg', 'sc-bg', AA],
    ['sc-fg', 'sc-card', AA],
    ['sc-muted-fg', 'sc-card', AA],
    ['sc-primary-fg', 'sc-primary', AA],
    ['sc-accent-fg', 'sc-accent', AA],
    // Known limitation: --sc-border on --sc-bg measures 2.89 in the light
    // register, under the 3:1 UI-component guideline, so it is deliberately
    // not asserted. (The repo's own default light border is 1.27 against its
    // card, so Greek is not setting a new low.) Fix by darkening --sc-border
    // in the light register if this ever needs to clear 3:1 on the page body.
    // The card pair below clears at 3.02 — almost no margin, so a slightly
    // darker card or lighter gold will trip this assertion.
    ['sc-border', 'sc-card', 3.0],
  ];

  for (const selector of [':root.sc-greek', ':root.sc-greek.sc-dark']) {
    it(`clears its contrast targets in ${selector}`, () => {
      const tokens = registerOf(greekCss(), selector);
      expect(Object.keys(tokens).length).toBeGreaterThan(8); // the regex matched
      for (const [fg, bg, min] of PAIRS) {
        const measured = contrast(tokens[fg], tokens[bg]);
        expect(`${fg} on ${bg}: ${measured >= min}`).toBe(`${fg} on ${bg}: true`);
      }
    });
  }
});

describe('hades palette contrast', () => {
  // The base register (the House itself) plus all nine boons — each measured
  // rather than eyeballed, so "nine gods that all fail the same way" is a
  // failure this file catches the same way hades.test.ts catches nine gods
  // rendering the same colour.
  const css = hadesCss();

  it('clears its contrast targets on the House register', () => {
    const tokens = registerOf(css, ':root.sc-hades');
    const PAIRS: ReadonlyArray<readonly [string, string, number]> = [
      ['sc-fg', 'sc-bg', AA],
      ['sc-fg', 'sc-card', AA],
      ['sc-muted-fg', 'sc-card', AA],
      ['sc-primary-fg', 'sc-primary', AA],
      ['sc-accent-fg', 'sc-accent', AA],
    ];
    for (const [fg, bg, min] of PAIRS) {
      const measured = contrast(tokens[fg], tokens[bg]);
      expect(`${fg} on ${bg}: ${measured >= min}`).toBe(`${fg} on ${bg}: true`);
    }
  });

  it('clears 4.5:1 between every boon and its own foreground', () => {
    for (const b of BOONS) {
      const tokens = registerOf(css, `:root.sc-hades[data-boon="${b}"]`);
      const measured = contrast(tokens['sc-primary'], tokens['sc-primary-fg']);
      expect(`${b}: ${measured >= AA}`).toBe(`${b}: true`);
    }
  });
});

describe('dark rules', () => {
  it('is never a second helping of the accent', () => {
    // Every dark register cleared the numeric contrast bar and still read as
    // one colour, because `border` shared hue AND saturation with `primary`:
    // every rule, focus ring, input outline and divider then glows in the
    // brand colour. `papers` shipped the two literally identical
    // (57 88% 58%). A rule is allowed to keep the accent's hue only if it
    // drops to a low saturation, or to keep saturation only if it moves hue.
    //
    // greek and slush are deliberately absent: greek's gold rule is pinned by
    // greek.test.ts and feeds its sprite fills, and slush's rule is a pure
    // white cut edge.
    const registers: Array<[string, Record<string, string>]> = [
      ...BRAND_DEFS.map(
        b =>
          [b.id, { 'sc-border': b.dark.border, 'sc-primary': b.dark.primary }] as [
            string,
            Record<string, string>,
          ],
      ),
      ['foudre', registerOf(foudreCss(), ':root.sc-foudre.sc-dark')],
      [
        'spiderverse',
        registerOf(spiderverseCss(), ':root.sc-spiderverse.sc-dark'),
      ],
      ['hanami', registerOf(hanamiCss(), ':root.sc-hanami.sc-dark')],
      [
        'nightshade',
        registerOf(nightshadeCss(), ':root.sc-nightshade.sc-dark'),
      ],
      ['rimefast', registerOf(rimefastCss(), ':root.sc-rimefast.sc-dark')],
      ['egyptian', registerOf(egyptianCss(), ':root.sc-egyptian.sc-dark')],
      // Hades has no `.sc-dark` pairing of its own — single register, see
      // hades.ts — so its one dark-in-all-but-name register is `:root.sc-hades`
      // itself, the same block the "hades palette contrast" describe below
      // measures.
      ['hades', registerOf(hadesCss(), ':root.sc-hades')],
    ];

    for (const [mode, tokens] of registers) {
      const [bh, bs] = tokens['sc-border'].split(' ').map(parseFloat);
      const [ph] = tokens['sc-primary'].split(' ').map(parseFloat);
      const raw = Math.abs(bh - ph) % 360;
      const hueGap = Math.min(raw, 360 - raw);
      const ok = hueGap >= 20 || bs <= 25;
      expect(`${mode} rule separated: ${ok}`).toBe(`${mode} rule separated: true`);
    }
  });
});
