import { SHADCN_CSS } from './styles';

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


});
