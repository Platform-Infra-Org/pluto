import { BOONS, BOON_LABELS, hadesCss } from './hades';
import { SHADCN_CSS } from './styles';

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


describe('the ornament actually paints', () => {
  // The class of bug the rest of this file cannot see: every other test here
  // only checks that CSS *text* exists, not that it does anything. A custom
  // property nothing reads, or an animation on a pseudo-element with no
  // `content`, is invisible to tsc, to lint, and to every assertion above —
  // it shipped once already (--sc-boon-ornament, defined nine times, read
  // nowhere; the animation target's ::after had no box to paint into at all).
  const css = hadesCss();

  it('reads back every custom property it defines, somewhere in the app stylesheet', () => {
    // Checked against the FULL assembled stylesheet, not just hadesCss():
    // the standard shadcn tokens (--sc-primary and friends) are declared here
    // but consumed by the shared component rules elsewhere in styles.ts, not
    // by hades.ts itself.
    const props = new Set(
      Array.from(css.matchAll(/--(sc-[a-z-]+):/g), m => m[1]),
    );
    expect(props.size).toBeGreaterThan(0); // the regex matched something
    for (const p of props) {
      expect(`${p}:${SHADCN_CSS.includes(`var(--${p}`)}`).toBe(`${p}:true`);
    }
  });

  it('gives the boon-animation host a content declaration, so the pseudo-element exists', () => {
    // A ::after with no `content` generates no box at all (CSS 2.1 §3.14) and
    // therefore has nothing to apply a background-image or an animation to.
    const start = css.indexOf('.sc-card-h::after {');
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf('}', start) + 1);
    expect(block).toContain('content:');
  });
});
