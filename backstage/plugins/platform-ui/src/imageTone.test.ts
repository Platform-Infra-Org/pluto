import { relativeLuminance, toneForLuminance } from './imageTone';

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance(0, 0, 0)).toBeCloseTo(0, 5);
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 5);
  });

  it('weights green most, as the eye does', () => {
    const g = relativeLuminance(0, 255, 0);
    const r = relativeLuminance(255, 0, 0);
    const b = relativeLuminance(0, 0, 255);
    expect(g).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(b);
  });
});

describe('toneForLuminance', () => {
  it('asks for light text on a dark background', () => {
    expect(toneForLuminance(relativeLuminance(18, 18, 22))).toBe('light');
  });

  it('asks for dark text on a bright background', () => {
    expect(toneForLuminance(relativeLuminance(240, 200, 60))).toBe('dark');
  });

  it('keeps light text on a mid-tone, where it survives better', () => {
    // ~0.30 luminance: below the midpoint but above pure dark.
    expect(toneForLuminance(0.3)).toBe('light');
    expect(toneForLuminance(0.4)).toBe('dark');
  });
});
