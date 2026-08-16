import { BRAND_DEFS, brandsCss } from './brands';
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

describe('brandsCss', () => {
  it('is not truncated and has balanced braces', () => {
    const css = brandsCss();
    expect(css.length).toBeGreaterThan(2000);
    const open = (css.match(/{/g) ?? []).length;
    const close = (css.match(/}/g) ?? []).length;
    expect(`${open}/${close}`).toBe(`${close}/${close}`);
  });

  it('has no control characters, which is what a bad escape leaves behind', () => {
    const control = [...brandsCss()].filter(ch => {
      const code = ch.codePointAt(0) ?? 32;
      return code < 32 && ch !== '\n' && ch !== '\t' && ch !== '\r';
    });
    expect(control).toEqual([]);
  });

  it('emits both registers for every brand', () => {
    const css = brandsCss();
    for (const b of BRAND_DEFS) {
      expect(`${b.id}:${css.includes(`:root.sc-${b.id} {`)}`).toBe(`${b.id}:true`);
      expect(`${b.id}:${css.includes(`:root.sc-${b.id}.sc-dark {`)}`).toBe(`${b.id}:true`);
    }
  });

  it('declares every colour token the default :root declares', () => {
    const base = colourTokens(SHADCN_CSS, ':root');
    expect(base.length).toBeGreaterThan(8);
    for (const b of BRAND_DEFS) {
      const light = colourTokens(brandsCss(), `:root.sc-${b.id}`);
      const dark = colourTokens(brandsCss(), `:root.sc-${b.id}.sc-dark`);
      expect(light).toEqual(expect.arrayContaining(base));
      expect(dark).toEqual(light);
    }
  });

  it('paints the card colour the contrast test measures against', () => {
    // statusTokens.ts holds the value the maths uses, brands.ts the one the
    // browser paints. Drift means contrast.test.ts passes against a colour
    // nothing renders.
    const css = brandsCss();
    for (const b of BRAND_DEFS) {
      const cards = MODE_CARDS[b.id as keyof typeof MODE_CARDS];
      expect(`${b.id}:${valueIn(css, `:root.sc-${b.id}`, 'card')}`).toBe(`${b.id}:${cards.light}`);
      expect(`${b.id}:${valueIn(css, `:root.sc-${b.id}.sc-dark`, 'card')}`).toBe(`${b.id}:${cards.dark}`);
    }
  });

  it('sets primary-shade opposite to primary-fg in every register', () => {
    const css = brandsCss();
    for (const b of BRAND_DEFS) {
      for (const sel of [`:root.sc-${b.id}`, `:root.sc-${b.id}.sc-dark`]) {
        const fg = valueIn(css, sel, 'primary-fg');
        const shade = valueIn(css, sel, 'primary-shade');
        expect(`${sel}:${fg === shade}`).toBe(`${sel}:false`);
      }
    }
  });

  it('keeps the default status hues rather than one per brand', () => {
    const css = brandsCss();
    for (const t of ['on-success', 'on-warning', 'on-destructive', 'on-muted']) {
      expect(`${t}:${css.includes(`--sc-${t}:`)}`).toBe(`${t}:false`);
    }
  });

  it('never declares a typeface — the app has one family', () => {
    const css = brandsCss();
    expect(css).not.toMatch(/--sc-font-ui:/);
    expect(css).not.toMatch(/@font-face/);
    expect(css).not.toMatch(/font-family:/);
  });

  it('names no class a production build discards', () => {
    const names = Array.from(stripComments(brandsCss()).matchAll(/\.([A-Za-z][\w-]*)/g), m => m[1]);
    const bad = names.filter(
      n => !n.startsWith('Mui') && !n.startsWith('bui-') && !n.startsWith('sc-') && !n.startsWith('material-icons'),
    );
    expect(bad).toEqual([]);
  });

  it('never rounds a surface holding a table', () => {
    const css = brandsCss();
    for (const b of BRAND_DEFS) {
      expect(`${b.id}:${css.includes(`:root.sc-${b.id} .sc-card:has(table)`)}`).toBe(`${b.id}:true`);
    }
    expect(stripComments(css)).not.toMatch(/overflow:\s*hidden/);
  });
});

describe('brand character', () => {
  it('gives every brand its own bottle colour', () => {
    expect(new Set(BRAND_DEFS.map(b => b.bottle)).size).toBe(BRAND_DEFS.length);
  });

  it('casts a shadow only where the reference has one', () => {
    // Of the six, only New Form casts anything — a green-tinted glow measured
    // on its own page. Giving the others a shadow would be inventing character
    // rather than reproducing it.
    const glowing = BRAND_DEFS.filter(b => b.glow);
    expect(glowing.map(b => b.id)).toEqual(['newform']);
    const css = brandsCss();
    for (const b of BRAND_DEFS) {
      expect(`${b.id}:${valueIn(css, `:root.sc-${b.id}`, 'shadow')}`).toBe(
        `${b.id}:${b.glow ?? 'none'}`,
      );
    }
  });

  it('animates only where the reference chrome moves', () => {
    const moving = BRAND_DEFS.filter(b => b.ease).map(b => b.id);
    expect(moving).toEqual(['newform', 'discord']);
    const css = stripComments(brandsCss());
    const guarded = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));
    const total = (css.match(/transition:/g) ?? []).length;
    const inside = (guarded.match(/transition:/g) ?? []).length;
    expect(`${inside}/${total}`).toBe(`${total}/${total}`);
  });

  it('presses by settling, never by displacing', () => {
    const css = stripComments(brandsCss());
    expect(css).not.toMatch(/:active[^{]*\{[^}]*transform:\s*translate/);
  });

  it('carries each reference own radius', () => {
    const css = stripComments(brandsCss());
    for (const b of BRAND_DEFS) {
      expect(`${b.id}:${css.includes(`border-radius: ${b.radius.card} !important`)}`).toBe(`${b.id}:true`);
      expect(`${b.id}:${css.includes(`border-radius: ${b.radius.button} !important`)}`).toBe(`${b.id}:true`);
    }
  });
});
