import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { appThemeApiRef, configApiRef, useApi } from '@backstage/core-plugin-api';
import { SHADCN_CSS } from './styles';
import { SPRITE_SIZE, spriteRects, TEMPLE } from './sprites';
import { PixelPotion } from './components';
import { templateHeaderCss } from './templateHeaders';
import { listenForKonami } from './konami';
import { useCurrentPath } from './CustomNav';
import { useRecordVisit } from './useVisits';
import { Quickstart } from './quickstart/Quickstart';
import { useQuickstart } from './quickstart/useQuickstart';
import { sampleImageTone, Tone } from './imageTone';
import { clampToViewport, PickerPos } from './pickerPos';

/**
 * Pointer travel before a press becomes a drag.
 *
 * Below it the press is still a click on a bottle. Without a threshold every
 * drag that happens to start on a potion would also change the colour scheme,
 * which is worse than the occlusion this feature exists to fix.
 */
const DRAG_THRESHOLD = 4;

/** The two foreground tones a scheme can use, and each other's shade. */
const WHITE = '0 0% 100%';
const INK = '240 10% 8%';

// Saturated toward NES-era values. `fg` is the text colour that sits on the
// accent: white where it clears 4.5:1, near-black where it doesn't. Green and
// amber are the reason this field exists — darkening them enough for white text
// would have turned them to mud. Ratios are measured, see SchemeRoot.test.ts.
export const SCHEMES = [
  { id: 'violet', label: 'Violet', hsl: '250 75% 60%', fg: WHITE }, // 5.60
  { id: 'blue', label: 'Blue', hsl: '217 85% 52%', fg: WHITE }, // 4.74
  { id: 'green', label: 'Green', hsl: '145 75% 42%', fg: INK }, // 7.41
  { id: 'rose', label: 'Rose', hsl: '345 80% 49%', fg: WHITE }, // 4.73
  { id: 'amber', label: 'Amber', hsl: '38 90% 52%', fg: INK }, // 8.85
  { id: 'slate', label: 'Slate', hsl: '215 30% 45%', fg: WHITE }, // 5.29
];

/**
 * Branding from `app.branding`, handed over once by {@link SchemeRoot}.
 * `applyScheme` runs at module load — before React, so before configApi exists —
 * hence this module-level relay rather than a prop.
 */
let branding: {
  mark?: string;
  favicon?: string;
  headerDir?: string;
  headerHeight?: string;
  headerPosition?: string;
} = {};

/**
 * Images bundled from packages/app/src/branding, keyed by subfolder. The app
 * owns them — platform-ui cannot import from the app — so the app hands the
 * whole map over and config picks which subfolder to use.
 */
let brandingImages: Record<string, string[]> = {};

/**
 * Text tone per header image, filled in asynchronously once each image has been
 * measured. Unmeasured images fall back to the accent's own foreground.
 */
const imageTones: Record<string, Tone> = {};
const pending = new Set<string>();

/** Measure any image we have not seen yet, then restyle once each lands. */
function ensureTones(images: string[]) {
  for (const src of images) {
    if (src in imageTones || pending.has(src)) continue;
    pending.add(src);
    sampleImageTone(src).then(tone => {
      imageTones[src] = tone;
      pending.delete(src);
      applyScheme();
    });
  }
}

export function setBrandingImages(images: Record<string, string[]>) {
  brandingImages = images;
  applyScheme();
}

function setBranding(next: typeof branding) {
  branding = next;
  applyScheme(); // redraw the tab icon now that the mark is known
}

// 64px downscales cleanly to the 32/16 the tab actually uses. Radius and inset
// match the in-app tile's proportions (styles.ts): glyph at ~65% of the tile.
const ICON_SIZE = 64;
const ICON_INSET = Math.round(ICON_SIZE * 0.175);

