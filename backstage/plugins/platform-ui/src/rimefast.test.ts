import { rimefastCss } from './rimefast';
import { MODE_CARDS } from './statusTokens';
import { SHADCN_CSS } from './styles';
import {
  AURORA,
  FUTHARK,
  KNOTWORK,
  RAVEN,
  YGGDRASIL,
  mirrorSprite,
  rotateSprite,
  spriteDataUri,
} from './sprites';

/** CSS with comments removed, so prose is never mistaken for a declaration. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Every rule, as selector plus body, with the ornament payloads neutralised. */
const rulesOf = (css: string) =>
  Array.from(
    stripComments(css)
      .replace(/url\("data:[^"]*"\)/g, 'url(ORNAMENT)')
      .matchAll(/([^{}]+)\{([^}]*)\}/g),
    m => ({ sel: m[1].trim().replace(/\s+/g, ' '), body: m[2] }),
  );

/** The element a rule targets, ignoring the mode prefix. */
const target = (sel: string) => sel.split(',')[0].trim().split(/\s+/).pop();

/** The value of one token inside one register block. */
const tokenIn = (css: string, selector: string, name: string) => {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf('}', start));
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(body)?.[1].trim();
};

describe('rimefastCss', () => {
  const css = rimefastCss();

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
    expect(css).toContain(':root.sc-rimefast');
    expect(css).toContain(':root.sc-rimefast.sc-dark');
  });

  it('declares the load-bearing tokens in both registers', () => {
    const light = css.slice(
      css.indexOf(':root.sc-rimefast'),
      css.indexOf(':root.sc-rimefast.sc-dark'),
    );
    const dark = css.slice(css.indexOf(':root.sc-rimefast.sc-dark'));
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
    expect(css).toContain(`--sc-card: ${MODE_CARDS.rimefast.light}`);
    expect(css).toContain(`--sc-card: ${MODE_CARDS.rimefast.dark}`);
  });

  it('declares no typeface', () => {
    expect(css).not.toContain('@font-face');
    expect(css).not.toMatch(/font-family:/);
  });

  it('keeps every aurora animation behind prefers-reduced-motion and on steps()', () => {
    const query = '@media (prefers-reduced-motion: no-preference)';
    expect(css.indexOf('animation:')).toBeGreaterThan(css.indexOf(query));
    const guarded = css.slice(css.indexOf(query));
    expect(guarded).toContain('steps(');
    expect(guarded).not.toMatch(/animation:[^;]*ease/);
    expect(guarded).not.toMatch(/animation:[^;]*cubic-bezier/);
  });

  it('paints a designed still frame, not a frozen one', () => {
    // Outside the motion query the aurora must still be a deliberate picture:
    // the same strip, fully painted and correctly coloured on frame one.
    expect(css).toMatch(/\.sc-rune-rule \{[^}]*opacity:/);
  });

  it('does not translate on :active', () => {
    expect(css).not.toMatch(/:active[^{]*\{[^}]*transform:\s*translate/);
  });

  it('names no rune that has been appropriated as an extremist symbol', () => {
    // Genuine Norse forms, all catalogued by the ADL. Ravens, Yggdrasil,
    // knotwork and generic futhark bands carry no such freight.
    const sheet = rimefastCss().toLowerCase();
    for (const banned of ['valknut', 'othala', 'sowilo', 'sunwheel', 'sigrune']) {
      expect(`${banned}:${sheet.includes(banned)}`).toBe(`${banned}:false`);
    }
  });
});

