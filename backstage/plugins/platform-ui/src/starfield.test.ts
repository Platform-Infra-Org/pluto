import {
  STARFIELD,
  STAR_WIDE,
  starfieldCss,
  starfieldDeclarations,
} from './starfield';

describe('starfield', () => {
  it('is a dark canvas with light stars', () => {
    // React Flow's <Background> puts `color` into an SVG attribute, where a
    // var(--x) would not resolve — so these have to stay literal colours.
    expect(STARFIELD.bg).toMatch(/^#[0-9a-f]{6}$/i);
    expect(STARFIELD.star).toMatch(/^rgba?\(|^#/);
    expect(STARFIELD.starDim).toMatch(/^rgba?\(|^#/);
    expect(STARFIELD.gap).toBeGreaterThan(0);
  });

  it('uses two star sizes, so the field reads as depth rather than a grid', () => {
    const d = starfieldDeclarations();
    expect(d.backgroundImage.match(/radial-gradient/g)).toHaveLength(2);
    expect(STARFIELD.size).toBeGreaterThan(STARFIELD.dimSize);
  });

  it('spaces the two layers differently, or they moire into one grid', () => {
    const d = starfieldDeclarations();
    expect(STAR_WIDE).not.toBe(STARFIELD.gap);
    // And not an integer multiple either: at 2x or 3x every bright star lands
    // exactly on a dim one and the two layers read as a single aligned grid.
    expect(STAR_WIDE % STARFIELD.gap).not.toBe(0);
    expect(d.backgroundSize).toBe(
      `${STAR_WIDE}px ${STAR_WIDE}px, ${STARFIELD.gap}px ${STARFIELD.gap}px`,
    );
    // Offset the dim layer so the two never sit on the same points.
    expect(d.backgroundPosition).not.toBe('0 0, 0 0');
  });

  it('emits a CSS rule for the given selector', () => {
    const css = starfieldCss('#dependency-graph');
    expect(css).toContain('#dependency-graph {');
    expect(css).toContain(STARFIELD.bg);
    expect(css).toContain('background-image:');
    expect(css).toContain('background-size:');
  });

  it('emits kebab-case properties, not the JS names', () => {
    // starfieldDeclarations is consumed by JSS (camelCase) and by the
    // stylesheet (kebab-case); only the latter goes through starfieldCss.
    const css = starfieldCss('.x');
    expect(css).not.toContain('backgroundColor');
    expect(css).toContain('background-color:');
  });

  it('has no backtick, which would truncate the stylesheet it is spliced into', () => {
    expect(starfieldCss('.x')).not.toContain('`');
  });
});
