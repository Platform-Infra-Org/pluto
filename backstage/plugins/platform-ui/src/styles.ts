// A self-contained shadcn-style design layer (tokens + component classes),
// injected globally. Colors are HSL triplets in CSS variables so the color
// picker can swap the accent live. Scoped under `.sc` so it never fights
// Backstage's own MUI styles outside our pages.
export const SHADCN_CSS = `
/* Self-hosted so the CSP (font-src 'self') is satisfied and the app works
   offline. Latin subset, 3.4KB. SIL OFL — see public/fonts/LICENSE.txt. */
@font-face {
  font-family: 'Silkscreen';
  src: url('/fonts/silkscreen.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
.sc, .sc * { box-sizing: border-box; }
/* Tokens live on :root so BOTH our .sc components and the MUI/Backstage reskin
   below read the same variables (and follow the color picker). */
:root {
  /* 8-bit, softened: the shadow keeps its offset and its hard edge — that is
     the pixel signature — but drops most of its weight, and corners are rounded
     rather than square. Chunky 2px outlines stay. */
  --sc-radius: 6px;
  --sc-radius-sm: 4px;
  --sc-border-w: 2px;
  --sc-shadow: 3px 3px 0 hsl(var(--sc-fg) / .16);
  --sc-font-pixel: 'Silkscreen', ui-monospace, SFMono-Regular, monospace;
  --sc-unit: 4px;
  --sc-nav-w: 240px;
  --sc-bg: 240 10% 98%;
  --sc-fg: 240 10% 12%;
  --sc-card: 0 0% 100%;
  --sc-card-fg: 240 10% 12%;
  --sc-muted: 240 5% 96%;
  --sc-muted-fg: 240 4% 46%;
  --sc-border: 240 6% 90%;
  --sc-input: 240 6% 90%;
  --sc-primary: 250 52% 55%;
  --sc-primary-fg: 0 0% 100%;
  --sc-ring: 250 52% 55%;
  --sc-accent: 240 5% 95%;
  --sc-accent-fg: 240 6% 20%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
}
:root.sc-dark {
  --sc-bg: 240 10% 3.9%;
  --sc-fg: 0 0% 98%;
  --sc-card: 240 10% 6.5%;
  --sc-card-fg: 0 0% 98%;
  --sc-muted: 240 3.7% 15.9%;
  --sc-muted-fg: 240 5% 64.9%;
  --sc-border: 240 3.7% 16.9%;
  --sc-input: 240 3.7% 16.9%;
  --sc-accent: 240 3.7% 15.9%;
  --sc-accent-fg: 0 0% 98%;
}
.sc, .sc * {
  /* Full arcade: the pixel face is the base font everywhere, not only on
     chrome. 12px is the floor — Silkscreen drops strokes below it. */
  font-family: var(--sc-font-pixel);
  color: hsl(var(--sc-fg));
}
.sc, .sc * { font-size: max(12px, 1em); }

/* ===== Reskin the Backstage/MUI native pages (catalog, scaffolder, search,
   settings…) to the shadcn look, driven by the same tokens + color picker. =====

   UPGRADE STABILITY: we target the most stable hook available for each element:
   - MUI global classes (.MuiButton-*, .MuiCard-*, .MuiTable-*, …)  — public API.
   - Backstage UI (bui) CSS variables (--bui-*) + [data-variant]     — public API.
   - react-flow classes (.react-flow__*)                            — public API.
   These carry the bulk of the reskin and survive upgrades.
   Backstage's own components (Header, InfoCard, ItemCardHeader, SidebarPage)
   are styled in theme.tsx through their published override keys and slot names,
   which are typed — a renamed slot fails tsc rather than silently unstyling a
   page. What remains marked [FRAGILE] here is the catalog/dependency graph,
   which a plugin styles privately and which exposes no override key. */

/* [stable: bui tokens] retarget bui's accent/link/focus to the picker. These
   CSS variables are the primary, upgrade-safe mechanism for bui components. */
:root {
  --bui-bg-solid: hsl(var(--sc-primary));
  --bui-bg-solid-hover: hsl(var(--sc-primary) / 0.92);
  --bui-bg-solid-pressed: hsl(var(--sc-primary) / 0.85);
  --bui-fg-link: hsl(var(--sc-primary));
  --bui-border-focus: hsl(var(--sc-primary));
}
/* [stable: data-variant] primary bui buttons resolve their own token — the
   [data-variant] attribute is a stable hook; the class fragment is only a scope. */
[data-variant="primary"][class*="bui-Button"] { background-color: hsl(var(--sc-primary)) !important; color: hsl(var(--sc-primary-fg)) !important; }
[data-variant="primary"][class*="bui-Button"]:hover { background-color: hsl(var(--sc-primary) / 0.9) !important; }
[class*="bui-ButtonLink"], [class*="bui-Button"] { border-radius: var(--sc-radius) !important; }
body, [class*="BackstageContent"] { background: hsl(var(--sc-bg)); } /* body = stable companion */
/* cards / surfaces */
/* cards/surfaces via stable MUI classes. The InfoCard header is styled in the
   theme (BackstageInfoCard.styleOverrides.header). */
.MuiCard-root, .MuiPaper-elevation1, .MuiPaper-elevation2, .MuiAccordion-root {
  background-color: hsl(var(--sc-card)) !important; color: hsl(var(--sc-fg));
  border: var(--sc-border-w) solid hsl(var(--sc-border)) !important;
  box-shadow: var(--sc-shadow) !important;
  border-radius: var(--sc-radius) !important; }
.MuiInputBase-root, .MuiOutlinedInput-root { border-radius: var(--sc-radius) !important; }
/* Popups we do not render ourselves — Backstage's Login Required prompt, the
   unregister confirmation — come out of the canon dialog primitive with square
   corners and no edge, which reads as a foreign box dropped on the page. Same
   surface treatment as every other card. MuiDialog-paper covers the plugins
   still on MUI dialogs. */
[class*="bui-DialogInner"], .MuiDialog-paper {
  background-color: hsl(var(--sc-card)) !important;
  border: var(--sc-border-w) solid hsl(var(--sc-border)) !important;
  border-radius: var(--sc-radius) !important;
  overflow: hidden; /* so the header and footer edges follow the corners */
  /* [flare] The command window: a double rule with a gap, the way an RPG menu
     frames a decision. Three stacked shadows — a card-coloured ring for the
     gap, the outer rule, then the hard offset every surface already has. No
     image, no border-image, and it composes with the rounded corner.
     Windows only, never cards: every surface double-framed is a page of noise,
     and the difference between a panel of content and a window demanding an
     answer is worth keeping. */
  box-shadow:
    0 0 0 2px hsl(var(--sc-card)),
    0 0 0 4px hsl(var(--sc-fg) / .85),
    var(--sc-shadow) !important;
}
.MuiOutlinedInput-notchedOutline { border-color: hsl(var(--sc-input)) !important; }
/* [flare] Loading is a loading screen. Backstage's Progress is MUI LinearProgress,
   so this pair reaches every native page: catalog, scaffolder, search, techdocs.
   The bar is 4px cells, and MUI's own transform transition has to go or it
   interpolates between the steps and the marching turns back into a slide. */
.MuiLinearProgress-root {
  height: 12px !important;
  background: hsl(var(--sc-muted)) !important;
  border: var(--sc-border-w) solid hsl(var(--sc-border));
  border-radius: var(--sc-radius);
  overflow: hidden;
}
/* MUI drives the indeterminate bar by animating a transform on a partial-width
   element, on a cubic-bezier. All of it goes: the bar fills the track and the
   cells do the moving, which is how a loading bar looked before easing existed. */
.MuiLinearProgress-bar {
  /* Transparent, not accent: the gaps have to show the track or the cells are
     invisible — a half-alpha accent over a solid accent is just the accent. */
  background-color: transparent !important;
  transition: none !important;
  transform: none !important;
  width: 100% !important;
  animation: none !important;
  background-image: repeating-linear-gradient(90deg,
    hsl(var(--sc-primary)) 0 8px, transparent 8px 16px);
}
/* The catalog spins a CircularProgress rather than the linear one, and a
   smoothly rotating ring is the least 8-bit object in the app. The svg goes and
   a square block takes its place, turned in eighths by the motion block below.
   The element itself stays: it carries role="progressbar". */
.MuiCircularProgress-root {
  width: 20px !important; height: 20px !important;
  display: inline-flex !important; align-items: center; justify-content: center;
  /* MUI rotates the root smoothly and continuously. Left on, it compounds with
     the stepped turn below and the block wobbles instead of flipping frames. */
  animation: none !important;
  transform: none !important;
}
.MuiCircularProgress-root svg { display: none; }
.MuiCircularProgress-root::after {
  content: '';
  width: 14px; height: 14px;
  background: hsl(var(--sc-primary));
  border: var(--sc-border-w) solid hsl(var(--sc-fg) / .35);
}
/* Every native surface takes the pixel face too — headings, body, table cells,
   inputs, menus, tooltips. The universal selector is deliberate: the goal is
   that no regular-font text survives anywhere in the app. */
body, body *, input, select, textarea, button, optgroup {
  font-family: var(--sc-font-pixel) !important;
}
/* Icon fonts are glyph lookups, not text — leave them alone or every icon
   turns into a letter. */
.material-icons, .material-icons-outlined, .MuiIcon-root, [class*="material-icons"],
.MuiSvgIcon-root, .MuiSvgIcon-root * {
  font-family: 'Material Icons' !important;
}
.MuiSvgIcon-root { font-family: inherit !important; }

/* ===== Native Backstage pages wear the same 8-bit chrome =====
   Catalog, scaffolder, search and settings are built from MUI components we
   don't own, so they are matched by MUI's global classes — the public, stable
   hook. Pixel type goes on chrome (buttons, tabs, table headers, filter labels,
   chips, headings); table bodies and descriptions stay Inter, exactly as on our
   own pages. */
.MuiButton-root, .MuiTab-root, .MuiChip-root, .MuiTableCell-head,
.MuiTableSortLabel-root, .MuiFormLabel-root, .MuiInputLabel-root,
.MuiTypography-h1, .MuiTypography-h2, .MuiTypography-h3,
.MuiTypography-h4, .MuiTypography-h5, .MuiTypography-h6,
.MuiCardHeader-title, .MuiDialogTitle-root, .MuiAlertTitle-root,
[class*="BackstageContentHeader-title"], [class*="BackstageItemCardHeader"],
[class*="bui-Button"], [class*="bui-HeaderTitle"], [class*="bui-HeaderBreadcrumb"],
[class*="BackstageAutocomplete-label"] {
  font-family: var(--sc-font-pixel) !important;
  text-transform: uppercase !important;
  letter-spacing: 0 !important;
  font-weight: 400 !important;
}
/* Silkscreen is a bitmap face — it loses strokes below 12px. */
.MuiTab-root, .MuiChip-root, .MuiTableCell-head, .MuiTableSortLabel-root,
.MuiFormLabel-root, .MuiInputLabel-root, [class*="bui-Button"],
[class*="BackstageAutocomplete-label"] {
  font-size: 12px !important;
}
/* The BUI page title is the biggest type on a native page. */
[class*="bui-HeaderTitle"] { font-size: 22px !important; }
.MuiButton-root { font-size: 13px !important; }
/* Heading scale for the pixel face. Silkscreen sets much wider than Inter at
   the same size, so Backstage's native scale (28-34px) wraps a single sentence
   over three lines. These are the equivalent optical sizes. */
h1, .MuiTypography-h1 { font-size: 22px !important; line-height: 1.35 !important; }
h2, .MuiTypography-h2 { font-size: 18px !important; line-height: 1.35 !important; }
h3, .MuiTypography-h3, .MuiCardHeader-title,
[class*="BackstageInfoCard-header"] * { font-size: 16px !important; }
h4, h5, h6, .MuiTypography-h4, .MuiTypography-h5, .MuiTypography-h6 { font-size: 14px !important; }
[class*="BackstageContentHeader-title"] { font-size: 18px !important; line-height: 1.35 !important; }
.MuiDialogTitle-root { font-size: 16px !important; }

/* Native buttons get the same press as ours: the shadow collapses and the
   button moves into the space it occupied.

   Element-qualified on purpose: bui renders a bui-ButtonContent span *inside*
   bui-Button, and a bare [class*="bui-Button"] matches both, drawing the border
   and shadow twice — the inner box. */
.MuiButton-root, button[class*="bui-Button"], a[class*="bui-Button"] {
  border-radius: var(--sc-radius) !important;
  border: var(--sc-border-w) solid hsl(var(--sc-fg) / .8) !important;
  box-shadow: var(--sc-shadow) !important;
  transition: none !important;
}
.MuiButton-root:active:not(.Mui-disabled),
button[class*="bui-Button"]:active, a[class*="bui-Button"]:active {
  transform: translate(2px, 2px);
  box-shadow: none !important;
}
.MuiButton-text, .MuiButton-textPrimary, .MuiIconButton-root {
  border: none !important; box-shadow: none !important;
}
/* Never a border or shadow on the inner content span. */
[class*="bui-ButtonContent"], [class*="bui-ButtonIcon"] {
  border: none !important;
  box-shadow: none !important;
}
.MuiChip-root {
  border: var(--sc-border-w) solid hsl(var(--sc-border)) !important;
  border-radius: var(--sc-radius-sm) !important;
  /* Silkscreen is wider than Inter, so a tag that used to fit its column now
     overflows. Cap the chip and ellipsise rather than letting it escape. */
  max-width: 100%;
  font-size: 11px !important;
}
.MuiChip-label { overflow: hidden; text-overflow: ellipsis; }
.MuiOutlinedInput-notchedOutline { border-width: var(--sc-border-w) !important; }
.MuiTableCell-head { color: hsl(var(--sc-muted-fg)) !important; }
/* Silkscreen is wider than Inter, so dense table text hits Backstage's own
   word-break sooner and snaps mid-word. 12px is the floor for this face and
   buys back roughly a fifth of the line. */
.MuiTableCell-body, .MuiTableCell-body * { font-size: 12px !important; }
/* Focus is a hard offset outline everywhere, never a glow. */
.MuiButton-root:focus-visible, .MuiTab-root:focus-visible,
.MuiIconButton-root:focus-visible, [class*="bui-Button"]:focus-visible {
  outline: var(--sc-border-w) solid hsl(var(--sc-ring)) !important;
  outline-offset: 2px;
}

/* accent — buttons, links, tabs, selection (all follow the picker) */
.MuiButton-root { box-shadow: var(--sc-shadow) !important; }
.MuiButton-containedPrimary { background-color: hsl(var(--sc-primary)) !important; color: hsl(var(--sc-primary-fg)) !important; }
.MuiButton-outlinedPrimary, .MuiButton-textPrimary { color: hsl(var(--sc-primary)) !important; }
.MuiLink-root, a.MuiTypography-colorPrimary, .MuiTypography-colorPrimary { color: hsl(var(--sc-primary)) !important; }
.MuiTabs-indicator { background-color: hsl(var(--sc-primary)) !important; }
.MuiTab-root { text-transform: none !important; font-weight: 600 !important; }
.MuiTab-textColorPrimary.Mui-selected, .Mui-selected { color: hsl(var(--sc-primary)) !important; }
.MuiSwitch-colorPrimary.Mui-checked { color: hsl(var(--sc-primary)) !important; }
.MuiCheckbox-colorPrimary.Mui-checked, .MuiRadio-colorPrimary.Mui-checked { color: hsl(var(--sc-primary)) !important; }
.MuiChip-root { border-radius: var(--sc-radius) !important; }
/* ===== Graphs: React-Flow look — dark canvas + dots, compact dark nodes =====
   Our own graphs use the stable .react-flow__* API (below). These rules restyle
   Backstage's built-in catalog/dependency graph SVG.
   [FRAGILE: PluginCatalogGraph* / DependencyGraph* — no stable hook; re-derive
   on upgrade, or drop if the built-in graph is no longer surfaced.] */
/* The graph svg IS the dark dotted canvas and fills its container (no smaller
   inner box inside a larger canvas). */
svg:has([class*="PluginCatalogGraph"]), svg:has([class*="DependencyGraphDefaultNode"]) {
  background-color: #0a0a10 !important;
  background-image: radial-gradient(circle, rgba(255,255,255,.16) 1px, transparent 1px) !important;
  background-size: 17px 17px !important; border-radius: var(--sc-radius);
  width: 100% !important; display: block !important; }
[class*="PluginCatalogGraphCustomNode-node"], [class*="DependencyGraphDefaultNode-node"] {
  fill: #17171f !important; stroke: #32303e !important; rx: 8 !important; ry: 8 !important; }
[class*="PluginCatalogGraphCustomLabel-text"], [class*="DependencyGraphDefaultNode-text"] {
  fill: #e7e7ef !important; font-size: 11px !important; font-weight: 500 !important; }
[class*="PluginCatalogGraph"] path, [class*="DependencyGraph"] path[marker-end], [class*="Edge"] path {
  stroke: rgba(255,255,255,.24) !important; }
[class*="PluginCatalogGraph"] marker path, [class*="DependencyGraph"] marker path { fill: rgba(255,255,255,.24) !important; }
/* focused / selected node -> accent tint */
[class*="PluginCatalogGraphCustomNode-node"][class*="primary"], [class*="PluginCatalogGraphCustomNode-node"][class*="focused"], rect[class*="focused"] {
  fill: hsl(var(--sc-primary) / .22) !important; stroke: hsl(var(--sc-primary)) !important; }
/* our React Flow workflow DAG — dark + dots (dot color set in the component). */
.react-flow, .react-flow__renderer, .react-flow__pane { background: #0a0a10 !important; }
.react-flow__node { border-radius: var(--sc-radius) !important; }
.react-flow__controls { box-shadow: none !important; }
.react-flow__controls button { background: #17171f !important; border-color: #32303e !important; }
.react-flow__controls button svg, .react-flow__controls-button svg { fill: #e7e7ef !important; }
.react-flow__attribution { display: none !important; }


/* flatten the gradient card headers (template / entity cards).
   The template card header is pixel art rather than a flat wash: four hard
   bands of the picked accent, dithered at each seam with a checkerboard, so it
   reads as an 8-bit sky. Every colour derives from --sc-primary, so the motif
   changes with the swatch. */
[class*="ItemCardHeader"] {
  /* Ancient Greek, drawn entirely with hard colour stops.

     The dominant motif is a meander — the Greek key — running the full width as
     a frieze: two rails with alternating teeth between them, which is the
     pattern reduced to what still reads at this size. A colonnade was tried
     first and failed: at the 12px the header allows, columns read as sprocket
     holes rather than marble. Above the frieze sits a stepped pediment, the
     temple roof from the platform mark, drawn as four stacked bars.

     Every colour derives from --sc-primary and --sc-primary-fg, so the scene
     re-paints when the picker changes. */
  background-color: hsl(var(--sc-primary)) !important;
  background-image:
    /* pediment: four stacked bars, widening downward — a stepped triangle */
    linear-gradient(hsl(var(--sc-primary-fg) / .82) 0 0),
    linear-gradient(hsl(var(--sc-primary-fg) / .82) 0 0),
    linear-gradient(hsl(var(--sc-primary-fg) / .82) 0 0),
    linear-gradient(hsl(var(--sc-primary-fg) / .82) 0 0),
    /* meander frieze: top rail, bottom rail, and the teeth that join them */
    linear-gradient(hsl(var(--sc-primary-fg) / .85) 0 0),
    linear-gradient(hsl(var(--sc-primary-fg) / .85) 0 0),
    repeating-linear-gradient(90deg,
      hsl(var(--sc-primary-fg) / .85) 0 4px, transparent 4px 24px),
    repeating-linear-gradient(90deg,
      transparent 0 12px, hsl(var(--sc-primary-fg) / .85) 12px 16px, transparent 16px 24px),
    /* dither over the sky */
    repeating-conic-gradient(
      hsl(var(--sc-primary-fg) / .12) 0% 25%, transparent 0% 50%),
    /* sky: hard bands, lightest at the top */
    linear-gradient(180deg,
      hsl(var(--sc-primary) / .5) 0 40%,
      hsl(var(--sc-primary) / .74) 40% 66%,
      hsl(var(--sc-primary) / .92) 66% 86%,
      hsl(var(--sc-primary) / 1) 86% 100%) !important;
  background-size:
    6px 3px, 18px 3px, 30px 3px, 42px 3px,
    100% 2px, 100% 2px, 100% 8px, 100% 8px,
    16px 16px,
    100% 100% !important;
  background-position:
    88% calc(100% - 26px), 88% calc(100% - 23px),
    88% calc(100% - 20px), 88% calc(100% - 17px),
    0 calc(100% - 14px), 0 calc(100% - 4px),
    0 calc(100% - 12px), 0 calc(100% - 12px),
    0 0,
    0 0 !important;
  background-repeat:
    no-repeat, no-repeat, no-repeat, no-repeat,
    repeat-x, repeat-x, repeat-x, repeat-x,
    repeat, no-repeat !important;
  color: hsl(var(--sc-primary-fg)) !important;
  border-bottom: var(--sc-border-w) solid hsl(var(--sc-fg) / .18) !important;
  image-rendering: pixelated;
}
/* The title sits on art, so it needs its own contrast: a 1px outline in the
   opposite tone (dark behind light text, light behind dark) plus weight. The
   shade token flips with the scheme, alongside --sc-primary-fg. */
[class*="ItemCardHeader"], [class*="ItemCardHeader"] * {
  font-weight: 700 !important;
  text-shadow:
    1px 0 0 hsl(var(--sc-primary-shade)),
    -1px 0 0 hsl(var(--sc-primary-shade)),
    0 1px 0 hsl(var(--sc-primary-shade)),
    0 -1px 0 hsl(var(--sc-primary-shade)),
    2px 2px 0 hsl(var(--sc-primary-shade) / .55);
}
[class*="ItemCardHeader"] * { color: hsl(var(--sc-primary-fg)) !important; }
/* tables */
.MuiTableCell-head, .MuiTableCell-root.MuiTableCell-head {
  text-transform: uppercase !important; font-size: 11px !important; font-weight: 700 !important;
  letter-spacing: .05em !important; color: hsl(var(--sc-muted-fg)) !important; }
.MuiTableCell-root { border-color: hsl(var(--sc-border)) !important; }

/* page + layout */
.sc-page { padding: 28px 32px; background: hsl(var(--sc-bg)); min-height: 100%; }
.sc-h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; margin: 0; color: hsl(var(--sc-fg)); }
.sc-sub { color: hsl(var(--sc-muted-fg)); margin-top: 4px; font-size: 14px; }
.sc-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 24px; }
.sc-grid { display: grid; gap: 16px; }
.sc-grid-2 { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); align-items: start; }
.sc-action { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: var(--sc-radius);
  border: var(--sc-border-w) solid hsl(var(--sc-border)); text-decoration: none; transition: background .12s, border-color .12s; }
.sc-action:hover { background: hsl(var(--sc-primary) / .06); border-color: hsl(var(--sc-primary) / .4); }
.sc-action-l { font-weight: 600; color: hsl(var(--sc-fg)); }
.sc-action-h { font-size: 12px; }

/* card */
.sc-card { background: hsl(var(--sc-card)); color: hsl(var(--sc-card-fg));
  border: var(--sc-border-w) solid hsl(var(--sc-border)); border-radius: var(--sc-radius); overflow: hidden; }
.sc-card-h { padding: 18px 20px 0; }
.sc-card-title { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
.sc-card-desc { color: hsl(var(--sc-muted-fg)); font-size: 13px; margin-top: 2px; }
.sc-card-b { padding: 18px 20px; }

/* buttons */
.sc-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 36px; padding: 0 14px; border-radius: var(--sc-radius);
  font-size: 13.5px; font-weight: 500; cursor: pointer; border: 1px solid transparent;
  transition: background .15s, opacity .15s; white-space: nowrap; text-decoration: none; }
.sc-btn:disabled { opacity: .5; cursor: not-allowed; }
.sc-btn-primary { background: hsl(var(--sc-primary)); color: hsl(var(--sc-primary-fg)); }
.sc-btn-primary:hover:not(:disabled) { background: hsl(var(--sc-primary) / .9); }
.sc-btn-outline { background: transparent; border-color: hsl(var(--sc-border)); color: hsl(var(--sc-fg)); }
.sc-btn-outline:hover:not(:disabled) { background: hsl(var(--sc-accent)); }
.sc-btn-ghost { background: transparent; color: hsl(var(--sc-fg)); }
.sc-btn-ghost:hover:not(:disabled) { background: hsl(var(--sc-accent)); }
.sc-btn-destructive { background: transparent; color: hsl(var(--sc-destructive)); border-color: transparent; }
.sc-btn-destructive:hover:not(:disabled) { background: hsl(var(--sc-destructive) / .1); }
.sc-btn-sm { height: 30px; padding: 0 10px; font-size: 12.5px; }

/* badge */
.sc-badge { display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 9px;
  border-radius: var(--sc-radius); font-size: 12px; font-weight: 600; border: 1px solid transparent;
  white-space: nowrap; max-width: 100%; }
.sc-dot { width: 7px; height: 7px; border-radius: var(--sc-radius); background: currentColor; }
/* [flare] Badge fills are dithered, not washed. The NES had no alpha channel, so
   a tint was a checkerboard — and a 4px checker is visibly a grid where a flat
   12% wash is just a pale rectangle.
   Each variant declares the colour of a filled cell in --sc-cell; the pattern
   itself is written once. Keeping the cell colour in a custom property is also
   what makes the contrast measurable: the worst case for the text is a filled
   cell, and that is exactly this value composited over the page.
   The text colours below are darker than the tokens they came from. Measured
   across all six schemes, every variant failed 4.5:1 before this change — the
   worst was the primary badge on the amber accent at 1.84:1 — and the dither
   costs a little more contrast on top. color-mix darkens the accent whatever
   the picker is set to, which a fixed hex cannot do. */
.sc-badge[class*="sc-badge-"] {
  background-color: transparent;
  background-image: repeating-conic-gradient(
    var(--sc-cell, transparent) 0% 25%, transparent 0% 50%);
  background-size: 4px 4px;
}
.sc-badge-muted { --sc-cell: hsl(240 5% 62% / .38); color: hsl(240 5% 34%); }
.sc-badge-primary { --sc-cell: hsl(var(--sc-primary) / .22);
  color: color-mix(in srgb, hsl(var(--sc-primary)) 52%, black); }
.sc-badge-success { --sc-cell: hsl(var(--sc-success) / .26); color: hsl(152 60% 22%); }
.sc-badge-warning { --sc-cell: hsl(var(--sc-warning) / .3); color: hsl(38 95% 24%); }
.sc-badge-destructive { --sc-cell: hsl(var(--sc-destructive) / .24); color: hsl(0 70% 34%); }

/* table */
.sc-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.sc-table th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: .05em; color: hsl(var(--sc-muted-fg));
  border-bottom: 1px solid hsl(var(--sc-border)); }
.sc-table td { padding: 12px 14px; border-bottom: 1px solid hsl(var(--sc-border)); color: hsl(var(--sc-fg)); }
.sc-cell-ellip { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Horizontal scroll for tables too wide for their card (card still clips to its corners). */
.sc-table-wrap { overflow-x: auto; max-width: 100%; }
/* tabs */
.sc-tabs { display: flex; gap: 4px; margin-bottom: 14px; border-bottom: 1px solid hsl(var(--sc-border)); }
.sc-tab { appearance: none; background: none; border: none; cursor: pointer; font: inherit;
  padding: 9px 14px; color: hsl(var(--sc-muted-fg)); font-weight: 600; font-size: 14px;
  border-bottom: 2px solid transparent; margin-bottom: -1px; }
.sc-tab:hover { color: hsl(var(--sc-fg)); }
.sc-tab.active { color: hsl(var(--sc-primary)); border-bottom-color: hsl(var(--sc-primary)); }
/* filter/sort toolbar */
.sc-toolbar { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; }
.sc-toolbar .sc-input { width: auto; flex: 1 1 220px; min-width: 180px; }
.sc-toolbar .sc-select { width: auto; min-width: 150px; }
/* collapsible JSON viewer */
.sc-json { display: flex; flex-direction: column; gap: 10px; }
.sc-json-bar { display: flex; gap: 8px; }
.sc-json-body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px;
  line-height: 1.7; background: hsl(var(--sc-muted) / .4); border: var(--sc-border-w) solid hsl(var(--sc-border));
  border-radius: var(--sc-radius); padding: 12px 14px; overflow-x: auto; }
.sc-json-children { padding-left: 16px; border-left: 1px solid hsl(var(--sc-border)); margin-left: 4px; }
.sc-json-row { white-space: nowrap; }
.sc-json-toggle { cursor: pointer; border-radius: var(--sc-radius); }
.sc-json-toggle:hover { background: hsl(var(--sc-primary) / .08); }
.sc-json-chevron { display: inline-block; width: 14px; color: hsl(var(--sc-muted-fg)); }
.sc-json-key { color: hsl(var(--sc-fg)); font-weight: 600; }
.sc-json-punc, .sc-json-collapsed { color: hsl(var(--sc-muted-fg)); }
.sc-json-string { color: hsl(152 42% 42%); }
.sc-json-number { color: hsl(217 60% 55%); }
.sc-json-boolean { color: hsl(280 50% 58%); }
.sc-json-null { color: hsl(var(--sc-muted-fg)); font-style: italic; }
.sc-dark .sc-json-string { color: hsl(152 45% 60%); }
.sc-dark .sc-json-number { color: hsl(217 70% 70%); }
.sc-dark .sc-json-boolean { color: hsl(280 60% 72%); }

/* [flare] Approval progress: cells plus the literal count. A bar alone says
   "some of it is done"; the number says which. */
.sc-approvals { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.sc-approvals-bar { display: flex; gap: 3px; }
.sc-approvals-cell { width: 18px; height: 14px;
  border: var(--sc-border-w) solid hsl(var(--sc-border));
  background: hsl(var(--sc-muted)); }
.sc-approvals-cell.filled { background: hsl(var(--sc-primary));
  border-color: hsl(var(--sc-primary)); }
.sc-approvals-count { font-family: var(--sc-font-pixel); font-size: 12px;
  color: hsl(var(--sc-muted-fg)); }

/* success notice (e.g. created-resource link) */
.sc-notice { padding: 10px 14px; border-radius: var(--sc-radius); font-weight: 500;
  --sc-cell: hsl(var(--sc-success) / .26);
  background-color: transparent;
  background-image: repeating-conic-gradient(var(--sc-cell) 0% 25%, transparent 0% 50%);
  background-size: 4px 4px;
  color: hsl(152 60% 22%);
  border: 1px solid hsl(var(--sc-success) / .45); }

/* login gate */
.sc-login { min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: hsl(var(--sc-bg)); padding: 24px; }
.sc-login-card { width: 360px; max-width: 100%; padding: 36px 32px; text-align: center;
  background: hsl(var(--sc-card)); border: var(--sc-border-w) solid hsl(var(--sc-border));
  border-radius: var(--sc-radius); box-shadow: var(--sc-shadow);
  display: flex; flex-direction: column; align-items: center; gap: 6px; }
.sc-login-mark { width: 52px; height: 52px; border-radius: var(--sc-radius); margin-bottom: 8px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, hsl(var(--sc-primary)), hsl(var(--sc-primary) / .6));
  box-shadow: var(--sc-shadow); }
/* svg = the built-in glyph (takes the tile's foreground color); img = a
   configured app.branding.mark (keeps its own colors, tile shows through its
   transparency). Both sit at ~65% of the tile so the shape clears the corners. */
.sc-login-mark svg, .sc-login-mark img { width: 34px; height: 34px; color: hsl(var(--sc-primary-fg)); object-fit: contain; }
.sc-login-title { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: hsl(var(--sc-fg)); margin: 0; }
.sc-login-sub { font-size: 14px; color: hsl(var(--sc-muted-fg)); margin: 0 0 16px; }
.sc-login-card .sc-btn { width: 100%; }
.sc-login-pick { margin-top: 20px; padding-top: 18px; border-top: 1px solid hsl(var(--sc-border)); width: 100%;
  display: flex; justify-content: center; }
.sc-table tr:last-child td { border-bottom: none; }
/* Hover is a dither too, so the selected row reads as a filled cell block
   rather than a soft tint. Row text is --sc-fg, so contrast is unaffected. */
.sc-table tbody tr:hover {
  background-image: repeating-conic-gradient(
    hsl(var(--sc-primary) / .16) 0% 25%, transparent 0% 50%);
  background-size: 4px 4px;
}
/* [flare] Rows select the way a menu does: a cursor in the margin rather than a
   wash alone. The gutter is reserved on every row whether or not the cursor is
   in it — a 12px reflow under the pointer is worse than no cursor at all. */
.sc-table tbody td:first-child,
.MuiTableBody-root .MuiTableCell-root:first-child { padding-left: 24px; position: relative; }
.sc-table tbody tr:hover td:first-child::before,
.sc-table tbody tr:focus-within td:first-child::before,
.MuiTableBody-root .MuiTableRow-root:hover .MuiTableCell-root:first-child::before,
.MuiTableBody-root .MuiTableRow-root:focus-within .MuiTableCell-root:first-child::before {
  content: '\\25B6' / '';
  position: absolute; left: 7px; top: 50%; transform: translateY(-50%);
  font-family: var(--sc-font-pixel); font-size: 10px;
  color: hsl(var(--sc-primary));
}

/* input */
.sc-input, .sc-select { height: 36px; width: 100%; padding: 0 10px; font-size: 14px;
  border-radius: var(--sc-radius); border: 1px solid hsl(var(--sc-input));
  background: hsl(var(--sc-bg)); color: hsl(var(--sc-fg)); outline: none; font-family: inherit; }
.sc-input:focus, .sc-select:focus { border-color: hsl(var(--sc-ring)); outline: var(--sc-border-w) solid hsl(var(--sc-ring)); outline-offset: 2px; box-shadow: none; }
.sc-label { font-size: 13px; font-weight: 500; color: hsl(var(--sc-fg)); display: block; margin-bottom: 6px; }
.sc-field { margin-bottom: 14px; }
.sc-link { color: hsl(var(--sc-primary)); text-decoration: none; font-weight: 500; }
.sc-link:hover { text-decoration: underline; }
.sc-muted { color: hsl(var(--sc-muted-fg)); }
.sc-row { display: flex; align-items: center; gap: 8px; }
.sc-kv { display: grid; grid-template-columns: 140px 1fr; gap: 6px 16px; font-size: 14px; }
.sc-kv dt { color: hsl(var(--sc-muted-fg)); }
.sc-kv dd { margin: 0; color: hsl(var(--sc-fg)); }

/* dialog */
.sc-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 1600;
  display: flex; align-items: center; justify-content: center; }
.sc-dialog { background: hsl(var(--sc-card)); color: hsl(var(--sc-fg));
  border: var(--sc-border-w) solid hsl(var(--sc-border)); border-radius: var(--sc-radius);
  width: min(480px, 92vw); max-height: 88vh; overflow: auto; box-shadow: var(--sc-shadow); }
.sc-dialog-h { padding: 20px 22px 0; font-size: 17px; font-weight: 600; }
.sc-dialog-b { padding: 16px 22px; }
.sc-dialog-f { padding: 12px 22px 20px; display: flex; justify-content: flex-end; gap: 8px; }

/* custom shadcn nav (replaces the Backstage sidebar) */
.sc-nav { position: fixed; top: 0; left: 0; bottom: 0; width: var(--sc-nav-w); z-index: 1200;
  background: hsl(var(--sc-card)); border-right: var(--sc-border-w) solid hsl(var(--sc-border));
  display: flex; flex-direction: column; padding: 12px 12px 16px; overflow-x: hidden;
  transition: width .16s ease; }
.sc-nav-top { display: flex; align-items: center; justify-content: space-between; padding: 4px 6px 14px; }
.sc-nav-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; min-width: 0; }
.sc-nav-mark { width: 26px; height: 26px; border-radius: var(--sc-radius); flex: 0 0 auto;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, hsl(var(--sc-primary)), hsl(var(--sc-primary) / .65));
  box-shadow: var(--sc-shadow); }
.sc-nav-mark svg, .sc-nav-mark img { width: 17px; height: 17px; color: hsl(var(--sc-primary-fg)); object-fit: contain; }
.sc-nav-word { font-weight: 700; font-size: 17px; letter-spacing: -0.02em; color: hsl(var(--sc-fg)); white-space: nowrap; }
.sc-nav-toggle { flex: 0 0 auto; width: 26px; height: 26px; border-radius: var(--sc-radius); border: var(--sc-border-w) solid hsl(var(--sc-border));
  background: transparent; color: hsl(var(--sc-muted-fg)); cursor: pointer; font-size: 13px; line-height: 1;
  display: flex; align-items: center; justify-content: center; }
.sc-nav-toggle:hover { background: hsl(var(--sc-accent)); color: hsl(var(--sc-fg)); }
.sc-nav-list { display: flex; flex-direction: column; gap: 2px; }
.sc-nav-item { position: relative; display: flex; align-items: center; gap: 11px; padding: 8px 10px; border-radius: var(--sc-radius);
  text-decoration: none; font-size: 14px; font-weight: 500; transition: background .12s, color .12s; white-space: nowrap; }
.sc-nav-ic { display: flex; align-items: center; color: hsl(var(--sc-muted-fg)); flex: 0 0 auto; }
.sc-nav-ic svg { width: 19px; height: 19px; }
.sc-nav-tx { color: hsl(var(--sc-muted-fg)); overflow: hidden; text-overflow: ellipsis; }
.sc-nav-item:hover { background: hsl(var(--sc-accent)); }
.sc-nav-item:hover .sc-nav-tx, .sc-nav-item:hover .sc-nav-ic { color: hsl(var(--sc-fg)); }
/* active: subtle pill + left accent bar; only the LETTERS take the accent color. */
.sc-nav-item.active { background: hsl(var(--sc-primary) / .10); }
.sc-nav-item.active .sc-nav-tx { color: hsl(var(--sc-primary)); font-weight: 600; }
.sc-nav-item.active .sc-nav-ic { color: hsl(var(--sc-fg)); }
.sc-nav-item.active::before { content: ''; position: absolute; left: 3px; top: 8px; bottom: 8px; width: 3px;
  border-radius: var(--sc-radius); background: hsl(var(--sc-primary)); }
/* collapsed: icons only */
.sc-nav.collapsed .sc-nav-word, .sc-nav.collapsed .sc-nav-tx { display: none; }
.sc-nav.collapsed .sc-nav-item { justify-content: center; padding: 9px; }
.sc-nav.collapsed .sc-nav-top { justify-content: center; }
/* Force the content gutter to match the nav width (hashed SidebarPage class). */
/* Content offset for the fixed nav lives in the theme
   (BackstageSidebarPage.styleOverrides.root); the mobile override stays here. */
@media (max-width: 600px) { .sc-nav { display: none; } [class*="BackstageSidebarPage-root"] { padding-left: 0 !important; } }

/* color scheme picker */
.sc-picker { position: fixed; right: 14px; bottom: 14px; z-index: 1500;
  display: flex; align-items: center; gap: 6px; padding: 7px 9px; border-radius: var(--sc-radius);
  background: hsl(var(--sc-card)); border: var(--sc-border-w) solid hsl(var(--sc-border));
  /* A floating window, so it takes the command-window frame too. */
  box-shadow:
    0 0 0 2px hsl(var(--sc-card)),
    0 0 0 4px hsl(var(--sc-fg) / .85),
    var(--sc-shadow); }
.sc-swatch { width: 18px; height: 18px; border-radius: var(--sc-radius); border: 2px solid transparent; cursor: pointer; padding: 0; }
.sc-swatch[aria-pressed="true"] { border-color: hsl(var(--sc-fg)); }
/* [flare] Scrollbars are furniture, and the OS default is the most modern
   object left on the page. Square thumb, hard edge, accent fill. The Firefox
   pair cannot express the border, so it degrades to a plain accent bar. */
* { scrollbar-color: hsl(var(--sc-primary)) hsl(var(--sc-muted)); scrollbar-width: thin; }
::-webkit-scrollbar { width: 14px; height: 14px; }
::-webkit-scrollbar-track { background: hsl(var(--sc-muted)); }
::-webkit-scrollbar-thumb {
  background: hsl(var(--sc-primary));
  border: var(--sc-border-w) solid hsl(var(--sc-bg));
  border-radius: 0;
}
::-webkit-scrollbar-thumb:hover { background: hsl(var(--sc-primary) / .82); }
::-webkit-scrollbar-corner { background: hsl(var(--sc-muted)); }

/* ===== Motion =====
   Everything timed lives behind prefers-reduced-motion and uses steps(), never
   ease: smooth interpolation is what makes a pixel interface look like a modern
   interface wearing a costume. Nothing conveys state through motion alone. */
@media (prefers-reduced-motion: no-preference) {
  @keyframes sc-march { to { background-position: 32px 0; } }
  @keyframes sc-gear { to { transform: rotate(360deg); } }
  @keyframes sc-flash {
    0%, 100% { box-shadow: var(--sc-shadow); }
    50% { box-shadow: 0 0 0 4px hsl(var(--sc-primary)); }
  }
  @keyframes sc-shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-2px); }
    75% { transform: translateX(2px); }
  }
  @keyframes sc-cursor-in {
    from { transform: translateX(-4px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  /* A workflow is running: 4px blocks stepping right, never sliding. */
  .sc-progress.running {
    background-image: repeating-linear-gradient(90deg,
      hsl(var(--sc-primary)) 0 16px, transparent 16px 32px);
    animation: sc-march .8s steps(8) infinite;
  }
  /* Native loading bars march in the same cells as ours; the spinner turns in
     eighths, so it reads as a sprite flipping frames rather than a ring. */
  .MuiLinearProgress-bar { animation: sc-march .8s steps(8) infinite !important; }
  .MuiCircularProgress-root::after { animation: sc-gear 1s steps(8) infinite; }
  /* The gear turns in quarter steps, like a four-frame sprite sheet. */
  .sc-state-ic.spinning { animation: sc-gear 1s steps(4) infinite; }
  .sc-flash { animation: sc-flash .4s steps(2) 2; }
  .sc-shake { animation: sc-shake .2s steps(2) 2; }

  /* The marker steps in from the left on hover; .active is excluded so a
     second cursor never appears beside the real one. */
  .sc-nav-item:hover .sc-nav-cursor::before {
    content: '\\25B6';
    display: inline-block;
    animation: sc-cursor-in .12s steps(2) both;
  }
  .sc-nav-item.active:hover .sc-nav-cursor::before { content: none; }

  /* [flare] A dialog arrives the way an 8-bit scene changes: through a dither,
     not a fade. The mask cells shrink in four steps, so the surface resolves
     cell by cell. 160ms — longer and it stops reading as a scene change and
     starts reading as a wait. */
  /* The mask lives ONLY inside the keyframes, and the last frame drops it
     entirely. Leaving it on the static rule and animating mask-size down to 1px
     ends with a sub-pixel checkerboard, which is not "finished" — it is a
     dialog permanently at half opacity. mask-image animates discretely, so the
     final frame flips it off cleanly. */
  @keyframes sc-dither-in {
    0% {
      -webkit-mask-image: repeating-conic-gradient(#000 0% 25%, transparent 0% 50%);
      mask-image: repeating-conic-gradient(#000 0% 25%, transparent 0% 50%);
      -webkit-mask-size: 12px 12px; mask-size: 12px 12px;
    }
    99% {
      -webkit-mask-image: repeating-conic-gradient(#000 0% 25%, transparent 0% 50%);
      mask-image: repeating-conic-gradient(#000 0% 25%, transparent 0% 50%);
      -webkit-mask-size: 3px 3px; mask-size: 3px 3px;
    }
    100% { -webkit-mask-image: none; mask-image: none; }
  }
  [class*="bui-DialogInner"], .MuiDialog-paper {
    animation: sc-dither-in .16s steps(4) both;
  }

  /* Ambient: presence, not information. */
  @keyframes sc-bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
  }
  @keyframes sc-caret { 50% { opacity: 0; } }
  .sc-empty .sc-state-ic { animation: sc-bob 1.2s steps(2) infinite; }
  .sc-h1::after,
  :is(h1, h2, h3)[class*="bui-HeaderTitle"]::after,
  [class*="BackstageHeader-title"]::after {
    animation: sc-caret 1s steps(1) infinite;
  }
}

/* The block caret marks a page title, wherever the page comes from: ours,
   Backstage's Header, or the BUI header the catalog uses. The caret itself sits
   outside the motion query — only its blink is animation, so a reader with
   reduced motion still gets the mark, just a steady one. */
.sc-h1::after,
:is(h1, h2, h3)[class*="bui-HeaderTitle"]::after,
[class*="BackstageHeader-title"]::after {
  /* ContentHeader is deliberately absent: it renders empty on the create page
     (a lone floating block) and, where it does have text, it sits under a
     Header title that already carries the caret.
     The slash-empty-string suffix is the alt text of generated content: it keeps
     the caret out of the accessible name, so a screen reader announces
     "Platform Catalog", not "Platform Catalog block". The element selector
     matters too — bui also renders a HeaderTitleStack wrapper, which would
     otherwise draw a second caret.
     (No backticks in this file: the whole stylesheet is one template literal.) */
  content: '\\2588' / '';
  margin-left: 4px;
  color: hsl(var(--sc-primary));
}

/* The scanline layer is texture, not motion, so it sits outside the media query
   and survives reduced-motion. pointer-events: none keeps clicks passing
   through it. */
.sc-page::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  background: repeating-linear-gradient(0deg,
    hsl(var(--sc-fg) / .03) 0 1px, transparent 1px 3px);
}

/* ===== 8-bit chrome =====
   Pixel type is for chrome only — headings, nav, buttons, badges, counters.
   Body copy, table cells, JSON values and log output keep Inter/mono, because
   they are read under pressure. Silkscreen is a bitmap face: below 12px whole
   strokes drop out, hence the floor. Uppercase is the authentic treatment and
   avoids Silkscreen's uneven lowercase baselines. */
.sc-h1, .sc-card-title, .sc-btn, .sc-badge, .sc-nav-word, .sc-nav-tx,
.sc-dialog-h, .sc-login-title, .sc-label {
  font-family: var(--sc-font-pixel);
  letter-spacing: 0;
  text-transform: uppercase;
  font-weight: 400;
  font-size: max(12px, 1em);
}
.sc-h1 { font-size: 24px; }
.sc-login-title { font-size: 20px; }
.sc-card-title, .sc-dialog-h { font-size: 14px; }
.sc-btn, .sc-badge, .sc-nav-tx, .sc-nav-word, .sc-label { font-size: 13px; }

/* The press IS the shadow collapsing: the button moves into the space its
   shadow occupied, which is how a 2-frame sprite button reads. */
.sc-btn {
  border: var(--sc-border-w) solid hsl(var(--sc-fg) / .8);
  box-shadow: var(--sc-shadow);
  transition: none;
}
.sc-btn:active:not(:disabled) { transform: translate(2px, 2px); box-shadow: none; }
.sc-btn:focus-visible,
.sc-input:focus-visible, .sc-select:focus-visible {
  outline: var(--sc-border-w) solid hsl(var(--sc-ring));
  outline-offset: 2px;
  box-shadow: none;
}
.sc-badge { border: var(--sc-border-w) solid hsl(var(--sc-border)); box-shadow: none;
  border-radius: var(--sc-radius-sm); }
.sc-input, .sc-select { border-width: var(--sc-border-w); box-shadow: none;
  border-radius: var(--sc-radius-sm); }

/* The resize handle: a 6px hit area straddling the nav's right edge, showing a
   2px accent line on hover/focus. Wider than it looks, because a 2px target is
   a miss. */
.sc-nav-resize {
  position: absolute; top: 0; right: 0; width: 6px; height: 100%;
  cursor: col-resize; background: transparent; z-index: 5; }
.sc-nav-resize:hover, .sc-nav-resize:focus-visible {
  background: linear-gradient(90deg, transparent 2px, hsl(var(--sc-primary)) 2px 4px, transparent 4px);
  outline: none; }
.sc-nav.dragging { transition: none; user-select: none; }
.sc-nav.dragging .sc-nav-resize {
  background: linear-gradient(90deg, transparent 2px, hsl(var(--sc-primary)) 2px 4px, transparent 4px); }

/* State sprite beside its badge. 16px is one screen pixel per sprite pixel —
   the size at which pixel art is sharpest; avoid non-integer multiples. */
.sc-state { display: inline-flex; align-items: center; gap: var(--sc-unit); }
.sc-state-ic { width: 16px; height: 16px; flex: 0 0 auto; color: currentColor; }

/* Sidebar: the active row is marked by a cursor, the way a menu selection is. */
.sc-nav-cursor { font-family: var(--sc-font-pixel); font-size: 11px; width: 12px;
  flex: 0 0 auto; color: hsl(var(--sc-primary)); }
.sc-nav-item { border-radius: var(--sc-radius); border-left: var(--sc-border-w) solid transparent; }
.sc-nav-item.active { border-left-color: hsl(var(--sc-primary)); }
.sc-nav-mark { border-radius: var(--sc-radius); border: var(--sc-border-w) solid hsl(var(--sc-fg) / .8);
  box-shadow: var(--sc-shadow); }

/* The JSON tree is pixel throughout now; keys keep their weight so the
   structure still reads at a glance. */
.sc-json-key, .sc-json-toggle { font-family: var(--sc-font-pixel); font-size: 12px; }
.sc-json-body { font-family: var(--sc-font-pixel); font-size: 12px; }
`;
