import { greekCss } from './greek';
import { SHADCN_CSS } from './styles';
import { GREEK_CARD_DARK, GREEK_CARD_LIGHT } from './statusTokens';

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
    // Strip comments first: prose explaining the hazard is allowed to name
    // the forbidden vocabulary, only live selectors are not.
    const selectorsOnly = greekCss().replace(/\/\*[\s\S]*?\*\//g, '');
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

  it('marks dialog corners with rotated squares', () => {
    expect(greekCss()).toMatch(/rotate\(45deg\)/);
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

describe('greek dialog marks', () => {
  it('positions the diamonds inside the box, never on a negative offset', () => {
    // styles.ts sets `overflow: hidden` on the dialog inner so its header and
    // footer edges follow the rounded corners. That clips absolutely
    // positioned children, so a mark at a negative offset paints nothing at
    // all — and no string-matching test notices.
    const css = greekCss().replace(/\/\*[\s\S]*?\*\//g, '');
    const pseudoRules = Array.from(
      css.matchAll(/([^{}]*::(?:before|after)[^{}]*){([^}]*)}/g),
      m => `${m[1].trim()} => ${m[2].trim()}`,
    );

    expect(pseudoRules.length).toBeGreaterThan(0);
    const negative = pseudoRules.filter(r =>
      /\b(top|left|bottom|right):\s*-/.test(r),
    );
    expect(negative).toEqual([]);
  });
});
