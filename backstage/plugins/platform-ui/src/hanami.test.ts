import { hanamiCss } from './hanami';
import { MODE_CARDS } from './statusTokens';
import { SHADCN_CSS } from './styles';
import { ASANOHA, KOI, SEIGAIHA, TORII, spriteDataUri } from './sprites';

/** CSS with comments removed, so prose is never mistaken for a declaration. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Every rule, as selector plus body, with the ornament payloads neutralised.
 * A data URI is opaque content, not markup: its xmlns is not a class and its
 * encoded body is not a declaration.
 */
const rulesOf = (css: string) =>
  Array.from(
    stripComments(css)
      .replace(/url\("data:[^"]*"\)/g, 'url(ORNAMENT)')
      .matchAll(/([^{}]+)\{([^}]*)\}/g),
    m => ({ sel: m[1].trim().replace(/\s+/g, ' '), body: m[2] }),
  );

/**
 * The element a rule targets, ignoring the mode prefix — so a light rule and
 * its .sc-dark override are recognised as dressing the same thing.
 */
const target = (sel: string) => sel.split(',')[0].trim().split(/\s+/).pop();

/** The value of one token inside one register block. */
const tokenIn = (css: string, selector: string, name: string) => {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf('}', start));
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(body)?.[1].trim();
};

