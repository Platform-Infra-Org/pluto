import { foudreCss } from './foudre';
import { SHADCN_CSS } from './styles';
import { MODE_CARDS } from './statusTokens';

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

function colourTokens(css: string, selector: string): string[] {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return [];
  const body = css.slice(start, css.indexOf('}', start));
  return Array.from(
    body.matchAll(/--(sc-[a-z-]+):\s*[\d.]+\s+[\d.]+%\s+[\d.]+%\s*;/g),
    m => m[1],
  ).sort();
}

/** A token's value, across every block using that selector. */
const valueIn = (css: string, selector: string, token: string) => {
  const re = new RegExp(`--sc-${token}:\\s*([^;]+);`);
  let from = 0;
  for (;;) {
    const start = css.indexOf(`${selector} {`, from);
    if (start === -1) return undefined;
    const hit = re.exec(css.slice(start, css.indexOf('}', start)));
    if (hit) return hit[1].trim();
    from = start + 1;
  }
};

describe('foudreCss', () => {
  it('is not truncated and has balanced braces', () => {
    const css = foudreCss();
    expect(css.length).toBeGreaterThan(1000);
    const open = (css.match(/{/g) ?? []).length;
    const close = (css.match(/}/g) ?? []).length;
    expect(`${open}/${close}`).toBe(`${close}/${close}`);
  });

  it('has no control characters, which is what a bad escape leaves behind', () => {
    const control = [...foudreCss()].filter(ch => {
      const code = ch.codePointAt(0) ?? 32;
      return code < 32 && ch !== '\n' && ch !== '\t' && ch !== '\r';
    });
    expect(control).toEqual([]);
  });

  it('declares every colour token the default :root declares', () => {
    const base = colourTokens(SHADCN_CSS, ':root');
    const light = colourTokens(foudreCss(), ':root.sc-foudre');
    const dark = colourTokens(foudreCss(), ':root.sc-foudre.sc-dark');
    expect(base.length).toBeGreaterThan(8);
    expect(light).toEqual(expect.arrayContaining(base));
    expect(dark).toEqual(light);
  });

  it('paints the card colour the contrast test measures against', () => {
    const css = foudreCss();
    expect(valueIn(css, ':root.sc-foudre', 'card')).toBe(MODE_CARDS.foudre.light);
    expect(valueIn(css, ':root.sc-foudre.sc-dark', 'card')).toBe(
      MODE_CARDS.foudre.dark,
    );
  });

  it('keeps the default status hues', () => {
    const css = foudreCss();
    for (const t of ['on-success', 'on-warning', 'on-destructive', 'on-muted']) {
      expect(`${t}:${css.includes(`--sc-${t}:`)}`).toBe(`${t}:false`);
    }
  });

  it('names no class a production build discards', () => {
    const names = Array.from(
      stripComments(foudreCss()).matchAll(/\.([A-Za-z][\w-]*)/g),
      m => m[1],
    );
    const bad = names.filter(
      n =>
        !n.startsWith('Mui') &&
        !n.startsWith('bui-') &&
        !n.startsWith('sc-') &&
        !n.startsWith('material-icons'),
    );
    expect(bad).toEqual([]);
  });
});

describe('the patterns that make it Foudre', () => {
  it('is deliberately flat — no shadow, no gradient', () => {
    // "No shadows, gradients, or glass effects — depth comes from colour
    // contrast and typographic scale." Both are defaults this design system
    // asserts globally, so both have to be actively unset.
    const css = stripComments(foudreCss());
    expect(valueIn(foudreCss(), ':root.sc-foudre', 'shadow')).toBe('none');
    expect(css).not.toMatch(/gradient\(/);
    const shadows = Array.from(css.matchAll(/box-shadow:\s*([^;]+);/g), m =>
      m[1].trim(),
    );
    expect(shadows.length).toBeGreaterThan(0);
    for (const s of shadows) {
      expect(s.replace(/\s*!important$/, '')).toBe('none');
    }
  });

  it('makes the brand mark one of the two dots', () => {
    // The reference's only furniture is a pair of magenta circles pinned to the
    // page corners. A tile with a gradient and a cast shadow is the opposite of
    // that, so the mark becomes a flat full circle.
    const css = stripComments(foudreCss());
    const markRule = css.slice(css.indexOf('.sc-nav-mark'));
    const body = markRule.slice(markRule.indexOf('{'), markRule.indexOf('}'));
    expect(body).toMatch(/border-radius:\s*9999px/);
    expect(body).toMatch(/border:\s*none/);
  });

  it('gives the display voice its own face and the full-intensity magenta', () => {
    // Magenta darkens where it FILLS, because at its published value it carries
    // white at 3.3:1. As display type it keeps full intensity, which is how the
    // reference actually uses it — punctuation, not fill.
    const css = foudreCss();
    const display = valueIn(css, ':root.sc-foudre', 'display');
    const primary = valueIn(css, ':root.sc-foudre', 'primary');
    expect(display).toBe('330 68% 55%');
    expect(primary).toBe('330 68% 38%');
    expect(`display louder:${display !== primary}`).toBe('display louder:true');
    expect(stripComments(css)).toMatch(
      /\.sc-h1\s*\{[^}]*color:\s*hsl\(var\(--sc-display\)\)/,
    );
  });

  it('sets the headline tight, the way the reference blocks its type', () => {
    // Beni runs at line-height 0.70 so a headline reads as a block rather than
    // a line. Anything at or above 1 would lose the whole effect.
    const css = stripComments(foudreCss());
    const h1 = css.slice(css.indexOf('.sc-h1'));
    const lh = /line-height:\s*([\d.]+)/.exec(h1.slice(0, h1.indexOf('}')));
    expect(lh).not.toBeNull();
    expect(parseFloat(lh![1])).toBeLessThan(1);
  });

  it('names only fonts it is allowed to serve', () => {
    // The CSP is font-src 'self'; Beni and Clash Grotesk are licensed, so only
    // the published fallback stacks belong here. Comments are stripped first:
    // the prose is allowed to NAME the licensed faces in order to explain why
    // they are absent, which is the same reason the greek sheet may write
    // BackstageHeader in a comment but never in a selector.
    const css = stripComments(foudreCss());
    expect(css).not.toMatch(/@font-face/);
    expect(css).not.toMatch(/url\(/);
    expect(css).not.toMatch(/\bBeni\b|Clash Grotesk|Druk|Tungsten|Satoshi/i);
  });

  it('never rounds a card holding a table past the point it shows through', () => {
    const css = foudreCss();
    expect(css).toMatch(/\.sc-card:has\(table\)/);
    expect(stripComments(css)).not.toMatch(/overflow:\s*hidden/);
  });
});
