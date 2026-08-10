import { SHADCN_CSS } from './styles';
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
      '--sc-font-pixel',
      '--sc-radius',
      '.sc-nav',
      'prefers-reduced-motion',
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

  it('paints the React Flow canvas with the shared starfield', () => {
    // The catalog graph gets the same colour through theme.tsx. If these drift,
    // the two graph surfaces stop looking like the same product.
    expect(SHADCN_CSS).toContain(STARFIELD.bg);
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
    const SURVIVES = (n: string) =>
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
    ).filter(n => !SURVIVES(n) && !KNOWN_DEAD.includes(n));
    expect([...new Set(dead)]).toEqual([]);
  });
});
