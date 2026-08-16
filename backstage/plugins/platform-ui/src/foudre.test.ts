import { foudreCss } from './foudre';
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

describe('foudreCss', () => {
  it('is not truncated and has balanced braces', () => {
    const css = foudreCss();
    expect(css.length).toBeGreaterThan(1000);
    const open = (css.match(/{/g) ?? []).length;
    const close = (css.match(/}/g) ?? []).length;
    expect(`${open}/${close}`).toBe(`${close}/${close}`);
  });

  it('has no control characters, which is what a bad escape leaves behind', () => {
    const control = [...foudreCss()].filter(ch => {
      const code = ch.codePointAt(0) ?? 32;
      return code < 32 && ch !== '\n' && ch !== '\t' && ch !== '\r';
    });
    expect(control).toEqual([]);
  });

  it('declares every colour token the default :root declares', () => {
    const base = colourTokens(SHADCN_CSS, ':root');
    const light = colourTokens(foudreCss(), ':root.sc-foudre');
    const dark = colourTokens(foudreCss(), ':root.sc-foudre.sc-dark');
    expect(base.length).toBeGreaterThan(8);
    expect(light).toEqual(expect.arrayContaining(base));
    expect(dark).toEqual(light);
  });

  it('paints the card colour the contrast test measures against', () => {
    const css = foudreCss();
    expect(valueIn(css, ':root.sc-foudre', 'card')).toBe(MODE_CARDS.foudre.light);
    expect(valueIn(css, ':root.sc-foudre.sc-dark', 'card')).toBe(
      MODE_CARDS.foudre.dark,
    );
  });

  it('keeps the default status hues', () => {
    const css = foudreCss();
    for (const t of ['on-success', 'on-warning', 'on-destructive', 'on-muted']) {
      expect(`${t}:${css.includes(`--sc-${t}:`)}`).toBe(`${t}:false`);
    }
  });

  it('names no class a production build discards', () => {
    const names = Array.from(
      stripComments(foudreCss()).matchAll(/\.([A-Za-z][\w-]*)/g),
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

describe('the patterns that make it Foudre', () => {
  it('is flat — no shadow anywhere', () => {
    const css = stripComments(foudreCss());
    expect(valueIn(foudreCss(), ':root.sc-foudre', 'shadow')).toBe('none');
    const shadows = Array.from(css.matchAll(/box-shadow:\s*([^;]+);/g), m => m[1].trim());
    expect(shadows.length).toBeGreaterThan(0);
    for (const sh of shadows) expect(sh.replace(/\s*!important$/, '')).toBe('none');
  });

  it('draws the site radius set, in the site proportions', () => {
    // Measured on the real DOM: 10px the default box (73 elements), 20px the
    // larger surface (40), 50% the buttons (35). A summary gave 20px as the
    // default and never mentioned the circles at all.
    const css = stripComments(foudreCss());
    expect(valueIn(foudreCss(), ':root.sc-foudre', 'radius')).toBe('10px');
    expect(css).toMatch(/border-radius:\s*20px/);
    expect(css).toMatch(/border-radius:\s*50%/);
  });

  it('keeps the lilac hairline the site actually draws', () => {
    // 1px solid #d1cfe4 on every bordered element. The rule token is a deeper
    // lilac because the published one measures ~1.4:1 on white; the original
    // stays as the hairline, which is its job on the site too.
    const light = valueIn(foudreCss(), ':root.sc-foudre', 'hairline');
    expect(light).toBe('246 28% 85%');
    expect(stripComments(foudreCss())).toMatch(/hsl\(var\(--sc-hairline\)\)/);
  });

  it('prints magenta louder as type than as fill', () => {
    // At the site value magenta carries chalk at 3.3:1 and cannot fill a
    // button; as display type it clears the 3:1 that applies to large text.
    const display = valueIn(foudreCss(), ':root.sc-foudre', 'display');
    const primary = valueIn(foudreCss(), ':root.sc-foudre', 'primary');
    expect(display).toBe('331 69% 55%');
    expect(primary).toBe('331 69% 36%');
  });

  it('sets the headline at the site line-height ratio', () => {
    // Beni is set 94px over 65.8px there — 0.70. Anything at or above 1 loses
    // the block entirely.
    const css = stripComments(foudreCss());
    const h1 = css.slice(css.indexOf('.sc-h1'));
    const lh = /line-height:\s*\.?([\d.]+)/.exec(h1.slice(0, h1.indexOf('}')));
    expect(lh).not.toBeNull();
    expect(parseFloat(`0.${lh![1].replace('0.', '')}`)).toBeLessThan(1);
  });

  it('uses the app typeface rather than a second family', () => {
    const css = stripComments(foudreCss());
    expect(css).not.toMatch(/@font-face/);
    expect(css).not.toMatch(/url\(/);
    expect(css).not.toMatch(/\bBeni\b|\bAnton\b/i);
  });

  it('never rounds a surface holding a table', () => {
    expect(foudreCss()).toMatch(/:has\(table\)/);
    expect(stripComments(foudreCss())).not.toMatch(/overflow:\s*hidden/);
  });
});

describe('the motion this mode owns', () => {
  // The design system permits a mode to replace the easing vocabulary, on
  // three conditions. Each is asserted here rather than left to review.

  it('declares the site curves as tokens and uses only those', () => {
    const css = stripComments(foudreCss());
    expect(valueIn(foudreCss(), ':root.sc-foudre', 'ease')).toBe(
      'cubic-bezier(.23, 1, .32, 1)',
    );
    expect(valueIn(foudreCss(), ':root.sc-foudre', 'ease-back')).toBe(
      'cubic-bezier(.17, .67, .3, 1.33)',
    );
    // Wholesale, not mixed: no stepped timing survives inside this mode, and no
    // curve is written inline where a token should carry it.
    expect(css).not.toMatch(/steps\(/);
    const inlineCurves = css.match(/cubic-bezier\([^)]*\)/g) ?? [];
    expect(inlineCurves.length).toBe(2); // the two token declarations only
  });

  it('puts every animation and transition behind the reduced-motion query', () => {
    const css = stripComments(foudreCss());
    const guarded = css.slice(
      css.indexOf('@media (prefers-reduced-motion: no-preference)'),
    );
    for (const prop of ['transition:', 'animation:']) {
      const total = (css.match(new RegExp(prop, 'g')) ?? []).length;
      const inside = (guarded.match(new RegExp(prop, 'g')) ?? []).length;
      expect(`${prop} ${inside}/${total}`).toBe(`${prop} ${total}/${total}`);
    }
  });

  it('animates only properties that do not touch layout', () => {
    // The site animates transform, colour and opacity and nothing else — the
    // three a compositor can run without reflowing the page. Animating width or
    // top would be the difference between smooth and busy.
    const css = stripComments(foudreCss());
    const animated = new Set<string>();
    for (const m of css.matchAll(/transition:\s*([^;]+);/g)) {
      for (const part of m[1].split(',')) {
        const prop = part.trim().split(/\s+/)[0];
        if (prop && prop !== '!important') animated.add(prop);
      }
    }
    for (const prop of animated) {
      expect(`animates ${prop}`).toBe(
        ['transform', 'background-color', 'color', 'border-color', 'opacity'].includes(prop)
          ? `animates ${prop}`
          : 'animates a layout property',
      );
    }
  });

  it('leaves a still frame that is designed, not frozen', () => {
    // Nothing here is the only signal for a state: every rule is a hover, an
    // active or an entrance. With motion off, the mark is simply lit.
    const css = stripComments(foudreCss());
    expect(css).toMatch(/0%, 100% \{ opacity: 1; \}/);
  });
});
