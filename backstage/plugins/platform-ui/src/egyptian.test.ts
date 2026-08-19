import { egyptianCss } from './egyptian';
import { MODE_CARDS } from './statusTokens';
import { SHADCN_CSS } from './styles';
import {
  ANKH,
  ATEN_STRIP,
  CARTOUCHE,
  DJED,
  GLYPH_BAND,
  PAPYRUS,
  WEDJAT,
  mirrorSprite,
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

describe('egyptianCss', () => {
  const css = egyptianCss();

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
    expect(css).toContain(':root.sc-egyptian');
    expect(css).toContain(':root.sc-egyptian.sc-dark');
  });

  it('declares every colour token the base sheet declares, in both registers', () => {
    const light = css.slice(
      css.indexOf(':root.sc-egyptian'),
      css.indexOf(':root.sc-egyptian.sc-dark'),
    );
    const dark = css.slice(css.indexOf(':root.sc-egyptian.sc-dark'));
    for (const token of [
      '--sc-bg',
      '--sc-fg',
      '--sc-card',
      '--sc-card-fg',
      '--sc-muted',
      '--sc-muted-fg',
      '--sc-border',
      '--sc-input',
      '--sc-primary',
      '--sc-primary-fg',
      '--sc-ring',
      '--sc-accent',
      '--sc-accent-fg',
      '--sc-success',
      '--sc-warning',
      '--sc-destructive',
    ]) {
      expect(`${token} light:${light.includes(`${token}:`)}`).toBe(`${token} light:true`);
      expect(`${token} dark:${dark.includes(`${token}:`)}`).toBe(`${token} dark:true`);
    }
    // Guards the base sheet still declaring these at all, so this test cannot
    // pass vacuously after a token rename.
    expect(SHADCN_CSS).toContain('--sc-card:');
  });

  it('emits the card value MODE_CARDS advertises', () => {
    expect(css).toContain(`--sc-card: ${MODE_CARDS.egyptian.light}`);
    expect(css).toContain(`--sc-card: ${MODE_CARDS.egyptian.dark}`);
  });

  it('declares no typeface', () => {
    expect(css).not.toContain('@font-face');
    expect(css).not.toMatch(/font-family:/);
  });

  it('does not translate on :active', () => {
    expect(css).not.toMatch(/:active[^{]*\{[^}]*transform:\s*translate/);
  });
});

