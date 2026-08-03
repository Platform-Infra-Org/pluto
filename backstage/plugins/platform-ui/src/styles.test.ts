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
});
