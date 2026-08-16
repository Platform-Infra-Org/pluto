import { huddleCss } from './huddle';
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

describe('huddleCss', () => {
  it('is not truncated and has balanced braces', () => {
    const css = huddleCss();
    expect(css.length).toBeGreaterThan(1000);
    const open = (css.match(/{/g) ?? []).length;
    const close = (css.match(/}/g) ?? []).length;
    expect(`${open}/${close}`).toBe(`${close}/${close}`);
  });

  it('has no control characters, which is what a bad escape leaves behind', () => {
    const control = [...huddleCss()].filter(ch => {
      const code = ch.codePointAt(0) ?? 32;
      return code < 32 && ch !== '\n' && ch !== '\t' && ch !== '\r';
    });
    expect(control).toEqual([]);
  });

  it('declares every colour token the default :root declares', () => {
    const base = colourTokens(SHADCN_CSS, ':root');
    const light = colourTokens(huddleCss(), ':root.sc-huddle');
    const dark = colourTokens(huddleCss(), ':root.sc-huddle.sc-dark');
    expect(base.length).toBeGreaterThan(8);
    expect(light).toEqual(expect.arrayContaining(base));
    expect(dark).toEqual(light);
  });

  it('paints the card colour the contrast test measures against', () => {
    const css = huddleCss();
    expect(valueIn(css, ':root.sc-huddle', 'card')).toBe(MODE_CARDS.huddle.light);
    expect(valueIn(css, ':root.sc-huddle.sc-dark', 'card')).toBe(
      MODE_CARDS.huddle.dark,
    );
  });

  it('keeps the default status hues', () => {
    const css = huddleCss();
    for (const t of ['on-success', 'on-warning', 'on-destructive', 'on-muted']) {
      expect(`${t}:${css.includes(`--sc-${t}:`)}`).toBe(`${t}:false`);
    }
  });

  it('names no class a production build discards', () => {
    const names = Array.from(
      stripComments(huddleCss()).matchAll(/\.([A-Za-z][\w-]*)/g),
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

describe('the patterns that make it Huddle', () => {
  it('replaces shadows with hairlines entirely', () => {
    // "1px hairline borders replace shadows entirely; colour contrast and
    // borders create separation."
    const css = stripComments(huddleCss());
    expect(valueIn(huddleCss(), ':root.sc-huddle', 'shadow')).toBe('none');
    const shadows = Array.from(css.matchAll(/box-shadow:\s*([^;]+);/g), m =>
      m[1].trim(),
    );
    expect(shadows.length).toBeGreaterThan(0);
    for (const sh of shadows) {
      expect(sh.replace(/\s*!important$/, '')).toBe('none');
    }
  });

  it('keeps a radius vocabulary, not a radius', () => {
    // Badges 4px, cards 8px, list items 24px, pills 100px, primary 1000px. The
    // jump between them is the pattern — a pill beside a near-square card is
    // how a secondary action is told apart from a surface.
    const css = stripComments(huddleCss());
    for (const r of ['4px', '8px', '24px', '100px', '1000px']) {
      expect(`${r}:${css.includes(`border-radius: ${r}`)}`).toBe(`${r}:true`);
    }
  });

  it('pairs burnt amber with honey gold, and nowhere else', () => {
    // "The only place gold appears, so it reads as a highlight." Measured at
    // 4.61:1, so it clears AA exactly as the reference draws it.
    const css = stripComments(huddleCss());
    expect(css).toMatch(/border:\s*1px solid hsl\(var\(--sc-amber\)\)/);
    expect(css).toMatch(/color:\s*hsl\(var\(--sc-honey\)\)/);
    expect(valueIn(huddleCss(), ':root.sc-huddle', 'primary')).not.toBe(
      valueIn(huddleCss(), ':root.sc-huddle', 'honey'),
    );
  });

  it('stays desaturated — no pastel is used as a surface', () => {
    // The three pastels are a status taxonomy in the reference, never
    // decoration. Using one as a card would be the most obvious way to misread
    // this system.
    const css = huddleCss();
    for (const sel of [':root.sc-huddle', ':root.sc-huddle.sc-dark']) {
      for (const token of ['bg', 'card']) {
        const v = valueIn(css, sel, token) ?? '';
        const sat = parseFloat(v.split(' ')[1] ?? '0');
        expect(`${sel} ${token} sat<20:${sat < 20}`).toBe(
          `${sel} ${token} sat<20:true`,
        );
      }
    }
  });

  it('sets the body face to the self-hosted Clash Grotesk', () => {
    const face = valueIn(huddleCss(), ':root.sc-huddle', 'font-pixel');
    expect(face).toMatch(/Clash Grotesk/);
    expect(face).not.toMatch(/Pixelify/);
  });

  it('declares no webfont of its own — the app serves the file', () => {
    // The @font-face lives in styles.ts against a same-origin path, which is
    // what the CSP (font-src 'self') permits.
    const css = huddleCss();
    expect(css).not.toMatch(/@font-face/);
    expect(css).not.toMatch(/url\(/);
  });

  it('never rounds a card holding a table past the point it shows through', () => {
    expect(stripComments(huddleCss())).not.toMatch(/overflow:\s*hidden/);
  });
});
