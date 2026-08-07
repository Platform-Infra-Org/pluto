import { isDarkTheme } from './darkMode';

describe('isDarkTheme', () => {
  it('follows an explicit dark choice', () => {
    expect(isDarkTheme('platform-dark', false)).toBe(true);
  });

  it('follows an explicit light choice even on a dark system', () => {
    // Choosing is choosing: the system preference must not override it.
    expect(isDarkTheme('platform-light', true)).toBe(false);
  });

  it('follows the system when no theme has been chosen', () => {
    // The regression this exists for: an unset theme used to resolve to light
    // while Backstage rendered its dark palette, giving white text on our light
    // background — the whole app unreadable on a dark-mode machine.
    expect(isDarkTheme(undefined, true)).toBe(true);
    expect(isDarkTheme(undefined, false)).toBe(false);
  });

  it('treats an empty id as unset rather than as light', () => {
    expect(isDarkTheme('', true)).toBe(true);
  });
});
