import { anthropicCss } from './anthropic';
import { SHADCN_CSS } from './styles';
import { MODE_CARDS } from './statusTokens';

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Every `--sc-*` whose value is an "H S% L%" triplet, inside one selector block. */
function colourTokens(css: string, selector: string): string[] {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return [];
  const body = css.slice(start, css.indexOf('}', start));
  return Array.from(
    body.matchAll(/--(sc-[a-z-]+):\s*[\d.]+\s+[\d.]+%\s+[\d.]+%\s*;/g),
    m => m[1],
  ).sort();
}

/**
 * A token's value, looked up across EVERY block using that selector.
 *
 * This mode declares its palette in one `:root.sc-anthropic` block and its
 * character — shadow, radius, fonts — in a second one, so a helper that reads
 * only the first block reports the character tokens as missing.
 */
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

describe('anthropicCss', () => {
  it('is not truncated and has balanced braces', () => {
    const css = anthropicCss();
    expect(css.length).toBeGreaterThan(1000);
    const open = (css.match(/{/g) ?? []).length;
    const close = (css.match(/}/g) ?? []).length;
    expect(`${open}/${close}`).toBe(`${close}/${close}`);
  });

  it('has no control characters, which is what a bad escape leaves behind', () => {
    const control = [...anthropicCss()].filter(ch => {
      const code = ch.codePointAt(0) ?? 32;
      return code < 32 && ch !== '\n' && ch !== '\t' && ch !== '\r';
    });
    expect(control).toEqual([]);
  });

  it('declares every colour token the default :root declares', () => {
    const base = colourTokens(SHADCN_CSS, ':root');
    const light = colourTokens(anthropicCss(), ':root.sc-anthropic');
    const dark = colourTokens(anthropicCss(), ':root.sc-anthropic.sc-dark');
    expect(base.length).toBeGreaterThan(8);
    expect(light).toEqual(expect.arrayContaining(base));
    expect(dark).toEqual(light);
  });

  it('paints the card colour the contrast test measures against', () => {
    const css = anthropicCss();
    expect(valueIn(css, ':root.sc-anthropic', 'card')).toBe(
      MODE_CARDS.anthropic.light,
    );
    expect(valueIn(css, ':root.sc-anthropic.sc-dark', 'card')).toBe(
      MODE_CARDS.anthropic.dark,
    );
  });

  it('keeps the default status hues', () => {
    const css = anthropicCss();
    for (const t of ['on-success', 'on-warning', 'on-destructive', 'on-muted']) {
      expect(`${t}:${css.includes(`--sc-${t}:`)}`).toBe(`${t}:false`);
    }
  });

  it('names no class a production build discards', () => {
    const names = Array.from(
      stripComments(anthropicCss()).matchAll(/\.([A-Za-z][\w-]*)/g),
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

describe('the three negatives', () => {
  // The reference system is defined as much by what it refuses as what it
  // uses: no drop shadows, no gradients, no pure white. Each of those is a
  // default the pixel design system asserts globally, so each has to be
  // actively unset — and a later edit could silently restore any of them.

  it('casts no shadow anywhere', () => {
    const css = stripComments(anthropicCss());
    expect(valueIn(anthropicCss(), ':root.sc-anthropic', 'shadow')).toBe('none');
    // Every box-shadow this mode declares must be the removal of one.
    const shadows = Array.from(css.matchAll(/box-shadow:\s*([^;]+);/g), m =>
      m[1].trim(),
    );
    expect(shadows.length).toBeGreaterThan(0);
    for (const s of shadows) {
      expect(s.replace(/\s*!important$/, '')).toBe('none');
    }
  });

  it('paints no gradient anywhere', () => {
    expect(stripComments(anthropicCss())).not.toMatch(/gradient\(/);
  });

  it('uses no pure white as a surface', () => {
    // Ivory Light, not #fff. A surface at 0 0% 100% would be the one colour the
    // reference explicitly avoids.
    const css = anthropicCss();
    for (const sel of [':root.sc-anthropic', ':root.sc-anthropic.sc-dark']) {
      for (const token of ['bg', 'card', 'muted', 'accent']) {
        expect(`${sel} ${token}:${valueIn(css, sel, token)}`).not.toBe(
          `${sel} ${token}:0 0% 100%`,
        );
      }
    }
  });
});

describe('typography and shape', () => {
  it('replaces the pixel face through the variable the whole system reads', () => {
    // --sc-font-pixel is what `.sc, .sc *` and theme.tsx both resolve, so
    // overriding it here is what carries the serif into MUI's own surfaces
    // rather than only our pages.
    const serif = valueIn(anthropicCss(), ':root.sc-anthropic', 'font-pixel');
    expect(serif).toMatch(/serif/);
    expect(serif).not.toMatch(/Pixelify/);
  });

  it('names only fonts it is allowed to serve', () => {
    // The CSP is font-src 'self' and this app self-hosts what it serves, so a
    // webfont reference would either fail the CSP or ship a licensed face we
    // have no right to. Only system and fallback stacks belong here.
    const css = anthropicCss();
    expect(css).not.toMatch(/@font-face/);
    expect(css).not.toMatch(/url\(/);
    expect(css).not.toMatch(/Styrene|Tiempos|Copernicus/i);
  });

  it('drops the uppercase chrome the pixel system uses', () => {
    expect(stripComments(anthropicCss())).toMatch(/text-transform:\s*none/);
  });

  it('softens the corners rather than keeping the 6px pixel radius', () => {
    const radius = valueIn(anthropicCss(), ':root.sc-anthropic', 'radius');
    expect(parseInt(radius ?? '0', 10)).toBeGreaterThan(6);
  });
});
