import {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { appThemeApiRef, configApiRef, useApi } from '@backstage/core-plugin-api';
import { SHADCN_CSS } from './styles';
import { BRAND_DEFS } from './brands';
import { AMPHORA_VESSEL, SPRITE_SIZE, spriteRects, TEMPLE } from './sprites';
import { PixelPotion, PixelStar } from './components';
import { templateHeaderCss } from './templateHeaders';
import { listenForKonami } from './konami';
import { useCurrentPath } from './CustomNav';
import { useRecordVisit } from './useVisits';
import { Quickstart } from './quickstart/Quickstart';
import { useQuickstart } from './quickstart/useQuickstart';
import { sampleImageTone, Tone } from './imageTone';
import { isDarkTheme } from './darkMode';
import {
  AnchoredPos,
  clampToViewport,
  fromAnchored,
  PickerPos,
  PICKER_POS_KEY,
  readStoredPos,
  toAnchored,
} from './pickerPos';
import { CARD_LIGHT } from './statusTokens';
import { ALL_ROUTE_CLASSES, routeClassFor } from './routeClass';
import { resolveHeaderImages } from './headerImages';

/**
 * Pointer travel before a press becomes a drag.
 *
 * Below it the press is still a click on a bottle. Without a threshold every
 * drag that happens to start on a potion would also change the colour scheme,
 * which is worse than the occlusion this feature exists to fix.
 */
const DRAG_THRESHOLD = 4;

/**
 * How long the cast runs before the pick is applied.
 *
 * Must match the sc-cast keyframes in styles.ts: the scheme changing is what
 * ends the animation, so a shorter value here cuts it off mid-frame.
 */
const CAST_MS = 360;

/** The two foreground tones a scheme can use, and each other's shade. */
const WHITE = '0 0% 100%';
const INK = '240 10% 8%';

/**
 * A picker entry. `mode` marks the one that carries a whole palette rather than
 * an accent — see greek.ts. Declared explicitly rather than inferred, so that
 * `s.mode` is readable on every element instead of only the one that sets it.
 */
type Scheme = {
  id: string;
  label: string;
  hsl: string;
  fg: string;
  mode?: Mode;
};

/**
 * The modes a potion can carry, and the source of the `sc-<mode>` root classes.
 *
 * Listed rather than inferred so `applyScheme` can clear every one of them on
 * each pick: a mode class left behind is a second palette still applying, and
 * which one wins is then decided by stylesheet order rather than by the click.
 */
const MODES = [
  'greek',
  'foudre',
  'slush',
  'spiderverse',
  'newform',
  'hermes',
  'papers',
  'discord',
  'github',
  'claude',
  'dairy',
  'obsidian',
  'hanami',
  'nightshade',
  'rimefast',
] as const;
type Mode = (typeof MODES)[number];

// Saturated toward NES-era values. `fg` is the text colour that sits on the
// accent: white where it clears 4.5:1, near-black where it doesn't. Green and
// amber are the reason this field exists — darkening them enough for white text
// would have turned them to mud. Ratios are measured, see SchemeRoot.test.ts.
export const SCHEMES: Scheme[] = [
  // Two design systems, each rendered in this app's furniture. Ids are the key
  // a browser has already persisted and never change once published.
  {
    id: 'greek',
    label: 'Ancient Greek',
    hsl: '10 68% 34%',
    fg: WHITE, // 7.94
    mode: 'greek',
  },
  {
    id: 'foudre',
    label: 'Agence Foudre',
    hsl: '330 68% 38%',
    fg: WHITE, // 6.80
    mode: 'foudre',
  },
  {
    id: 'slush',
    label: 'Slush',
    hsl: '213 100% 43%',
    fg: WHITE, // 4.62
    mode: 'slush',
  },
  {
    id: 'spiderverse',
    label: 'Spider-Verse',
    hsl: '355 82% 42%',
    fg: WHITE, // 7.05
    mode: 'spiderverse',
  },
  {
    id: 'hanami',
    label: 'Hanami',
    hsl: '355 59% 39%',
    fg: '45 100% 98%', // 7.36 — gofun, the mode's own card colour
    mode: 'hanami',
  },
  {
    id: 'nightshade',
    label: 'Nightshade',
    hsl: '142 67% 66%',
    fg: '240 10% 8%', // 11.62 — witch green is far too light to take white
    mode: 'nightshade',
  },
  {
    id: 'rimefast',
    label: 'Rimefast',
    hsl: '41 75% 51%',
    fg: '240 10% 8%', // 8.46 — orpiment is far too light to take white
    mode: 'rimefast',
  },
  // The table-driven brand modes, from brands.ts.
  ...BRAND_DEFS.map(b => ({
    id: b.id,
    label: b.label,
    hsl: b.bottle,
    fg: b.bottleFg,
    mode: b.id as Mode,
  })),
];

/**
 * What a browser with nothing stored gets.
 *
 * Resolved through the shelf rather than used raw, so removing or renaming a
 * scheme degrades to the first bottle instead of leaving every new visitor on
 * an id that no longer exists.
 */
const DEFAULT_SCHEME_ID = 'obsidian';
const defaultScheme = (): Scheme =>
  SCHEMES.find(s => s.id === DEFAULT_SCHEME_ID) ?? SCHEMES[0];

/**
 * Branding from `app.branding`, handed over once by {@link SchemeRoot}.
 * `applyScheme` runs at module load — before React, so before configApi exists —
 * hence this module-level relay rather than a prop.
 */
let branding: {
  mark?: string;
  favicon?: string;
  /** Explicit runtime URLs; when present they override headerDir. */
  headerImages?: string[];
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
/** `--sc-radius` (6px) over the 26px `.sc-nav-mark` tile. */
const ICON_RADIUS = 6 / 26;

/**
 * The accent tile every generated icon sits on — the same object as
 * `.sc-nav-mark` and `.sc-login-mark` in styles.ts, painted to match.
 *
 * Those use `linear-gradient(135deg, primary, primary / .6)`, and the far stop
 * is the accent at 60% *alpha*: what tints that corner is the surface behind
 * the tile, `hsl(var(--sc-card))`. A favicon has no backdrop, so an alpha stop
 * alone would leave the corner translucent over whatever the browser's tab
 * strip happens to be. Painting the card colour underneath first and then the
 * same gradient over it composites to the identical colour — and it tracks
 * light/dark for free, because --sc-card is read live.
 */
function drawTile(g: CanvasRenderingContext2D, accentHsl: string) {
  const fill = () => {
    if (typeof g.roundRect === 'function') {
      g.beginPath();
      g.roundRect(0, 0, ICON_SIZE, ICON_SIZE, Math.round(ICON_SIZE * ICON_RADIUS));
      g.fill();
    } else {
      g.fillRect(0, 0, ICON_SIZE, ICON_SIZE); // jsdom, and Safari before 16.4
    }
  };
  g.fillStyle = `hsl(${cardHsl()})`;
  fill();
  const grad = g.createLinearGradient(0, 0, ICON_SIZE, ICON_SIZE); // 135deg
  grad.addColorStop(0, `hsl(${accentHsl})`);
  grad.addColorStop(1, `hsl(${accentHsl} / .6)`);
  g.fillStyle = grad;
  fill();
}

/**
 * The live value of `--sc-card`, so the tile follows a light/dark switch
 * without this module having to know which scheme is active. Falls back to the
 * light value that `:root` declares, which is what an unresolved custom
 * property would have meant anyway.
 */
function cardHsl(): string {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue('--sc-card')
      .trim() || CARD_LIGHT
  );
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
  // EVERY icon link, not just the first. The Backstage index.html declares
  // three (`icon` -> favicon.ico, plus sized 16x16 and 32x32 PNGs) and a
  // `shortcut icon`. A browser picks by `sizes`, so an explicitly sized
  // candidate beats an unsized one — updating only the first left the stock
  // favicon-32x32.png winning the tab while the sidebar mark was correct.
  // `~=` matches a whitespace-separated list, so it catches `shortcut icon`
  // while still excluding `apple-touch-icon` and `mask-icon`.
  const links = document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]');
  if (!links.length) return;
  const setHref = (href: string) => links.forEach(l => (l.href = href));
  if (branding.favicon) {
    setHref(branding.favicon);
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const g = canvas.getContext('2d');
  if (!g) return;

  const publish = () => {
    try {
      setHref(canvas.toDataURL('image/png'));
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
  // Falls back through the shelf, not to a hard-coded id: a scheme removed
  // from it must not leave a persisted pick pointing at nothing.
  const id = scheme || stored || defaultScheme().id;
  const s = SCHEMES.find(x => x.id === id) ?? defaultScheme();
  // A mode potion carries a whole palette rather than an accent. Everything it
  // changes hangs off one class — see greek.ts for why specificity makes that
  // enough, and sc-konami for the same mechanism used as an easter egg.
  // Every mode is toggled on every pick, not just the chosen one: setting the
  // new class without clearing the old leaves two whole palettes fighting, and
  // the loser is decided by source order rather than by what was clicked.
  for (const m of MODES) {
    document.documentElement.classList.toggle(`sc-${m}`, s.mode === m);
  }
  ensureStyle(
    'sc-accent',
    // --sc-primary-shade is the opposite of the foreground: it is what text on
    // the header art is outlined with, so light text gets a dark edge and dark
    // text a light one.
    `:root{--sc-primary:${s.hsl};--sc-ring:${s.hsl};--sc-primary-fg:${s.fg};` +
      `--sc-primary-shade:${s.fg === WHITE ? INK : WHITE}}`,
  );
  // Empty when no images are supplied, which leaves the pixel-art headers.
  // Config-supplied URLs win over the build-time glob, so header art can be
  // swapped by mounting files into dist/branding without rebuilding the image.
  const headerImages = resolveHeaderImages(
    { images: branding.headerImages, dir: branding.headerDir },
    brandingImages,
  );
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
  // The record's own hsl is not necessarily what is painted: a mode potion
  // sets --sc-primary from CSS, which wins on specificity. Reading the
  // computed value is what keeps the tab icon in step with the page — the
  // same reason cardHsl() reads computed style rather than a constant.
  const root = getComputedStyle(document.documentElement);
  updateFavicon(
    root.getPropertyValue('--sc-primary').trim() || s.hsl,
    root.getPropertyValue('--sc-primary-fg').trim() || s.fg,
  );
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
 * `floating` is the corner shelf that follows you around the app: fixed
 * placement, draggable, one bottle plus a tray. `compact` is that last part on
 * its own — the box the sign-in card mounts, in the flow of the card and
 * undraggable. The card is the only place the floating one is suppressed, so
 * there is never a second shelf stacked on the first.
 */
export function SchemePicker({
  floating,
  compact,
}: { floating?: boolean; compact?: boolean } = {}) {
  // `floating` used to mean three things at once: one bottle plus a tray, a
  // fixed position, and drag. The sign-in card wants the first without the
  // other two — its shelf is inside a 296px card and cannot grow.
  const collapsed = floating || compact;
  const [scheme, setScheme] = useState(
    () =>
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem('platform-scheme')) ||
      defaultScheme().id,
  );
  // Closed, the shelf shows only the bottle that is actually equipped. Same
  // shape as the sidebar's collapse (CustomNav.tsx): lazy read on mount, and a
  // write-back effect. Unlike the nav there is no root-level data attribute —
  // the collapse never leaves this component's own subtree, so a class on its
  // root div is the whole mechanism.
  // Expanded is the default: the shelf is what exists today, and the closed
  // state is an opt-in.
  // The floating shelf holds exactly one bottle: the equipped one, which is
  // also the control that opens the inventory. There is no expand button and
  // no collapsed state to remember — a shelf of eleven unlabelled 26px bottles
  // was the thing the inventory replaced.
  // The id mid-cast, if any. A pick is applied when its little animation ends
  // rather than on the press, so the bottle is seen to be taken off the shelf.
  const [casting, setCasting] = useState<string | null>(null);
  const castTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The inventory popover. Deliberately not persisted: it is a menu, and a menu
  // that reopens itself on every page load is a bug, not a preference.
  // ponytail: closed by its own button or by Escape only — no outside-click
  // listener. Add one if it starts getting left open behind other chrome.
  const [inv, setInv] = useState(false);
  const invBtn = useRef<HTMLButtonElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<PickerPos | undefined>(() => {
    if (typeof localStorage === 'undefined') return undefined;
    const stored = readStoredPos(localStorage.getItem(PICKER_POS_KEY));
    // Set during the initial render rather than in an effect: an effect runs
    // after first paint, so the picker would be drawn in its CSS corner and
    // then visibly jump to the stored position.
    if (stored && typeof document !== 'undefined') {
      document.documentElement.dataset.pickerMoved = 'true';
    }
    return stored;
  });
  const [dragging, setDragging] = useState(false);
  // Live drag bookkeeping. A ref, not state: it changes on every pointermove and
  // nothing renders from it.
  // The corner the last drop anchored to. Recomputed on drop, consumed on
  // resize: absolute top-left coordinates meant a picker parked bottom-right
  // drifted into the middle of a narrowed window, because it was still on
  // screen and clampToViewport had nothing to correct.
  const anchor = useRef<AnchoredPos | null>(null);
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

  useEffect(
    () => () => {
      if (castTimer.current) clearTimeout(castTimer.current);
    },
    [],
  );

  useEffect(() => {
    // Escape closes the inventory and hands focus back to the button that
    // opened it, rather than dropping it at the top of the document. Bound to
    // the window rather than to the panel: the panel is a plain grouping div,
    // so a key listener on it would only ever fire while focus was already
    // inside — and Escape is expected to work from wherever the pointer left
    // you.
    if (!inv) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setInv(false);
      invBtn.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inv]);

  useEffect(() => {
    if (!floating || !pos) return;
    // Set here as well as in the state initialiser, which covers a position
    // that arrives after mount rather than from storage.
    document.documentElement.dataset.pickerMoved = 'true';
    // Seed the anchor from a restored position, so the first resize after a
    // reload behaves the same as one straight after a drag.
    if (!anchor.current && ref.current) {
      const r = ref.current.getBoundingClientRect();
      anchor.current = toAnchored(
        { x: r.left, y: r.top },
        { w: r.width, h: r.height },
        { w: window.innerWidth, h: window.innerHeight },
      );
    }
    try {
      localStorage.setItem(PICKER_POS_KEY, JSON.stringify(pos));
    } catch {
      /* ignore */
    }
  }, [floating, pos]);

  useEffect(() => {
    if (!floating) return undefined;
    const onResize = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Only reposition a picker that has been moved; an untouched one is held
      // by its CSS corner and needs nothing.
      const a = anchor.current;
      if (!a) return;
      setPos(
        fromAnchored(
          a,
          { w: r.width, h: r.height },
          { w: window.innerWidth, h: window.innerHeight },
        ),
      );
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [floating]);

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
    // Nothing is committed here on purpose. Seeding the position on the press
    // meant the very first press on an untouched shelf ran a state update
    // between pointerdown and click, and the re-render swallowed that click:
    // the first thing a user clicked after every reload did nothing, and only
    // the second worked. Measured in the browser — jsdom fires click without a
    // preceding pointer sequence, so the suite never saw it.
    // Deferring costs nothing. onPointerMove sets the position the moment a
    // press becomes a drag, and the effect on `pos` writes data-picker-moved
    // AFTER that commit — so the corner anchor is dropped in the frame the
    // inline left/top already exist, which is the ordering the seeding was
    // hand-rolling in the first place.
    // Capture is taken in onPointerMove, once this is actually a drag — NOT
    // here. While a pointer is captured, the spec retargets the following
    // `click` to the capturing element, so capturing on every press sent every
    // potion's click to this container instead of the button, and the colour
    // could never be changed. A plain click must involve no capture at all.
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el || d.id !== e.pointerId) return;
    // No button held: this is a hover, not a drag. pointerup and pointercancel
    // are bound to the element, so a press that starts here and releases
    // somewhere else never clears the bookkeeping — and every later hover then
    // moved the shelf as though the drag had never ended. `buttons` is the one
    // signal that is correct no matter which events were missed.
    if (e.buttons === 0) {
      drag.current = null;
      setDragging(false);
      return;
    }
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.ox, e.clientY - d.oy) < DRAG_THRESHOLD)
        return;
      d.moved = true;
      setDragging(true);
      // Now that it is a drag, keep it alive if the pointer outruns the box.
      // Retargeting the click no longer matters — endDrag swallows it anyway.
      el.setPointerCapture?.(e.pointerId);
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
    const el = ref.current;
    el?.releasePointerCapture?.(e.pointerId);
    if (!d.moved) return;
    // Remember which corner it was dropped nearest, so a later resize keeps the
    // same visual relationship instead of preserving raw top-left coordinates.
    if (el) {
      const r = el.getBoundingClientRect();
      anchor.current = toAnchored(
        { x: r.left, y: r.top },
        { w: r.width, h: r.height },
        { w: window.innerWidth, h: window.innerHeight },
      );
    }
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

  // Collapsed, not floating: the sign-in card mounts the same one-bottle box
  // without the fixed placement or the drag, because a flat shelf of every
  // bottle does not fit a 296px card and got worse with each potion added.
  // A pick that no longer exists degrades to the first bottle rather than
  // rendering nothing — the same rule applyScheme() uses.
  const equipped = SCHEMES.find(s => s.id === scheme) ?? defaultScheme();
  const shelf = collapsed ? [equipped] : SCHEMES;

  /**
   * Take a bottle off the shelf: play its cast, then equip.
   *
   * The delay is the animation and nothing else, so it is skipped outright when
   * the reader has asked for less motion — waiting 360ms to apply a colour
   * nobody is going to see move is a worse experience, not a gentler one.
   */
  const equip = (id: string) => {
    const reduced =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setScheme(id);
      setInv(false);
      return;
    }
    setCasting(id);
    if (castTimer.current) clearTimeout(castTimer.current);
    castTimer.current = setTimeout(() => {
      setCasting(null);
      setScheme(id);
      setInv(false);
    }, CAST_MS);
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
      {shelf.map((s, i) => (
        <button
          key={s.id}
          ref={collapsed ? invBtn : undefined}
          type="button"
          className={`sc-potion${collapsed ? ' sc-picker-toggle' : ''}`}
          // Staggers the rattle so the bottles move out of phase. In unison
          // they read as the shelf vibrating rather than as loose objects.
          style={{ ['--sc-i' as string]: i } as CSSProperties}
          aria-pressed={s.id === scheme}
          // On the shelf this bottle is the way into the inventory, so it says
          // so; in the sign-in card it is still just a swatch that picks.
          {...(collapsed
            ? { 'aria-expanded': inv, 'aria-controls': 'sc-picker-inv' }
            : {})}
          // The sprite is decorative, so the button carries the name itself.
          aria-label={
            collapsed ? `${s.label} — open potion inventory` : s.label
          }
          title={collapsed ? `${s.label} — open potion inventory` : s.label}
          onClick={() => (collapsed ? setInv(v => !v) : setScheme(s.id))}
        >
          <PixelPotion
            liquid={`hsl(${s.hsl})`}
            sprite={s.mode === 'greek' ? AMPHORA_VESSEL : undefined}
          />
          {/* Sparkles on the equipped bottle. Decoration and nothing else: what
              is equipped is carried by aria-pressed, by the label, and by being
              the only bottle on the shelf. Drawn at full opacity by default, so
              under reduced motion they simply sit there instead of blinking. */}
          {collapsed && (
            <span className="sc-potion-stars" aria-hidden="true">
              {[0, 1, 2].map(n => (
                <PixelStar
                  key={n}
                  className={`sc-potion-star sc-potion-star-${n}`}
                />
              ))}
            </span>
          )}
        </button>
      ))}
      {collapsed && inv && (
        <div
          id="sc-picker-inv"
          className="sc-picker-inv"
          role="group"
          aria-label="Potion inventory"
        >
          <ul className="sc-inv-list">
            {SCHEMES.map(s => (
              <li key={s.id} className="sc-inv-row">
                {/* The bottle IS the control. No second equip button beside it:
                    the row was a swatch, a name and a button all saying the
                    same thing, and the name is on the button already. */}
                <button
                  type="button"
                  className={`sc-inv-potion${
                    casting === s.id ? ' sc-inv-casting' : ''
                  }`}
                  aria-pressed={s.id === scheme}
                  aria-label={s.label}
                  title={s.label}
                  onClick={() => equip(s.id)}
                >
                  <PixelPotion
                    liquid={`hsl(${s.hsl})`}
                    sprite={s.mode === 'greek' ? AMPHORA_VESSEL : undefined}
                  />
                  {casting === s.id && (
                    <span className="sc-cast-stars" aria-hidden="true">
                      {[0, 1, 2, 3].map(n => (
                        <PixelStar
                          key={n}
                          className={`sc-cast-star sc-cast-star-${n}`}
                        />
                      ))}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
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
      headerImages: config.getOptionalStringArray(
        'app.branding.templateHeaders.images',
      ),
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
  const path = useCurrentPath();
  useRecordVisit(path);

  useEffect(() => {
    // A class per route, so CSS can scope a rule to one page. Material-UI drops
    // a makeStyles name in production builds, so no selector can name the
    // scaffolder's card grid — only Mui* classes survive, and those are far too
    // general to style on their own. Route scoping makes them specific again.
    const root = document.documentElement;
    root.classList.remove(...ALL_ROUTE_CLASSES);
    const cls = routeClassFor(path);
    if (cls) root.classList.add(cls);
  }, [path]);

  useEffect(() => {
    // `activeThemeId$` emits undefined until someone picks a theme, and
    // Backstage then renders whichever variant matches the system. The id alone
    // therefore cannot decide which tokens to use — consulting the media query
    // as well is what keeps our background on the same side as MUI's text.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    let themeId: string | undefined;
    const apply = () => {
      document.documentElement.classList.toggle(
        'sc-dark',
        isDarkTheme(themeId, mq.matches),
      );
      // The tab icon's tile is composited over --sc-card, which just changed
      // sides. Without this the icon keeps the previous mode's tile until the
      // next scheme pick.
      applyScheme();
    };
    const sub = appTheme.activeThemeId$().subscribe(id => {
      themeId = id;
      apply();
    });
    // Only has an effect while the theme is unset, but subscribing
    // unconditionally is simpler than tracking when that is true.
    mq.addEventListener('change', apply);
    return () => {
      sub.unsubscribe();
      mq.removeEventListener('change', apply);
    };
  }, [appTheme]);

  return (
    <>
      <SchemePicker floating />
      <ModeArt />
      <QuickstartHost />
    </>
  );
}

/** Nine petals: enough for a drift, few enough that none of them overlap. */
const PETALS = Array.from({ length: 9 }, (_, i) => i);

/**
 * The host for the animated mode ornaments.
 *
 * Mounted unconditionally and hidden by CSS rather than branched on the picked
 * scheme, because `applyScheme` runs before React and writes a class on the
 * root element — there is no React state holding the current mode, and adding
 * one would give the ornament a second source of truth that can disagree with
 * the class actually applied. styles.ts hides every child; each mode sheet
 * turns on the one it draws.
 *
 * Decoration only, so aria-hidden: a screen reader has nothing to gain from
 * nine falling petals, and every one of these is behind
 * prefers-reduced-motion.
 */
function ModeArt() {
  return (
    <div className="sc-mode-art" aria-hidden="true">
      <div className="sc-sakura">
        {PETALS.map(i => (
          <i key={i} />
        ))}
      </div>
      <div className="sc-moon" />
      <div className="sc-rune-rule" />
    </div>
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