describe('rimefast ornament', () => {
  const css = rimefastCss();
  const INKS = [
    'hsl(41 75% 51.4%)', // orpiment
    'hsl(28 70% 34%)', // ochre, by day
    'hsl(205 45% 30%)', // woad
    'hsl(157 35% 40%)', // frost
    'hsl(157 60% 59.8%)', // aurora, night
    'hsl(157 55% 28%)', // aurora, day
  ];

  it('renders every motif it claims, in one register or the other', () => {
    // An ornament that never reaches the sheet is weight the bundler strips
    // out anyway, and a docstring claiming otherwise is how that goes unseen.
    // The derived forms count: the sidebar band is the futhark turned upright
    // and the right-hand raven is the left one mirrored.
    for (const [name, sprite] of Object.entries({
      FUTHARK,
      KNOTWORK,
      YGGDRASIL,
      AURORA,
      RAVEN,
    })) {
      const drawn = INKS.some(
        ink =>
          css.includes(spriteDataUri(sprite, ink)) ||
          css.includes(spriteDataUri(rotateSprite(sprite), ink)),
      );
      expect(`${name}:${drawn}`).toBe(`${name}:true`);
    }
  });

  it('faces the two ravens at each other', () => {
    // Two birds facing the same way are one drawing used twice, which is the
    // first thing the eye notices. The mirror is generated so the pair cannot
    // drift; this is what catches it being dropped.
    const orpiment = 'hsl(41 75% 51.4%)';
    expect(css).toContain(spriteDataUri(RAVEN, orpiment));
    expect(css).toContain(spriteDataUri(mirrorSprite(RAVEN), orpiment));
  });

  it('bakes ornament ink that matches the register it is used in', () => {
    // A data URI is its own document: it inherits neither currentColor nor a
    // custom property, so every literal tracks its token by hand.
    expect(tokenIn(css, ':root.sc-rimefast', 'sc-border')).toBe('205 45% 30%');
    expect(tokenIn(css, ':root.sc-rimefast.sc-dark', 'sc-border')).toBe('157 35% 40%');
    expect(tokenIn(css, ':root.sc-rimefast', 'sc-primary')).toBe('28 70% 34%');
    expect(tokenIn(css, ':root.sc-rimefast.sc-dark', 'sc-primary')).toBe('41 75% 51.4%');
    expect(tokenIn(css, ':root.sc-rimefast', 'sc-aurora-ink')).toBe('157 55% 28%');
    expect(tokenIn(css, ':root.sc-rimefast.sc-dark', 'sc-aurora-ink')).toBe('157 60% 59.8%');
  });

  it('prints the sidebar as a field rather than a strip down one edge', () => {
    // The hanami sidebar is the model this follows: a full-panel tiled lattice
    // at low contrast, so the nav reads as a wall the labels sit on. A band
    // anchored to one edge reads as a seam — something the layout did — and it
    // has nowhere to go when the nav collapses to icon width.
    // Painted in the ground tint, never in woad.
    const nav = /:root\.sc-rimefast \.sc-nav \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(nav).toMatch(/background-repeat:\s*repeat;/);
    expect(nav).not.toMatch(/repeat-y/);
    expect(nav).toContain(spriteDataUri(KNOTWORK, 'hsl(44 30% 93%)'));
    const dark = /:root\.sc-rimefast\.sc-dark \.sc-nav \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(dark).toContain(spriteDataUri(KNOTWORK, 'hsl(205 30% 12%)'));
  });

  it('keeps the ground tint a ground, and off the line inks', () => {
    // Same literal-tracks-token trap as the inks above, one layer quieter: the
    // sidebar field is printed in a tint that sits a few points off its own
    // surface. If it ever equals a line ink, the panel stops being a wall and
    // becomes a drawing.
    expect(tokenIn(css, ':root.sc-rimefast', 'sc-ground')).toBe('44 30% 93%');
    expect(tokenIn(css, ':root.sc-rimefast.sc-dark', 'sc-ground')).toBe('205 30% 12%');
    expect(tokenIn(css, ':root.sc-rimefast', 'sc-ground')).not.toBe(
      tokenIn(css, ':root.sc-rimefast', 'sc-border'),
    );
  });

  it('keeps every ornament paired with a repeat', () => {
    // A background-image with no background-repeat tiles the whole surface: a
    // perched raven becomes a flock. Checked per target element, because a
    // register override legitimately swaps only the image.
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

  it('gives every layered ornament a position for each image', () => {
    // The list forms are positional: two ravens against one position stacks
    // them both in the same corner.
    for (const rule of rulesOf(css).filter(r => r.body.includes('ORNAMENT'))) {
      const images = (rule.body.match(/ORNAMENT/g) ?? []).length;
      const pos = /background-position:\s*([^;]+);/.exec(rule.body);
      if (!pos || images < 2) continue;
      expect(`${rule.sel}: ${pos[1].split(',').length}`).toBe(`${rule.sel}: ${images}`);
    }
  });

  it('never positions ornament on a negative offset', () => {
    // A background is clipped to the border box, so ornament hung outside it
    // paints nothing at all. Selector rules only: the aurora is ADVANCED by a
    // negative position inside its keyframes, which is how a strip steps.
    const offenders = rulesOf(css).filter(
      r => r.sel.startsWith(':root') && /background-position:[^;]*-\d/.test(r.body),
    );
    expect(offenders.map(o => o.sel)).toEqual([]);
  });
});

describe('rimefast motion', () => {
  const css = stripComments(rimefastCss());
  const QUERY = '@media (prefers-reduced-motion: no-preference)';

  it('puts every animation behind the reduced-motion query', () => {
    const guarded = css.slice(css.indexOf(QUERY));
    const all = (css.match(/animation:/g) ?? []).length;
    const inside = (guarded.match(/animation:/g) ?? []).length;
    expect(`${inside}/${all}`).toBe(`${all}/${all}`);
    expect(all).toBeGreaterThan(1); // the aurora and the button, not just one
  });

  it('leaves the button lit when motion is declined, not frozen mid-pulse', () => {
    // The still frame is designed: the static filter and the lit keyframe are
    // the same declaration, or stillness means a glow caught halfway down.
    const beforeQuery = css.slice(0, css.indexOf(QUERY));
    const statics = Array.from(beforeQuery.matchAll(/[^-]filter:\s*([^;]+);/g));
    const staticGlow = statics[statics.length - 1]?.[1].trim();
    const lit = /0%,\s*100%\s*\{\s*filter:\s*([^;]+);/.exec(css)?.[1].trim();
    expect(staticGlow).toBeDefined();
    expect(lit).toBe(staticGlow);
  });

  it('glows with a property nothing else claims !important', () => {
    // styles.ts sets box-shadow with !important on the button root, and an
    // important author declaration beats both a normal one at any specificity
    // AND the animation origin — a box-shadow glow here paints nothing.
    const frames = css.match(/@keyframes sc-rimefast-forge\s*\{([\s\S]*?)\n\s*\}/);
    expect(frames).toBeTruthy();
    expect(frames![1]).toMatch(/filter:\s*drop-shadow\(/);
    expect(frames![1]).not.toMatch(/box-shadow/);
  });

  it('glows in orpiment, never in the aurora green that means success', () => {
    // Aurora green sits about five degrees from the success status hue. A
    // green halo on a button in the same sight line as a badge turns
    // decoration into state, which is the trap this mode recorded up front.
    const frames = css.match(/@keyframes sc-rimefast-forge\s*\{([\s\S]*?)\n\s*\}/);
    expect(frames![1]).toContain('--sc-primary');
    expect(frames![1]).not.toContain('--sc-aurora-ink');
    expect(frames![1]).not.toContain('--sc-success');
  });
});
