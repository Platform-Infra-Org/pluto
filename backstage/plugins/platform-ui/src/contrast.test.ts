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
