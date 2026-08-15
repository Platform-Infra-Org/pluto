import { gsapCss } from './gsap';
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
 * This mode declares its palette in one `:root.sc-gsap` block and its
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

describe('gsapCss', () => {
  it('is not truncated and has balanced braces', () => {
    const css = gsapCss();
    expect(css.length).toBeGreaterThan(1000);
    const open = (css.match(/{/g) ?? []).length;
    const close = (css.match(/}/g) ?? []).length;
    expect(`${open}/${close}`).toBe(`${close}/${close}`);
  });

  it('has no control characters, which is what a bad escape leaves behind', () => {
    const control = [...gsapCss()].filter(ch => {
      const code = ch.codePointAt(0) ?? 32;
      return code < 32 && ch !== '\n' && ch !== '\t' && ch !== '\r';
    });
    expect(control).toEqual([]);
  });

  it('declares every colour token the default :root declares', () => {
    const base = colourTokens(SHADCN_CSS, ':root');
    const light = colourTokens(gsapCss(), ':root.sc-gsap');
    const dark = colourTokens(gsapCss(), ':root.sc-gsap.sc-dark');
    expect(base.length).toBeGreaterThan(8);
    expect(light).toEqual(expect.arrayContaining(base));
    expect(dark).toEqual(light);
  });

  it('paints the card colour the contrast test measures against', () => {
    const css = gsapCss();
    expect(valueIn(css, ':root.sc-gsap', 'card')).toBe(
      MODE_CARDS.gsap.light,
    );
    expect(valueIn(css, ':root.sc-gsap.sc-dark', 'card')).toBe(
      MODE_CARDS.gsap.dark,
    );
  });

  it('keeps the default status hues', () => {
    const css = gsapCss();
    for (const t of ['on-success', 'on-warning', 'on-destructive', 'on-muted']) {
      expect(`${t}:${css.includes(`--sc-${t}:`)}`).toBe(`${t}:false`);
    }
  });

  it('names no class a production build discards', () => {
    const names = Array.from(
      stripComments(gsapCss()).matchAll(/\.([A-Za-z][\w-]*)/g),
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
    const css = stripComments(gsapCss());
    expect(valueIn(gsapCss(), ':root.sc-gsap', 'shadow')).toBe('none');
    // Every box-shadow this mode declares must be the removal of one.
    const shadows = Array.from(css.matchAll(/box-shadow:\s*([^;]+);/g), m =>
      m[1].trim(),
    );
    expect(shadows.length).toBeGreaterThan(0);
    for (const s of shadows) {
      expect(s.replace(/\s*!important$/, '')).toBe('none');
    }
  });

  it('keeps the gradient stroke, which is how this system shows depth', () => {
    // The inverse of the anthropic rule: the reference has no shadows and gets
    // its depth from gradients, so a gradient here is required rather than
    // forbidden. It must be the 114.41deg green pair, not a stray.
    const css = stripComments(gsapCss());
    expect(css).toMatch(/linear-gradient\(114\.41deg/);
    expect(css).toMatch(/--sc-green-lit/);
  });

  it('uses neither pure white nor pure black', () => {
    // The reference names this as its one constraint: the warmth of the cream
    // and the off-black IS the character, so neither 0 0% 100% nor 0 0% 0%
    // may appear as a surface in either register.
    const css = gsapCss();
    for (const sel of [':root.sc-gsap', ':root.sc-gsap.sc-dark']) {
      for (const token of ['bg', 'card', 'muted', 'accent']) {
        const v = valueIn(css, sel, token);
        expect(`${sel} ${token}:${v}`).not.toBe(`${sel} ${token}:0 0% 100%`);
        expect(`${sel} ${token}:${v}`).not.toBe(`${sel} ${token}:0 0% 0%`);
      }
    }
  });
});

describe('typography and shape', () => {
  it('replaces the pixel face through the variable the whole system reads', () => {
    // --sc-font-pixel is what `.sc, .sc *` and theme.tsx both resolve, so
    // overriding it here is what carries the serif into MUI's own surfaces
    // rather than only our pages.
    const face = valueIn(gsapCss(), ':root.sc-gsap', 'font-pixel');
    expect(face).toMatch(/Inter Tight/);
    expect(face).not.toMatch(/Pixelify/);
  });

  it('names only fonts it is allowed to serve', () => {
    // The CSP is font-src 'self' and this app self-hosts what it serves, so a
    // webfont reference would either fail the CSP or ship a licensed face we
    // have no right to. Only system and fallback stacks belong here.
    const css = gsapCss();
    expect(css).not.toMatch(/@font-face/);
    expect(css).not.toMatch(/url\(/);
    expect(css).not.toMatch(/\bMori\b|Söhne/i);
  });

  it('drops the uppercase chrome the pixel system uses', () => {
    expect(stripComments(gsapCss())).toMatch(/text-transform:\s*none/);
  });

  it('makes every button a pill', () => {
    // The 100px ghost pill is the most recognisable thing about this system's
    // chrome; a square button would read as any other theme.
    expect(stripComments(gsapCss())).toMatch(/border-radius:\s*100px/);
  });
});
