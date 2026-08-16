import { greekCss } from './greek';
import { SHADCN_CSS } from './styles';
import {
  GREEK_CARD_DARK,
  GREEK_CARD_LIGHT,
  GREEK_STATUS_TOKENS,
} from './statusTokens';
import {
  COLUMN,
  MEANDER,
  PALMETTE,
  ROSETTE,
  spriteDataUri,
} from './sprites';

/** CSS with comments removed, so prose is never mistaken for a declaration. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Only the parts a selector engine would read: no comments, and no inlined
 * ornament. A data URI is opaque content, not markup — its `www.w3.org` xmlns
 * is not a class named `org`, and its encoded body is not a declaration.
 */
const selectorsIn = (css: string) =>
  stripComments(css).replace(/url\("data:[^"]*"\)/g, 'url(ORNAMENT)');

/** Every rule, as selector plus body, with ornament payloads neutralised. */
const rulesOf = (css: string) =>
  Array.from(selectorsIn(css).matchAll(/([^{}]+)\{([^}]*)\}/g), m => ({
    sel: m[1].trim().replace(/\s+/g, ' '),
    body: m[2],
  }));

/**
 * The element a rule targets, ignoring the mode prefix — so the light rule and
 * its `.sc-dark` override are recognised as dressing the same thing.
 */
const target = (sel: string) => sel.split(',')[0].trim().split(/\s+/).pop();

/** The dialog rule that actually paints the corner medallions. */
function dialogRule(css: string): string {
  const rule = rulesOf(css).find(
    r => r.sel.includes('MuiDialog-paper') && r.body.includes('background-image'),
  );
  return rule ? rule.body : '';
}

/** Every `--sc-*` whose value is an "H S% L%" triplet, inside one selector block. */
function colourTokens(css: string, selector: string): string[] {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return [];
  const end = css.indexOf('}', start);
  const body = css.slice(start, end);
  return Array.from(
    body.matchAll(/--(sc-[a-z-]+):\s*[\d.]+\s+[\d.]+%\s+[\d.]+%\s*;/g),
    m => m[1],
  ).sort();
}

describe('greekCss', () => {
  it('is not truncated', () => {
    expect(greekCss().length).toBeGreaterThan(500);
  });

  it('has balanced braces', () => {
    const css = greekCss();
    const open = (css.match(/{/g) ?? []).length;
    const close = (css.match(/}/g) ?? []).length;
    expect(`${open}/${close}`).toBe(`${close}/${close}`);
  });

  it('has no control characters, which is what a bad escape leaves behind', () => {
    const control = [...greekCss()].filter(ch => {
      const code = ch.codePointAt(0) ?? 32;
      return code < 32 && ch !== '\n' && ch !== '\t' && ch !== '\r';
    });
    expect(control).toEqual([]);
  });

  it('declares every colour token the default :root declares', () => {
    // A mode that forgets one inherits a colour from the wrong register, which
    // degrades into unreadable text rather than an obvious break.
    const base = colourTokens(SHADCN_CSS, ':root');
    const greek = colourTokens(greekCss(), ':root.sc-greek');
    expect(base.length).toBeGreaterThan(8); // the regex actually matched
    expect(greek).toEqual(expect.arrayContaining(base));
  });

  it('redeclares every colour token in the dark register', () => {
    const light = colourTokens(greekCss(), ':root.sc-greek');
    const dark = colourTokens(greekCss(), ':root.sc-greek.sc-dark');
    expect(dark).toEqual(light);
  });

  it('uses steps() for any animation, never ease', () => {
    expect(greekCss()).not.toMatch(/animation:[^;]*\bease\b/);
  });

  it('names no class a production build discards', () => {
    // Strip comments AND data URIs first: prose explaining the hazard is
    // allowed to name the forbidden vocabulary, and an inlined ornament
    // carries an xmlns of `www.w3.org` whose dots are not class selectors.
    // Only live selectors are subject to the rule.
    const selectorsOnly = selectorsIn(greekCss());
    const names = Array.from(selectorsOnly.matchAll(/\.([A-Za-z][\w-]*)/g), m => m[1]);
    const bad = names.filter(
      n =>
        !n.startsWith('Mui') &&
        !n.startsWith('bui-') &&
        !n.startsWith('sc-') &&
        !n.startsWith('material-icons'),
    );
    expect(bad).toEqual([]);
  });

  it('paints the card colour the contrast test measures against', () => {
    // Two sources of truth for one colour: statusTokens.ts holds the value the
    // contrast maths uses, greek.ts holds the value the browser paints. If they
    // drift, contrast.test.ts passes against a colour nothing renders.
    const css = greekCss();
    const cardIn = (selector: string) => {
      const start = css.indexOf(`${selector} {`);
      const body = css.slice(start, css.indexOf('}', start));
      return /--sc-card:\s*([^;]+);/.exec(body)?.[1].trim();
    };
    expect(cardIn(':root.sc-greek')).toBe(GREEK_CARD_LIGHT);
    expect(cardIn(':root.sc-greek.sc-dark')).toBe(GREEK_CARD_DARK);
  });

  it('paints the dither cells the contrast test measures ink against', () => {
    // Same trap as the card above, one layer down and previously unguarded:
    // --sc-success/-warning/-destructive here ARE the badge cell, and
    // statusTokens.ts holds a second copy of each as the `cell` field the AA
    // maths uses. Desaturate one side only and contrast.test.ts happily keeps
    // measuring the colour nothing renders. Read-only — the pairing is the
    // assertion, neither side is this test's to move.
    const css = greekCss();
    const tokenIn = (selector: string, name: string) => {
      const start = css.indexOf(`${selector} {`);
      const body = css.slice(start, css.indexOf('}', start));
      return new RegExp(`--sc-${name}:\\s*([^;]+);`).exec(body)?.[1].trim();
    };
    const cellOf = (name: string) =>
      GREEK_STATUS_TOKENS.find(t => t.name === name)?.cell;

    for (const [token, ink] of [
      ['success', 'on-success'],
      ['warning', 'on-warning'],
      ['destructive', 'on-destructive'],
    ]) {
      for (const register of [':root.sc-greek', ':root.sc-greek.sc-dark']) {
        expect(`${register} --sc-${token}: ${tokenIn(register, token)}`).toBe(
          `${register} --sc-${token}: ${cellOf(ink)}`,
        );
      }
    }
  });
});

