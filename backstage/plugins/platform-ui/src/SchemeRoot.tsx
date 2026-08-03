import { useEffect, useState } from 'react';
import { appThemeApiRef, configApiRef, useApi } from '@backstage/core-plugin-api';
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

/**
 * Branding from `app.branding`, handed over once by {@link SchemeRoot}.
 * `applyScheme` runs at module load — before React, so before configApi exists —
 * hence this module-level relay rather than a prop.
 */
let branding: { mark?: string; favicon?: string } = {};

export function setBranding(next: { mark?: string; favicon?: string }) {
  branding = next;
  applyScheme(); // redraw the tab icon now that the mark is known
}

/**
 * The tab icon. An explicit `app.branding.favicon` is used as-is; otherwise a
 * configured mark is composited over the picked accent, so the tab recolours
 * with the sidebar tile. With neither set, the static icons in
 * `packages/app/public` are left alone.
 */
function updateFavicon(accentHsl: string) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  if (branding.favicon) {
    link.href = branding.favicon;
    return;
  }
  if (!branding.mark) return;

  // 64px downscales cleanly to the 32/16 the tab actually uses. Tile radius and
  // logo inset follow the same proportions as the in-app tile (styles.ts).
  const S = 64;
  const inset = Math.round(S * 0.175);
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const g = canvas.getContext('2d');
  if (!g) return;

  const img = new Image();
  img.onload = () => {
    try {
      g.fillStyle = `hsl(${accentHsl})`;
      if (typeof g.roundRect === 'function') {
        g.beginPath();
        g.roundRect(0, 0, S, S, Math.round(S * 0.27));
        g.fill();
      } else {
        g.fillRect(0, 0, S, S);
      }
      g.drawImage(img, inset, inset, S - inset * 2, S - inset * 2);
      link.href = canvas.toDataURL('image/png');
    } catch {
      // Cross-origin mark (tainted canvas) or an SVG with no intrinsic size —
      // keep whatever favicon is already there.
    }
  };
  img.src = branding.mark;
}

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
  updateFavicon(s.hsl);
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
  const config = useApi(configApiRef);

  useEffect(() => {
    setBranding({
      mark: config.getOptionalString('app.branding.mark'),
      favicon: config.getOptionalString('app.branding.favicon'),
    });
  }, [config]);

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
