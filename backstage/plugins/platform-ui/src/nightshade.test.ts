import { nightshadeCss } from './nightshade';
import { MODE_CARDS } from './statusTokens';
import { SHADCN_CSS } from './styles';
import {
  CAULDRON,
  CRESCENT_FLAME,
  FILIGREE,
  MOON_STRIP,
  SCROLL_CORNER,
  SPRIG,
  TORCH,
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

describe('nightshadeCss', () => {
  const css = nightshadeCss();

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
    expect(css).toContain(':root.sc-nightshade');
    expect(css).toContain(':root.sc-nightshade.sc-dark');
  });

  it('declares the load-bearing tokens in both registers', () => {
    const light = css.slice(
      css.indexOf(':root.sc-nightshade'),
      css.indexOf(':root.sc-nightshade.sc-dark'),
    );
    const dark = css.slice(css.indexOf(':root.sc-nightshade.sc-dark'));
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
    expect(css).toContain(`--sc-card: ${MODE_CARDS.nightshade.light}`);
    expect(css).toContain(`--sc-card: ${MODE_CARDS.nightshade.dark}`);
  });

  it('declares no typeface', () => {
    expect(css).not.toContain('@font-face');
    expect(css).not.toMatch(/font-family:/);
  });

  it('keeps every moon animation behind prefers-reduced-motion and on steps()', () => {
    const query = '@media (prefers-reduced-motion: no-preference)';
    expect(css.indexOf('animation:')).toBeGreaterThan(css.indexOf(query));
    const guarded = css.slice(css.indexOf(query));
    expect(guarded).toContain('steps(');
    expect(guarded).not.toMatch(/animation:[^;]*ease/);
    expect(guarded).not.toMatch(/animation:[^;]*cubic-bezier/);
  });

  it('paints a designed still frame, not a frozen one', () => {
    // Outside the motion query the moon must still be a deliberate picture:
    // one crescent, chosen, not an animation frozen halfway.
    expect(css).toMatch(/\.sc-moon \{[^}]*opacity:/);
  });

  it('does not translate on :active', () => {
    expect(css).not.toMatch(/:active[^{]*\{[^}]*transform:\s*translate/);
  });
});