describe('egyptian ornament', () => {
  const css = egyptianCss();
  const INKS = [
    'hsl(221 62% 32%)', // lapis
    'hsl(204 68% 33%)', // Egyptian blue, darkened for the light register
    'hsl(44 82% 55%)', // gold leaf, by night
    'hsl(40 80% 36%)', // the gold accent, by day
    'hsl(168 52% 26%)', // malachite, by day
    'hsl(168 45% 55%)', // malachite, by night
    'hsl(205 28% 92%)', // the ground tint, by day
    'hsl(212 34% 13%)', // and inside the tomb
  ];

  it('renders every motif it claims, in one register or the other', () => {
    // An ornament that never reaches the sheet is weight the bundler strips
    // out anyway, and a docstring claiming otherwise is how that goes unseen.
    // The derived form counts: the left-hand eye is the right one mirrored.
    for (const [name, sprite] of Object.entries({
      ANKH,
      ATEN_STRIP,
      CARTOUCHE,
      DJED,
      GLYPH_BAND,
      PAPYRUS,
      WEDJAT,
    })) {
      const drawn = INKS.some(
        ink =>
          css.includes(spriteDataUri(sprite, ink)) ||
          css.includes(spriteDataUri(mirrorSprite(sprite), ink)),
      );
      expect(`${name}:${drawn}`).toBe(`${name}:true`);
    }
  });

  it('faces the two wedjat eyes at each other', () => {
    // Two eyes looking the same way are one drawing used twice, which is the
    // first thing anyone notices. The mirror is generated so the pair cannot
    // drift; this is what catches it being dropped.
    const gold = 'hsl(40 80% 36%)';
    expect(css).toContain(spriteDataUri(WEDJAT, gold));
    expect(css).toContain(spriteDataUri(mirrorSprite(WEDJAT), gold));
  });

  it('bakes ornament ink that matches the register it is used in', () => {
    // A data URI is its own document: it inherits neither currentColor nor a
    // custom property, so every literal tracks its token by hand.
    expect(tokenIn(css, ':root.sc-egyptian', 'sc-primary')).toBe('221 62% 32%');
    expect(tokenIn(css, ':root.sc-egyptian.sc-dark', 'sc-primary')).toBe('44 82% 55%');
    expect(tokenIn(css, ':root.sc-egyptian', 'sc-border')).toBe('204 68% 33%');
    expect(tokenIn(css, ':root.sc-egyptian.sc-dark', 'sc-border')).toBe('204 62% 50%');
    expect(tokenIn(css, ':root.sc-egyptian', 'sc-malachite')).toBe('168 52% 26%');
    expect(tokenIn(css, ':root.sc-egyptian.sc-dark', 'sc-malachite')).toBe('168 45% 55%');
    expect(tokenIn(css, ':root.sc-egyptian', 'sc-sun-ink')).toBe('40 80% 36%');
    expect(tokenIn(css, ':root.sc-egyptian.sc-dark', 'sc-sun-ink')).toBe('44 82% 55%');
    expect(tokenIn(css, ':root.sc-egyptian', 'sc-ground')).toBe('205 28% 92%');
    expect(tokenIn(css, ':root.sc-egyptian.sc-dark', 'sc-ground')).toBe('212 34% 13%');
    // The tint is a GROUND, never a line ink. If it ever equals the rule
    // colour, the sidebar field stops being a wall and becomes a drawing.
    expect(tokenIn(css, ':root.sc-egyptian', 'sc-ground')).not.toBe(
      tokenIn(css, ':root.sc-egyptian', 'sc-border'),
    );
  });

  it('keeps malachite off every screen that can show a status badge', () => {
    // Malachite sits 16deg from the success status hue, so green ornament in
    // the same sight line as a badge turns decoration into state. The sign-in
    // page is the one route with no badge on it, and that is the whole of the
    // licence: any other selector taking this ink is the bug.
    // Matched on the data URI rather than on the ink string: the fill is
    // percent-encoded by the time it reaches the sheet, so 'hsl(168 52% 26%)'
    // appears nowhere in it.
    const malachite = [
      spriteDataUri(DJED, 'hsl(168 52% 26%)'),
      spriteDataUri(DJED, 'hsl(168 45% 55%)'),
    ];
    const users = Array.from(
      stripComments(egyptianCss()).matchAll(/([^{}]+)\{([^}]*)\}/g),
      m => ({ sel: m[1].trim().replace(/\s+/g, ' '), body: m[2] }),
    )
      .filter(r => malachite.some(uri => r.body.includes(uri)))
      .map(r => target(r.sel));
    expect([...new Set(users)]).toEqual(['.sc-login']);
  });

  it('prints the sidebar as a field rather than a strip down one edge', () => {
    // The hanami sidebar is the model this follows: a full-panel tiled lattice
    // at low contrast, so the nav reads as a wall the labels sit on. A band
    // anchored to one edge reads as a seam — something the layout did — and it
    // has nowhere to go when the nav collapses to icon width.
    // Painted in the ground tint, never in the rule colour.
    const nav = /:root\.sc-egyptian \.sc-nav \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(nav).toMatch(/background-repeat:\s*repeat;/);
    expect(nav).not.toMatch(/repeat-y/);
    expect(nav).toContain(spriteDataUri(PAPYRUS, 'hsl(205 28% 92%)'));
    const dark = /:root\.sc-egyptian\.sc-dark \.sc-nav \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(dark).toContain(spriteDataUri(PAPYRUS, 'hsl(212 34% 13%)'));
  });

  it('keeps every ornament paired with a repeat', () => {
    // A background-image with no background-repeat tiles the whole surface: a
    // single ankh becomes a wall of them. Checked per target element, because
    // a register override legitimately swaps only the image.
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
    // The list forms are positional: two eyes against one position stacks them
    // both in the same corner.
    for (const rule of rulesOf(css).filter(r => r.body.includes('ORNAMENT'))) {
      const images = (rule.body.match(/ORNAMENT/g) ?? []).length;
      const pos = /background-position:\s*([^;]+);/.exec(rule.body);
      if (!pos || images < 2) continue;
      expect(`${rule.sel}: ${pos[1].split(',').length}`).toBe(`${rule.sel}: ${images}`);
    }
  });

  it('never positions ornament on a negative offset', () => {
    // A background is clipped to the border box, so ornament hung outside it
    // paints nothing at all. Selector rules only: the walk cycle is ADVANCED
    // by a negative position inside its keyframes, which is how a strip steps.
    const offenders = rulesOf(css).filter(
      r => r.sel.startsWith(':root') && /background-position:[^;]*-\d/.test(r.body),
    );
    expect(offenders.map(o => o.sel)).toEqual([]);
  });
});