/** The accent tile every generated icon sits on. */
function drawTile(g: CanvasRenderingContext2D, accentHsl: string) {
  g.fillStyle = `hsl(${accentHsl})`;
  if (typeof g.roundRect === 'function') {
    g.beginPath();
    g.roundRect(0, 0, ICON_SIZE, ICON_SIZE, Math.round(ICON_SIZE * 0.27));
    g.fill();
  } else {
    g.fillRect(0, 0, ICON_SIZE, ICON_SIZE); // jsdom, and Safari before 16.4
  }
}

/**
 * The tab icon, redrawn on every accent change so it tracks the sidebar tile.
 *
 * `app.branding.favicon` pins a fixed icon and wins outright. Otherwise the tile
 * is drawn in the picked accent and either the configured `app.branding.mark`
 * image or — by default — the built-in glyph is drawn on top. The static icons
 * in `packages/app/public` remain the pre-JavaScript first paint.
 */
function updateFavicon(accentHsl: string, fgHsl: string) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  if (branding.favicon) {
    link.href = branding.favicon;
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const g = canvas.getContext('2d');
  if (!g) return;

  const publish = () => {
    try {
      link.href = canvas.toDataURL('image/png');
    } catch {
      // Tainted canvas (a cross-origin mark) — keep the static icon.
    }
  };

  if (branding.mark) {
    const img = new Image();
    img.onload = () => {
      drawTile(g, accentHsl);
      g.drawImage(
        img,
        ICON_INSET,
        ICON_INSET,
        ICON_SIZE - ICON_INSET * 2,
        ICON_SIZE - ICON_INSET * 2,
      );
      publish();
    };
    // An SVG with no intrinsic width/height cannot be drawn; keep the static icon.
    img.onerror = () => {};
    img.src = branding.mark;
    return;
  }

  // Default: the same pixel glyph the sidebar draws.
  drawTile(g, accentHsl);
  const scale = (ICON_SIZE - ICON_INSET * 2) / SPRITE_SIZE;
  g.save();
  g.translate(ICON_INSET, ICON_INSET);
  g.scale(scale, scale);
  g.fillStyle = `hsl(${fgHsl})`; // the scheme's own foreground
  for (const r of spriteRects(TEMPLE)) g.fillRect(r.x, r.y, r.w, 1);
  g.restore();
  publish();
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
  ensureStyle(
    'sc-accent',
    // --sc-primary-shade is the opposite of the foreground: it is what text on
    // the header art is outlined with, so light text gets a dark edge and dark
    // text a light one.
    `:root{--sc-primary:${s.hsl};--sc-ring:${s.hsl};--sc-primary-fg:${s.fg};` +
      `--sc-primary-shade:${s.fg === WHITE ? INK : WHITE}}`,
  );
  // Empty when no images are supplied, which leaves the pixel-art headers.
  const headerImages =
    brandingImages[branding.headerDir ?? 'template-headers'] ?? [];
  ensureTones(headerImages);
  ensureStyle(
    'sc-template-headers',
    templateHeaderCss({
      images: headerImages,
      // Each header's text is coloured for the image behind it, not the accent.
      tones: headerImages.map(src => imageTones[src]),
      height: branding.headerHeight,
      position: branding.headerPosition,
    }),
  );
  updateFavicon(s.hsl, s.fg);
}

// Theme the login gate immediately, before React mounts anything.
applyScheme();

/**
 * The live color-scheme swatches. Self-contained (own state, persisted +
 * applied on click), so it works both inside the app and on the login gate.
 */
/**
 * The scheme picker.
 *
 * `floating` is the corner shelf that follows you around the app. Without it
 * the picker sits in the flow, which is how the sign-in card carries its own —
 * the card is the only place the floating one is suppressed, so there is never
 * a second shelf stacked on the first.
 */
