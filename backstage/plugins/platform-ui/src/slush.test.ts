import { slushCss } from './slush';
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

describe('slushCss', () => {
  it('is not truncated and has balanced braces', () => {
    const css = slushCss();
    expect(css.length).toBeGreaterThan(1000);
    const open = (css.match(/{/g) ?? []).length;
    const close = (css.match(/}/g) ?? []).length;
    expect(`${open}/${close}`).toBe(`${close}/${close}`);
  });

  it('has no control characters, which is what a bad escape leaves behind', () => {
    const control = [...slushCss()].filter(ch => {
      const code = ch.codePointAt(0) ?? 32;
      return code < 32 && ch !== '\n' && ch !== '\t' && ch !== '\r';
    });
    expect(control).toEqual([]);
  });

  it('declares every colour token the default :root declares', () => {
    const base = colourTokens(SHADCN_CSS, ':root');
    const light = colourTokens(slushCss(), ':root.sc-slush');
    const dark = colourTokens(slushCss(), ':root.sc-slush.sc-dark');
    expect(base.length).toBeGreaterThan(8);
    expect(light).toEqual(expect.arrayContaining(base));
    expect(dark).toEqual(light);
  });

  it('paints the card colour the contrast test measures against', () => {
    const css = slushCss();
    expect(valueIn(css, ':root.sc-slush', 'card')).toBe(MODE_CARDS.slush.light);
    expect(valueIn(css, ':root.sc-slush.sc-dark', 'card')).toBe(
      MODE_CARDS.slush.dark,
    );
  });

  it('keeps the default status hues', () => {
    const css = slushCss();
    for (const t of ['on-success', 'on-warning', 'on-destructive', 'on-muted']) {
      expect(`${t}:${css.includes(`--sc-${t}:`)}`).toBe(`${t}:false`);
    }
  });

  it('names no class a production build discards', () => {
    const names = Array.from(
      stripComments(slushCss()).matchAll(/\.([A-Za-z][\w-]*)/g),
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

describe('the patterns that make it Slush', () => {
  it('cuts every surface with a heavy rule and casts no shadow', () => {
    // 72 elements at 4px solid black and 61 more at 2px on the reference, and
    // not one box-shadow on the whole page. A sticker is defined by its cut
    // edge, so the rule is the design rather than a detail of it.
    const css = stripComments(slushCss());
    expect(valueIn(slushCss(), ':root.sc-slush', 'shadow')).toBe('none');
    expect(css).toMatch(/border:\s*4px solid hsl\(var\(--sc-border\)\)/);
    expect(css).toMatch(/border:\s*2px solid hsl\(var\(--sc-border\)\)/);
    const shadows = Array.from(css.matchAll(/box-shadow:\s*([^;]+);/g), m => m[1].trim());
    expect(shadows.length).toBeGreaterThan(0);
    for (const sh of shadows) expect(sh.replace(/\s*!important$/, '')).toBe('none');
  });

  it('draws the reference radius set, pills included', () => {
    const css = stripComments(slushCss());
    expect(valueIn(slushCss(), ':root.sc-slush', 'radius')).toBe('20px');
    expect(css).toMatch(/border-radius:\s*30px/);
    expect(css).toMatch(/border-radius:\s*9999px/);
  });

  it('puts black text on every sticker, because the measurements say so', () => {
    // Against black: yellow 14.94, lavender 14.57, mint 12.09, blue 7.57,
    // ember 6.12. Against white those same fills sit at 1.41-3.43. A theme
    // that put white on all of them would be illegible on five of its six
    // accents, so the badge and the mark both take ink.
    const css = stripComments(slushCss());
    const inked = css.match(/color:\s*hsl\(0 0% 0%\)/g) ?? [];
    expect(inked.length).toBeGreaterThanOrEqual(2);
    // The one fill that inverts is kept as its own token rather than used as a
    // background with black on it.
    expect(valueIn(slushCss(), ':root.sc-slush', 'sticker-deep')).toBe('247 71% 58%');
  });

  it('separates the sticker blue from the action blue', () => {
    // The published blue carries white at 2.78:1 and cannot fill a button; the
    // primary darkens to 43% for 5.53:1. The sticker keeps the site value.
    expect(valueIn(slushCss(), ':root.sc-slush', 'primary')).toBe('213 100% 43%');
    expect(valueIn(slushCss(), ':root.sc-slush', 'sticker')).toBe('48 100% 60%');
  });

  it('keeps the app typeface rather than introducing another', () => {
    const css = slushCss();
    expect(css).not.toMatch(/--sc-font-ui:/);
    expect(css).not.toMatch(/@font-face/);
    expect(css).not.toMatch(/url\(/);
    expect(css).not.toMatch(/Aeonik|Lateral/i);
  });

  it('never rounds a surface holding a table', () => {
    expect(slushCss()).toMatch(/:has\(table\)/);
    expect(stripComments(slushCss())).not.toMatch(/overflow:\s*hidden/);
  });
});

describe('the motion this mode owns', () => {
  it('declares its curve as a token and uses no stepped timing', () => {
    const css = stripComments(slushCss());
    expect(valueIn(slushCss(), ':root.sc-slush', 'ease')).toMatch(/cubic-bezier/);
    expect(css).not.toMatch(/steps\(/);
  });

  it('puts every animation and transition behind the reduced-motion query', () => {
    const css = stripComments(slushCss());
    const guarded = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));
    for (const prop of ['transition:', 'animation:']) {
      const total = (css.match(new RegExp(prop, 'g')) ?? []).length;
      const inside = (guarded.match(new RegExp(prop, 'g')) ?? []).length;
      expect(`${prop} ${inside}/${total}`).toBe(`${prop} ${total}/${total}`);
    }
  });

  it('presses by settling, never by displacing', () => {
    // A translate on :active slides the control out from under the pointer,
    // which the base sheet bans app-wide. Scale is the sticker equivalent.
    const css = stripComments(slushCss());
    expect(css).not.toMatch(/:active[^{]*\{[^}]*transform:\s*translate/);
    expect(css).toMatch(/:active[^{]*\{[^}]*transform:\s*scale/);
  });
});
