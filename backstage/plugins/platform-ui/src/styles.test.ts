import { SHADCN_CSS } from './styles';
import { GRAPH_OVERRIDES } from './theme';
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
      '.MuiButton-containedPrimary',
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

  it('gives a surface holding a table no corner radius at all', () => {
    // Diagnosed against the running app, not guessed. The table sits 1px inside
    // its Paper and paints an opaque header into the corner, which leaves only
    // two outcomes and no third:
    //   overflow: hidden  -> the surface clips the table's own corners off
    //   overflow: visible -> the table's square corner covers the surface's arc
    // Both shipped in turn. Square meeting square is the only geometry where
    // neither happens, so BOTH halves are pinned here: visible AND zero radius.
    expect(SHADCN_CSS).toMatch(
      /\.MuiPaper-root:has\(table\)\s*\{[^}]*overflow:\s*visible/,
    );
    expect(SHADCN_CSS).toMatch(
      /\.MuiPaper-root:has\(table\)\s*\{[^}]*border-radius:\s*0/,
    );
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
      /\.MuiTypography-h1,[\s\S]*?\{([^}]*)\}/,
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

  it('drops the type subtitle from a template card', () => {
    // The card led with its type rather than its name; the type repeats what
    // the template's own copy already says.
    expect(SHADCN_CSS).toMatch(
      /\.sc-route-create[^{]*> h3\s*\{\s*display:\s*none/,
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
      /\.sc-route-create[^{]*> h4 \{[^}]*font-size:\s*22px/,
    );
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
});
