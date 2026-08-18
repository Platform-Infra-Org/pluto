import { rimefastCss } from './rimefast';
import { MODE_CARDS } from './statusTokens';
import { SHADCN_CSS } from './styles';

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
