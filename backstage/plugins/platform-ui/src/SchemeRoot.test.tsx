import { render } from '@testing-library/react';
import { ApiProvider } from '@backstage/core-app-api';
import { TestApiRegistry, MockStorageApi } from '@backstage/test-utils';
import { appThemeApiRef, configApiRef, storageApiRef } from '@backstage/core-plugin-api';
import { ConfigReader } from '@backstage/config';
import { SchemeRoot } from './SchemeRoot';
import { QUICKSTART_VERSION } from './quickstart/steps';

/**
 * A no-op AppThemeApi. SchemeRoot only reads `activeThemeId$()` to keep
 * `.sc-dark` in sync; nothing here exercises light/dark switching.
 */
const appTheme = {
  getInstalledThemes: () => [],
  activeThemeId$: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
  getActiveThemeId: () => undefined,
  setActiveThemeId: () => {},
};

function renderRoot(defaultScheme: string | undefined) {
  const apis = TestApiRegistry.from(
    [
      configApiRef,
      new ConfigReader(
        defaultScheme ? { app: { branding: { defaultScheme } } } : {},
      ),
    ],
    [appThemeApiRef, appTheme],
    // Pre-mark the tour as seen: it renders with a ResizeObserver jsdom
    // doesn't have, and is unrelated to what this test pins.
    [
      storageApiRef,
      MockStorageApi.create({
        'platform.quickstart': { completedVersion: QUICKSTART_VERSION },
      }),
    ],
  );
  return render(
    <ApiProvider apis={apis}>
      <SchemeRoot />
    </ApiProvider>,
  );
}

describe('SchemeRoot', () => {
  const realMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    // jsdom has no matchMedia; SchemeRoot reads it for the dark-mode query.
    (window as unknown as { matchMedia: unknown }).matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
  });

  afterEach(() => {
    (window as unknown as { matchMedia: unknown }).matchMedia = realMatchMedia;
  });

  it('applies and persists a configured default on a browser with nothing stored', () => {
    // Pins the fix at SchemeRoot.tsx:884 — `branding.defaultScheme` set
    // synchronously in render, before SchemePicker (a child in the same
    // render pass) computes its own initial pick and persists it. Delete
    // that line and this goes red: SchemePicker's lazy `useState` locks in
    // 'obsidian' before the config effect (a passive effect, arriving after
    // paint and after SchemePicker's own effect, per React's ordering) has
    // any chance to correct it, and 'obsidian' is what gets written to
    // localStorage.
    renderRoot('greek');

    expect(localStorage.getItem('platform-scheme')).toBe('greek');
    expect(document.documentElement.classList.contains('sc-greek')).toBe(true);
    expect(document.documentElement.classList.contains('sc-obsidian')).toBe(false);
  });

  it('still falls back to obsidian when nothing is configured', () => {
    renderRoot(undefined);

    expect(localStorage.getItem('platform-scheme')).toBe('obsidian');
    expect(document.documentElement.classList.contains('sc-obsidian')).toBe(true);
  });
});
