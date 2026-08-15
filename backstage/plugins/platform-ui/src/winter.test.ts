import { winterCss } from './winter';
import { SHADCN_CSS } from './styles';
import { WINTER_CARD_DARK, WINTER_CARD_LIGHT } from './statusTokens';
import { ICICLES, SNOWFLAKE, spriteDataUri } from './sprites';

/** CSS with comments removed, so prose is never mistaken for a declaration. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Only the parts a selector engine would read: no comments, and no inlined
 * ornament. A data URI is opaque content — its `www.w3.org` xmlns is not a
 * class named `org`, and its encoded body is not a declaration.
 */
const selectorsIn = (css: string) =>
  stripComments(css).replace(/url\("data:[^"]*"\)/g, 'url(ORNAMENT)');

const rulesOf = (css: string) =>
  Array.from(selectorsIn(css).matchAll(/([^{}]+)\{([^}]*)\}/g), m => ({
    sel: m[1].trim().replace(/\s+/g, ' '),
    body: m[2],
  }));

const target = (sel: string) => sel.split(',')[0].trim().split(/\s+/).pop();

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

describe('winterCss', () => {
  it('is not truncated', () => {
    expect(winterCss().length).toBeGreaterThan(500);
  });

  it('has balanced braces', () => {
    const css = winterCss();
    const open = (css.match(/{/g) ?? []).length;
    const close = (css.match(/}/g) ?? []).length;
    expect(`${open}/${close}`).toBe(`${close}/${close}`);
  });

  it('has no control characters, which is what a bad escape leaves behind', () => {
    const control = [...winterCss()].filter(ch => {
      const code = ch.codePointAt(0) ?? 32;
      return code < 32 && ch !== '\n' && ch !== '\t' && ch !== '\r';
    });
    expect(control).toEqual([]);
  });

  it('declares every colour token the default :root declares', () => {
    // A mode that forgets one inherits a colour from the wrong register, which
    // degrades into unreadable text rather than an obvious break.
    const base = colourTokens(SHADCN_CSS, ':root');
    const winter = colourTokens(winterCss(), ':root.sc-winter');
    expect(base.length).toBeGreaterThan(8);
    expect(winter).toEqual(expect.arrayContaining(base));
  });

  it('redeclares every colour token in the dark register', () => {
    const light = colourTokens(winterCss(), ':root.sc-winter');
    const dark = colourTokens(winterCss(), ':root.sc-winter.sc-dark');
    expect(dark).toEqual(light);
  });

  it('paints the card colour the contrast test measures against', () => {
    // Two sources of truth for one colour: statusTokens.ts holds the value the
    // contrast maths uses, winter.ts holds the value the browser paints. If
    // they drift, contrast.test.ts passes against a colour nothing renders.
    const css = winterCss();
    const cardIn = (selector: string) => {
      const start = css.indexOf(`${selector} {`);
      const body = css.slice(start, css.indexOf('}', start));
      return /--sc-card:\s*([^;]+);/.exec(body)?.[1].trim();
    };
    expect(cardIn(':root.sc-winter')).toBe(WINTER_CARD_LIGHT);
    expect(cardIn(':root.sc-winter.sc-dark')).toBe(WINTER_CARD_DARK);
  });

  it('keeps the default status hues rather than inventing a third set', () => {
    // The design system allows a mode to redefine status hue and Greek already
    // spends that exception. If winter also redefined them, SUCCEEDED would
    // have three different colours depending on which bottle you hold.
    const css = winterCss();
    for (const t of ['on-success', 'on-warning', 'on-destructive', 'on-muted']) {
      expect(`${t}:${css.includes(`--sc-${t}:`)}`).toBe(`${t}:false`);
    }
  });

  it('names no class a production build discards', () => {
    const names = Array.from(
      selectorsIn(winterCss()).matchAll(/\.([A-Za-z][\w-]*)/g),
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

describe('winter ornament', () => {
  it('renders every ornament it defines, none left unused', () => {
    const css = winterCss();
    for (const [name, sprite] of Object.entries({ SNOWFLAKE, ICICLES })) {
      const light = spriteDataUri(sprite, 'hsl(200 55% 42%)');
      const dark = spriteDataUri(sprite, 'hsl(195 60% 55%)');
      expect(`${name}:${css.includes(light) || css.includes(dark)}`).toBe(
        `${name}:true`,
      );
    }
  });

  it('bakes a colour that matches the register it is used in', () => {
    // A data URI is its own document — it inherits neither currentColor nor a
    // custom property, so the literals have to track --sc-border by hand.
    const css = winterCss();
    const borderIn = (selector: string) => {
      const start = css.indexOf(`${selector} {`);
      const body = css.slice(start, css.indexOf('}', start));
      return /--sc-border:\s*([^;]+);/.exec(body)?.[1].trim();
    };
    expect(borderIn(':root.sc-winter')).toBe('200 55% 42%');
    expect(borderIn(':root.sc-winter.sc-dark')).toBe('195 60% 55%');
  });

  it('never positions ornament on a negative offset', () => {
    // A background is clipped to the border box, and styles.ts additionally
    // sets overflow: hidden on the dialog. Ornament hung outside either
    // boundary paints nothing at all, and a string-matching test passes on it.
    const offenders = rulesOf(winterCss()).filter(
      r =>
        /background-position:[^;]*-\d/.test(r.body) ||
        /\b(?:top|left|bottom|right):\s*-\d/.test(r.body),
    );
    expect(offenders.map(o => o.sel)).toEqual([]);
  });

  it('keeps every ornament paired with a repeat', () => {
    const rules = rulesOf(winterCss());
    const repeated = new Set(
      rules.filter(r => /background-repeat:/.test(r.body)).map(r => target(r.sel)),
    );
    const unpaired = rules.filter(
      r =>
        r.body.includes('ORNAMENT') &&
        !r.body.includes('--sc-header-art') &&
        !repeated.has(target(r.sel)),
    );
    expect(unpaired.map(u => u.sel)).toEqual([]);
  });

  it('marks all four dialog corners with a snow crystal', () => {
    const rule = rulesOf(winterCss()).find(
      r => r.sel.includes('MuiDialog-paper') && r.body.includes('ORNAMENT'),
    );
    expect((rule?.body.match(/ORNAMENT/g) ?? []).length).toBe(4);
  });

  it('gives the header band its own repeat and position hooks', () => {
    const css = winterCss();
    for (const hook of [
      '--sc-header-art:',
      '--sc-header-art-size:',
      '--sc-header-art-repeat:',
      '--sc-header-art-pos:',
    ]) {
      expect(`${hook}${css.includes(hook)}`).toBe(`${hook}true`);
    }
  });
});

describe('the drifting flake', () => {
  it('animates the flake, stepped, behind the reduced-motion query', () => {
    const css = stripComments(winterCss());
    const guarded = css.slice(
      css.indexOf('@media (prefers-reduced-motion: no-preference)'),
    );
    const total = (css.match(/animation:/g) ?? []).length;
    const inside = (guarded.match(/animation:/g) ?? []).length;
    expect(`${inside}/${total}`).toBe(`${total}/${total}`);
    expect(css).toMatch(/animation:[^;]*steps\(/);
    expect(css).not.toMatch(/animation:[^;]*\bease\b/);
  });

  it('leaves the flake visible when motion is switched off', () => {
    // The reduced-motion case is designed, not merely disabled: the flake must
    // still be painted and still be in the bottle, just not moving. A rule that
    // only existed inside the media query would leave an empty bottle.
    const css = stripComments(winterCss());
    const beforeMedia = css.slice(
      0,
      css.indexOf('@media (prefers-reduced-motion: no-preference)'),
    );
    expect(beforeMedia).toMatch(/\.sc-flake\s*\{[^}]*fill:/);
  });

  it('drives the flake from a class the picker renders in every mode', () => {
    // The shelf shows every bottle whichever theme is active, so this one rule
    // is deliberately not scoped to :root.sc-winter. If it were, the snowflake
    // would sit frozen until you had already switched to winter.
    const css = stripComments(winterCss());
    const flakeRules = rulesOf(css).filter(r => r.sel.includes('.sc-flake'));
    expect(flakeRules.length).toBeGreaterThan(0);
    for (const r of flakeRules) {
      expect(`${r.sel} scoped:${r.sel.includes('sc-winter')}`).toBe(
        `${r.sel} scoped:false`,
      );
    }
  });
});
