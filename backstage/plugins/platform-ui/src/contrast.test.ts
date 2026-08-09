import {
  CARD_DARK,
  CARD_LIGHT,
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