export function SchemePicker({ floating }: { floating?: boolean } = {}) {
  const [scheme, setScheme] = useState(
    () =>
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem('platform-scheme')) ||
      'violet',
  );
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<PickerPos>();
  const [dragging, setDragging] = useState(false);
  // Live drag bookkeeping. A ref, not state: it changes on every pointermove and
  // nothing renders from it.
  const drag = useRef<{
    id: number;
    ox: number;
    oy: number;
    dx: number;
    dy: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    // Base CSS + accent var; also re-applied live whenever the picker changes.
    applyScheme(scheme);
    try {
      localStorage.setItem('platform-scheme', scheme);
    } catch {
      /* ignore */
    }
  }, [scheme]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Left button only, and only the floating instance — the sign-in card's
    // picker sits in the flow of the card and must not move.
    if (!floating || e.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    drag.current = {
      id: e.pointerId,
      ox: e.clientX,
      oy: e.clientY,
      dx: e.clientX - r.left,
      dy: e.clientY - r.top,
      moved: false,
    };
    // Keeps the drag alive if the pointer outruns the box.
    el.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el || d.id !== e.pointerId) return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.ox, e.clientY - d.oy) < DRAG_THRESHOLD)
        return;
      d.moved = true;
      setDragging(true);
      document.documentElement.dataset.pickerMoved = 'true';
    }
    const r = el.getBoundingClientRect();
    setPos(
      clampToViewport(
        { x: e.clientX - d.dx, y: e.clientY - d.dy },
        { w: r.width, h: r.height },
        { w: window.innerWidth, h: window.innerHeight },
      ),
    );
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    ref.current?.releasePointerCapture?.(e.pointerId);
    if (!d.moved) return;
    setDragging(false);
    // The pointerup that ends a drag is followed by a click, which would land on
    // whichever bottle the drag began on. Swallow exactly that one.
    const swallow = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    window.addEventListener('click', swallow, true);
    // Removed on the next tick rather than with `once`, so a drag that ends
    // without producing a click cannot leave a listener armed to eat an
    // unrelated one later.
    window.setTimeout(
      () => window.removeEventListener('click', swallow, true),
      0,
    );
  };

  return (
    <div
      ref={ref}
      className={`sc sc-picker${floating ? ' sc-picker-float' : ''}`}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      data-dragging={dragging ? 'true' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="group"
      aria-label="Color scheme"
    >
      {SCHEMES.map(s => (
        <button
          key={s.id}
          type="button"
          className="sc-potion"
          aria-pressed={s.id === scheme}
          // The sprite is decorative, so the button carries the name itself.
          aria-label={s.label}
          title={s.label}
          onClick={() => setScheme(s.id)}
        >
          <PixelPotion liquid={`hsl(${s.hsl})`} />
        </button>
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
      headerDir: config.getOptionalString('app.branding.templateHeaders.dir'),
      headerHeight: config.getOptionalString(
        'app.branding.templateHeaders.height',
      ),
      headerPosition: config.getOptionalString(
        'app.branding.templateHeaders.position',
      ),
    });
  }, [config]);

  useEffect(
    () =>
      listenForKonami(() =>
        document.documentElement.classList.toggle('sc-konami'),
      ),
    [],
  );

  // One navigation source for the whole app: the nav already derives the path
  // without react-router, and a second source would drift from the first.
  useRecordVisit(useCurrentPath());

  useEffect(() => {
    const sub = appTheme.activeThemeId$().subscribe(id => {
      document.documentElement.classList.toggle(
        'sc-dark',
        !!id && id.includes('dark'),
      );
    });
    return () => sub.unsubscribe();
  }, [appTheme]);

  return (
    <>
      <SchemePicker floating />
      <QuickstartHost />
    </>
  );
}

/**
 * Runs the tour once per user, and listens for a request to run it again.
 *
 * The replay button lives on Home, which is a different plugin, so it asks
 * through an event rather than a shared context — the app root and the home
 * page have no other connection.
 */
function QuickstartHost() {
  const { open, start, close } = useQuickstart();
  useEffect(() => {
    const onReplay = () => start();
    window.addEventListener('platform:quickstart', onReplay);
    return () => window.removeEventListener('platform:quickstart', onReplay);
  }, [start]);
  return open ? <Quickstart onClose={close} /> : null;
}