describe('nightshade ornament', () => {
  const css = nightshadeCss();
  const INKS = [
    'hsl(41 67% 54.9%)', // filigree gold, night
    'hsl(41 60% 40%)', // and by day
    'hsl(142 67% 66.3%)', // witch green, night
    'hsl(152 62% 26%)', // and by day
    'hsl(219 40% 84.9%)', // selene silver, night
    'hsl(219 30% 60%)', // and by day
  ];

  it('renders every motif it claims, in one register or the other', () => {
    // An ornament that never reaches the sheet is weight the bundler strips
    // out anyway, and a docstring claiming otherwise is how that goes unseen.
    for (const [name, sprite] of Object.entries({
      SPRIG,
      CRESCENT_FLAME,
      CAULDRON,
      FILIGREE,
      SCROLL_CORNER,
      TORCH,
      MOON_STRIP,
    })) {
      const drawn = INKS.some(
        ink =>
          css.includes(spriteDataUri(sprite, ink)) ||
          css.includes(spriteDataUri(sprite, ink, '~')) ||
          css.includes(spriteDataUri(rotateSprite(sprite), ink)),
      );
      expect(`${name}:${drawn}`).toBe(`${name}:true`);
    }
  });

  it('bakes ornament ink that matches the register it is used in', () => {
    // A data URI is its own document: it inherits neither currentColor nor a
    // custom property, so every literal tracks its token by hand.
    expect(tokenIn(css, ':root.sc-nightshade', 'sc-filigree')).toBe('41 60% 40%');
    expect(tokenIn(css, ':root.sc-nightshade.sc-dark', 'sc-filigree')).toBe('41 67% 54.9%');
    expect(tokenIn(css, ':root.sc-nightshade', 'sc-witch')).toBe('152 62% 26%');
    expect(tokenIn(css, ':root.sc-nightshade.sc-dark', 'sc-witch')).toBe('142 67% 66.3%');
    expect(tokenIn(css, ':root.sc-nightshade', 'sc-selene')).toBe('219 30% 60%');
    expect(tokenIn(css, ':root.sc-nightshade.sc-dark', 'sc-selene')).toBe('219 40% 84.9%');
  });

  it('faces each corner bracket at its own corner', () => {
    // Four DISTINCT images, unlike the dialog's four copies of one medallion.
    // A bracket that is symmetric under a quarter turn has no corner in it, so
    // four identical URIs here would mean the rotation was dropped somewhere.
    const rule = rulesOf(css).find(
      r => r.sel.includes('.sc-login-card') && r.body.includes('ORNAMENT'),
    );
    expect(rule).toBeTruthy();
    expect((rule!.body.match(/ORNAMENT/g) ?? []).length).toBe(4);
    const start = css.indexOf(':root.sc-nightshade .sc-login-card {');
    const body = css.slice(start, css.indexOf('}', start));
    const uris = new Set(body.match(/url\("data:[^"]*"\)/g) ?? []);
    expect(uris.size).toBe(4);
  });

  it('keeps every ornament paired with a repeat', () => {
    // A background-image with no background-repeat tiles the whole surface: a
    // corner bracket becomes wallpaper. Checked per target element, because a
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
    // The list forms are positional: six images against four positions puts
    // two of the torches back on top of the crescents.
    for (const rule of rulesOf(css).filter(r => r.body.includes('ORNAMENT'))) {
      const images = (rule.body.match(/ORNAMENT/g) ?? []).length;
      const pos = /background-position:\s*([^;]+);/.exec(rule.body);
      if (!pos || images < 2) continue;
      expect(`${rule.sel}: ${pos[1].split(',').length}`).toBe(`${rule.sel}: ${images}`);
    }
  });

  it('never positions ornament on a negative offset', () => {
    // A background is clipped to the border box, so ornament hung outside it
    // paints nothing at all. Selector rules only: the moon strip is ADVANCED
    // by a negative position inside its keyframes, which is how a sprite strip
    // steps, and that is motion rather than placement.
    const offenders = rulesOf(css).filter(
      r => r.sel.startsWith(':root') && /background-position:[^;]*-\d/.test(r.body),
    );
    expect(offenders.map(o => o.sel)).toEqual([]);
  });
});

describe('nightshade motion', () => {
  const css = stripComments(nightshadeCss());
  const QUERY = '@media (prefers-reduced-motion: no-preference)';

  it('puts every animation behind the reduced-motion query', () => {
    const guarded = css.slice(css.indexOf(QUERY));
    const all = (css.match(/animation:/g) ?? []).length;
    const inside = (guarded.match(/animation:/g) ?? []).length;
    expect(`${inside}/${all}`).toBe(`${all}/${all}`);
    expect(all).toBeGreaterThan(1); // the moon and the button, not just one
  });

  it('leaves the button lit when motion is declined, not frozen mid-gutter', () => {
    // The still frame is designed: the static filter and the lit keyframe are
    // the same declaration, or a reader who asked for stillness gets a glow
    // caught halfway through dimming.
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
    const frames = css.match(/@keyframes sc-nightshade-gutter\s*\{([\s\S]*?)\n\s*\}/);
    expect(frames).toBeTruthy();
    expect(frames![1]).toMatch(/filter:\s*drop-shadow\(/);
    expect(frames![1]).not.toMatch(/box-shadow/);
  });

  it('blooms in moonlight rather than in witch green', () => {
    // The mode's own adjacency rule: the button is already gold, and gold
    // beside green is the one pairing this mode does not make.
    const frames = css.match(/@keyframes sc-nightshade-gutter\s*\{([\s\S]*?)\n\s*\}/);
    expect(frames![1]).toContain('--sc-moonlight');
    expect(frames![1]).not.toContain('--sc-witch');
  });
});
