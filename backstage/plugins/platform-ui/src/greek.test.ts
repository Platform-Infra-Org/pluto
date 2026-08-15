import { greekCss } from './greek';
import { SHADCN_CSS } from './styles';
import { GREEK_CARD_DARK, GREEK_CARD_LIGHT } from './statusTokens';

/** Every `--sc-*` whose value is an "H S% L%" triplet, inside one selector block. */
function colourTokens(css: string, selector: string): string[] {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return [];
  const end = css.indexOf('}', start);
  const body = css.slice(start, end);
  return Array.from(
    body.matchAll(/--(sc-[a-z-]+):\s*[\d.]+\s+[\d.]+%\s+[\d.]+%\s*;/g),
    m => m[1],
  ).sort();
}

describe('greekCss', () => {
  it('is not truncated', () => {
    expect(greekCss().length).toBeGreaterThan(500);
  });

  it('has balanced braces', () => {
    const css = greekCss();
    const open = (css.match(/{/g) ?? []).length;
    const close = (css.match(/}/g) ?? []).length;
    expect(`${open}/${close}`).toBe(`${close}/${close}`);
  });

  it('has no control characters, which is what a bad escape leaves behind', () => {
    const control = [...greekCss()].filter(ch => {
      const code = ch.codePointAt(0) ?? 32;
      return code < 32 && ch !== '\n' && ch !== '\t' && ch !== '\r';
    });
    expect(control).toEqual([]);
  });

  it('declares every colour token the default :root declares', () => {
    // A mode that forgets one inherits a colour from the wrong register, which
    // degrades into unreadable text rather than an obvious break.
    const base = colourTokens(SHADCN_CSS, ':root');
    const greek = colourTokens(greekCss(), ':root.sc-greek');
    expect(base.length).toBeGreaterThan(8); // the regex actually matched
    expect(greek).toEqual(expect.arrayContaining(base));
  });

  it('redeclares every colour token in the dark register', () => {
    const light = colourTokens(greekCss(), ':root.sc-greek');
    const dark = colourTokens(greekCss(), ':root.sc-greek.sc-dark');
    expect(dark).toEqual(light);
  });

  it('uses steps() for any animation, never ease', () => {
    expect(greekCss()).not.toMatch(/animation:[^;]*\bease\b/);
  });

  it('names no class a production build discards', () => {
    const names = Array.from(greekCss().matchAll(/\.([A-Za-z][\w-]*)/g), m => m[1]);
    const bad = names.filter(
      n =>
        !n.startsWith('Mui') &&
        !n.startsWith('bui-') &&
        !n.startsWith('sc-') &&
        !n.startsWith('material-icons'),
    );
    expect(bad).toEqual([]);
  });

  it('paints the card colour the contrast test measures against', () => {
    // Two sources of truth for one colour: statusTokens.ts holds the value the
    // contrast maths uses, greek.ts holds the value the browser paints. If they
    // drift, contrast.test.ts passes against a colour nothing renders.
    const css = greekCss();
    const cardIn = (selector: string) => {
      const start = css.indexOf(`${selector} {`);
      const body = css.slice(start, css.indexOf('}', start));
      return /--sc-card:\s*([^;]+);/.exec(body)?.[1].trim();
    };
    expect(cardIn(':root.sc-greek')).toBe(GREEK_CARD_LIGHT);
    expect(cardIn(':root.sc-greek.sc-dark')).toBe(GREEK_CARD_DARK);
  });
});
