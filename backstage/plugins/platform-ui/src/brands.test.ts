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
      expect(`${b.id}:${css.includes(`:root.sc-${b.id}.sc-dark {`)}`).toBe(
        `${b.id}:true`,
      );
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
    // statusTokens.ts holds the value the contrast maths uses and brands.ts
    // holds the value the browser paints. If they drift, contrast.test.ts
    // passes against a colour nothing renders.
    const css = brandsCss();
    for (const b of BRAND_DEFS) {
      const cards = MODE_CARDS[b.id as keyof typeof MODE_CARDS];
      expect(`${b.id}:${valueIn(css, `:root.sc-${b.id}`, 'card')}`).toBe(
        `${b.id}:${cards.light}`,
      );
      expect(`${b.id}:${valueIn(css, `:root.sc-${b.id}.sc-dark`, 'card')}`).toBe(
        `${b.id}:${cards.dark}`,
      );
    }
  });

  it('sets primary-shade opposite to primary-fg in every register', () => {
    const css = brandsCss();
    for (const b of BRAND_DEFS) {
      for (const sel of [`:root.sc-${b.id}`, `:root.sc-${b.id}.sc-dark`]) {
        const fg = valueIn(css, sel, 'primary-fg');
        const shade = valueIn(css, sel, 'primary-shade');
        expect(`${sel}:${fg === shade}`).toBe(`${sel}:false`);
        expect(`${sel}:${shade === '0 0% 100%'}`).toBe(
          `${sel}:${fg !== '0 0% 100%'}`,
        );
      }
    }
  });

  it('keeps the default status hues rather than one per brand', () => {
    // Greek spends the design system's single exception. Nine brands each with
    // their own green would leave SUCCEEDED looking different per bottle.
    const css = brandsCss();
    for (const t of ['on-success', 'on-warning', 'on-destructive', 'on-muted']) {
      expect(`${t}:${css.includes(`--sc-${t}:`)}`).toBe(`${t}:false`);
    }
  });

  it('names no class a production build discards', () => {
    const names = Array.from(
      stripComments(brandsCss()).matchAll(/\.([A-Za-z][\w-]*)/g),
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

  it('names only fonts it is allowed to serve', () => {
    // The CSP is font-src 'self' and this app self-hosts what it serves, so a
    // webfont reference would either fail the CSP or ship a licensed face.
    const css = brandsCss();
    expect(css).not.toMatch(/@font-face/);
    expect(css).not.toMatch(/url\(/);
    expect(css).not.toMatch(/\bSalmond\b|\bGraphikx\b|\bLateral\b|ppmondwest/i);
  });
});

describe('brand shapes', () => {
  it('gives every brand its own bottle colour', () => {
    const seen = new Set(BRAND_DEFS.map(b => b.bottle));
    expect(seen.size).toBe(BRAND_DEFS.length);
  });

  it('never rounds a card holding a table past the point it shows through', () => {
    // A table is a rectangle with its own filled header. Past roughly 12px its
    // square corners appear outside the card's curve — and clipping the card to
    // hide that cuts the table's own edge off, which is worse.
    const css = brandsCss();
    for (const b of BRAND_DEFS) {
      expect(
        `${b.id}:${css.includes(`:root.sc-${b.id} .sc-card:has(table)`)}`,
      ).toBe(`${b.id}:true`);
    }
    expect(stripComments(css)).not.toMatch(/overflow:\s*hidden/);
  });

  it('gives a flat brand no shadow and a tactile one a real stack', () => {
    const css = brandsCss();
    for (const b of BRAND_DEFS) {
      const shadow = valueIn(css, `:root.sc-${b.id}`, 'shadow');
      expect(`${b.id}:${shadow === 'none'}`).toBe(`${b.id}:${b.flat}`);
    }
    // Raycast is the one that keeps depth, and it does it with inset edges
    // rather than a cast shadow — a key pressed into the page, not floating.
    expect(stripComments(css)).toMatch(/inset 0 1px 0 hsl\(0 0% 100% \/ \.07\)/);
  });

  it('carries each reference own button shape', () => {
    const css = stripComments(brandsCss());
    for (const b of BRAND_DEFS) {
      expect(`${b.id}:${css.includes(`border-radius: ${b.radius.button}`)}`).toBe(
        `${b.id}:true`,
      );
    }
  });
});
