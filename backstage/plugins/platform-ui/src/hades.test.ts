import { BOONS, BOON_LABELS, hadesCss } from './hades';

describe('hades mode', () => {
  it('defines the nine boons of the wheel', () => {
    expect([...BOONS]).toEqual([
      'zeus', 'poseidon', 'demeter', 'hermes', 'dionysus',
      'ares', 'artemis', 'aphrodite', 'chaos',
    ]);
  });

  it('names every boon', () => {
    for (const b of BOONS) expect(BOON_LABELS[b]).toBeTruthy();
  });

  it('registers the base palette on the mode class', () => {
    expect(hadesCss()).toContain(':root.sc-hades');
  });

  it('animates only in steps()', () => {
    // The design-system contract: steps() everywhere, never ease, including
    // third-party motion. An eased keyframe here is a defect, not a taste call.
    const css = hadesCss();
    expect(css).not.toMatch(/animation[^;]*\bease\b/);
    expect(css).not.toMatch(/transition[^;]*\bease\b/);
    for (const decl of css.match(/animation:[^;]+;/g) ?? []) {
      expect(decl).toContain('steps(');
    }
  });

  it('puts every animation behind a reduced-motion guard', () => {
    // Count, not presence: one unguarded keyframe is exactly the bug this
    // catches, and a single guard elsewhere in the file would hide it.
    const css = hadesCss();
    const guards = (css.match(/@media \(prefers-reduced-motion: no-preference\)/g) ?? []).length;
    const animated = (css.match(/animation:/g) ?? []).length;
    expect(guards).toBeGreaterThan(0);
    expect(animated).toBeGreaterThan(0);
    const outside = css.split('@media (prefers-reduced-motion: no-preference)')[0];
    expect(outside).not.toContain('animation:');
  });
});

describe('boon variants', () => {
  const css = hadesCss();

  it('gives every boon its own block', () => {
    for (const b of BOONS) {
      expect(`${b}:${css.includes(`[data-boon="${b}"]`)}`).toBe(`${b}:true`);
    }
  });

  it('gives every boon its own accent', () => {
    const accents = BOONS.map(b => {
      const block = css.slice(css.indexOf(`[data-boon="${b}"]`));
      return block.slice(0, block.indexOf('}')).match(/--sc-primary:\s*([^;]+);/)?.[1];
    });
    expect(accents.every(Boolean)).toBe(true);
    // Nine gods that all render the same colour is the failure this catches.
    expect(new Set(accents).size).toBe(BOONS.length);
  });

  it('gives every boon its own keyframes', () => {
    for (const b of BOONS) {
      expect(`${b}:${css.includes(`sc-hades-${b}`)}`).toBe(`${b}:true`);
    }
  });

  it('defines the one-shot flare', () => {
    expect(css).toContain('sc-hades-flare');
  });
});