describe('egyptian motion', () => {
  const css = stripComments(egyptianCss());
  const QUERY = '@media (prefers-reduced-motion: no-preference)';

  it('puts every animation behind the reduced-motion query', () => {
    const guarded = css.slice(css.indexOf(QUERY));
    const all = (css.match(/animation:/g) ?? []).length;
    const inside = (guarded.match(/animation:/g) ?? []).length;
    expect(`${inside}/${all}`).toBe(`${all}/${all}`);
    expect(all).toBeGreaterThan(1); // Khepri and the button, not just one
  });

  it('steps every animation, and interpolates none of them', () => {
    const guarded = css.slice(css.indexOf(QUERY));
    expect(guarded).toContain('steps(');
    expect(guarded).not.toMatch(/animation:[^;]*ease/);
    expect(guarded).not.toMatch(/animation:[^;]*cubic-bezier/);
  });

  it('paints a designed still frame, not a frozen one', () => {
    // Outside the motion query the Aten must still be a deliberate picture:
    // fully painted, in its corner, with its rays on the axes — which is what
    // background-position 0 0 pins.
    // The LAST query, not the first: the button glow opens one query above the
    // Aten's own rules, so slicing at the first one cuts them off.
    const before = css.slice(0, css.lastIndexOf(QUERY));
    const still = /\.sc-aten \{([^}]*)\}/.exec(before)?.[1] ?? '';
    expect(still).toMatch(/opacity:\s*1/);
    expect(still).toMatch(/background-position:\s*0 0/);
    expect(still).toMatch(/display:\s*block/);
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
    const frames = css.match(/@keyframes sc-egyptian-gild\s*\{([\s\S]*?)\n\s*\}/);
    expect(frames).toBeTruthy();
    expect(frames![1]).toMatch(/filter:\s*drop-shadow\(/);
    expect(frames![1]).not.toMatch(/box-shadow/);
  });

  it('steps the Aten a whole number of frames per loop', () => {
    // The strip is two 26px frames, so the loop has to close on 52px. Any
    // other distance leaves the sun mid-frame at the wrap and it smears.
    expect(css).toMatch(/background-size:\s*52px 26px/);
    expect(css).toMatch(
      /sc-egyptian-aten \{ to \{ background-position: -52px 0; \} \}/,
    );
    expect(css).toMatch(/sc-egyptian-aten 1\.6s steps\(2\)/);
  });

  it('keeps the Aten in one place, because it is not a creature on a rail', () => {
    // The scarab this replaced travelled the whole bottom rail, which pulled
    // the eye off the page. The Aten is anchored: nothing here may translate,
    // and the only thing the keyframes move is the background position.
    expect(css).not.toContain('sc-khepri');
    expect(css).not.toMatch(/\.sc-aten[^}]*translate/);
    const frames = /@keyframes sc-egyptian-aten \{([^}]*\}[^}]*)\}/.exec(css);
    expect(frames).toBeTruthy();
    expect(frames![1]).not.toMatch(/transform/);
  });

});
