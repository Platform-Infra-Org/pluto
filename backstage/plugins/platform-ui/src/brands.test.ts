import { BRAND_DEFS, brandsCss } from './brands';
import { SHADCN_CSS } from './styles';
import { MODE_CARDS } from './statusTokens';
import { foudreCss } from './foudre';
import { slushCss } from './slush';
import { spiderverseCss } from './spiderverse';
import { greekCss } from './greek';
import { hanamiCss } from './hanami';
import { nightshadeCss } from './nightshade';

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
      expect(`${b.id}:${css.includes(`:root.sc-${b.id}.sc-dark {`)}`).toBe(`${b.id}:true`);
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
    // statusTokens.ts holds the value the maths uses, brands.ts the one the
    // browser paints. Drift means contrast.test.ts passes against a colour
    // nothing renders.
    const css = brandsCss();
    for (const b of BRAND_DEFS) {
      const cards = MODE_CARDS[b.id as keyof typeof MODE_CARDS];
      expect(`${b.id}:${valueIn(css, `:root.sc-${b.id}`, 'card')}`).toBe(`${b.id}:${cards.light}`);
      expect(`${b.id}:${valueIn(css, `:root.sc-${b.id}.sc-dark`, 'card')}`).toBe(`${b.id}:${cards.dark}`);
    }
  });

  it('sets primary-shade opposite to primary-fg in every register', () => {
    const css = brandsCss();
    for (const b of BRAND_DEFS) {
      for (const sel of [`:root.sc-${b.id}`, `:root.sc-${b.id}.sc-dark`]) {
        const fg = valueIn(css, sel, 'primary-fg');
        const shade = valueIn(css, sel, 'primary-shade');
        expect(`${sel}:${fg === shade}`).toBe(`${sel}:false`);
      }
    }
  });

  it('keeps the default status hues rather than one per brand', () => {
    const css = brandsCss();
    for (const t of ['on-success', 'on-warning', 'on-destructive', 'on-muted']) {
      expect(`${t}:${css.includes(`--sc-${t}:`)}`).toBe(`${t}:false`);
    }
  });

  it('never declares a typeface — the app has one family', () => {
    const css = brandsCss();
    expect(css).not.toMatch(/--sc-font-ui:/);
    expect(css).not.toMatch(/@font-face/);
    expect(css).not.toMatch(/font-family:/);
  });

  it('names no class a production build discards', () => {
    const names = Array.from(stripComments(brandsCss()).matchAll(/\.([A-Za-z][\w-]*)/g), m => m[1]);
    const bad = names.filter(
      n => !n.startsWith('Mui') && !n.startsWith('bui-') && !n.startsWith('sc-') && !n.startsWith('material-icons'),
    );
    expect(bad).toEqual([]);
  });

  it('clips a table to the corners of the surface holding it', () => {
    // Every mode states this for its own surfaces rather than inheriting it,
    // because each one sets its own card radius and would otherwise round the
    // corner without clipping the table into it — which is the failure the base
    // sheet's comment describes.
    const css = brandsCss();
    for (const b of BRAND_DEFS) {
      expect(`${b.id}:${css.includes(`:root.sc-${b.id} .sc-card:has(table)`)}`).toBe(`${b.id}:true`);
    }
    expect(stripComments(css)).not.toMatch(/:has\(table\)[^{]*\{[^}]*border-radius:\s*0/);
  });
});

