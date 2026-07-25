import { useEffect, useState } from 'react';
import { appThemeApiRef, useApi } from '@backstage/core-plugin-api';
import { SHADCN_CSS } from './styles';

// Muted, shadcn-calm accents (lower saturation — not neon).
export const SCHEMES = [
  { id: 'violet', label: 'Violet', hsl: '250 52% 55%' },
  { id: 'blue', label: 'Blue', hsl: '217 60% 52%' },
  { id: 'green', label: 'Green', hsl: '152 42% 40%' },
  { id: 'rose', label: 'Rose', hsl: '345 55% 52%' },
  { id: 'amber', label: 'Amber', hsl: '32 70% 48%' },
  { id: 'slate', label: 'Slate', hsl: '215 20% 40%' },
];

function ensureStyle(id: string, css: string) {
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

/**
 * Inject the base shadcn CSS + the accent var for `scheme` (or the persisted
 * one). Runs at module load so the sign-in gate — which renders before the
 * SchemeRoot app-root element mounts — is already themed by the picker.
 */
export function applyScheme(scheme?: string) {
  if (typeof document === 'undefined') return;
  ensureStyle('sc-base', SHADCN_CSS);
  const stored =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('platform-scheme')
      : null;
  const id = scheme || stored || 'violet';
  const s = SCHEMES.find(x => x.id === id) ?? SCHEMES[0];
  ensureStyle('sc-accent', `:root{--sc-primary:${s.hsl};--sc-ring:${s.hsl}}`);
}

// Theme the login gate immediately, before React mounts anything.
applyScheme();

/**
 * The live color-scheme swatches. Self-contained (own state, persisted +
 * applied on click), so it works both inside the app and on the login gate.
 */
export function SchemePicker() {
  const [scheme, setScheme] = useState(
    () =>
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem('platform-scheme')) ||
      'violet',
  );

  useEffect(() => {
    // Base CSS + accent var; also re-applied live whenever the picker changes.
    applyScheme(scheme);
    try {
      localStorage.setItem('platform-scheme', scheme);
    } catch {
      /* ignore */
    }
  }, [scheme]);

  return (
    <div className="sc sc-picker" role="group" aria-label="Color scheme">
      {SCHEMES.map(s => (
        <button
          key={s.id}
          type="button"
          className="sc-swatch"
          aria-pressed={s.id === scheme}
          title={s.label}
          style={{ background: `hsl(${s.hsl})` }}
          onClick={() => setScheme(s.id)}
        />
      ))}
    </div>
  );
}

/**
 * App-root element: injects the shadcn design layer, keeps `.sc-dark` in sync
 * with the active Backstage theme, and renders the live color-scheme picker.
 */
export function SchemeRoot() {
  const appTheme = useApi(appThemeApiRef);

  useEffect(() => {
    const sub = appTheme.activeThemeId$().subscribe(id => {
      document.documentElement.classList.toggle(
        'sc-dark',
        !!id && id.includes('dark'),
      );
    });
    return () => sub.unsubscribe();
  }, [appTheme]);

  return <SchemePicker />;
}
