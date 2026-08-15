import { MODE_DEFS, modesCss } from './modes';
import { SHADCN_CSS } from './styles';
import { MODE_CARDS } from './statusTokens';
import { spriteRects } from './sprites';

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

const valueIn = (css: string, selector: string, token: string) => {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf('}', start));
  return new RegExp(`--sc-${token}:\\s*([^;]+);`).exec(body)?.[1].trim();
};

describe('modesCss', () => {
  it('is not truncated and has balanced braces', () => {
    const css = modesCss();
    expect(css.length).toBeGreaterThan(1000);
    const open = (css.match(/{/g) ?? []).length;
    const close = (css.match(/}/g) ?? []).length;
    expect(`${open}/${close}`).toBe(`${close}/${close}`);
  });

  it('has no control characters, which is what a bad escape leaves behind', () => {
    const control = [...modesCss()].filter(ch => {
      const code = ch.codePointAt(0) ?? 32;
      return code < 32 && ch !== '\n' && ch !== '\t' && ch !== '\r';
    });
    expect(control).toEqual([]);
  });

  it('emits both registers for every mode in the table', () => {
    const css = modesCss();
    for (const m of MODE_DEFS) {
      expect(`${m.id}:${css.includes(`:root.sc-${m.id} {`)}`).toBe(
        `${m.id}:true`,
      );
      expect(`${m.id}:${css.includes(`:root.sc-${m.id}.sc-dark {`)}`).toBe(
        `${m.id}:true`,
      );
    }
  });

  it('declares every colour token the default :root declares, in both registers', () => {
    // A mode that forgets one inherits a colour from the wrong register, which
    // degrades into unreadable text rather than an obvious break.
    const base = colourTokens(SHADCN_CSS, ':root');
    expect(base.length).toBeGreaterThan(8);
    for (const m of MODE_DEFS) {
      const light = colourTokens(modesCss(), `:root.sc-${m.id}`);
      const dark = colourTokens(modesCss(), `:root.sc-${m.id}.sc-dark`);
      expect(`${m.id} light`).toBe(
        light.length >= base.length ? `${m.id} light` : 'missing tokens',
      );
      expect(light).toEqual(expect.arrayContaining(base));
      expect(dark).toEqual(light);
    }
  });

  it('paints the card colour the contrast test measures against', () => {
    // Two sources of truth for one colour: statusTokens.ts holds the value the
    // contrast maths uses, modes.ts holds the value the browser paints. If they
    // drift, contrast.test.ts passes against a colour nothing renders.
    const css = modesCss();
    for (const m of MODE_DEFS) {
      const cards = MODE_CARDS[m.id as keyof typeof MODE_CARDS];
      expect(`${m.id}:${valueIn(css, `:root.sc-${m.id}`, 'card')}`).toBe(
        `${m.id}:${cards.light}`,
      );
      expect(
        `${m.id}:${valueIn(css, `:root.sc-${m.id}.sc-dark`, 'card')}`,
      ).toBe(`${m.id}:${cards.dark}`);
    }
  });

  it('sets primary-shade opposite to primary-fg in every register', () => {
    // The shade outlines text sitting on header art: light text needs a dark
    // edge and dark text a light one. Getting it backwards is silent.
    const css = modesCss();
    for (const m of MODE_DEFS) {
      for (const sel of [`:root.sc-${m.id}`, `:root.sc-${m.id}.sc-dark`]) {
        const fg = valueIn(css, sel, 'primary-fg');
        const shade = valueIn(css, sel, 'primary-shade');
        expect(`${sel}:${fg === shade}`).toBe(`${sel}:false`);
        const fgIsWhite = fg === '0 0% 100%';
        expect(`${sel}:${shade === '0 0% 100%'}`).toBe(`${sel}:${!fgIsWhite}`);
      }
    }
  });

  it('keeps the default status hues rather than inventing one per mode', () => {
    // The design system allows a mode to redefine status hue and Greek already
    // spends that exception. Seven modes each with their own green would leave
    // SUCCEEDED looking different depending on which bottle you hold.
    const css = modesCss();
    for (const t of ['on-success', 'on-warning', 'on-destructive', 'on-muted']) {
      expect(`${t}:${css.includes(`--sc-${t}:`)}`).toBe(`${t}:false`);
    }
  });

  it('names no class a production build discards', () => {
    const names = Array.from(
      stripComments(modesCss()).matchAll(/\.([A-Za-z][\w-]*)/g),
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

  it('glows with a property nothing else claims !important', () => {
    // styles.ts sets box-shadow with !important on .MuiButton-root; an
    // important author declaration beats a normal one at any specificity, so a
    // box-shadow glow here would silently never paint.
    const css = stripComments(modesCss());
    const glows = Array.from(css.matchAll(/filter:\s*drop-shadow\(/g));
    expect(glows.length).toBe(MODE_DEFS.length);
    expect(css).not.toMatch(/:root\.sc-\w+ \.MuiButton-containedPrimary[^{]*\{[^}]*box-shadow/);
  });
});

describe('what floats in each bottle', () => {
  it('gives every mode in the table its own sprite', () => {
    const seen = new Set<string>();
    for (const m of MODE_DEFS) {
      expect(`${m.id}:${Boolean(m.inner)}`).toBe(`${m.id}:true`);
      const key = m.inner.join('|');
      expect(`${m.id} unique:${seen.has(key)}`).toBe(`${m.id} unique:false`);
      seen.add(key);
    }
  });

  it('draws every bottle sprite on the small grid with real pixels', () => {
    // A sprite that is empty, or the wrong size, renders as nothing at all
    // inside the bottle and no string-matching test would notice.
    for (const m of MODE_DEFS) {
      expect(`${m.id} rows:${m.inner.length}`).toBe(`${m.id} rows:8`);
      for (const row of m.inner) {
        expect(`${m.id} width:${row.length}`).toBe(`${m.id} width:8`);
      }
      expect(`${m.id} filled:${spriteRects(m.inner).length > 0}`).toBe(
        `${m.id} filled:true`,
      );
    }
  });

  it('animates the contents, stepped, behind the reduced-motion query', () => {
    const css = stripComments(modesCss());
    const guarded = css.slice(
      css.indexOf('@media (prefers-reduced-motion: no-preference)'),
    );
    const total = (css.match(/animation:/g) ?? []).length;
    const inside = (guarded.match(/animation:/g) ?? []).length;
    expect(`${inside}/${total}`).toBe(`${total}/${total}`);
    expect(css).toMatch(/animation:[^;]*steps\(/);
    expect(css).not.toMatch(/animation:[^;]*\bease\b/);
  });

  it('leaves the contents visible when motion is switched off', () => {
    // The reduced-motion case is designed, not merely disabled: the sprite must
    // still be painted, just not moving. A fill that only existed inside the
    // media query would leave every bottle empty.
    const css = stripComments(modesCss());
    const beforeMedia = css.slice(
      0,
      css.indexOf('@media (prefers-reduced-motion: no-preference)'),
    );
    expect(beforeMedia).toMatch(/\.sc-potion-inner\s*\{[^}]*fill:/);
  });

  it('drives the contents from a class the picker renders in every mode', () => {
    // The shelf shows every bottle whichever theme is active, so this rule is
    // deliberately not mode-scoped. If it were, the sapling would sit frozen
    // until you had already switched to spring.
    const css = stripComments(modesCss());
    const rules = Array.from(css.matchAll(/([^{}]+)\{([^}]*)\}/g), m => ({
      sel: m[1].trim().replace(/\s+/g, ' '),
      body: m[2],
    })).filter(r => r.sel.includes('.sc-potion-inner'));
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) {
      expect(`${r.sel} scoped:${/:root\.sc-\w/.test(r.sel)}`).toBe(
        `${r.sel} scoped:false`,
      );
    }
  });
});