describe('brand character', () => {
  it('gives every brand its own bottle colour', () => {
    expect(new Set(BRAND_DEFS.map(b => b.bottle)).size).toBe(BRAND_DEFS.length);
  });

  it('casts a shadow only where the reference has one', () => {
    // Only two of the rows cast anything: New Form's green-tinted glow and
    // Obsidian's hairline ring plus copper bloom, both measured on their own
    // pages. Giving the others a shadow would be inventing character rather
    // than reproducing it — Family Dairy in particular has literally zero
    // box-shadows across its whole reference page, which is why it has none
    // here despite being the row most tempted to lift its cards.
    const glowing = BRAND_DEFS.filter(b => b.glow);
    expect(glowing.map(b => b.id)).toEqual(['newform', 'obsidian']);
    const css = brandsCss();
    for (const b of BRAND_DEFS) {
      expect(`${b.id}:${valueIn(css, `:root.sc-${b.id}`, 'shadow')}`).toBe(
        `${b.id}:${b.glow ?? 'none'}`,
      );
    }
  });

  it('animates only where the reference chrome moves', () => {
    const moving = BRAND_DEFS.filter(b => b.ease).map(b => b.id);
    // github joins them: Primer transitions its chrome on a measured curve
    // (cubic-bezier(.2,.4,.2,1)), so reproducing the palette over stepped
    // timing would be that design wearing this one's clock.
    expect(moving).toEqual([
      'newform',
      'discord',
      'github',
      'dairy',
      'obsidian',
    ]);
    const css = stripComments(brandsCss());
    const guarded = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));
    const total = (css.match(/transition:/g) ?? []).length;
    const inside = (guarded.match(/transition:/g) ?? []).length;
    expect(`${inside}/${total}`).toBe(`${total}/${total}`);
  });

  it('lets a row own its speed, because a curve alone does not separate two', () => {
    // Obsidian's easing was measured verbatim on 296 elements and comes out
    // byte-for-byte identical to Discord's. The DURATION is the entire measured
    // difference between the two — 75ms on colour against 180ms — so with the
    // duration hardcoded, obsidian ships as a discord clone that happens to be
    // a different colour. Rows that measured nothing of their own keep .18s.
    const css = stripComments(brandsCss());
    for (const b of BRAND_DEFS.filter(x => x.ease)) {
      // `[^}]*` skips the radius rule, which opens on the same selector but
      // closes before ever reaching a `transition:`.
      const block =
        new RegExp(`:root\\.sc-${b.id} \\.sc-btn,[^}]*transition:([^;]+);`).exec(css)?.[1] ?? '';
      const dur = b.dur ?? { colour: '.18s', transform: '.18s' };
      expect(`${b.id} transform:${block.includes(`transform ${dur.transform} `)}`)
        .toBe(`${b.id} transform:true`);
      expect(`${b.id} colour:${block.includes(`color ${dur.colour} `)}`)
        .toBe(`${b.id} colour:true`);
    }
    const by = (id: string) => BRAND_DEFS.find(b => b.id === id);
    expect(by('obsidian')?.ease).toBe(by('discord')?.ease);
    expect(by('obsidian')?.dur).not.toEqual(by('discord')?.dur);
  });

  it('presses by settling, never by displacing', () => {
    const css = stripComments(brandsCss());
    expect(css).not.toMatch(/:active[^{]*\{[^}]*transform:\s*translate/);
  });

  it('carries each reference own radius', () => {
    const css = stripComments(brandsCss());
    for (const b of BRAND_DEFS) {
      expect(`${b.id}:${css.includes(`border-radius: ${b.radius.card} !important`)}`).toBe(`${b.id}:true`);
      expect(`${b.id}:${css.includes(`border-radius: ${b.radius.button} !important`)}`).toBe(`${b.id}:true`);
    }
  });
});

// Lives here rather than in one mode's own file because it holds for all of
// them, and a copy per sheet is a copy that goes stale in four places.
describe('every mode sheet reaches the nested-ThemeProvider routes', () => {
  // /catalog-import and the two TechDocs routes render under a NESTED MUI
  // ThemeProvider, where the generator appends a counter to every class it
  // makes: MuiCard-root arrives as MuiCard-root-186, and the counter is not
  // stable between visits (measured MuiButton-root-316, then -685). A class
  // selector cannot match a moving name, so a bare .Mui rule in a mode sheet
  // is decoration that silently never paints on those three routes — which is
  // exactly how they shipped, themed base chrome over vanilla cards, after
  // styles.ts was converted and these sheets were not.
  const sheets: Array<[string, string]> = [
    ['foudre', foudreCss()],
    ['slush', slushCss()],
    ['spiderverse', spiderverseCss()],
    ['greek', greekCss()],
    ['hanami', hanamiCss()],
    ['nightshade', nightshadeCss()],
    ['brands', brandsCss()],
  ];

  it.each(sheets)('%s names no bare generated Mui class', (id, css) => {
    // MUI's global STATE classes (.Mui-disabled, .Mui-selected) are literal
    // strings, not generated names, so they are not in this net: the pattern
    // requires a component segment before the dash. The elevation pair is the
    // one deliberate bare spelling — see the next test for why.
    const bare = Array.from(
      stripComments(css).matchAll(/\.(Mui[A-Za-z]+-[A-Za-z][\w-]*)/g),
      m => m[1],
    ).filter(n => !/^MuiPaper-elevation[12]$/.test(n));
    expect(`${id}: ${bare.join(', ')}`).toBe(`${id}: `);
  });

  it.each(sheets)('%s anchors the numbered elevation classes', (id, css) => {
    const rules = stripComments(css);
    for (const n of [1, 2]) {
      // [class*="MuiPaper-elevation1"] would also match elevation10 through 19
      // (v4 goes to 24, and 8 is the default menu Paper), which would hand
      // every menu and popover the card treatment. The clean class beside a
      // trailing-dash match covers every spelling and nothing else.
      expect(`${id}/${n} suffixed:${rules.includes(`[class*="MuiPaper-elevation${n}-"]`)}`)
        .toBe(`${id}/${n} suffixed:true`);
      expect(`${id}/${n} clean:${rules.includes(`.MuiPaper-elevation${n},`)}`)
        .toBe(`${id}/${n} clean:true`);
      expect(rules).not.toContain(`[class*="MuiPaper-elevation${n}"]`);
    }
  });
});
