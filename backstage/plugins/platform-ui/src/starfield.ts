/**
 * The space background shared by every graph surface.
 *
 * One definition, two consumers that cannot use the same mechanism:
 *
 *   React Flow    — takes `color`/`gap`/`size` as component props and renders
 *                   its own SVG pattern, which pans and zooms with the canvas.
 *   Catalog graph — a plain SVG with no such component, so it is painted by a
 *                   theme styleOverride on the element itself.
 *
 * Literal colour strings, not CSS custom properties: React Flow puts `color`
 * into an SVG attribute, and var(--x) does not resolve there.
 */
export const STARFIELD = {
  /** Near-black, faintly blue so it does not read as a dead pixel field. */
  bg: '#05050c',
  /** The bright, sparse stars. Kept low: this is a backdrop, not a texture. */
  star: 'rgba(255, 255, 255, 0.42)',
  /** The faint majority — barely there, which is the point. */
  starDim: 'rgba(255, 255, 255, 0.14)',
  /** Spacing of the dim layer, in px. Wide, so the field stays sparse. */
  gap: 30,
  /** Radius of a bright star. */
  size: 1.2,
  /** Radius of a dim star. */
  dimSize: 0.8,
} as const;

/** Spacing of the bright layer. Deliberately not a multiple of `gap`. */
export const STAR_WIDE = STARFIELD.gap * 3.5;

/**
 * The starfield as CSS declarations, for a surface React Flow does not own.
 *
 * Two layers at different spacings: a single grid of identical dots reads as
 * graph paper, and at equal spacing the two layers moire into one. The bright
 * layer is sparser than the dim one, which is what makes it read as depth.
 */
export function starfieldDeclarations(): Record<string, string> {
  const { bg, star, starDim, gap, size, dimSize } = STARFIELD;
  const half = Math.round(gap / 2);
  return {
    backgroundColor: bg,
    backgroundImage: [
      `radial-gradient(circle, ${star} ${size}px, transparent ${size}px)`,
      `radial-gradient(circle, ${starDim} ${dimSize}px, transparent ${dimSize}px)`,
    ].join(', '),
    backgroundSize: `${STAR_WIDE}px ${STAR_WIDE}px, ${gap}px ${gap}px`,
    // Centred, not anchored to the top-left. A graph is laid out about the
    // middle of its canvas, so a field starting in the corner puts the nodes
    // between the stars at one end and on top of them at the other. From the
    // centre the two stay in step. The dim layer is offset by half its gap so
    // it never lands on the bright one.
    backgroundPosition: `center, calc(50% + ${half}px) calc(50% + ${half}px)`,
  };
}

/** The same thing as a CSS rule, for the hand-written stylesheet. */
export function starfieldCss(selector: string): string {
  const d = starfieldDeclarations();
  const body = Object.entries(d)
    .map(([k, v]) => `  ${k.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}: ${v} !important;`)
    .join('\n');
  return `${selector} {\n${body}\n}`;
}