describe('hanamiCss', () => {
  const css = hanamiCss();

  it('is not truncated and has balanced braces', () => {
    expect(css.length).toBeGreaterThan(1000);
    const open = (css.match(/{/g) ?? []).length;
    const close = (css.match(/}/g) ?? []).length;
    expect(`${open}/${close}`).toBe(`${close}/${close}`);
  });

  it('has no control characters, which is what a bad escape leaves behind', () => {
    // Compared by code point rather than by regex: a control-character regex
    // is itself a lint error, and this is the same net brands.test.ts uses.
    const control = [...css].filter(ch => {
      const code = ch.codePointAt(0) ?? 32;
      return code < 32 && ch !== '\n' && ch !== '\t' && ch !== '\r';
    });
    expect(control).toEqual([]);
  });

  it('declares both registers', () => {
    expect(css).toContain(':root.sc-hanami');
    expect(css).toContain(':root.sc-hanami.sc-dark');
  });

  it('declares the load-bearing tokens in both registers', () => {
    const light = css.slice(
      css.indexOf(':root.sc-hanami'),
      css.indexOf(':root.sc-hanami.sc-dark'),
    );
    const dark = css.slice(css.indexOf(':root.sc-hanami.sc-dark'));
    for (const token of [
      '--sc-bg',
      '--sc-fg',
      '--sc-card',
      '--sc-primary',
      '--sc-primary-fg',
      '--sc-border',
      '--sc-muted-fg',
      '--sc-accent',
    ]) {
      expect(`${token} light:${light.includes(`${token}:`)}`).toBe(`${token} light:true`);
      expect(`${token} dark:${dark.includes(`${token}:`)}`).toBe(`${token} dark:true`);
    }
    // Guards the base sheet still declaring these at all, so this test cannot
    // pass vacuously after a token rename.
    expect(SHADCN_CSS).toContain('--sc-card:');
  });

  it('emits the card value MODE_CARDS advertises', () => {
    expect(css).toContain(`--sc-card: ${MODE_CARDS.hanami.light}`);
    expect(css).toContain(`--sc-card: ${MODE_CARDS.hanami.dark}`);
  });

  it('declares no typeface', () => {
    expect(css).not.toContain('@font-face');
    expect(css).not.toMatch(/font-family:/);
  });

  it('keeps every petal animation behind prefers-reduced-motion and on steps()', () => {
    const query = '@media (prefers-reduced-motion: no-preference)';
    expect(css.indexOf('animation:')).toBeGreaterThan(css.indexOf(query));
    const guarded = css.slice(css.indexOf(query));
    expect(guarded).toContain('steps(');
    expect(guarded).not.toMatch(/animation:[^;]*ease/);
    expect(guarded).not.toMatch(/animation:[^;]*cubic-bezier/);
  });

  it('paints a designed still frame, not a frozen one', () => {
    // Outside the motion query the petals must still be a deliberate picture.
    expect(css).toMatch(/\.sc-sakura i \{[^}]*opacity:/);
  });

  it('does not translate on :active', () => {
    expect(css).not.toMatch(/:active[^{]*\{[^}]*transform:\s*translate/);
  });
});

describe('hanami ornament', () => {
  const css = hanamiCss();

  it('renders every motif it claims, in one register or the other', () => {
    // Colour alone does not make the mode Japanese. An ornament that never
    // reaches the sheet is weight the bundler strips out anyway, and prose in
    // the docstring saying otherwise is how that goes unnoticed.
    const inks = [
      'hsl(189 31% 21.6%)', // ai-iro
      'hsl(187 38% 64.7%)', // asagi
      'hsl(355 59% 38.8%)', // enji
      'hsl(348 79% 70.2%)', // beni
      'hsl(28 45% 89%)', // washi
      'hsl(196 24% 11.5%)', // yoru
    ];
    for (const [name, sprite] of Object.entries({ SEIGAIHA, TORII, ASANOHA, KOI })) {
      const drawn = inks.some(ink => css.includes(spriteDataUri(sprite, ink)));
      expect(`${name}:${drawn}`).toBe(`${name}:true`);
    }
  });

  it('bakes ornament ink that matches the register it is used in', () => {
    // A data URI is its own document: it inherits neither currentColor nor a
    // custom property, so every literal has to track its token by hand. These
    // are the four that carry ornament in this sheet.
    expect(tokenIn(css, ':root.sc-hanami', 'sc-ai')).toBe('189 31% 21.6%');
    expect(tokenIn(css, ':root.sc-hanami.sc-dark', 'sc-ai')).toBe('187 38% 64.7%');
    expect(tokenIn(css, ':root.sc-hanami', 'sc-washi')).toBe('28 45% 89%');
    expect(tokenIn(css, ':root.sc-hanami.sc-dark', 'sc-washi')).toBe('196 24% 11.5%');
    // And the tint is a GROUND, one step off its own surface — never a line
    // ink. If washi ever equals ai, the field stops being paper.
    expect(tokenIn(css, ':root.sc-hanami', 'sc-washi')).not.toBe(
      tokenIn(css, ':root.sc-hanami', 'sc-ai'),
    );
  });

  it('keeps every ornament paired with a repeat', () => {
    // A background-image with no background-repeat tiles across the whole
    // surface: a torii over the sign-in card becomes a wall of gates. Checked
    // per target element, because a register override legitimately swaps only
    // the image and inherits the repeat from the rule above it.
    const rules = rulesOf(css);
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

  it('gives every layered ornament as many repeats as it has images', () => {
    // The list forms are positional: three images and two repeats means the
    // third layer takes the first repeat again, which is how the koi ended up
    // tiled across the shore in the first draft of this rule.
    for (const rule of rulesOf(css).filter(r => r.body.includes('ORNAMENT'))) {
      const images = (rule.body.match(/ORNAMENT/g) ?? []).length;
      const repeats = /background-repeat:\s*([^;]+);/.exec(rule.body);
      if (!repeats || images < 2) continue;
      const list = repeats[1].split(',').length;
      // One repeat covers every layer; otherwise there must be one each.
      expect(`${rule.sel}: ${list === 1 || list === images}`).toBe(
        `${rule.sel}: true`,
      );
    }
  });

  it('never positions ornament on a negative offset', () => {
    // A background is clipped to the border box, so ornament hung outside it
    // paints nothing at all — and a string-matching test passes happily on it.
    // Selector rules only. The petal strip is ADVANCED by a negative
    // background-position inside its keyframes, which is how a sprite strip
    // steps; that is motion, not placement, and it never has to stay inside
    // anyone's border box.
    const offenders = rulesOf(css).filter(
      r =>
        r.sel.startsWith(':root') &&
        /background-position:[^;]*-\d/.test(r.body),
    );
    expect(offenders.map(o => o.sel)).toEqual([]);
  });

  it('outlines the primary button without lighting it', () => {
    // The keyline is the woodblock ink every other shape here carries. The
    // absence of a glow is the design decision, not an omission: this mode is
    // lit by daylight on paper, and greek's ember belongs to a dark room.
    expect(stripComments(css)).toMatch(
      /MuiButton-containedPrimary[\s\S]{0,220}border:[^;]*--sc-ai/,
    );
    expect(stripComments(css)).not.toMatch(/drop-shadow/);
  });
});
