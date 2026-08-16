import { spiderverseCss } from './spiderverse';
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

describe('spiderverseCss', () => {
  it('is not truncated and has balanced braces', () => {
    const css = spiderverseCss();
    expect(css.length).toBeGreaterThan(1500);
    const open = (css.match(/{/g) ?? []).length;
    const close = (css.match(/}/g) ?? []).length;
    expect(`${open}/${close}`).toBe(`${close}/${close}`);
  });

  it('contains no backtick, which would truncate the sheet', () => {
    // This file lost its whole stylesheet to a backtick inside a CSS comment
    // once already: the literal ended early and the module exported a string
    // the caller then tried to invoke. Same hazard styles.ts documents.
    expect(spiderverseCss()).not.toMatch(/`/);
  });

  it('declares every colour token the default :root declares', () => {
    const base = colourTokens(SHADCN_CSS, ':root');
    const light = colourTokens(spiderverseCss(), ':root.sc-spiderverse');
    const dark = colourTokens(spiderverseCss(), ':root.sc-spiderverse.sc-dark');
    expect(base.length).toBeGreaterThan(8);
    expect(light).toEqual(expect.arrayContaining(base));
    expect(dark).toEqual(light);
  });

  it('paints the card colour the contrast test measures against', () => {
    const css = spiderverseCss();
    expect(valueIn(css, ':root.sc-spiderverse', 'card')).toBe(MODE_CARDS.spiderverse.light);
    expect(valueIn(css, ':root.sc-spiderverse.sc-dark', 'card')).toBe(MODE_CARDS.spiderverse.dark);
  });

  it('keeps the default status hues', () => {
    const css = spiderverseCss();
    for (const t of ['on-success', 'on-warning', 'on-destructive', 'on-muted']) {
      expect(`${t}:${css.includes(`--sc-${t}:`)}`).toBe(`${t}:false`);
    }
  });
});

describe('the two ceilings that keep it readable', () => {
  // These are the whole risk of this mode. Chromatic aberration doubles every
  // stroke and a halftone screen at strength eats the text on top of it, so
  // both are bounded here rather than left to judgement.

  it('keeps the misregistered plates off body copy', () => {
    // text-shadow may only ever appear on display type. If this list widens to
    // .sc or body, the app becomes unreadable in this mode.
    const css = stripComments(spiderverseCss());
    const rules = Array.from(css.matchAll(/([^{}]+)\{([^}]*)\}/g), m => ({
      sel: m[1].trim().replace(/\s+/g, ' '),
      body: m[2],
    })).filter(r => /text-shadow:/.test(r.body));
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) {
      const allowed = /sc-h1|sc-card-title|keyframes|0%|50%|100%/.test(r.sel);
      expect(`${r.sel.slice(0, 40)} allowed:${allowed}`).toBe(
        `${r.sel.slice(0, 40)} allowed:true`,
      );
    }
  });

  it('keeps the halftone under the alpha that would eat the text', () => {
    const css = stripComments(spiderverseCss());
    const alphas = Array.from(
      css.matchAll(/--sc-halftone\)\s*\/\s*\.(\d+)\)/g),
      m => parseFloat(`0.${m[1]}`),
    );
    expect(alphas.length).toBeGreaterThan(0);
    for (const a of alphas) expect(a).toBeLessThanOrEqual(0.1);
  });
});

describe('the panel', () => {
  it('keeps a hard offset shadow, unlike every other mode here', () => {
    // A printed panel really does throw one, so this is the one mode that
    // keeps a shadow rather than flattening.
    const shadow = valueIn(spiderverseCss(), ':root.sc-spiderverse', 'shadow');
    expect(shadow).toMatch(/4px 4px 0/);
  });

  it('cuts rather than glides — stepped motion, on purpose', () => {
    // Every other mode that owns its motion uses a smooth curve because its
    // reference does. A comic panel cuts, so this one steps, and that is a
    // decision rather than an inherited default.
    const css = stripComments(spiderverseCss());
    expect(css).toMatch(/steps\(/);
    expect(css).not.toMatch(/cubic-bezier/);
  });

  it('puts every animation behind the reduced-motion query', () => {
    const css = stripComments(spiderverseCss());
    const guarded = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));
    const total = (css.match(/animation:/g) ?? []).length;
    const inside = (guarded.match(/animation:/g) ?? []).length;
    expect(`${inside}/${total}`).toBe(`${total}/${total}`);
  });

  it('presses by collapsing its shadow, never by displacing', () => {
    const css = stripComments(spiderverseCss());
    expect(css).not.toMatch(/:active[^{]*\{[^}]*transform:\s*translate/);
    expect(css).toMatch(/:active[^{]*\{[^}]*box-shadow:\s*0 0 0/);
  });

  it('never declares a typeface — the app has one family', () => {
    const css = spiderverseCss();
    expect(css).not.toMatch(/--sc-font-ui:|@font-face|font-family:/);
  });
});