describe('greek chrome', () => {
  it('frames dialogs in gold without touching plain cards', () => {
    const css = greekCss();
    // Windows only, never cards: the existing design keeps a double frame as
    // the difference between a decision and a panel of content.
    expect(css).toMatch(/:root\.sc-greek[^{]*MuiDialog-paper[^{]*\{[^}]*--sc-gold/);
  });

  it('supplies header art through a variable, not a Backstage class name', () => {
    const css = greekCss();
    const selectorsOnly = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toContain('--sc-header-art');
    expect(selectorsOnly).not.toContain('BackstageHeader');
  });

  it('marks all four dialog corners with a rosette medallion', () => {
    // Four corners, not two. The rosette is symmetric under a quarter turn, so
    // one sprite serves every corner as four background layers — which is what
    // lifts this past the two-pseudo-element ceiling the old diamonds hit.
    const rule = dialogRule(greekCss());
    expect((rule.match(/ORNAMENT/g) ?? []).length).toBe(4);
    expect(rule).toMatch(/background-repeat:\s*no-repeat/);
  });
});

describe('greek motion', () => {
  it('puts every animation behind the reduced-motion query', () => {
    const css = greekCss();
    const guarded = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));
    const animations = (css.match(/animation:/g) ?? []).length;
    const guardedAnimations = (guarded.match(/animation:/g) ?? []).length;
    expect(`${guardedAnimations}/${animations}`).toBe(`${animations}/${animations}`);
  });

  it('steps the ember pulse', () => {
    expect(greekCss()).toMatch(/animation:[^;]*steps\(/);
  });

  it('leaves the reduced-motion case lit, not frozen mid-cycle', () => {
    // A static creature on a bar is a smudge; the same reasoning applies to a
    // glow caught at 40% opacity.
    // Comments stripped first: the prose here explains the box-shadow hazard
    // and would otherwise be matched as a declaration.
    const css = greekCss().replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toMatch(/@keyframes sc-greek-ember/);

    // The static (unanimated) glow is the last `filter` declared before the
    // reduced-motion media block; the "lit" keyframe is the 0%, 100% one.
    // It is `filter`, not `box-shadow`: styles.ts claims box-shadow on buttons
    // with `!important`, which beats both a normal declaration and the
    // animation origin, so a box-shadow glow here paints nothing.
    const beforeMedia = css.slice(0, css.indexOf('@media (prefers-reduced-motion: no-preference)'));
    const filtersBeforeMedia = Array.from(beforeMedia.matchAll(/[^-]filter:\s*([^;]+);/g));
    const staticFilter = filtersBeforeMedia[filtersBeforeMedia.length - 1]?.[1].trim();
    const litFilter = /0%,\s*100%\s*{\s*filter:\s*([^;]+);/.exec(css)?.[1].trim();

    expect(staticFilter).toBeDefined();
    expect(litFilter).toBeDefined();
    expect(litFilter).toBe(staticFilter);
  });

  it('glows with a property nothing else claims !important', () => {
    // Both Critical defects in this file shipped green because the tests
    // matched strings anywhere in the sheet. styles.ts sets `box-shadow` with
    // `!important` on `.MuiButton-root`; an important author declaration beats
    // a normal one at any specificity AND beats the animation origin, so a
    // box-shadow glow would silently stop painting on every Backstage page.
    const css = greekCss().replace(/\/\*[\s\S]*?\*\//g, '');
    const beforeMedia = css.slice(0, css.indexOf('@media (prefers-reduced-motion: no-preference)'));
    const staticGlow = beforeMedia.slice(beforeMedia.lastIndexOf('{'));
    const frames = Array.from(
      css.matchAll(/(?:0%,\s*100%|50%)\s*{([^}]*)}/g),
      m => m[1],
    );

    expect(frames).toHaveLength(2);
    for (const rule of [staticGlow, ...frames]) {
      expect(rule).toMatch(/filter:\s*drop-shadow\(/);
      expect(rule).not.toMatch(/box-shadow/);
    }
  });
});

describe('greek ornament renders inside its box', () => {
  // The defect this whole describe exists for: a background is clipped to the
  // border box, and styles.ts additionally sets `overflow: hidden` on the
  // dialog. Ornament hung outside either boundary paints nothing at all, and a
  // string-matching test happily passes on it. Two corner marks already shipped
  // dead this way once.
  it('never positions ornament on a negative offset', () => {
    const offenders = rulesOf(greekCss()).filter(
      r =>
        /background-position:[^;]*-\d/.test(r.body) ||
        /\b(?:top|left|bottom|right):\s*-\d/.test(r.body),
    );
    expect(offenders.map(o => o.sel)).toEqual([]);
  });

  it('keeps every ornament paired with a repeat', () => {
    // A background-image with no background-repeat tiles across the whole
    // surface: a corner medallion becomes wallpaper, a header band becomes a
    // field. Checked per target element rather than per rule, because a
    // register override legitimately swaps only the image and inherits the
    // repeat from the rule above it.
    const rules = rulesOf(greekCss());
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

  it('gives the header band its own repeat and position hooks', () => {
    // The header art reaches the page through variables read by theme.tsx, so
    // its repeat cannot live in a rule here — it needs its own hook, or the
    // band tiles down the whole header instead of sitting on one edge.
    const css = greekCss();
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

describe('greek ornament is drawn from sprites', () => {
  it('renders every ornament it defines, none left unused', () => {
    // Colour alone does not make the mode Greek. These are the motifs that do,
    // and each must actually reach the stylesheet as a rendered ornament rather
    // than sitting unused in sprites.ts — an ornament nobody sees is weight,
    // and the bundler strips it out anyway.
    const css = greekCss();
    for (const [name, sprite] of Object.entries({
      MEANDER,
      PALMETTE,
      COLUMN,
      ROSETTE,
    })) {
      const light = spriteDataUri(sprite, 'hsl(40 55% 46%)');
      const dark = spriteDataUri(sprite, 'hsl(43 62% 46%)');
      expect(`${name}:${css.includes(light) || css.includes(dark)}`).toBe(
        `${name}:true`,
      );
    }
  });

  it('bakes a colour that matches the register it is used in', () => {
    // A data URI is its own document — it inherits neither currentColor nor a
    // custom property. The literals therefore have to track --sc-border by
    // hand, and this is what notices when they stop.
    const css = greekCss();
    const borderIn = (selector: string) => {
      const start = css.indexOf(`${selector} {`);
      const body = css.slice(start, css.indexOf('}', start));
      return /--sc-border:\s*([^;]+);/.exec(body)?.[1].trim();
    };
    expect(borderIn(':root.sc-greek')).toBe('40 55% 46%');
    expect(borderIn(':root.sc-greek.sc-dark')).toBe('43 62% 46%');
  });
});
