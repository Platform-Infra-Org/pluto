import { frankCss } from './frank';
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

describe('frankCss', () => {
  it('is not truncated and has balanced braces', () => {
    const css = frankCss();
    expect(css.length).toBeGreaterThan(1000);
    const open = (css.match(/{/g) ?? []).length;
    const close = (css.match(/}/g) ?? []).length;
    expect(`${open}/${close}`).toBe(`${close}/${close}`);
  });

  it('has no control characters, which is what a bad escape leaves behind', () => {
    const control = [...frankCss()].filter(ch => {
      const code = ch.codePointAt(0) ?? 32;
      return code < 32 && ch !== '\n' && ch !== '\t' && ch !== '\r';
    });
    expect(control).toEqual([]);
  });

  it('declares every colour token the default :root declares', () => {
    const base = colourTokens(SHADCN_CSS, ':root');
    const light = colourTokens(frankCss(), ':root.sc-frank');
    const dark = colourTokens(frankCss(), ':root.sc-frank.sc-dark');
    expect(base.length).toBeGreaterThan(8);
    expect(light).toEqual(expect.arrayContaining(base));
    expect(dark).toEqual(light);
  });

  it('paints the card colour the contrast test measures against', () => {
    const css = frankCss();
    expect(valueIn(css, ':root.sc-frank', 'card')).toBe(MODE_CARDS.frank.light);
    expect(valueIn(css, ':root.sc-frank.sc-dark', 'card')).toBe(
      MODE_CARDS.frank.dark,
    );
  });

  it('keeps the default status hues', () => {
    const css = frankCss();
    for (const t of ['on-success', 'on-warning', 'on-destructive', 'on-muted']) {
      expect(`${t}:${css.includes(`--sc-${t}:`)}`).toBe(`${t}:false`);
    }
  });

  it('names no class a production build discards', () => {
    const names = Array.from(
      stripComments(frankCss()).matchAll(/\.([A-Za-z][\w-]*)/g),
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

describe('the patterns that make it Frank', () => {
  it('frames every surface with a hairline and never a shadow', () => {
    // "A 1-2px solid black hairline border used as a framing device throughout,
    // creating museum-like presentation without drop shadows."
    const css = stripComments(frankCss());
    expect(valueIn(frankCss(), ':root.sc-frank', 'shadow')).toBe('none');
    expect(css).toMatch(/border-color:\s*hsl\(var\(--sc-fg\) \/ \.85\)/);
    const shadows = Array.from(css.matchAll(/box-shadow:\s*([^;]+);/g), m => m[1].trim());
    for (const sh of shadows) {
      expect(sh.replace(/\s*!important$/, '')).toBe('none');
    }
  });

  it('gives each accent only to the register that can carry it', () => {
    // The reference's accents are not interchangeable: teal measures 1.60:1 on
    // the light card and 11.71:1 on the dark one, plum the reverse. Declaring
    // all of them in both registers would leave half the palette invisible in
    // half the app, so each register redefines the burst tokens for itself.
    const css = frankCss();
    for (const t of ['spotlight', 'deep', 'indigo']) {
      const light = valueIn(css, ':root.sc-frank', t);
      const dark = valueIn(css, ':root.sc-frank.sc-dark', t);
      expect(`${t} light:${Boolean(light)}`).toBe(`${t} light:true`);
      expect(`${t} dark:${Boolean(dark)}`).toBe(`${t} dark:true`);
      expect(`${t} differs:${light !== dark}`).toBe(`${t} differs:true`);
    }
  });

  it('keeps navigation square and actions pill-shaped', () => {
    // The reference gives navigation a 0px radius and buttons 30px — the jump
    // is what separates structural chrome from the content it frames.
    const css = stripComments(frankCss());
    expect(css).toMatch(/\.sc-nav-item[^{]*\{[^}]*border-radius:\s*0/);
    expect(css).toMatch(/border-radius:\s*30px/);
  });

  it('keeps the app font family rather than introducing another', () => {
    // Clash Grotesk everywhere; this mode changes colour and shape, not voice.
    const css = frankCss();
    expect(css).not.toMatch(/--sc-font-pixel:/);
    expect(css).not.toMatch(/@font-face/);
    expect(css).not.toMatch(/url\(/);
  });

  it('never rounds a surface holding a table', () => {
    const css = frankCss();
    expect(css).toMatch(/:has\(table\)/);
    expect(stripComments(css)).not.toMatch(/overflow:\s*hidden/);
  });
});
