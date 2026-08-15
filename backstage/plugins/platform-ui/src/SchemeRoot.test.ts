import { SCHEMES, applyScheme } from './SchemeRoot';

/** WCAG relative luminance for an "H S% L%" triplet. */
function luminance(hsl: string): number {
  const [h, s, l] = hsl.split(' ').map(v => parseFloat(v));
  const sN = s / 100;
  const lN = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) =>
    lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const lin = (x: number) =>
    x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(f(0)) + 0.7152 * lin(f(8)) + 0.0722 * lin(f(4));
}

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('colour schemes', () => {
  it('every scheme clears 4.5:1 between its accent and its foreground', () => {
    for (const s of SCHEMES) {
      const ratio = contrast(s.hsl, s.fg);
      expect(`${s.id}:${ratio >= 4.5}`).toBe(`${s.id}:true`);
    }
  });

  it('keeps seven schemes with stable ids', () => {
    expect(SCHEMES.map(s => s.id)).toEqual([
      'violet',
      'blue',
      'green',
      'rose',
      'amber',
      'slate',
      'greek',
    ]);
  });

  it('marks exactly one scheme as a mode', () => {
    const modes = SCHEMES.filter(s => s.mode);
    expect(modes.map(s => s.mode)).toEqual(['greek']);
  });

  it('toggles sc-greek on the root element when the mode is picked', () => {
    applyScheme('greek');
    expect(document.documentElement.classList.contains('sc-greek')).toBe(true);
    applyScheme('violet');
    expect(document.documentElement.classList.contains('sc-greek')).toBe(false);
  });
});
