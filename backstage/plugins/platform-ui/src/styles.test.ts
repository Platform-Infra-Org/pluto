import { SHADCN_CSS } from './styles';
import { GRAPH_OVERRIDES, pageThemes } from './theme';
import { SPRITE_SIZE } from './sprites';
import { STARFIELD } from './starfield';

/**
 * The whole stylesheet is one template literal, so a stray backtick in a CSS
 * comment silently truncates it — the app then renders unstyled with a runtime
 * error, while tsc and every other test still pass. That has happened twice;
 * this is the guard.
 */
describe('SHADCN_CSS', () => {
  it('is not truncated', () => {
    expect(SHADCN_CSS.length).toBeGreaterThan(5000);
  });

  it('still carries the rules the app depends on', () => {
    for (const marker of [
      '@font-face',
      '--sc-font-ui',
      '--sc-radius',
      '.sc-nav',
      'prefers-reduced-motion',
      // Proves greekCss() is actually interpolated. Without this, greek.ts can
      // be perfectly correct and simply never reach the page.
      ':root.sc-greek',
    ]) {
      expect(`${marker}:${SHADCN_CSS.includes(marker)}`).toBe(`${marker}:true`);
    }
  });

  it('has balanced braces', () => {
    const open = (SHADCN_CSS.match(/{/g) ?? []).length;
    const close = (SHADCN_CSS.match(/}/g) ?? []).length;
    expect(`${open}/${close}`).toBe(`${close}/${close}`);
  });

  it('has no control characters, which is what a bad escape leaves behind', () => {
    // Inside a template literal a single backslash before digits is a legacy
    // octal escape: the doubled form is the caret, the single form is
    // character 0x02 followed by "5BC". The app build rejects the source
    // outright and tsc says nothing, so the evaluated string is checked for
    // the residue instead. Compared by code point rather than by regex,
    // because a control-character regex is itself a lint error.
    const control = [...SHADCN_CSS].filter(ch => {
      const code = ch.codePointAt(0) ?? 32;
      return code < 32 && ch !== '\n' && ch !== '\t' && ch !== '\r';
    });
    expect(control).toEqual([]);
  });

  it('sizes every state sprite at an integer multiple of SPRITE_SIZE', () => {
    // A fractional multiple only looks right where the device pixel ratio
    // happens to cancel it: .sc-empty's 24px (1.5x) was even at dpr 2 and
    // lopsided at dpr 1, so it read as a Windows-only rendering bug. Any
    // integer multiple is correct on every screen.
    const sizes = Array.from(
      SHADCN_CSS.matchAll(/\.sc-state-ic[^{}]*\{[^}]*?width:\s*(\d+(?:\.\d+)?)px/g),
      m => parseFloat(m[1]),
    );
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.filter(px => px % SPRITE_SIZE !== 0)).toEqual([]);
  });

  it('routes MUI primary colours through the picked accent', () => {
    // The scaffolder form's palette.primary is frozen at theme construction, so
    // these overrides are the only thing making it follow the picker. Both MUI
    // majors' spellings must be present — v4 emits MuiStepIcon-active, v5 the
    // global Mui-active, and an audit of the live form found the v4 form.
    for (const sel of [
      '.MuiStepIcon-root.MuiStepIcon-active',
      '.MuiStepIcon-root.Mui-active',
      // Substring form since the suffix-tolerance pass: the same class arrives
      // as MuiButton-containedPrimary-316 under a nested ThemeProvider.
      '[class*="MuiButton-containedPrimary"]',
      '.MuiCheckbox-colorPrimary.Mui-checked',
      // MUI v4 defaults these to the SECONDARY palette; a primary-only
      // override left the form's checkboxes purple.
      '.MuiCheckbox-colorSecondary.Mui-checked',
      // The array field's add/remove/reorder controls.
      '.MuiIconButton-colorSecondary',
    ]) {
      expect(SHADCN_CSS).toContain(sel);
    }
    // The theme's literal indigo must never be hard-coded into the stylesheet.
    expect(SHADCN_CSS.toLowerCase()).not.toContain('#6366f1');
  });

  it('lets the JSON viewer scroll and wrap instead of clipping', () => {
    // min-width:0 is the load-bearing part: a flex item defaults to
    // min-width:auto, so without it overflow-x never engages and a long param
    // value is clipped at the window edge with no scrollbar to reach it.
    expect(SHADCN_CSS).toMatch(/\.sc-json-body\s*\{[^}]*min-width:\s*0/);
    expect(SHADCN_CSS).toMatch(/\.sc-json-string[^{]*\{[^}]*overflow-wrap:\s*anywhere/);
  });

  it('falls back to antialiasing at fractional device pixel ratios', () => {
    // No fixed size divides evenly at 125% zoom, so crispEdges has to go there
    // or neighbouring sprite columns round to different widths.
    expect(SHADCN_CSS).toContain('(resolution: 1.25dppx)');
    expect(SHADCN_CSS).toMatch(/shape-rendering:\s*geometricPrecision/);
  });

  it('shares one accent-hover treatment between the tour and other buttons', () => {
    // Duplicating the rule is how the two drift apart; the relations card's
    // Explore graph button opts in with .sc-btn-accent.
    expect(SHADCN_CSS).toMatch(/\.sc-btn-accent:hover:not\(:disabled\)/);
    expect(SHADCN_CSS).toMatch(
      /\.sc-tour:hover:not\(:disabled\)[^{]*\.sc-btn-accent[^{]*\{[^}]*--sc-primary/,
    );
  });

  it('darkens the edge label backing, which react-flow paints white', () => {
    expect(SHADCN_CSS).toMatch(/\.react-flow__edge-textbg\s*\{[^}]*fill:/);
  });

  it('keeps react-flow transparent so its star pattern is not covered', () => {
    // The pattern svg is z-index:-1, so it paints behind its parent's own
    // background. An opaque colour on .react-flow hid the stars completely;
    // the colour belongs on the wrapper, which sits below that svg.
    expect(SHADCN_CSS).toMatch(
      /\.react-flow,[^{]*\{[^}]*background:\s*transparent/,
    );
    expect(SHADCN_CSS).toMatch(/\.sc-graph-canvas\s*\{[^}]*background:/);
  });

  it('paints the React Flow canvas with the shared starfield', () => {
    // The catalog graph gets the same colour through theme.tsx. If these drift,
    // the two graph surfaces stop looking like the same product.
    expect(SHADCN_CSS).toContain(STARFIELD.bg);
  });

  it('stacks the collapsed rail so its two controls cannot collide', () => {
    // The rail is 68px. Less .sc-nav's 24px of padding and .sc-nav-top's 12px,
    // a row has 32px to hold a 26px brand mark AND a 26px toggle, both
    // flex: 0 0 auto. Side by side that is 52px into 32px: they overran the box
    // and overflow-x: hidden clipped the result. A column gives each 26px
    // against 44px of width.
    expect(SHADCN_CSS).toMatch(
      /\.sc-nav\.collapsed \.sc-nav-top\s*\{[^}]*flex-direction:\s*column/,
    );
  });

  it('presses buttons by highlighting them, never by moving them', () => {
    // A 2px translate on :active shifted the button out from under the pointer,
    // fought the filter-based glows the mode potions paint, and left anything
    // anchored to the button a frame behind. Highlight only.
    expect(SHADCN_CSS).not.toMatch(/:active[^{]*\{[^}]*transform:\s*translate/);
    expect(SHADCN_CSS).toMatch(/:active[^{]*\{[^}]*box-shadow:\s*inset/);
  });

  it('puts the collapsed rail icons on the logo axis', () => {
    // Both the brand mark and every nav icon get the same 26px centred box, so
    // they share one vertical axis by construction rather than by two padding
    // sums happening to agree — which they did not.
    expect(SHADCN_CSS).toMatch(
      /\.sc-nav\.collapsed \.sc-nav-brand,\s*\.sc-nav\.collapsed \.sc-nav-ic\s*\{[^}]*width:\s*26px/,
    );
  });

  it('self-hosts every face it names, same-origin', () => {
    // The CSP is font-src 'self'. A CDN url in an @font-face would simply not
    // load, and the failure is silent — the page falls back and looks nearly
    // right. Both faces are files this app serves.
    // Every face, whatever the count. The app is down to one family; the rule
    // is that whatever it serves, it serves itself.
    const faces = Array.from(SHADCN_CSS.matchAll(/@font-face\s*\{([^}]*)\}/g), m => m[1]);
    expect(faces.length).toBeGreaterThanOrEqual(1);
    for (const face of faces) {
      const url = /url\('([^']+)'\)/.exec(face);
      expect(url).not.toBeNull();
      expect(url![1].startsWith('/fonts/')).toBe(true);
    }
  });

  it('clips a table to the corners of the surface holding it', () => {
    // The radius and the clip are one decision and are pinned together. The
    // surface was square for a long time because the table paints into the
    // corner: `hidden` cut the table's corners off and `visible` let its square
    // corner cover the arc, so zero was the only geometry where neither
    // happened. The header no longer paints its own opaque ground, which is
    // what makes the clip safe -- but a radius WITHOUT the clip brings the
    // second failure straight back, so neither half may be set alone.
    const block = SHADCN_CSS.match(
      /\.MuiPaper-root:has\(table\)\s*\{([^}]*)\}/,
    );
    expect(block).toBeTruthy();
    expect(block![1]).toMatch(/overflow:\s*hidden/);
    expect(block![1]).toMatch(/border-radius:\s*var\(--sc-radius\)/);
    expect(block![1]).not.toMatch(/overflow:\s*visible/);
  });

  it('serves exactly one typeface', () => {
    // One family, differentiated by weight, size and case. A second @font-face
    // would mean the consolidation had quietly come undone.
    const faces = Array.from(SHADCN_CSS.matchAll(/@font-face\s*\{([^}]*)\}/g), m => m[1]);
    expect(faces.length).toBe(1);
    expect(faces[0]).toMatch(/Clash Grotesk/);
    expect(SHADCN_CSS).not.toMatch(/Pixelify Sans|Anton/);
  });

  it('leaves uppercase to the micro-label alone', () => {
    // The arcade treatment uppercased every piece of chrome, which is right for
    // a bitmap-derived face and shouting in an outline grotesque. The label
    // keeps it, with the positive tracking uppercase always needs.
    expect(SHADCN_CSS).toMatch(
      /\.sc-label\s*\{[^}]*text-transform:\s*uppercase[^}]*letter-spacing:\s*0\.04em/,
    );
  });

  it('gives every title one face', () => {
    // The h1 that says "Welcome to Platform" and a card's own title are the
    // same kind of object; they were drifting apart by which stylesheet reached
    // them first.
    expect(SHADCN_CSS).toMatch(/--sc-font-title:/);
    expect(SHADCN_CSS).toMatch(
      /\.sc-card-title,[\s\S]{0,400}font-family:\s*var\(--sc-font-title\)/,
    );
  });

  it('sets a native page title the way it sets "Welcome to Platform"', () => {
    // A native page's title used to sit in the chrome rule and came out
    // uppercase at weight 400 — a bitmap-face convention that reads as
    // shouting in an outline grotesque and made every Backstage page look
    // like a different product from ours.
    const rules = SHADCN_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    const block = rules.match(
      /\[class\*="MuiTypography-h1"\],[\s\S]*?\{([^}]*)\}/,
    );
    expect(block).toBeTruthy();
    expect(block![1]).toMatch(/text-transform:\s*none/);
    expect(block![1]).toMatch(/font-family:\s*var\(--sc-font-title\)/);
    // The micro-label keeps its uppercase: it is a wayfinding convention
    // rather than a texture, and it is the one place the sheet still shouts.
    expect(rules).toMatch(
      /\.MuiTableCell-head,[\s\S]{0,300}text-transform:\s*uppercase/,
    );
  });

  it('drops the type text from a template card but keeps its buttons', () => {
    // The card led with its type rather than its name, and the type repeats
    // what the template's own copy already says. Hiding the whole h3 also hid
    // the detail and favourite buttons that live in it, which are the only way
    // from a card to the Template entity.
    expect(SHADCN_CSS).toMatch(
      /\.sc-route-create[^{]*> h3 > div:first-child \{\s*display:\s*none/,
    );
    expect(SHADCN_CSS).not.toMatch(
      /\.sc-route-create[^{]*> h3 \{[^}]*display:\s*none/,
    );
  });

  it('lets the visualizer follow whatever theme is live', () => {
    // The four DependencyGraph override keys carried hardcoded hex chosen for
    // one dark palette, so the graph stayed that colour in every mode and in
    // light mode — a dark canvas with pale nodes on a parchment page. MUI
    // freezes these at theme construction, so they have to read a variable.
    const graph = JSON.stringify(GRAPH_OVERRIDES);
    expect(graph.length).toBeGreaterThan(100);
    expect(graph).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(graph).toMatch(/hsl\(var\(--sc-card\)\)/);
    expect(graph).toMatch(/hsl\(var\(--sc-fg\)\)/);
  });

  it('declares the bui tokens on both data-theme-mode registers', () => {
    // THE most important assertion in this file, because its failure is
    // invisible in light — the register anyone checks first.
    // Canon declares its light set at ":root, [data-theme-mode='light']" and
    // its dark set at "[data-theme-mode='dark']", and the app puts the
    // attribute on <body>. Custom properties inherit, so <body>'s own
    // declaration beats anything inherited from <html>: a bare :root here is
    // dead in dark, which is how the first five overrides shipped broken
    // (measured: html said our accent, body said Backstage's pale blue).
    // Quote-agnostic — canon uses single quotes, we use double.
    expect(SHADCN_CSS).toMatch(
      /\[data-theme-mode=.light.\][\s\S]{0,80}\[data-theme-mode=.dark.\]\s*\{/,
    );
    // And the block it opens is the token map, not something else.
    // Comments stripped: this block's prose names the one token it must NOT
    // declare, and prose is not a declaration.
    const rules = SHADCN_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    const block = rules.match(/\[data-theme-mode=.dark.\]\s*\{([\s\S]*?)\n\}/);
    expect(block).toBeTruthy();
    expect(block![1]).toMatch(/--bui-bg-app:/);
    expect(block![1]).toMatch(/--bui-fg-primary:/);
    // The status family is wholesale or nothing: a half-mapped family puts one
    // themed badge beside one vanilla one on the same card.
    for (const ramp of ['positive', 'negative', 'warning', 'announcement']) {
      for (const member of [
        'bg',
        'bg-hover',
        'bg-disabled',
        'bg-subdued',
        'bg-subdued-hover',
        'bg-subdued-disabled',
        'border',
        'fg',
        'fg-disabled',
        'fg-subdued',
        'fg-subdued-disabled',
      ]) {
        const name = `--bui-${ramp}-${member}:`;
        expect(`${name}${block![1].includes(name)}`).toBe(`${name}true`);
      }
    }
    // The pill stays a pill. Mapping this one turns every canon pill into a
    // rounded rectangle.
    expect(block![1]).not.toMatch(/--bui-radius-full/);
  });

  it('matches the Mui classes that arrive counter-suffixed, both spellings', () => {
    // Three routes render under a nested ThemeProvider, so @material-ui/styles
    // hands back MuiLink-root-190 instead of MuiLink-root — and the counter is
    // not stable across visits, so no numeric selector can ever work. Two of
    // the three (/docs/... and an entity's Docs tab) match no prefix in
    // routeClass.ts and cannot be reached by a route-scoped workaround at all,
    // which is why the GLOBAL rules carry the substring form.
    const SUFFIXED = [
      'MuiCard-root',
      'MuiAccordion-root',
      'MuiButton-root',
      'MuiButton-containedPrimary',
      'MuiButton-outlinedPrimary',
      'MuiButton-textPrimary',
      'MuiCardHeader-title',
      'MuiOutlinedInput-notchedOutline',
      'MuiSvgIcon-root',
      'MuiIconButton-root',
      'MuiTypography-h1',
      'MuiTypography-h2',
      'MuiTypography-h3',
      'MuiTypography-h4',
      'MuiTypography-h5',
      'MuiTypography-h6',
      'MuiToolbar-root',
      'MuiDivider-root',
      'MuiSlider-root',
      'MuiSlider-colorPrimary',
      'MuiLink-root',
      'MuiTypography-colorPrimary',
    ];
    const rules = SHADCN_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    // Selector lists only — a declaration can mention anything. Scoped
    // selectors are exempt and deliberately so: a `.sc-route-*` or
    // `:root.sc-<mode>` rule reaches a route or a potion that is not one of the
    // three suffixed ones, and the mode sheets that emit them are separate
    // files. It is the GLOBAL rules that have to carry both spellings, because
    // two of the three routes have no route class to scope to in the first
    // place.
    const selectors = rules
      .split('{')
      .flatMap(chunk => chunk.split('}').pop()!.split(','))
      .filter(sel => !sel.includes('.sc-'));
    for (const cls of SUFFIXED) {
      expect(`${cls}:${rules.includes(`[class*="${cls}"]`)}`).toBe(`${cls}:true`);
      const bare = new RegExp(`\\.${cls}(?![A-Za-z0-9_-])`);
      const offenders = selectors.filter(sel => bare.test(sel));
      expect(`${cls}:${offenders.join('|')}`).toBe(`${cls}:`);
    }
  });

  it('anchors the elevation substrings so they cannot swallow elevation10-19', () => {
    // [class*="MuiPaper-elevation1"] also matches MuiPaper-elevation10 through
    // -19 (MUI v4 goes to 24, and 8 is the default menu Paper), which would
    // give every menu and popover the card treatment. The generator emits
    // key-counter, so the trailing dash matches every suffixed spelling and
    // nothing else. These two are the reason the plain form is not universal.
    // Comments are stripped first: the rule's own comment quotes the unanchored
    // spelling it exists to ban, and prose is not a selector.
    const rules = SHADCN_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const n of [1, 2]) {
      expect(rules).toContain(`[class*="MuiPaper-elevation${n}-"]`);
      expect(rules).toContain(`.MuiPaper-elevation${n},`);
      expect(rules).not.toContain(`[class*="MuiPaper-elevation${n}"]`);
    }
  });

  it('colours the empty graph against the canvas, not against the page', () => {
    // .sc-graph-canvas is pinned to the starfield and is deliberately dark in
    // BOTH registers, so a page token on the text it holds measured 2.96:1 in
    // light. The canvas's own node colour is the answer.
    const rules = SHADCN_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    const block = rules.match(/\.sc-graph-empty\s*\{([^}]*)\}/);
    expect(block).toBeTruthy();
    expect(block![1]).not.toMatch(/--sc-muted-fg/);
    expect(block![1]).toMatch(/color:\s*#e7e7ef/);
  });

  it('lets the ownership tile gradient follow the picker', () => {
    // genPageTheme joins its colours into a literal linear-gradient at theme
    // construction, so the tiles on /catalog/default/group/* and /user/* wore a
    // baked indigo->violet in all nine modes and both registers. MUI freezes
    // these, so a CSS variable is the only way they can follow the live theme.
    const entries = Object.values(pageThemes);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.backgroundImage).toContain('hsl(var(--sc-primary))');
      expect(entry.backgroundImage).not.toContain('#');
    }
  });

  it('reaches the JSS-suffixed classes /catalog-import mounts', () => {
    // That route, alone in the app, mounts its own JSS class-name generator:
    // measured on a production build, 83 of its 90 MUI classes arrive
    // counter-suffixed (MuiStepLabel-label-234) against 0 of ~90 on /catalog.
    // A class selector matches whole tokens, so every exact-class rule scoped
    // to the route was dead there. Without that census these two assertions
    // look like a style preference; they are the fix.
    expect(SHADCN_CSS).not.toMatch(/\.sc-route-import\s+\.Mui/);
    expect(SHADCN_CSS).toContain('.sc-route-import [class*="MuiStepIcon-root"]');
  });

  it('pairs ink with the surface it actually sits on', () => {
    // Three controls shipped ink chosen for one state and painted in another.
    // MUI's unselected toggle label is its own rgba(0,0,0,.38) and measured
    // 2.66:1 on the card in claude light. A selected row takes MUI's grey fill,
    // so the bare .Mui-selected accent rule left accent-on-grey. And the step
    // number was primary-fg on every disc, including the muted ones, which put
    // white on light grey in all nine modes.
    // accentFg/accent and mutedFg/muted are both pinned per mode in
    // contrast.test.ts, so pairing against those cannot drift.
    const rules = SHADCN_CSS.replace(/\/\*[\s\S]*?\*\//g, '');

    const toggle = rules.match(/\.MuiToggleButton-root\s*\{([^}]*)\}/);
    expect(toggle).toBeTruthy();
    expect(toggle![1]).toMatch(/color:\s*hsl\(var\(--sc-muted-fg\)\)/);
    expect(rules).toMatch(
      /\.MuiToggleButton-root\.Mui-selected[\s\S]{0,160}--sc-accent-fg/,
    );
    expect(rules).toMatch(
      /\.MuiListItem-root\.Mui-selected[\s\S]{0,200}--sc-accent-fg/,
    );

    // The step number defaults to the muted disc and only takes primary-fg
    // where the disc is actually primary.
    const step = rules.match(
      /\.sc-route-import \[class\*="MuiStepIcon-text"\]\s*\{([^}]*)\}/,
    );
    expect(step).toBeTruthy();
    expect(step![1]).toMatch(/--sc-muted-fg/);
    expect(rules).toMatch(
      /MuiStepIcon-active"\] \[class\*="MuiStepIcon-text"\][\s\S]{0,160}--sc-primary-fg/,
    );
  });

  it('gives no field the page ground, because a field lives on a card', () => {
    // A field inherits the ground of the surface it sits on. Naming --sc-bg
    // while sitting on a --sc-card surface is how the two drift apart: measured
    // on the built app, light register, /create, they differed in 9 of the 11
    // modes. slush and discord passed only because they happen to set --sc-bg
    // and --sc-card to the same white, which is exactly why pinning one mode's
    // colour would not have caught this — the check has to be on the rule, not
    // on a rendered pixel.
    const rules = SHADCN_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    const FIELD =
      /MuiInput|MuiOutlinedInput|\.sc-input|\.sc-select|\.sc-textarea|bui-(?:Input|Field|TextField|Search)/;
    const offenders = Array.from(
      rules.matchAll(/([^{}]+)\{([^{}]*)\}/g),
      m => [m[1].trim(), m[2]] as const,
    )
      .filter(([sel]) => FIELD.test(sel))
      .filter(([, body]) => /background(?:-color)?:[^;]*--sc-bg\b/.test(body))
      .map(([sel]) => sel);
    expect(offenders).toEqual([]);
  });

  it('lets chrome inherit its ground instead of asserting a surface', () => {
    // Twice now: a field named --sc-bg while sitting on a card, and a toolbar
    // named --sc-card while sitting on the page. Both are strips of chrome, and
    // chrome does not know what it is standing on -- only a surface does. The
    // failure is invisible wherever the two tokens happen to agree, which is
    // why it read as a Hermes and Flying Papers bug rather than a general one.
    const rules = SHADCN_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const sel of ['MuiToolbar-root', 'MuiAppBar-root']) {
      const block = rules.match(
        new RegExp(`\\[class\\*="${sel}"\\]\\s*\\{([^}]*)\\}`),
      );
      if (!block) continue;
      const bg = block[1].match(/background(-color)?:\s*([^;]+)/);
      if (!bg) continue;
      expect(`${sel}:${bg[2].trim()}`).toBe(`${sel}:transparent`);
    }
  });

  it('themes the bui plugin header', () => {
    // It ships its own white ground and black ink — measured rgb(255,255,255)
    // on a production build while the mode's card was 42 45% 98%.
    expect(SHADCN_CSS).toMatch(
      /\[class\*="bui-PluginHeader"\]\s*\{[^}]*hsl\(var\(--sc-card\)\)/,
    );
  });

  it('declares no edge on the plugin header, which is seven elements', () => {
    // The substring hook matches the whole PluginHeader family — Toolbar,
    // ToolbarContent, ToolbarIcon, ToolbarName, Breadcrumbs and the bar — so a
    // border here is drawn once under the icon, once under the title and once
    // under the box. That shipped, and it read as three stray underlines.
    // Ground and ink inherit down that tree harmlessly; an edge does not.
    const rules = SHADCN_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    const block = rules.match(
      /\[class\*="bui-PluginHeader"\]\s*\{([^}]*)\}/,
    );
    expect(block).toBeTruthy();
    expect(block![1]).not.toMatch(/border/);
  });

  it('recolours the visualizer tree, which bypasses the theme overrides', () => {
    // The plugin passes its own renderNode, so the BackstageDependencyGraph*
    // keys in theme.tsx never see the nodes; it hardcodes #90caf9 as a React
    // prop on "rect", which lands as an SVG presentation attribute at
    // specificity 0 and loses to a plain author rule. Node kind is readable
    // only from the corner radius.
    expect(SHADCN_CSS).toContain('#dependency-graph rect[rx="0"]');
    // Comments are stripped first: the rule's own comment names the hex it
    // exists to beat, and prose is not a declaration.
    const rules = SHADCN_CSS.replace(/\/\*[\s\S]*?\*\//g, '').toLowerCase();
    expect(rules).not.toContain('#90caf9');
    // The canvas follows the mode instead of a fixed near-black.
    expect(SHADCN_CSS).toMatch(
      /#dependency-graph\s*\{[^}]*background-color:\s*hsl\(var\(--sc-bg\)\)/,
    );
  });

  it('makes the template name the card headline', () => {
    // h4 is the template's name. It arrived at the header's inherited size,
    // which read as a caption on a card whose whole job is to be picked out of
    // a grid.
    expect(SHADCN_CSS).toMatch(
      /\.sc-route-create[^{]*> h4 \{[^}]*font-size:\s*16px/,
    );
    // The plate hugs the type. 4px of vertical padding made a 34.39px band over
    // a 90px header scene; at 16px/1.2 the line box needs 19.2px and 1px of
    // padding leaves the descender 1.6px of clearance. Comments are stripped
    // first — the rule's own comment quotes the old values.
    const rules = SHADCN_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    const block = rules.match(/\.sc-route-create[^{]*> h4 \{([^}]*)\}/);
    expect(block).toBeTruthy();
    const padding = /padding:\s*(\d+(?:\.\d+)?)px/.exec(block![1]);
    expect(padding).not.toBeNull();
    expect(parseFloat(padding![1])).toBeLessThanOrEqual(2);
  });

  it('uses no class name that a production build discards', () => {
    // Material-UI keeps a makeStyles `name` in the generated class only outside
    // production; in a built image BackstageItemCardHeader-root-130 is jss130.
    // A selector naming one is dead in the deployed app and alive on the dev
    // server, which is the worst failure mode available — it looks correct
    // everywhere you would normally test. Measured against a real production
    // build served from packages/app/dist: 221 Mui* and 28 bui-* class names
    // survive; Backstage*, PluginCatalogGraph* and DependencyGraph* all come
    // back as zero.
    const survives = (n: string) =>
      n.startsWith('Mui') || // MUI keeps its own prefix in production
      n.startsWith('bui-') || // Backstage UI ships plain CSS, not JSS
      n.startsWith('sc-') || // ours
      n.startsWith('material-icons'); // the icon font's literal class

    // Nothing is exempt any more. The catalog-graph rules that used to live
    // here moved into theme.tsx styleOverrides, which MUI applies by component
    // name and which therefore survive a production build — so the stylesheet
    // now has no production-dead selector at all, rather than documented debt.
    const KNOWN_DEAD: string[] = [];

    // Comments are stripped first: several of them quote the very selectors
    // this guard exists to ban, and prose is not a rule.
    const rules = SHADCN_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    const dead = Array.from(
      rules.matchAll(/\[class\*="([A-Za-z][A-Za-z0-9_-]*)"\]/g),
      m => m[1],
    ).filter(n => !survives(n) && !KNOWN_DEAD.includes(n));
    expect([...new Set(dead)]).toEqual([]);
  });

  it('steps the potion sparkle, behind the motion query, lit by default', () => {
    // Same shape as greek.test.ts's ember guard. Three separate claims:
    // the keyframes exist only inside the no-preference block, the timing is
    // stepped rather than eased, and the 0%/100% frame is fully opaque — so
    // the still frame is the designed one and the sparkle can only ever be
    // decoration on top of it, never the thing that marks the equipped bottle.
    const guarded = SHADCN_CSS.slice(
      SHADCN_CSS.indexOf('@media (prefers-reduced-motion: no-preference)'),
    );
    expect(SHADCN_CSS).toContain('@keyframes sc-sparkle');
    expect(guarded).toContain('@keyframes sc-sparkle');
    expect(guarded).toMatch(
      /@keyframes sc-sparkle \{\s*0%, 100% \{ opacity: 1; \}/,
    );
    expect(guarded).toMatch(/animation: sc-sparkle [^;]*steps\(/);
    // And the static rule outside the query paints them at that same opacity.
    expect(SHADCN_CSS).toMatch(
      /\.sc-potion \.sc-potion-stars svg \{[^}]*opacity: 1;/,
    );
  });

  it('gives the tray and its bottles no transition at all', () => {
    // The nav's `transition: width .16s ease` is a documented pre-existing
    // exception, not a pattern. The tray opens and shuts by existing or not,
    // so there is nothing to ease.
    const rules = SHADCN_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const sel of ['.sc-picker-inv', '.sc-inv-potion', '.sc-inv-list']) {
      const blocks = Array.from(
        rules.matchAll(new RegExp(`\\${sel}[^{}]*\\{([^}]*)\\}`, 'g')),
        m => m[1],
      );
      expect(`${sel}:${blocks.length > 0}`).toBe(`${sel}:true`);
      expect(blocks.filter(b => /transition/.test(b))).toEqual([]);
    }
  });

  it('runs the cast stepped, inside the query, and lit when it is off', () => {
    // The pick is applied when the cast ends, so the animation is on the
    // critical path of a state change: it has to be stepped like everything
    // else, it has to sit inside the reduced-motion query, and the component
    // has to skip the wait entirely when motion is off -- which is asserted in
    // SchemePicker.test.tsx, because it is behaviour rather than style.
    // Every keyframe and every animation: shorthand lives behind the query, and
    // the sheet has more than one such block, so this is checked by finding the
    // rule and looking at which block it fell in rather than by slicing at the
    // first one.
    const inQuery = (needle: string) => {
      const at = SHADCN_CSS.indexOf(needle);
      expect(`${needle}:${at >= 0}`).toBe(`${needle}:true`);
      const opened = SHADCN_CSS.lastIndexOf(
        '@media (prefers-reduced-motion: no-preference)',
        at,
      );
      // Nothing between that @media and the rule may close it.
      const between = SHADCN_CSS.slice(opened, at);
      let depth = 0;
      for (const ch of between) {
        if (ch === '{') depth += 1;
        else if (ch === '}') depth -= 1;
      }
      return opened >= 0 && depth > 0;
    };
    expect(inQuery('@keyframes sc-cast')).toBe(true);
    expect(inQuery('.sc-inv-casting svg')).toBe(true);
    expect(SHADCN_CSS).toMatch(/\.sc-inv-casting svg\s*\{[^}]*steps\(/);
    // The stars are drawn lit by a plain rule, so the still frame is the
    // designed one rather than a half-finished pop.
    expect(SHADCN_CSS).toMatch(/\.sc-cast-stars svg\s*\{[^}]*color:/);
  });

  it('never repositions an outlined label, whose notch geometry MUI owns', () => {
    // The standard variant needs left: 10px to sit inside our boxed field.
    // The outlined variant must not be touched: its label is placed by a
    // transform and its <legend> is cut to match, so moving one and not the
    // other puts the text on the border. Selecting an entity in a
    // MultiEntityPicker is what makes it visible.
    const offenders = SHADCN_CSS.split('}')
      .filter(block => /left:\s*var\(--sc-field-x\)/.test(block))
      .filter(block => /MuiInputLabel-root|MuiFormLabel-root/.test(block));
    expect(offenders).toEqual([]);
  });
});
