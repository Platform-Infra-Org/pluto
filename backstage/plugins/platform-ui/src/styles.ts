// A self-contained shadcn-style design layer (tokens + component classes),
// injected globally. Colors are HSL triplets in CSS variables so the color
// picker can swap the accent live. Scoped under `.sc` so it never fights
// Backstage's own MUI styles outside our pages.
import { statusTokenCss } from './statusTokens';
import { greekCss } from './greek';
import { foudreCss } from './foudre';
import { slushCss } from './slush';
import { brandsCss } from './brands';
import { spiderverseCss } from './spiderverse';
import { hanamiCss } from './hanami';
import { nightshadeCss } from './nightshade';
import { rimefastCss } from './rimefast';
import { STARFIELD } from './starfield';

export const SHADCN_CSS = `
/* The app's one typeface. Self-hosted because the CSP is font-src 'self', so a
   CDN reference would simply not load — and the failure is silent, the page
   falling back to something that looks nearly right. The variable file covers
   200-700 in a single asset. ITF Free Font License, see public/fonts/LICENSE.txt.

   It replaced the pixel face as the base. Differentiation now comes from
   weight, size and case rather than from a second family: the scale below is
   what an outline grotesque needs, where the pixel face wanted uppercase chrome
   and a hard 12px floor to stay legible. */
@font-face {
  font-family: 'Clash Grotesk';
  src: url('/fonts/clash-grotesk.woff2') format('woff2');
  font-weight: 200 700;
  font-style: normal;
  font-display: swap;
}
.sc, .sc * { box-sizing: border-box; }
/* The host for the animated mode ornaments — SchemeRoot mounts it once, and a
   mode sheet turns on the child it wants. Hidden by default and pointer-events
   none, so a mode that claims nothing costs one empty fixed box. Kept OUT of
   the mode sheets because the default must be off for every mode at once, and
   a per-mode default is a per-mode chance to forget one. */
.sc-mode-art { position: fixed; inset: 0; z-index: 1; overflow: hidden; pointer-events: none; }
.sc-mode-art > * { display: none; position: absolute; }
/* Tokens live on :root so BOTH our .sc components and the MUI/Backstage reskin
   below read the same variables (and follow the color picker). */
:root {
  /* 8-bit, softened: the shadow keeps its offset and its hard edge — that is
     the pixel signature — but drops most of its weight, and corners are rounded
     rather than square. Chunky 2px outlines stay.
     The house radius is the soft one the modern references converge on; the
     border width beside it is what still separates one mode from the next. */
  --sc-radius: 12px;
  --sc-radius-sm: 8px;
  /* The horizontal inset of a field's own text. The label that names it reads
     the same variable, so the two cannot drift: MUI positions a standard-variant
     label at left:0 because that variant has no box, and we give it one. */
  --sc-field-x: 10px;
  --sc-border-w: 2px;
  --sc-shadow: 3px 3px 0 hsl(var(--sc-fg) / .16);
  --sc-font-ui: 'Clash Grotesk', Inter, system-ui, -apple-system, sans-serif;
  /* Titles take the grotesque, everything else keeps the pixel face. Held as
     its own variable so a mode can move the two independently — the pixel font
     is still the app's voice, but a heading is where a face has room to be
     read rather than decoded. */
  --sc-font-title: 'Clash Grotesk', Inter, system-ui, -apple-system, sans-serif;
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
${statusTokenCss()}
${greekCss()}
${foudreCss()}
${slushCss()}
${brandsCss()}
${spiderverseCss()}
${hanamiCss()}
${nightshadeCss()}
${rimefastCss()}
.sc, .sc * {
  /* Full arcade: the pixel face is the base font everywhere, not only on
     chrome. 12px is the floor — kept as a legibility choice, not because
     an outline grotesque loses no strokes at small sizes the way a bitmap face
     would. Nobody has checked by eye whether the
     floor still earns its keep at this face's proportions, so it stays. */
  font-family: var(--sc-font-ui);
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
   and the catalog/dependency graph are styled in theme.tsx through the style
   hooks their components register. MUI applies those by component NAME, which
   a production build never mangles — unlike generated class names, which
   become jss<n> there. Nothing here may name one: styles.test.ts fails on it. */

/* [stable: bui tokens] retarget bui's surface/text/border/radius/status tokens
   to the picker. These CSS variables are the primary, upgrade-safe mechanism
   for bui components, and until this block was filled in only five of canon's
   ~140 were mapped — so every canon surface on an entity page (six kinds),
   /notifications and the TechDocs entity card rendered as a Backstage hex.

   THE SELECTOR LIST IS LOAD-BEARING, ALL THREE OF IT. Canon declares its light
   set at ":root, [data-theme-mode='light']" and its dark set at
   "[data-theme-mode='dark']", and the app puts data-theme-mode on <body>.
   Custom properties inherit, so <body>'s own declaration beats anything
   inherited from <html>: a bare :root here is DEAD in the dark register, which
   is exactly how the five original overrides shipped broken (measured:
   html --bui-bg-solid = ours, body --bui-bg-solid = canon's pale blue). Naming
   both data-theme-mode values puts our declaration on the same element canon
   declares on, where it wins. styles.test.ts pins the selector list, because
   the failure is invisible in light — the register people check first. */
:root,
[data-theme-mode="light"],
[data-theme-mode="dark"] {
  /* grounds */
  --bui-bg-app: hsl(var(--sc-bg));
  --bui-bg-neutral-1: hsl(var(--sc-card));
  --bui-bg-neutral-1-hover: hsl(var(--sc-card) / 0.92);
  --bui-bg-neutral-1-pressed: hsl(var(--sc-card) / 0.85);
  --bui-bg-neutral-1-disabled: hsl(var(--sc-card) / 0.5);
  --bui-bg-neutral-2: hsl(var(--sc-muted));
  --bui-bg-neutral-2-hover: hsl(var(--sc-muted) / 0.92);
  --bui-bg-neutral-2-pressed: hsl(var(--sc-muted) / 0.85);
  --bui-bg-neutral-2-disabled: hsl(var(--sc-muted) / 0.5);
  --bui-bg-neutral-3: hsl(var(--sc-accent));
  --bui-bg-neutral-3-hover: hsl(var(--sc-accent) / 0.92);
  --bui-bg-neutral-3-pressed: hsl(var(--sc-accent) / 0.85);
  --bui-bg-neutral-3-disabled: hsl(var(--sc-accent) / 0.5);
  /* neutral-4 is the only one whose base is already translucent, so its states
     step the alpha UP rather than down — same visible cue, right direction. */
  --bui-bg-neutral-4: hsl(var(--sc-border) / 0.35);
  --bui-bg-neutral-4-hover: hsl(var(--sc-border) / 0.45);
  --bui-bg-neutral-4-pressed: hsl(var(--sc-border) / 0.5);
  --bui-bg-neutral-4-disabled: hsl(var(--sc-border) / 0.18);
  /* --bui-bg-inherit needs no entry: canon defines it as var(--bui-bg-app) at a
     plain :root, so mapping bg-app carries it. */

  /* the solid (primary) surface */
  --bui-bg-solid: hsl(var(--sc-primary));
  --bui-bg-solid-hover: hsl(var(--sc-primary) / 0.92);
  --bui-bg-solid-pressed: hsl(var(--sc-primary) / 0.85);
  --bui-bg-solid-disabled: hsl(var(--sc-primary) / 0.5);
  --bui-fg-solid: hsl(var(--sc-primary-fg));
  --bui-fg-solid-disabled: hsl(var(--sc-primary-fg) / 0.55);
  --bui-accent-bg: hsl(var(--sc-primary));
  --bui-accent-bg-hover: hsl(var(--sc-primary) / 0.9);
  --bui-accent-bg-disabled: hsl(var(--sc-primary) / 0.5);
  --bui-accent-fg: hsl(var(--sc-primary-fg));
  --bui-accent-fg-disabled: hsl(var(--sc-primary-fg) / 0.55);

  /* ink */
  --bui-fg-primary: hsl(var(--sc-fg));
  --bui-fg-secondary: hsl(var(--sc-muted-fg));
  --bui-fg-disabled: hsl(var(--sc-muted-fg) / 0.55);
  --bui-fg-link: hsl(var(--sc-primary));

  /* edges and focus */
  --bui-border-1: hsl(var(--sc-border));
  --bui-border-2: hsl(var(--sc-border) / 0.6);
  --bui-border-focus: hsl(var(--sc-ring));
  --bui-ring: hsl(var(--sc-ring));
  --bui-shadow: var(--sc-shadow);

  /* shape. --bui-radius-full is deliberately NOT mapped: it is the pill, and it
     must stay 9999px or every canon pill becomes a rounded rectangle. */
  --bui-radius-1: var(--sc-radius-sm);
  --bui-radius-2: var(--sc-radius-sm);
  --bui-radius-3: var(--sc-radius-sm);
  --bui-radius-4: var(--sc-radius);
  --bui-radius-5: var(--sc-radius);
  --bui-radius-6: var(--sc-radius);

  /* Status, wholesale. A half-mapped family puts one themed badge beside one
     vanilla one on the same card, which reads as a bug rather than a palette,
     so every member of every ramp is here or none would be.
     The shape follows the badges (.sc-badge-*): a translucent fill of the
     status hue, with the measured on-* ink over it. --sc-on-* clears 5:1
     against both the card and the dither cell in both registers
     (statusTokens.ts), so it clears any tint between them too. There is no
     --sc-info / --sc-announcement token: canon's informational ramp is the
     accent, so it takes --sc-primary. */
  --bui-fg-positive: hsl(var(--sc-on-success));
  --bui-fg-negative: hsl(var(--sc-on-destructive));
  --bui-fg-warning: hsl(var(--sc-on-warning));
  --bui-fg-announcement: hsl(var(--sc-primary));
  --bui-fg-success: hsl(var(--sc-on-success));
  --bui-fg-danger: hsl(var(--sc-on-destructive));
  --bui-fg-info: hsl(var(--sc-primary));
  --bui-bg-success: hsl(var(--sc-success) / 0.16);
  --bui-bg-danger: hsl(var(--sc-destructive) / 0.16);
  --bui-bg-warning: hsl(var(--sc-warning) / 0.16);
  --bui-bg-info: hsl(var(--sc-primary) / 0.16);
  --bui-fg-success-on-bg: hsl(var(--sc-on-success));
  --bui-fg-danger-on-bg: hsl(var(--sc-on-destructive));
  --bui-fg-warning-on-bg: hsl(var(--sc-on-warning));
  --bui-fg-info-on-bg: hsl(var(--sc-primary));
  --bui-border-success: hsl(var(--sc-success));
  --bui-border-danger: hsl(var(--sc-destructive));
  --bui-border-warning: hsl(var(--sc-warning));
  --bui-border-info: hsl(var(--sc-primary));

  --bui-positive-bg: hsl(var(--sc-success) / 0.16);
  --bui-positive-bg-hover: hsl(var(--sc-success) / 0.22);
  --bui-positive-bg-disabled: hsl(var(--sc-success) / 0.1);
  --bui-positive-bg-subdued: hsl(var(--sc-success) / 0.1);
  --bui-positive-bg-subdued-hover: hsl(var(--sc-success) / 0.16);
  --bui-positive-bg-subdued-disabled: hsl(var(--sc-success) / 0.06);
  --bui-positive-border: hsl(var(--sc-success));
  --bui-positive-fg: hsl(var(--sc-on-success));
  --bui-positive-fg-disabled: hsl(var(--sc-on-success) / 0.55);
  --bui-positive-fg-subdued: hsl(var(--sc-on-success));
  --bui-positive-fg-subdued-disabled: hsl(var(--sc-on-success) / 0.55);

  --bui-negative-bg: hsl(var(--sc-destructive) / 0.16);
  --bui-negative-bg-hover: hsl(var(--sc-destructive) / 0.22);
  --bui-negative-bg-disabled: hsl(var(--sc-destructive) / 0.1);
  --bui-negative-bg-subdued: hsl(var(--sc-destructive) / 0.1);
  --bui-negative-bg-subdued-hover: hsl(var(--sc-destructive) / 0.16);
  --bui-negative-bg-subdued-disabled: hsl(var(--sc-destructive) / 0.06);
  --bui-negative-border: hsl(var(--sc-destructive));
  --bui-negative-fg: hsl(var(--sc-on-destructive));
  --bui-negative-fg-disabled: hsl(var(--sc-on-destructive) / 0.55);
  --bui-negative-fg-subdued: hsl(var(--sc-on-destructive));
  --bui-negative-fg-subdued-disabled: hsl(var(--sc-on-destructive) / 0.55);

  --bui-warning-bg: hsl(var(--sc-warning) / 0.16);
  --bui-warning-bg-hover: hsl(var(--sc-warning) / 0.22);
  --bui-warning-bg-disabled: hsl(var(--sc-warning) / 0.1);
  --bui-warning-bg-subdued: hsl(var(--sc-warning) / 0.1);
  --bui-warning-bg-subdued-hover: hsl(var(--sc-warning) / 0.16);
  --bui-warning-bg-subdued-disabled: hsl(var(--sc-warning) / 0.06);
  --bui-warning-border: hsl(var(--sc-warning));
  --bui-warning-fg: hsl(var(--sc-on-warning));
  --bui-warning-fg-disabled: hsl(var(--sc-on-warning) / 0.55);
  --bui-warning-fg-subdued: hsl(var(--sc-on-warning));
  --bui-warning-fg-subdued-disabled: hsl(var(--sc-on-warning) / 0.55);

  --bui-announcement-bg: hsl(var(--sc-primary) / 0.16);
  --bui-announcement-bg-hover: hsl(var(--sc-primary) / 0.22);
  --bui-announcement-bg-disabled: hsl(var(--sc-primary) / 0.1);
  --bui-announcement-bg-subdued: hsl(var(--sc-primary) / 0.1);
  --bui-announcement-bg-subdued-hover: hsl(var(--sc-primary) / 0.16);
  --bui-announcement-bg-subdued-disabled: hsl(var(--sc-primary) / 0.06);
  --bui-announcement-border: hsl(var(--sc-primary));
  --bui-announcement-fg: hsl(var(--sc-primary));
  --bui-announcement-fg-disabled: hsl(var(--sc-primary) / 0.55);
  --bui-announcement-fg-subdued: hsl(var(--sc-primary));
  --bui-announcement-fg-subdued-disabled: hsl(var(--sc-primary) / 0.55);
  /* --bui-gray-1..11 stay canon's own neutral ramp: it is raw, a mode-token
     ladder mapped onto it can invert in one register, and no measured element
     resolves through one. */
}
/* [stable: data-variant] primary bui buttons resolve their own token — the
   [data-variant] attribute is a stable hook; the class fragment is only a scope. */
[data-variant="primary"][class*="bui-Button"] { background-color: hsl(var(--sc-primary)) !important; color: hsl(var(--sc-primary-fg)) !important; }
[data-variant="primary"][class*="bui-Button"]:hover { background-color: hsl(var(--sc-primary) / 0.9) !important; }
[class*="bui-ButtonLink"], [class*="bui-Button"] { border-radius: var(--sc-radius) !important; }
body { background: hsl(var(--sc-bg)); } /* BackstageContent bg moved to theme.tsx (BackstageContent.styleOverrides.root) */
/* cards / surfaces */
/* cards/surfaces via stable MUI classes. The InfoCard header is styled in the
   theme (BackstageInfoCard.styleOverrides.header). */
/* The two elevation classes are the ONE exception to the substring form:
   [class*="MuiPaper-elevation1"] also matches MuiPaper-elevation10 through -19
   (MUI v4 goes to 24, and 8 is the default menu Paper), which would give every
   menu and popover the card treatment. The generator emits key-counter, so an
   anchored trailing dash matches every suffixed spelling and nothing else. */
[class*="MuiCard-root"],
.MuiPaper-elevation1, [class*="MuiPaper-elevation1-"],
.MuiPaper-elevation2, [class*="MuiPaper-elevation2-"],
[class*="MuiAccordion-root"] {
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
[class*="MuiOutlinedInput-notchedOutline"] { border-color: hsl(var(--sc-input)) !important; }
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
  font-family: var(--sc-font-ui) !important;
}
/* Icon fonts are glyph lookups, not text — leave them alone or every icon
   turns into a letter. */
.material-icons, .material-icons-outlined, .MuiIcon-root, [class*="material-icons"],
[class*="MuiSvgIcon-root"], [class*="MuiSvgIcon-root"] * {
  font-family: 'Material Icons' !important;
}
[class*="MuiSvgIcon-root"] { font-family: inherit !important; }

/* ===== Native Backstage pages wear the same 8-bit chrome =====
   Catalog, scaffolder, search and settings are built from MUI components we
   don't own, so they are matched by MUI's global classes — the public, stable
   hook. Pixel type goes on chrome (buttons, tabs, table headers, filter labels,
   chips, headings); table bodies and descriptions stay Inter, exactly as on our
   own pages. BackstageContentHeader-title, BackstageItemCardHeader and
   BackstageAutocomplete-label carry the same font/text-transform, set in
   theme.tsx instead since class*= hooks on those three don't survive a
   production build. */
[class*="MuiButton-root"], .MuiTab-root, .MuiChip-root, .MuiTableCell-head,
.MuiTableSortLabel-root, .MuiFormLabel-root, .MuiInputLabel-root,
[class*="bui-Button"] {
  font-family: var(--sc-font-ui) !important;
  text-transform: uppercase !important;
  letter-spacing: 0 !important;
  font-weight: 400 !important;
}
/* A native page's title is the same object as the h1 that says "Welcome to
   Platform", so it is set the same way: sentence case, 600, tracked in.
   It used to sit in the rule above and came out uppercase at weight 400 —
   a bitmap-face convention that reads as shouting in an outline grotesque,
   and it made every native page look like a different product from ours.
   The breadcrumb and the toolbar name are the top bar's own text and follow
   the title rather than the chrome. */
[class*="MuiTypography-h1"], [class*="MuiTypography-h2"], [class*="MuiTypography-h3"],
[class*="MuiTypography-h4"], [class*="MuiTypography-h5"], [class*="MuiTypography-h6"],
[class*="MuiCardHeader-title"], .MuiDialogTitle-root, .MuiAlertTitle-root,
[class*="bui-HeaderTitle"], [class*="bui-HeaderBreadcrumb"],
[class*="bui-PluginHeaderToolbarName"] {
  font-family: var(--sc-font-title) !important;
  text-transform: none !important;
  letter-spacing: -0.025em !important;
  font-weight: 600 !important;
}
/* The BUI page title is the biggest type on a native page. */
[class*="bui-HeaderTitle"] { font-size: 28px !important; }
/* The bar naming the page carries the page's name, so it is set like a title
   rather than like chrome. */
[class*="bui-HeaderTitle"],
[class*="bui-PluginHeaderToolbarName"] {
  font-weight: 700 !important;
}
/* The one bui surface with no rule here: PluginHeader ships its own white
   ground and black ink, measured rgb(255,255,255) on a production build while
   the mode's card was 42 45% 98%. Every potion is affected, so this is
   app-wide rather than route-scoped.
   Ground and ink only, deliberately: the substring hook matches the whole
   PluginHeader family — Toolbar, ToolbarContent, ToolbarIcon, ToolbarName,
   Breadcrumbs — so any edge declared here is drawn seven times over, once
   under the icon, once under the title and once under the bar. Colour
   inherits harmlessly down that tree; a border does not. */
[class*="bui-PluginHeader"] {
  background: hsl(var(--sc-card)) !important;
  color: hsl(var(--sc-fg)) !important;
}
/* bui draws its own hairline under the toolbar as well. With the header now on
   the card ground the rule separates nothing, and it read as a third stray
   underline beneath the two above. */
[class*="bui-PluginHeaderToolbar"] {
  border-bottom: none !important;
}
/* Three canon components that read a different token from the one the map
   fills, so mapping alone leaves them looking like Backstage on an entity
   page. Measured on a group page with the map in place: --bui-border-1 was
   correctly our gold and --bui-fg-link correctly our accent, and neither
   reached the screen.
   Card draws no border at all and takes canon's 8px, beside MUI cards at
   var(--sc-radius) — two card shapes on one page. Link colours itself from
   --bui-fg-primary, so every link on those pages rendered as body text.
   No !important: these must lose to a mode sheet, which says the same thing
   at higher specificity when it wants something else (foudre's links are
   muted and underlined on purpose). Canon ships inside @layer, and an
   unlayered author rule beats a layered one whatever the order. */
[class~="bui-Card"] {
  border: var(--sc-border-w) solid hsl(var(--sc-border));
  border-radius: var(--sc-radius);
}
/* The card's own parts must NOT take that edge. A substring hook here matches
   bui-CardHeader and bui-CardBody as well, and the About panel then drew its
   header's border inside the card's -- two boxes where the design has one.
   ~= matches a whole class token, so only the card itself is named. The same
   family trap the PluginHeader rules carry a comment about. */
[class~="bui-Link"] {
  color: hsl(var(--sc-primary));
}
/* The API explorer's title sits on a different gutter from its own table.
   Its page is <HeaderPage> + <Content>, while every other native page is
   <Header> + <Container>: the header's slots ARE bui Containers
   (max-width: 120rem; margin-inline: auto; padding-inline: 20px), and
   BackstageContent is a full-width article padded 24px. So the title is 4px
   left of the table it heads, and once the content column passes 120rem the
   header centres while the table does not and the gap becomes hundreds of
   pixels. Squaring the header's containers with Content is the whole fix; the
   class is route-scoped because no other page pairs the two. Bounded by the
   breakpoint Content itself uses — below it Content drops to 16px and the two
   already agree. */
@media (min-width: 600px) {
  .sc-route-api-docs [class*="bui-HeaderTop"],
  .sc-route-api-docs [class*="bui-HeaderContent"],
  .sc-route-api-docs [class*="bui-HeaderBottom"] {
    max-width: none; margin-inline: 0; padding-inline: 24px; }
}
/* Heading scale for the pixel face.
   Sized by measurement, not by eye: the body face advances 'n' at ~0.55em,
   a third narrower than the old face's 0.875em, so each size below is the
   one at which a real page title occupies the same pixel width the old face
   did at the old size. Same layout, larger glyphs. Backstage's own 28-34px
   scale is still slightly too wide here, which is why these overrides remain
   at all; the smaller components no longer need one and have been dropped. */
h1, [class*="MuiTypography-h1"] { font-size: 29px !important; line-height: 1.35 !important; }
h2, [class*="MuiTypography-h2"] { font-size: 22px !important; line-height: 1.35 !important; }
h3, [class*="MuiTypography-h3"], [class*="MuiCardHeader-title"] { font-size: 19px !important; }
h4, h5, h6, [class*="MuiTypography-h4"], [class*="MuiTypography-h5"], [class*="MuiTypography-h6"] { font-size: 14px !important; }
/* BackstageInfoCard-header * (19px) and BackstageContentHeader-title (18px/1.35)
   are set in theme.tsx — see the comment above. */
.MuiDialogTitle-root { font-size: 16px !important; }

/* Native buttons get the same press as ours: the shadow collapses and the
   button moves into the space it occupied.

   Element-qualified on purpose: bui renders a bui-ButtonContent span *inside*
   bui-Button, and a bare [class*="bui-Button"] matches both, drawing the border
   and shadow twice — the inner box. */
[class*="MuiButton-root"], button[class*="bui-Button"], a[class*="bui-Button"] {
  border-radius: var(--sc-radius) !important;
  border: var(--sc-border-w) solid hsl(var(--sc-fg) / .8) !important;
  box-shadow: var(--sc-shadow) !important;
  transition: none !important;
}
/* Pressing highlights; it does not move anything. The arcade press-down was a
   2px translate, which shifted the button out from under the pointer, fought
   the filter-based glows the mode potions paint, and left anything anchored to
   the button a frame behind. An inset wash reads as pressed without moving a
   pixel. */
[class*="MuiButton-root"]:active:not(.Mui-disabled),
button[class*="bui-Button"]:active, a[class*="bui-Button"]:active {
  transform: none;
  box-shadow: inset 0 0 0 2em hsl(var(--sc-fg) / .14) !important;
}
.MuiButton-text, [class*="MuiButton-textPrimary"], [class*="MuiIconButton-root"] {
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
  /* The cap and ellipsis stay whatever the face: a long tag should be cut off
     rather than allowed to escape its column. The 11px that used to sit here
     was width compensation for the old, wider face and is no longer needed —
     the native 13px now renders narrower than that 11px override did. */
  max-width: 100%;
}
.MuiChip-label { overflow: hidden; text-overflow: ellipsis; }
[class*="MuiOutlinedInput-notchedOutline"] { border-width: var(--sc-border-w) !important; }
.MuiTableCell-head { color: hsl(var(--sc-muted-fg)) !important; }
/* Three components that had no rule at all and so rendered MUI's own defaults
   wherever a plugin uses them — visible on the TechDocs routes, which is also
   where the class arrives counter-suffixed. */
/* A toolbar is a strip of chrome, not a surface, so it takes the ink and
   inherits the ground. It named --sc-card here, which is right only when it
   happens to sit in a card: the scaffolder's filter toolbar sits directly on
   the page, so on every mode whose page is not white it painted a white slab
   around the search field. Invisible in the modes whose bg IS white, which is
   why it read as a Hermes and Flying Papers bug rather than a general one.
   The same mistake the field grounds had — naming a surface on something that
   is not one. */
[class*="MuiToolbar-root"] {
  background-color: transparent;
  color: hsl(var(--sc-fg));
}
[class*="MuiDivider-root"] {
  background-color: hsl(var(--sc-border));
  border-color: hsl(var(--sc-border));
}
/* v4's slider paints rail, track and thumb from the root's own colour, so one
   declaration covers all three rather than three slot selectors. */
[class*="MuiSlider-root"], [class*="MuiSlider-colorPrimary"] {
  color: hsl(var(--sc-primary));
}
/* The Profile card on /settings is MUI's default #bdbdbd circle. Clean class:
   /settings is not one of the three counter-suffixed routes. */
.MuiAvatar-root {
  background-color: hsl(var(--sc-accent));
  color: hsl(var(--sc-accent-fg));
  border: var(--sc-border-w) solid hsl(var(--sc-border));
}
/* No table-body override: the old face needed one because dense cells hit
   Backstage's word-break and snapped mid-word, but the native 14px in the body
   Sans measures narrower than the 12px this used to force, so the pressure the
   rule relieved is gone. */
/* Focus is a hard offset outline everywhere, never a glow. */
[class*="MuiButton-root"]:focus-visible, .MuiTab-root:focus-visible,
[class*="MuiIconButton-root"]:focus-visible, [class*="bui-Button"]:focus-visible {
  outline: var(--sc-border-w) solid hsl(var(--sc-ring)) !important;
  outline-offset: 2px;
}

/* accent — buttons, links, tabs, selection (all follow the picker) */
[class*="MuiButton-root"] { box-shadow: var(--sc-shadow) !important; }
[class*="MuiButton-containedPrimary"] { background-color: hsl(var(--sc-primary)) !important; color: hsl(var(--sc-primary-fg)) !important; }
[class*="MuiButton-outlinedPrimary"], [class*="MuiButton-textPrimary"] { color: hsl(var(--sc-primary)) !important; }
[class*="MuiLink-root"], a[class*="MuiTypography-colorPrimary"], [class*="MuiTypography-colorPrimary"] { color: hsl(var(--sc-primary)) !important; }
.MuiTabs-indicator { background-color: hsl(var(--sc-primary)) !important; }
.MuiTab-root { text-transform: none !important; font-weight: 600 !important; }
.MuiTab-textColorPrimary.Mui-selected, .Mui-selected { color: hsl(var(--sc-primary)) !important; }
/* A selected *row* is not a selected tab. The bare .Mui-selected above paints
   the accent on anything MUI marks selected, and MUI also gives such a row its
   own grey fill — so the catalog's picked filter ended up accent-on-grey, which
   measured 2.75:1 in hermes dark and under 4.5 in six modes. A row states its
   selection with the accent *surface* and takes the ink that surface is
   measured against; contrast.test.ts pins accentFg against accent for every
   mode, so this pairing cannot drift. */
.MuiListItem-root.Mui-selected,
.MuiMenuItem-root.Mui-selected {
  background-color: hsl(var(--sc-accent)) !important;
}
.MuiListItem-root.Mui-selected,
.MuiListItem-root.Mui-selected .MuiTypography-root,
.MuiMenuItem-root.Mui-selected,
.MuiMenuItem-root.Mui-selected .MuiTypography-root {
  color: hsl(var(--sc-accent-fg)) !important;
}
/* MUI's unselected toggle label is rgba(0,0,0,.38), which is its own idea of a
   muted ink and has no relationship to ours: on the settings page it measured
   2.66:1 against the card in claude light and was reported as unreadable. The
   selected one takes the accent surface for the same reason the row above
   does. */
.MuiToggleButton-root {
  color: hsl(var(--sc-muted-fg)) !important;
}
.MuiToggleButton-root.Mui-selected,
.MuiToggleButton-root.MuiToggleButton-selected {
  background-color: hsl(var(--sc-accent)) !important;
  color: hsl(var(--sc-accent-fg)) !important;
}
.MuiSwitch-colorPrimary.Mui-checked { color: hsl(var(--sc-primary)) !important; }
.MuiCheckbox-colorPrimary.Mui-checked, .MuiRadio-colorPrimary.Mui-checked { color: hsl(var(--sc-primary)) !important; }
.MuiChip-root { border-radius: var(--sc-radius) !important; }
/* ===== Graphs =====
   All three graphs are ours and drawn with React Flow, whose class names are
   literal and so survive a production build. Backstage's own SVG graph is no
   longer rendered: its selectors named generated class names, which production
   mangles to jss<n>, so they were dead in every deployed release while working
   perfectly on the dev server. */
/* The app visualizer draws Backstage's SVG graph, which is a different feature
   from the catalog graph and still exists. Its id is stable, so it can be
   reached without naming any generated class.
   The tree it draws is NOT the DependencyGraph default node: the plugin passes
   its own renderNode, which bypasses the four BackstageDependencyGraph*
   overrides in theme.tsx and hardcodes #90caf9, #9e9e9e, #2196f3, #757575 and
   #000000. Those are React props on "rect" and "text", so they render as SVG
   presentation attributes — bottom of the cascade, specificity 0 — and a plain
   author rule beats them without !important. The plugin distinguishes its two
   node kinds only by corner radius (rx=0 an extension node, rx=20 a group), so
   that is what these read. Scoped by the svg's own id, DEPENDENCY_GRAPH_SVG in
   core-components: nothing else in this app carries it, and our three graphs
   are React Flow.
   The canvas moves off the hardcoded near-black it used to share with the
   catalog graph: with the nodes now on the mode's card it would be the last
   thing on the page not following the potion, and in light mode it read as
   broken. The starfield stays where it was designed to live, on the React Flow
   canvas below. */
#dependency-graph {
  background-color: hsl(var(--sc-bg));
  border-radius: var(--sc-radius);
}
#dependency-graph rect[rx="0"] {
  fill: hsl(var(--sc-card));
  stroke: hsl(var(--sc-border));
}
#dependency-graph rect[rx="20"] {
  fill: hsl(var(--sc-muted));
  stroke: hsl(var(--sc-border));
}
/* The label is the rect's next sibling inside the node's own g, so this cannot
   reach an edge label, which theme.tsx already owns. */
#dependency-graph rect + text { fill: hsl(var(--sc-card-fg)); }
/* The visualizer's Detailed tab keeps its own hues on purpose. getOutputColor
   assigns a distinct colour per output type (reactElement, routePath, routeRef,
   apiFactory, plus a rotating palette) and computes its own text contrast: that
   is categorical data encoding, the same exception the experience bar's status
   colours take. Flattening the chips to one token destroys the legend, so no
   rules are added for them. */

/* ===== Catalog graph (our React Flow one) ===== */
.sc-graph-layout { display: grid; grid-template-columns: 280px 1fr; gap: 16px;
  align-items: start; min-width: 0; }
@media (max-width: 900px) { .sc-graph-layout { grid-template-columns: 1fr; } }
/* The node text colour, not a page token: this sits on .sc-graph-canvas, which
   is pinned to the starfield and is deliberately dark in BOTH registers. Read
   through --sc-muted-fg it measured 2.96:1 in light — an AA failure that only
   existed because a page token was used on a surface that ignores the page. */
.sc-graph-empty { display: flex; align-items: center; justify-content: center;
  height: 100%; min-height: 320px; padding: 24px; text-align: center;
  color: #e7e7ef; font-size: 13px; }
/* Nodes: the dark surface everywhere, the accent only on the rooted one. A
   graph where every node looks the same is a graph where re-rooting appears to
   do nothing, which is exactly how the built-in one failed. */
.react-flow__node.sc-graph-node { background: #17171f; color: #e7e7ef;
  border: var(--sc-border-w) solid #32303e; border-radius: var(--sc-radius);
  font-size: 11px; font-weight: 500; display: flex; align-items: center;
  justify-content: center; padding: 0 8px; text-align: center; }
.react-flow__node.sc-graph-node.root { background: hsl(var(--sc-primary) / .22);
  border-color: hsl(var(--sc-primary)); }
.react-flow__edge-path { stroke: rgba(255,255,255,.24) !important; }
.react-flow__edge-text { font-size: 10px; }
/* React Flow paints a white rect behind every edge label, which is a bright
   block on a near-black canvas. Match it to the space colour instead. */
.react-flow__edge-textbg { fill: #05050c !important; }
/* React Flow's own stylesheet is bundled and can load after ours, so these
   need !important to win rather than depending on injection order. */
.react-flow__edge-text { fill: #b9b9c6 !important; }

/* The canvas wrapper carries the space colour. It sits BELOW react-flow's
   background svg, which is what makes the stars visible — see the note on the
   .react-flow rule below. */
.sc-graph-canvas { background: ${STARFIELD.bg}; border-radius: var(--sc-radius); }
/* Transparent, NOT the space colour. React Flow renders its dot pattern into an
   svg with z-index:-1, which paints behind its parent's own background — so an
   opaque colour here hid the stars completely (the old grey ones too). The
   colour goes on the wrapper element instead, which sits below that svg. */
.react-flow, .react-flow__renderer, .react-flow__pane { background: transparent !important; }
.react-flow__node { border-radius: var(--sc-radius) !important; }
/* A graph node's text belongs to the node, not to the page.
   The canvas is the dark starfield in BOTH themes, and every node sets its own
   light text — but the .sc descendant rule above assigns a colour to every
   descendant, and
   a direct rule beats inheritance. So any element inside a node label (a span
   wrapping a line, a tooltip host, anything added later) silently took the
   page's foreground, which in light mode is dark text on the dark node.
   Scoped here rather than on each label because the fix has to survive the
   next person nesting one more element — it has already regressed once. Equal
   specificity to that rule, so this wins by sitting after it. */
.react-flow__node * { color: inherit; }
.react-flow__controls { box-shadow: none !important; }
.react-flow__controls button { background: #17171f !important; border-color: #32303e !important; }
.react-flow__controls button svg, .react-flow__controls-button svg { fill: #e7e7ef !important; }
.react-flow__attribution { display: none !important; }
/* [flare] React Flow marches its animated edges with a linear dashdraw. It is
   third-party motion, but it is visible motion, and smooth interpolation is
   the one thing this design does not do. Stepped here, and removed entirely
   under reduced motion by the block below. */
.react-flow__edge.animated path,
.react-flow__edge-path { animation-timing-function: steps(8) !important; }


/* flatten the gradient card headers (template / entity cards).
   The template card header is pixel art rather than a flat wash: four hard
   bands of the picked accent, dithered at each seam with a checkerboard, so it
   reads as an 8-bit sky. Every colour derives from --sc-primary, so the motif
   changes with the swatch. */
/* Selector note for every card-header rule below: Material-UI keeps a
   makeStyles name in the generated class only OUTSIDE production, so
   [class*="ItemCardHeader"] matched nothing in a built image while working
   perfectly on the dev server. Only Mui-prefixed classes survive, and the
   header is reliably the card's first element child. .sc-route-create scopes
   it to the templates page, because .MuiCard-root alone is every card in the
   app. This positional cycling cannot move into theme styleOverrides — nth-child
   is not expressible there. */
/* The template's NAME, and only the name.
   ItemCardHeader renders subtitle (the type) before title (the name), so the
   type led every card. It gives them stable tags rather than classes —
   subtitle is component="h3" and title is component="h4" — which is what makes
   this orderable without naming a class a production build would discard.
   The type is dropped outright: it repeats what the template's own copy
   already says and it was reading as the card's headline. */
.sc-route-create [class*="MuiCard-root"] > .MuiBox-root:first-child { display: flex; flex-direction: column; }
.sc-route-create [class*="MuiCard-root"] > .MuiBox-root:first-child > * { order: 3; }
.sc-route-create [class*="MuiCard-root"] > .MuiBox-root:first-child > h4 {
  order: 1;
  /* The name IS the card. It arrived at the header's inherited size, which read
     as a caption on a card whose whole job is to be picked from a grid. */
  font-size: 22px !important;
  font-weight: 600 !important;
  line-height: 1.2 !important;
  letter-spacing: -0.02em;
  color: hsl(0 0% 100%) !important;
  /* No plate at all now — the darkening is a shadow cast by the letters.

     The plate existed because white over the generated header scene measures as
     low as 1.27:1 on the bright art, and something has to carry that. A filled
     box is the blunt way to do it; an outline is the pixel way, and this is a
     pixel interface. Eight hard offsets at 1-2px wrap every glyph in the same
     near-black the plate used to be, and a 3px offset behind them reads as the
     drop shadow. No blur anywhere: a soft halo would be the one out-of-language
     thing on the card.

     Solved for the worst case rather than the average one. The sun scene is the
     brightest ground a title lands on, and white over it is the 1.27:1 measured
     above. With the outline, the glyph edge always meets near-black first, so
     what the reader resolves is white against the shadow — not white against
     whatever the scene happens to paint underneath.

     Centred because without a plate there is no box edge left to align to: the
     title is a caption over a scene now, and a caption sits in the middle of
     it. 22px is pinned by styles.test.ts. */
  text-shadow:
    1px 1px 0 hsl(240 12% 6% / .95),
    -1px 1px 0 hsl(240 12% 6% / .95),
    1px -1px 0 hsl(240 12% 6% / .95),
    -1px -1px 0 hsl(240 12% 6% / .95),
    2px 0 0 hsl(240 12% 6% / .95),
    -2px 0 0 hsl(240 12% 6% / .95),
    0 2px 0 hsl(240 12% 6% / .95),
    0 -2px 0 hsl(240 12% 6% / .95),
    3px 3px 0 hsl(240 12% 6% / .8);
  margin: 0;
  align-self: center;
  text-align: center;
  max-width: 100%;
}
/* The h3 holds ONE child, CardHeader's subtitleWrapper, and that wrapper holds
   two: the type text, then the detail + favourite buttons. Only the type text
   is unwanted, so the rule has to reach two levels down — hiding the h3, or
   hiding the wrapper, takes the buttons with it and removes the only route
   from a card to its Template entity. Both have been shipped by mistake.
   order 0 lifts the surviving button row above the title in the flex column,
   and flex-end parks it against the card's right edge. */
.sc-route-create [class*="MuiCard-root"] > .MuiBox-root:first-child > h3 {
  order: 0;
  align-self: flex-end;
  margin: 0;
  line-height: 1;
}
.sc-route-create [class*="MuiCard-root"] > .MuiBox-root:first-child > h3 > div > div:first-child { display: none; }

.sc-route-create [class*="MuiCard-root"] > .MuiBox-root:first-child {
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
/* [flare] Three scenes, not one. The built-in art only shows when no images are
   dropped into the branding folder, so it is the first impression on a fresh
   install — and it repeated identically down the whole grid.
   The sky, the dither and the meander frieze are shared, so the three read as
   one world; only the structure standing on the frieze changes. That structure
   is the same four rectangles in every scene, re-sized and re-placed, which is
   why this costs two rules rather than two more background stacks.
   Cards cycle 3n+1 / 3n+2 / 3n+3, the same way the supplied images cycle. */
.sc-route-create [class*="MuiCard-root"]:nth-child(3n + 2)
  > .MuiBox-root:first-child {
  /* The oracle flame: a taper, widest at its base. */
  background-size:
    4px 4px, 8px 4px, 12px 4px, 16px 4px,
    100% 2px, 100% 2px, 100% 8px, 100% 8px,
    16px 16px,
    100% 100% !important;
  background-position:
    86% calc(100% - 30px), 86% calc(100% - 26px),
    86% calc(100% - 22px), 86% calc(100% - 18px),
    0 calc(100% - 14px), 0 calc(100% - 4px),
    0 calc(100% - 12px), 0 calc(100% - 12px),
    0 0,
    0 0 !important;
}
.sc-route-create [class*="MuiCard-root"]:nth-child(3n + 3)
  > .MuiBox-root:first-child {
  /* The underworld gate: two posts under a lintel, with a step above it. */
  background-size:
    5px 16px, 5px 16px, 28px 4px, 18px 3px,
    100% 2px, 100% 2px, 100% 8px, 100% 8px,
    16px 16px,
    100% 100% !important;
  background-position:
    80% calc(100% - 14px), 94% calc(100% - 14px),
    87% calc(100% - 30px), 87% calc(100% - 33px),
    0 calc(100% - 14px), 0 calc(100% - 4px),
    0 calc(100% - 12px), 0 calc(100% - 12px),
    0 0,
    0 0 !important;
}
/* The title sits on art, so it needs its own contrast: a 1px outline in the
   opposite tone (dark behind light text, light behind dark) plus weight. The
   shade token flips with the scheme, alongside --sc-primary-fg. */
.sc-route-create [class*="MuiCard-root"] > .MuiBox-root:first-child,
.sc-route-create [class*="MuiCard-root"] > .MuiBox-root:first-child * {
  font-weight: 700 !important;
  text-shadow:
    1px 0 0 hsl(var(--sc-primary-shade)),
    -1px 0 0 hsl(var(--sc-primary-shade)),
    0 1px 0 hsl(var(--sc-primary-shade)),
    0 -1px 0 hsl(var(--sc-primary-shade)),
    2px 2px 0 hsl(var(--sc-primary-shade) / .55);
}
.sc-route-create [class*="MuiCard-root"] > .MuiBox-root:first-child * { color: hsl(var(--sc-primary-fg)) !important; }
/* tables */
.MuiTableCell-head, .MuiTableCell-root.MuiTableCell-head {
  text-transform: uppercase !important; font-size: 11px !important; font-weight: 700 !important;
  letter-spacing: .05em !important; color: hsl(var(--sc-muted-fg)) !important; }
/* Same reasoning as .sc-table: the cell rule is a separator and takes a
   quarter of the edge colour, not all of it. */
.MuiTableCell-root { border-color: hsl(var(--sc-border) / .25) !important; }

/* page + layout */
.sc-page { padding: 28px 32px; background: hsl(var(--sc-bg)); min-height: 100%; }
.sc-h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; margin: 0; color: hsl(var(--sc-fg)); }
.sc-sub { color: hsl(var(--sc-muted-fg)); margin-top: 4px; font-size: 14px; }
.sc-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 24px; }
.sc-grid { display: grid; gap: 16px; }
/* Home's cards are a grid of equals: stretch rather than start, so every box
   in a row is the same height, and the cards fill the cell they are given. A
   row of cards each shrunk to its own contents reads as a pile, not a grid. */
.sc-grid-2 { display: grid; gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  /* Every row as tall as the tallest, so the whole grid is one size rather
     than each row finding its own. */
  grid-auto-rows: 1fr;
  align-items: stretch; }
.sc-grid-2 > .sc-card { height: 100%; display: flex; flex-direction: column; }
/* A card asked to take two places does so, and its row still lines up because
   the row height is uniform. */
.sc-grid-2 > .sc-card.sc-span-2 { grid-column: span 2; }
/* The body takes the slack, so headers line up across the row. */
.sc-grid-2 > .sc-card > .sc-card-b { flex: 1 1 auto; }
.sc-action { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: var(--sc-radius);
  border: var(--sc-border-w) solid hsl(var(--sc-border)); text-decoration: none; transition: background .12s, border-color .12s; }
.sc-action:hover { background: hsl(var(--sc-primary) / .06); border-color: hsl(var(--sc-primary) / .4); }
.sc-action-l { font-weight: 600; color: hsl(var(--sc-fg)); }
.sc-action-h { font-size: 12px; }

/* card */
.sc-card { background: hsl(var(--sc-card)); color: hsl(var(--sc-card-fg));
  border: var(--sc-border-w) solid hsl(var(--sc-border)); border-radius: var(--sc-radius); overflow: hidden; }
/* A surface holding a table keeps its corners, and clips the table to them.
   This was square for a long time, and the reason is worth keeping: the table
   sits 1px inside its Paper and used to paint an opaque header background into
   the corner, so clipping cut the table's own corners off and not clipping let
   that square corner cover the surface's arc. Both shipped in turn, and zero
   was the only geometry where neither happened.
   What changed is the header: it no longer paints its own opaque ground, so
   there is nothing square left to fight the arc, and clipping simply follows
   it. Re-checked in the running app in both registers before this went back.
   Keep the two together — a radius without the clip brings the old bug back. */
.sc-card:has(table),
[class*="MuiCard-root"]:has(table),
.MuiPaper-root:has(table) {
  overflow: hidden !important;
  border-radius: var(--sc-radius) !important;
}
/* The template filter's search arrived as MUI's underline input: a rule under
   the text and nothing else, which is the one control on that page that looks
   like it belongs to a different app. It takes the same box every other field
   here has — edge, radius, and a ring when it is focused — and the underline
   pseudo-elements that would otherwise draw a second line under the box are
   turned off.
   The ground is inherited, not named: this field sits on a card, and it used
   to declare --sc-bg, which mismatched the card in 9 of the 11 modes. See the
   note on .sc-input below. */
.sc-route-create [class*="MuiInput-root"] {
  background: transparent;
  border: var(--sc-border-w) solid hsl(var(--sc-border));
  border-radius: var(--sc-radius);
  padding: 3px var(--sc-field-x);
}
/* Label position, notch and outline geometry used to live here, scoped to
   .sc-route-create. They now live in theme.tsx (MuiInputLabel /
   MuiOutlinedInput), because a route-scoped rule cannot tell MUI's standard
   variant from its outlined one: the inset that a boxed standard field needs
   pushed the outlined label off its own <legend> notch. This sheet may still
   colour an input; it must not move its label. */
.sc-route-create [class*="MuiInput-underline"]::before,
.sc-route-create [class*="MuiInput-underline"]::after {
  display: none !important;
}
.sc-route-create [class*="MuiInput-root"].Mui-focused {
  border-color: hsl(var(--sc-ring));
  box-shadow: 0 0 0 3px hsl(var(--sc-ring) / .25);
}

/* A table's title is the heading of the thing under it, and it arrived at
   14px — smaller than the card titles beside it and no larger than its own
   column headers. Scoped to the toolbar so it cannot reach an h5 in prose. */
[class*="MuiToolbar-root"] [class*="MuiTypography-h5"],
[class*="MuiToolbar-root"] [class*="MuiTypography-h6"] {
  font-size: 19px !important;
  font-weight: 700 !important;
  letter-spacing: -0.02em !important;
}
/* The action that sits above a table — Create, Register, Refresh — is the one
   control on the page most likely to be wanted, and it was set at the 400 the
   uppercase chrome rule gives everything. */
[class*="MuiButton-root"], [class*="bui-Button"] {
  font-weight: 700 !important;
}
/* And the scroll goes on the container that owns the width, so a wide table
   scrolls rather than being cut. */
.MuiTableContainer-root { overflow-x: auto; max-width: 100%; }
.sc-card-h { padding: 18px 20px 0; }
/* Title and its optional action share a row; the action keeps to the right and
   never squeezes the title, which wraps first. */
.sc-card-hrow { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.sc-card-action { flex: 0 0 auto; font-size: 13px; }
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
/* Neutral at rest, red under the pointer. A control that ends a running
   workflow sits in a toolbar beside ordinary ones, and a permanently red button
   there reads as an error the page is reporting rather than an action offered.
   The colour arrives on the reach, which is when the warning is useful.
   Layered on a variant rather than replacing one, so it keeps that variant's
   geometry: .sc-btn-outline .sc-btn-danger is an outline button that turns. */
.sc-btn-danger:hover:not(:disabled),
.sc-btn-danger:focus-visible:not(:disabled) {
  background: hsl(var(--sc-destructive) / .12);
  border-color: hsl(var(--sc-destructive));
  color: hsl(var(--sc-destructive));
}
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
.sc-badge-muted { --sc-cell: hsl(240 5% 62% / .38); color: hsl(var(--sc-on-muted)); }
.sc-badge-primary { --sc-cell: hsl(var(--sc-primary) / .22);
  color: color-mix(in srgb, hsl(var(--sc-primary)) 52%, black); }
.sc-badge-success { --sc-cell: hsl(var(--sc-success) / .26); color: hsl(var(--sc-on-success)); }
.sc-badge-warning { --sc-cell: hsl(var(--sc-warning) / .3); color: hsl(var(--sc-on-warning)); }
.sc-badge-destructive { --sc-cell: hsl(var(--sc-destructive) / .24); color: hsl(var(--sc-on-destructive)); }

/* table */
.sc-table { width: 100%; border-collapse: collapse; font-size: 14px; }
/* A row rule is a separator, not an edge. At full strength it is the same
   weight as the card's own border, and on a dark ground that reads as a bright
   line every row -- literally white in Slush, whose border token IS 0 0% 100%,
   and near-white in Foudre. The MUI table this sits beside already draws its
   rules at a quarter, so matching it also stops one card's table looking
   heavier than the next. */
.sc-table th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: .05em; color: hsl(var(--sc-muted-fg));
  border-bottom: 1px solid hsl(var(--sc-border) / .25); }
.sc-table td { padding: 12px 14px; border-bottom: 1px solid hsl(var(--sc-border) / .25); color: hsl(var(--sc-fg)); }
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
/* Compact variant, for a select that sits in a card header beside a title. */
.sc-select-sm { height: 28px; padding: 0 26px 0 8px; font-size: 12px; }
/* collapsible JSON viewer */
.sc-json { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.sc-json-bar { display: flex; gap: 8px; flex-wrap: wrap; }
/* min-width:0 is what makes overflow-x actually engage. A flex or grid item
   defaults to min-width:auto, so one long unbreakable line grows the item
   instead of scrolling inside it, and an ancestor clips it at the window edge —
   which is how a param carrying a dumped JSON payload disappeared off-screen
   with no scrollbar to reach it. */
.sc-json-body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px;
  line-height: 1.7; background: hsl(var(--sc-muted) / .4); border: var(--sc-border-w) solid hsl(var(--sc-border));
  border-radius: var(--sc-radius); padding: 12px 14px; overflow-x: auto;
  min-width: 0; max-width: 100%; }
.sc-json-children { padding-left: 16px; border-left: 1px solid hsl(var(--sc-border)); margin-left: 4px;
  min-width: 0; }
/* Structure stays on one line so the tree still reads as a tree; a long scalar
   wraps, because a serialised payload is one unbroken token that no amount of
   horizontal scrolling makes readable. */
.sc-json-row { white-space: nowrap; min-width: 0; }
.sc-json-string, .sc-json-number { white-space: pre-wrap; overflow-wrap: anywhere; }
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
/* A string that is itself a JSON document keeps its quotes and takes the string
   colour on its braces, so the subtree reads as "a string containing this"
   rather than as a real nested object. The difference decides what the workflow
   receives: a string param arrives escaped where an object arrives clean. */
.sc-json-embedded > .sc-json-row > .sc-json-punc,
.sc-json-embedded > .sc-json-row > .sc-json-collapsed { color: hsl(152 42% 42%); }
:root.sc-dark .sc-json-embedded > .sc-json-row > .sc-json-punc,
:root.sc-dark .sc-json-embedded > .sc-json-row > .sc-json-collapsed { color: hsl(152 45% 60%); }

/* [flare] Approval progress: cells plus the literal count. A bar alone says
   "some of it is done"; the number says which. */
.sc-approvals { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.sc-approvals-bar { display: flex; gap: 3px; }
.sc-approvals-cell { width: 18px; height: 14px;
  border: var(--sc-border-w) solid hsl(var(--sc-border));
  background: hsl(var(--sc-muted)); }
.sc-approvals-cell.filled { background: hsl(var(--sc-primary));
  border-color: hsl(var(--sc-primary)); }
.sc-approvals-count { font-family: var(--sc-font-ui); font-size: 12px;
  color: hsl(var(--sc-muted-fg)); }

/* [flare] Empty states are panels, not stray sentences. The bobbing sprite
   already had a rule here and no component to hang it on. */
.sc-empty { display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 22px 16px; text-align: center;
  border: var(--sc-border-w) dashed hsl(var(--sc-border));
  border-radius: var(--sc-radius); color: hsl(var(--sc-muted-fg)); }
/* The rects need the colour too, not just the svg: fill="currentColor" resolves
   per element, and the global .sc * rule gives each rect its own dark colour. */
.sc-empty .sc-state-ic, .sc-empty .sc-state-ic * {
  color: hsl(var(--sc-primary)); }
/* 32px = 2x the 16px sprite. 24px was 1.5x, which only looks right where the
   device pixel ratio is even: at dpr 2 it lands on 3 device pixels per sprite
   pixel, but at dpr 1 it is 1.5 and crispEdges rounds alternate columns to 1px
   and 2px — a visibly lopsided sprite on any non-retina screen. Keep every
   size an integer multiple of SPRITE_SIZE. */
.sc-empty .sc-state-ic { width: 32px; height: 32px; }
.sc-empty-title { font-family: var(--sc-font-ui); text-transform: uppercase;
  font-size: 13px; color: hsl(var(--sc-fg)); }
.sc-empty-hint { font-size: 12px; max-width: 32ch; }

/* [suspend] The mid-workflow approval gate. Yellow edge, matching the node in
   the graph and the request badge: one signal, three places. */
.sc-suspend { border-left: 3px solid hsl(var(--sc-warning));
  padding-left: 12px; margin-bottom: 14px; }
.sc-suspend-step { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.sc-suspend-msg { margin: 0 0 10px; color: hsl(var(--sc-muted-fg)); font-size: 13px; }
.sc-suspend-inputs { margin-bottom: 12px; }
.sc-req { color: hsl(var(--sc-warning)); }
.sc-help { margin: 4px 0 10px; font-size: 12px; color: hsl(var(--sc-muted-fg)); }

/* [quickstart] A dialogue box in the corner, not a modal per step: the point
   is to show people the app, and a modal hides the app. The ring is drawn as a
   fixed overlay so it can sit over anything without the page needing to know. */
.sc-qs { position: fixed; inset: 0; z-index: 2500; pointer-events: none; }
.sc-qs-ring { position: fixed; border: 3px solid hsl(var(--sc-primary));
  border-radius: var(--sc-radius); pointer-events: none;
  /* The dim is the ring's own shadow, so there is one element and no gap
     between the cut-out and the overlay to line up. */
  box-shadow: 0 0 0 9999px hsl(var(--sc-fg) / .45); }
.sc-qs-box { position: fixed; right: 18px; bottom: 18px; width: 320px;
  pointer-events: auto; padding: 14px 16px 12px;
  background: hsl(var(--sc-card)); border-radius: var(--sc-radius);
  border: var(--sc-border-w) solid hsl(var(--sc-border));
  box-shadow:
    0 0 0 2px hsl(var(--sc-card)),
    0 0 0 4px hsl(var(--sc-fg) / .85),
    var(--sc-shadow); }
/* The 78px is clearance for the picker sitting in the same corner. Once the
   picker has been moved, the tour box can have the space back. */
/* The picker docks bottom-LEFT now, so the tour box no longer has to clear it.
   A dragged picker can still be anywhere, which is what needsFlip handles. */
:root:not([data-picker-moved='true']) .sc-qs-box { bottom: 18px; }
/* …and when even that is not enough — the picker is draggable, so it can be
   parked exactly here — the box moves to the opposite end rather than sitting
   on top of the element it is describing. Decided in Quickstart.tsx from the
   measured rects, because no fixed offset can cover an element that moves. */
.sc-qs-box-top { top: 18px; bottom: auto; }
.sc-qs-count { font-family: var(--sc-font-ui); font-size: 11px;
  color: hsl(var(--sc-muted-fg)); }
.sc-qs-title { font-family: var(--sc-font-ui); text-transform: uppercase;
  font-size: 14px; margin: 4px 0 8px; color: hsl(var(--sc-fg)); }
.sc-qs-body { font-size: 13px; line-height: 1.5; margin: 0 0 12px;
  color: hsl(var(--sc-muted-fg)); }
.sc-qs-actions { justify-content: flex-end; gap: 6px; }
/* The continue marker every dialogue box in this app carries. */
.sc-qs-box::after { content: '\\25BC' / ''; position: absolute;
  right: 8px; bottom: 2px; font-size: 9px; color: hsl(var(--sc-primary)); }

/* [xp] Workflow progress as an experience bar: a rupee, a track, and the count
   beside it. The count is the same done/total the fill is drawn from, so the
   decoration can never claim progress the workflow has not made. */
.sc-xp { display: flex; align-items: center; gap: 10px; margin-bottom: 14px;
  position: relative; }
.sc-xp-rupee { width: 18px; height: 18px; flex: 0 0 auto;
  color: hsl(var(--sc-fg) / .8); }
.sc-xp-track { flex: 1 1 auto; height: 14px; overflow: hidden;
  background: hsl(var(--sc-muted));
  border: var(--sc-border-w) solid hsl(var(--sc-border));
  border-radius: var(--sc-radius-sm); }
/* The fill takes its colour from the run, not from the picked accent: yellow
   while it works, green when it lands, red when it does not. Those three read
   the same in every scheme, which is the whole point — a bar that is violet on
   Tuesday and amber on Wednesday tells you nothing at a glance.
   --sc-xp-tone is set per state below; the cell pattern is written once. */
.sc-xp-fill { position: relative; height: 100%;
  background: hsl(var(--sc-xp-tone));
  background-image: repeating-linear-gradient(90deg,
    hsl(var(--sc-xp-tone)) 0 6px, hsl(var(--sc-xp-tone) / .72) 6px 12px); }
.sc-xp-running { --sc-xp-tone: var(--sc-warning); }
.sc-xp-done { --sc-xp-tone: var(--sc-success); }
.sc-xp-failed { --sc-xp-tone: var(--sc-destructive); }
/* Ink on yellow: the creatures are white on the accent bar, which vanishes
   against warning. */
.sc-xp-running .sc-xp-creep { color: hsl(var(--sc-fg) / .75); }
.sc-xp-running .sc-xp-count { color: hsl(var(--sc-on-warning)); }
.sc-xp-failed .sc-xp-count { color: hsl(var(--sc-on-destructive)); }
.sc-xp-done .sc-xp-count { color: hsl(var(--sc-on-success)); }
.sc-xp-count { font-family: var(--sc-font-ui); font-size: 12px;
  color: hsl(var(--sc-muted-fg)); flex: 0 0 auto; }
/* The creatures live inside the fill, so their run is bounded by real
   progress rather than by the width of the card. */
.sc-xp-creep { position: absolute; bottom: 1px; width: 8px; height: 8px;
  color: hsl(var(--sc-primary-fg) / .9); }
.sc-xp-creep svg { width: 8px; height: 8px; display: block; }
/* One frame at a time; both are rendered so the swap costs nothing. */
.sc-creep-b { display: none; }
.sc-xp-dots { display: inline-block; width: 1.6em; text-align: left; }
.sc-xp-banner { position: absolute; right: 0; top: -18px;
  font-family: var(--sc-font-ui); font-size: 12px;
  color: hsl(var(--sc-primary)); }
.sc-xp-gameover .sc-xp-banner { color: hsl(var(--sc-destructive)); }
.sc-xp-levelup .sc-xp-banner { color: hsl(var(--sc-success)); }

/* [flare] The tour button.
   Hover is the sidebar's own selected treatment — a muted wash of the picked
   accent — so selection looks the same wherever it happens. */
.sc-tour { position: relative; overflow: visible; }
/* Shared with any button that should light up in the picked accent on hover —
   the same treatment the sidebar uses for selection, so "this is the one you
   are about to act on" looks identical wherever it happens. */
.sc-tour:hover:not(:disabled), .sc-tour:focus-visible,
.sc-btn-accent:hover:not(:disabled), .sc-btn-accent:focus-visible {
  background: hsl(var(--sc-primary) / .10);
  border-color: hsl(var(--sc-primary) / .45);
  color: hsl(var(--sc-primary));
}
/* Six sparkles around the button, hidden until it is hovered. Absolutely
   positioned so they never affect the button's own size. */
.sc-tour-stars { position: absolute; inset: -8px; pointer-events: none; }
/* The rects need the colour too, not just the svg: fill="currentColor"
   resolves per element and the global .sc * rule hands each rect its own. */
.sc-tour-star, .sc-tour-star * { color: hsl(var(--sc-primary)); }
.sc-tour-star { position: absolute; width: 8px; height: 8px; opacity: 0; }
.sc-tour-star-0 { top: 0; left: 6px; }
.sc-tour-star-1 { top: -2px; left: 46%; }
.sc-tour-star-2 { top: 4px; right: 8px; }
.sc-tour-star-3 { bottom: 0; left: 18px; }
.sc-tour-star-4 { bottom: -2px; left: 58%; }
.sc-tour-star-5 { bottom: 5px; right: 4px; }
/* Without motion they simply appear: still stars, not a smudge. */
.sc-tour:hover .sc-tour-star, .sc-tour:focus-visible .sc-tour-star { opacity: 1; }

/* success notice (e.g. created-resource link) */
.sc-notice { padding: 10px 14px; border-radius: var(--sc-radius); font-weight: 500;
  --sc-cell: hsl(var(--sc-success) / .26);
  background-color: transparent;
  background-image: repeating-conic-gradient(var(--sc-cell) 0% 25%, transparent 0% 50%);
  background-size: 4px 4px;
  color: hsl(var(--sc-on-success));
  border: 1px solid hsl(var(--sc-success) / .45); }
/* Same shelf, other outcome. The text colour is stated for both schemes rather
   than inherited: the success notice above fixes one colour, which only reads
   on a light background. */
.sc-notice-fail { --sc-cell: hsl(var(--sc-destructive) / .26);
  color: hsl(0 62% 28%);
  border-color: hsl(var(--sc-destructive) / .45); }
:root.sc-dark .sc-notice-fail { color: hsl(0 75% 80%); }

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
/* [flare] PRESS START, in pixel type and blinking. The button below it still
   says what it does. */
.sc-press-start { font-family: var(--sc-font-ui); text-transform: uppercase;
  letter-spacing: .06em; color: hsl(var(--sc-primary)); }
.sc-login-pick { margin-top: 20px; padding-top: 18px; border-top: 1px solid hsl(var(--sc-border)); width: 100%;
  display: flex; justify-content: center; }

.sc-table tr:last-child td { border-bottom: none; }
/* Hover is a dither too, so the selected row reads as a filled cell block
   rather than a soft tint. Row text is --sc-fg, so contrast is unaffected. */
/* Rows sit on the card, not on the page. The catalog's table shipped its rows
   at the page background — rgb(15,14,21) inside a card of rgb(20,18,26) —
   which reads as a foreign band laid inside the panel rather than as part of
   it. The stripe stays, because it is what lets the eye track a wide row, but
   it is a hair of the muted token over the card instead of a different colour
   altogether. */
[class*="MuiTableRow-root"],
[class*="MuiTableBody-root"] [class*="MuiTableRow-root"] {
  background-color: transparent !important;
}
.sc-table tbody tr:nth-child(even),
[class*="MuiTableBody-root"] [class*="MuiTableRow-root"]:nth-child(even) {
  background-color: hsl(var(--sc-muted) / .3) !important;
}
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
  font-family: var(--sc-font-ui); font-size: 10px;
  color: hsl(var(--sc-primary));
}

/* input.
   A field takes the ground of whatever it is sitting on, so it names no ground
   token at all. These declared --sc-bg while every one of them is mounted on a
   card or a toolbar, which is --sc-card: measured on the built app, the two
   differed in 9 of the 11 modes, and the two that agreed did so only because
   they happen to set both tokens to the same white. Transparent is correct in
   every mode by construction — there is no second token left to disagree — and
   it is what the catalog and search fields already do. The edge, the radius
   and the focus ring are what make it read as a field. */
.sc-input, .sc-select { height: 36px; width: 100%; padding: 0 10px; font-size: 14px;
  border-radius: var(--sc-radius); border: 1px solid hsl(var(--sc-input));
  background: transparent; color: hsl(var(--sc-fg)); outline: none; font-family: inherit; }
.sc-input:focus, .sc-select:focus { border-color: hsl(var(--sc-ring)); outline: var(--sc-border-w) solid hsl(var(--sc-ring)); outline-offset: 2px; box-shadow: none; }
.sc-textarea { height: auto; min-height: 92px; padding: 8px 10px; line-height: 1.45;
  font-family: var(--sc-font-mono, ui-monospace, monospace); resize: vertical; }
.sc-label { font-size: 13px; font-weight: 500; color: hsl(var(--sc-fg)); display: block; margin-bottom: 6px; }
.sc-field { margin-bottom: 14px; }
.sc-link { color: hsl(var(--sc-primary)); text-decoration: none; font-weight: 500; }
.sc-link:hover { text-decoration: underline; }
.sc-muted { color: hsl(var(--sc-muted-fg)); }
.sc-row { display: flex; align-items: center; gap: 8px; }
/* The graph filters put a bare <input type="checkbox"> in a .sc-row, which
   renders the OS's own blue tick beside nine themed potions. accent-color is
   the whole fix — repainting the box by hand costs an appearance: none and a
   hand-drawn tick, and the native control is already the right shape.
   ponytail: the sibling <select> needs nothing — GraphDirection already gives
   it .sc-select, which is the token ground/border/radius this would add. */
.sc-row input[type="checkbox"] { accent-color: hsl(var(--sc-primary)); }
.sc-kv { display: grid; grid-template-columns: 140px 1fr; gap: 6px 16px; font-size: 14px; }
.sc-kv dt { color: hsl(var(--sc-muted-fg)); }
/* min-width:0 so a long value scrolls inside its own cell. A grid item defaults
   to min-width:auto, so one unbreakable line widens the whole column and the
   card clips it at the window edge instead. */
.sc-kv dd { margin: 0; color: hsl(var(--sc-fg)); min-width: 0; overflow-wrap: anywhere; }

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
/* The brand mark and every row icon share one left edge. A row insets its
   content by 2px of transparent border plus 10px of padding, so the brand gets
   the same 12px and the row's own side padding goes to zero rather than being
   added on top of it. Before this the mark sat at 18px and the icons at 24px. */
.sc-nav-top { display: flex; align-items: center; justify-content: space-between; padding: 4px 0 14px; }
.sc-nav-brand { padding-left: 12px; }
.sc-nav-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; min-width: 0; }
.sc-nav-mark { width: 26px; height: 26px; border-radius: var(--sc-radius); flex: 0 0 auto;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, hsl(var(--sc-primary)), hsl(var(--sc-primary) / .65));
  box-shadow: var(--sc-shadow); }
.sc-nav-mark svg, .sc-nav-mark img { width: 17px; height: 17px; color: hsl(var(--sc-primary-fg)); object-fit: contain; }
.sc-nav-word { font-weight: 700; font-size: 17px; letter-spacing: -0.02em; color: hsl(var(--sc-fg)); white-space: nowrap; }
/* The sidebar's collapse control: one 26px square.
   .sc-picker-toggle used to share this rule, back when the picker had a
   separate chevron. It does not any more — the class now marks the equipped
   bottle that opens the tray, which is a .sc-potion and takes that rule's
   geometry. A bordered box drawn behind it would be a second control. */
.sc-nav-toggle { flex: 0 0 auto; width: 26px; height: 26px; border-radius: var(--sc-radius); border: var(--sc-border-w) solid hsl(var(--sc-border));
  background: transparent; color: hsl(var(--sc-muted-fg)); cursor: pointer; font-size: 13px; line-height: 1;
  display: flex; align-items: center; justify-content: center; }
.sc-nav-toggle:hover { background: hsl(var(--sc-accent)); color: hsl(var(--sc-fg)); }
.sc-nav-toggle:focus-visible {
  outline: var(--sc-border-w) solid hsl(var(--sc-ring)); outline-offset: 2px; }
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
.sc-nav.collapsed .sc-nav-item { justify-content: center; padding: 9px 0; }
/* Collapsed, the brand mark and every nav icon sit in the SAME 26px box,
   centred on the rail — so they share one vertical axis by construction rather
   than by two independent padding sums happening to agree. They did not agree:
   the row kept .sc-nav-top's side padding while the items kept their own, and
   the icons ended up off the logo's centre line. */
.sc-nav.collapsed .sc-nav-brand,
.sc-nav.collapsed .sc-nav-ic {
  width: 26px;
  justify-content: center;
}
/* Collapsed, the row's 2px left border and the 12px brand inset would each
   shift one of the two off the rail's centre line, and the cursor would take
   12px of a 44px rail. All three go. The active row is still marked by the
   ::before bar. */
.sc-nav.collapsed .sc-nav-brand { padding-left: 0; }
.sc-nav.collapsed .sc-nav-item { border-left-width: 0; }
.sc-nav.collapsed .sc-nav-cursor { display: none; }
/* Collapsed, the brand mark and the toggle stack instead of sitting side by
   side. The arithmetic is why: the rail is 68px, less .sc-nav's 24px of padding
   and .sc-nav-top's 12px leaves a 32px row — and it was being asked to hold a
   26px mark AND a 26px toggle, both flex: 0 0 auto. 52px into 32px overran the
   box and overflow-x: hidden clipped the result, so the two controls appeared
   to sit on top of each other. In a column each is 26px against 44px of width
   and neither has to shrink. */
.sc-nav.collapsed .sc-nav-top {
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding: 4px 0 14px;
}
/* Force the content gutter to match the nav width (hashed SidebarPage class). */
/* Content offset for the fixed nav, and its mobile override, both live in the
   theme (BackstageSidebarPage.styleOverrides.root). */
@media (max-width: 600px) { .sc-nav { display: none; } }

/* color scheme picker */
/* [flare] The colour picker is a potion box: a shelf of bottles, each holding
   its scheme as liquid. The shelf floor is a hard 3px rule the potions stand
   on, so they read as objects placed rather than icons laid out. */
.sc-picker { display: flex; align-items: flex-end; gap: 2px;
  /* The tray is position: absolute and opens against its shelf. The floating
     instance resolves it off .sc-picker-float's fixed placement; the sign-in
     card's has no positioned ancestor at all, so without this the tray escapes
     to the viewport. Harmless for the floating one, which overrides it. */
  position: relative;
  padding: 8px 10px 5px; border-radius: var(--sc-radius);
  background: hsl(var(--sc-card));
  border: var(--sc-border-w) solid hsl(var(--sc-border));
  border-bottom: 5px solid hsl(var(--sc-fg) / .8);
  /* A floating window, so it takes the command-window frame too. */
  box-shadow:
    0 0 0 2px hsl(var(--sc-card)),
    0 0 0 4px hsl(var(--sc-fg) / .85),
    var(--sc-shadow); }
/* Only the floating instance is pinned to the corner; in the flow it is a
   shelf like any other block, which is how the sign-in card carries one. */
/* Docked at the bottom of the sidebar. The shelf is 190px and the nav is
   resizable from 180px (68px collapsed), so it has to fold rather than
   overhang: CustomNav writes the live width onto --sc-nav-w, so the shelf
   re-flows with the same drag that resizes the nav. z-index 1500 against the
   nav's 1200 puts it above the nav rather than clipped by it. */
.sc-picker-float { position: fixed; left: 8px; bottom: 14px; z-index: 1500;
  cursor: grab; touch-action: none;
  max-width: calc(var(--sc-nav-w) - 16px);
  flex-wrap: wrap; justify-content: center; }
/* Once dragged, inline left/top drive it — the corner anchors have to go or the
   box would be pinned by both edges and stretch instead of move. It is free of
   the sidebar then, so the width cap goes with them. */
:root[data-picker-moved='true'] .sc-picker-float {
  left: auto; bottom: auto; max-width: none; flex-wrap: nowrap; }
/* Collapsed is a 68px icons-only rail; a colour shelf folded into six rows
   there is noise, not a control. A dragged picker is unaffected — it is no
   longer in the sidebar. The attribute is set by CustomNav rather than a
   sibling selector, because the nav and the picker mount from different trees
   and are not siblings in the DOM. */
:root[data-nav-collapsed='true']:not([data-picker-moved='true']) .sc-picker-float {
  display: none; }
/* Never selectable, not just while dragging: the shelf is a row of buttons with
   no text to select, and applying this only after the 4px threshold meant the
   first few pixels of every drag started a text selection instead — which then
   fought the drag for the rest of the gesture. */
.sc-picker-float { -webkit-user-select: none; user-select: none; }
.sc-picker-float[data-dragging='true'] { cursor: grabbing; }
/* The sign-in card has its own shelf under the button, so the corner one would
   be a second identical picker on the same screen. */
:root.sc-signed-out .sc-picker-float { display: none; }

/* Shut, the shelf carries one bottle and its two controls, and must never fold
   that to a second row. There is no transition on the collapse: it swaps one
   child for eleven rather than animating a width, so the correct amount of
   motion is none. */

/* Each bottle sits in its own slot on the shelf. Positioned, so the sparkles
   on the equipped one have something to anchor to. */
.sc-potion { position: relative; width: 26px; height: 26px; padding: 0; cursor: pointer;
  background: none; border: none; line-height: 0;
  color: hsl(var(--sc-fg) / .85); }
/* The sprite is decoration inside the button, and an svg child will otherwise
   take the click for itself — the button is the target, always. */
.sc-potion svg { width: 100%; height: 100%; display: block; pointer-events: none; }
/* Picking one lifts it off the shelf — the same 2px the buttons press by,
   in the other direction. */
.sc-potion:hover { transform: translateY(-2px); }
.sc-potion[aria-pressed="true"] { transform: translateY(-3px); }
.sc-potion[aria-pressed="true"] svg {
  /* The chosen bottle is the only one that glows, and the glow is its own
     liquid colour rather than the accent — which is the same thing here. */
  filter: drop-shadow(0 0 3px hsl(var(--sc-primary)));
}
.sc-potion:focus-visible { outline: var(--sc-border-w) solid hsl(var(--sc-ring));
  outline-offset: 2px; }
/* [flare] The equipped bottle sparkles while the shelf is shut — the same
   PixelStar sprite the tour button bursts with, not a second technique.
   Written after the two .sc-potion svg rules above and at matching specificity
   on purpose: those size every sprite in the button to fill it and hand the
   chosen one a drop-shadow, and a 6px star wants neither. */
.sc-potion .sc-potion-stars { position: absolute; inset: -5px; pointer-events: none; }
.sc-potion .sc-potion-stars svg { position: absolute; display: block;
  width: 6px; height: 6px; filter: none;
  color: hsl(var(--sc-primary));
  /* Lit is the static default. Motion may take the star away and put it back;
     it may not be what makes it appear. */
  opacity: 1; }
.sc-potion-star-0 { top: 0; left: -2px; }
.sc-potion-star-1 { top: 32%; right: -2px; }
.sc-potion-star-2 { bottom: 1px; left: 24%; }

/* The inventory: every equippable potion as a named row with its own action.
   Eleven modes plus the accents outgrew a two-row strip of unlabelled bottles,
   so this is the way to browse them; the strip stays as the quick shelf. It
   hangs above the box rather than inside it, and takes the same command-window
   frame the box has. */
.sc-picker-inv { position: absolute; left: 0; bottom: calc(100% + 10px);
  width: 214px; max-height: 56vh; overflow-y: auto; padding: 8px; cursor: default;
  background: hsl(var(--sc-card)); color: hsl(var(--sc-fg));
  border: var(--sc-border-w) solid hsl(var(--sc-border));
  border-bottom: 5px solid hsl(var(--sc-fg) / .8);
  border-radius: var(--sc-radius);
  box-shadow:
    0 0 0 2px hsl(var(--sc-card)),
    0 0 0 4px hsl(var(--sc-fg) / .85),
    var(--sc-shadow); }
/* A tray of bottles. The row used to be a swatch, a name and an Equip button
   all saying the same thing; the bottle is the control now and the name lives
   on it, where a pointer and a screen reader both already look. */
.sc-inv-list { list-style: none; margin: 0; padding: 0;
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
.sc-inv-row { display: block; }
.sc-inv-potion { position: relative; display: block; width: 100%; padding: 5px 2px;
  cursor: pointer; line-height: 0; border-radius: var(--sc-radius-sm);
  border: var(--sc-border-w) solid transparent; background: none;
  color: hsl(var(--sc-fg) / .85); }
.sc-inv-potion svg { width: 24px; height: 24px; display: block; margin: 0 auto;
  pointer-events: none; }
.sc-inv-potion:hover { background: hsl(var(--sc-accent));
  border-color: hsl(var(--sc-border)); color: hsl(var(--sc-fg)); }
/* The equipped bottle keeps a filled slot AND aria-pressed, so the state is
   never carried by the fill alone. */
.sc-inv-potion[aria-pressed="true"] { background: hsl(var(--sc-primary) / .18);
  border-color: hsl(var(--sc-primary)); color: hsl(var(--sc-fg)); }
.sc-inv-potion:focus-visible { outline: var(--sc-border-w) solid hsl(var(--sc-ring));
  outline-offset: 2px; }
/* The cast. Stars around the bottle that was just taken off the tray, drawn
   lit by default so the reduced-motion path — which skips the wait entirely
   and equips at once — never shows a half-finished effect. */
.sc-cast-stars { position: absolute; inset: -2px; pointer-events: none; }
.sc-cast-stars svg { position: absolute; display: block;
  width: 7px; height: 7px; color: hsl(var(--sc-primary)); }
.sc-cast-star-0 { top: 0; left: 8%; }
.sc-cast-star-1 { top: 12%; right: 6%; }
.sc-cast-star-2 { bottom: 6%; left: 4%; }
.sc-cast-star-3 { bottom: 0; right: 12%; }
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

/* ===== Register an existing component =====
   The one flow built almost entirely from raw MUI — a stepper, a bare form,
   plain Typography — so it arrived with none of the design layer while every
   other page inherited it.
   This route mounts its own JSS class-name generator, and it is the only one
   that does: measured on a production build, 83 of its 90 MUI classes arrive
   counter-suffixed (MuiStepLabel-label-234, MuiBox-root-27) against 0 of ~90
   on /catalog. A CSS class selector matches whole tokens, so .MuiStepLabel-label
   cannot match class="MuiStepLabel-label-234" and every exact-class rule here
   was dead. The attribute-substring form matches both spellings, so it is
   correct on the dev server and in the image alike.
   The exact-class rules were rewritten in place rather than duplicated: these
   are route-scoped, so they cover nothing else and a second spelling would be
   dead weight. The GLOBAL Mui rules further down are a different matter and
   stay as they are.
   Note [class*="MuiStepLabel-label"] also matches MuiStepLabel-labelContainer.
   That is harmless — the container is a bare wrapper span and the label
   inherits the same declarations anyway. */
.sc-route-import [class*="MuiStepper-root"] {
  background: transparent !important;
  padding: 8px 0 16px !important;
}
.sc-route-import [class*="MuiStepLabel-label"] {
  font-family: var(--sc-font-ui) !important;
  text-transform: uppercase;
  letter-spacing: 0;
  font-size: 13px !important;
  color: hsl(var(--sc-muted-fg)) !important;
}
/* The compound .MuiStepLabel-label.Mui-active cannot survive here: the suffix
   breaks both halves of it, so the state class is matched on its own. */
.sc-route-import [class*="MuiStepLabel-active"],
.sc-route-import [class*="MuiStepLabel-completed"] {
  color: hsl(var(--sc-fg)) !important;
  font-weight: 600 !important;
}
/* The step bubbles take the accent and the hard edge the rest of the app uses,
   rather than MUI's default flat circles. */
.sc-route-import [class*="MuiStepIcon-root"] {
  color: hsl(var(--sc-muted)) !important;
  border: var(--sc-border-w) solid hsl(var(--sc-border));
  border-radius: 50%;
}
.sc-route-import [class*="MuiStepIcon-active"],
.sc-route-import [class*="MuiStepIcon-completed"] {
  color: hsl(var(--sc-primary)) !important;
  border-color: hsl(var(--sc-primary));
}
/* The number is painted on the disc, not on the page, so it follows whichever
   fill the disc is carrying. A single primary-fg for both states put a white
   numeral on the muted disc of every step that was not the current one —
   1.1:1 in slush light, and wrong in all nine modes at both ends. */
.sc-route-import [class*="MuiStepIcon-text"] {
  fill: hsl(var(--sc-muted-fg)) !important;
}
.sc-route-import [class*="MuiStepIcon-active"] [class*="MuiStepIcon-text"],
.sc-route-import [class*="MuiStepIcon-completed"] [class*="MuiStepIcon-text"] {
  fill: hsl(var(--sc-primary-fg)) !important;
}
.sc-route-import [class*="MuiStepConnector-line"] {
  border-color: hsl(var(--sc-border)) !important;
}
/* The analysis result and the form sit in bare Papers. */
.sc-route-import [class*="MuiPaper-root"] {
  background: hsl(var(--sc-card)) !important;
  border: var(--sc-border-w) solid hsl(var(--sc-border));
  border-radius: var(--sc-radius);
  box-shadow: var(--sc-shadow);
}
.sc-route-import [class*="MuiTypography-h6"],
.sc-route-import [class*="MuiFormLabel-root"],
.sc-route-import [class*="MuiInputLabel-root"] {
  font-family: var(--sc-font-ui) !important;
  text-transform: uppercase;
  letter-spacing: 0;
  color: hsl(var(--sc-fg)) !important;
}
.sc-route-import [class*="MuiTypography-body1"],
.sc-route-import [class*="MuiTypography-body2"] {
  color: hsl(var(--sc-fg));
}
/* The link rule that used to sit here is gone: the global one it duplicated is
   now [class*="MuiLink-root"] / [class*="MuiTypography-colorPrimary"] and
   reaches this route on its own — along with the two TechDocs routes, which
   have no route class and could never have been covered from here.
   The rest of this block stays: the stepper rules above have no global
   counterpart at all, and the surface/label/input/list/progress rules below
   carry declarations the global sheet does not. */
/* The repository-URL field is the page's one real input; it arrives bare. It
   sits in the Paper above, which is --sc-card, so it inherits that ground
   rather than naming --sc-bg — see the note on .sc-input. Colour only: the
   radius this rule used to repeat is already set app-wide above, and the
   label/notch geometry it might otherwise have grown lives in theme.tsx. */
.sc-route-import [class*="MuiOutlinedInput-root"] {
  background: transparent;
}
.sc-route-import [class*="MuiListItem-root"] {
  border-bottom: var(--sc-border-w) solid hsl(var(--sc-border) / .6);
}
.sc-route-import [class*="MuiLinearProgress-root"] {
  border: var(--sc-border-w) solid hsl(var(--sc-border));
  border-radius: var(--sc-radius);
}

/* Every title, one face. The h1 that says "Welcome to Platform" and a card's
   own title are the same kind of object and were drifting apart by which
   stylesheet reached them first.
   Bare h1-h6 are in the list because Backstage's own page header renders a
   heading with NO class at all — verified in the running app — so neither a
   Mui* selector nor the typed BackstageHeader override can reach it. The
   element itself is the only stable hook. */
h1, h2, h3, h4, h5, h6,
.sc-h1,
.sc-card-title,
.sc-empty-title,
.sc-qs-title,
.sc-login-title,
[class*="MuiTypography-h1"],
[class*="MuiTypography-h2"],
[class*="MuiTypography-h3"],
[class*="MuiTypography-h4"],
[class*="MuiTypography-h5"],
[class*="MuiTypography-h6"] {
  font-family: var(--sc-font-title) !important;
  letter-spacing: -0.01em;
}

/* [flare] The konami code. Flips to a fixed NES-hardware accent and sends a
   block walking along the footer. Stored nowhere and announced nowhere: it
   resets on reload, which is the point of an easter egg. */
:root.sc-konami {
  --sc-primary: 212 100% 45%;
  --sc-ring: 212 100% 45%;
  --sc-primary-fg: 0 0% 100%;
  --sc-primary-shade: 240 10% 8%;
}
:root.sc-konami::after {
  content: '';
  position: fixed; bottom: 0; left: 0; z-index: 2000;
  width: 16px; height: 16px;
  background: hsl(var(--sc-primary));
  border: var(--sc-border-w) solid hsl(var(--sc-fg) / .8);
  pointer-events: none;
}

/* Third-party motion that ignores the motion query: React Flow animates its
   edges regardless, so it is switched off here rather than left running for
   someone who asked for stillness. */
@media (prefers-reduced-motion: reduce) {
  .react-flow__edge.animated path,
  .react-flow__edge-path { animation: none !important; }
}

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
  @keyframes sc-rattle {
    0%   { transform: translate(0px, 0px); }
    25%  { transform: translate(-1px, 1px); }
    50%  { transform: translate(1px, -1px); }
    75%  { transform: translate(1px, 1px); }
    100% { transform: translate(0px, 0px); }
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
  /* Bottles knock in their slots while the shelf is being carried.
     On the sprite, never the button: the button's transform is already spoken
     for by the hover lift and the selected lift, and an animation on the same
     property would clobber both — the chosen bottle would drop back into the
     shelf for as long as the drag lasted. The svg's only existing effect is a
     drop-shadow filter, so its transform is free.
     1px, because the sprites are 26px on a pixel grid and 2px reads as a bounce.
     Absent under reduced motion by construction: the box still follows the
     pointer, which is the feedback that matters, so only decoration is lost. */
  .sc-picker-float[data-dragging='true'] .sc-potion svg {
    animation: sc-rattle .16s steps(4) infinite;
    animation-delay: calc(var(--sc-i, 0) * .04s);
  }

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
  .sc-press-start { animation: sc-caret 1s steps(1) infinite; }
  .sc-qs-box::after { animation: sc-caret 1s steps(1) infinite; }

  /* They twinkle out of step with each other: same keyframes, staggered, so
     the group never blinks as one block. */
  @keyframes sc-twinkle {
    0%, 45% { opacity: 1; }
    50%, 95% { opacity: 0; }
    100% { opacity: 1; }
  }
  .sc-tour:hover .sc-tour-star, .sc-tour:focus-visible .sc-tour-star {
    animation: sc-twinkle .6s steps(1) infinite;
  }
  /* The equipped bottle's sparkles. Two frames, so they flick rather than
     fade, and staggered by class the way the tour's six are — PixelStar takes
     no style prop, and a per-star delay in CSS needs no component change.
     0%/100% is opacity 1, which is exactly the static rule outside this query:
     with motion off the stars are simply drawn, and the equipped bottle is
     still marked by aria-pressed, by its label, and by being the only one
     left on the shelf. */
  @keyframes sc-sparkle {
    0%, 100% { opacity: 1; }
    50% { opacity: .3; }
  }
  .sc-potion .sc-potion-stars svg { animation: sc-sparkle 1.2s steps(2) infinite; }
  .sc-potion-star-1 { animation-delay: -.4s; }
  .sc-potion-star-2 { animation-delay: -.8s; }
  /* The cast: 360ms, and SchemeRoot.tsx applies the pick when it ends — the
     two durations are one number and must move together. Stepped like
     everything else here; the bottle lifts a little and the stars pop in
     around it. */
  @keyframes sc-cast {
    0% { transform: translateY(0) scale(1); }
    50% { transform: translateY(-3px) scale(1.12); }
    100% { transform: translateY(0) scale(1); }
  }
  @keyframes sc-cast-pop {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
  .sc-inv-casting svg { animation: sc-cast .36s steps(3) 1; }
  .sc-inv-casting .sc-cast-stars svg { animation: sc-cast-pop .36s steps(2) 1; }
  .sc-cast-star-1 { animation-delay: .06s; }
  .sc-cast-star-2 { animation-delay: .12s; }
  .sc-cast-star-3 { animation-delay: .18s; }

  .sc-tour-star-1 { animation-delay: -.1s; }
  .sc-tour-star-2 { animation-delay: -.25s; }
  .sc-tour-star-3 { animation-delay: -.35s; }
  .sc-tour-star-4 { animation-delay: -.45s; }
  .sc-tour-star-5 { animation-delay: -.55s; }

  /* [xp] The run cycle: two frames, and a walk bounded by the fill. */
  @keyframes sc-creep-run { to { left: calc(100% - 8px); } }
  @keyframes sc-creep-frame {
    0%, 49% { opacity: 1; }
    50%, 100% { opacity: 0; }
  }
  .sc-xp-creep { animation: sc-creep-run 3.2s steps(16) infinite; }
  /* LOADING... counts itself out, one dot at a time. */
  @keyframes sc-xp-dots {
    0% { clip-path: inset(0 100% 0 0); }
    33% { clip-path: inset(0 66% 0 0); }
    66% { clip-path: inset(0 33% 0 0); }
    100% { clip-path: inset(0 0 0 0); }
  }
  .sc-xp-dots { animation: sc-xp-dots 1.2s steps(1) infinite; }
  /* Offset so they do not march in lockstep. */
  .sc-xp-creep-1 { animation-delay: -1.1s; }
  .sc-xp-creep-2 { animation-delay: -2.2s; }
  .sc-creep-a { animation: sc-creep-frame .4s steps(1) infinite; }
  .sc-creep-b { display: block; position: absolute; inset: 0;
    animation: sc-creep-frame .4s steps(1) infinite reverse; }

  /* [xp] Level up: the bar flashes and the banner rises once. */
  @keyframes sc-xp-flash {
    0%, 100% { background-color: hsl(var(--sc-xp-tone)); }
    50% { background-color: hsl(0 0% 100%); }
  }
  @keyframes sc-xp-rise {
    from { transform: translateY(8px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .sc-xp-levelup .sc-xp-fill { animation: sc-xp-flash .3s steps(2) 2; }
  .sc-xp-banner { animation: sc-xp-rise .3s steps(3) both; }
  .sc-xp-gameover .sc-xp-track { animation: sc-shake .2s steps(2) 2; }
  @keyframes sc-walk { to { left: calc(100vw - 16px); } }
  :root.sc-konami::after { animation: sc-walk 6s steps(24) infinite; }
  .sc-h1::after,
  :is(h1, h2, h3)[class*="bui-HeaderTitle"]::after {
    animation: sc-caret 1s steps(1) infinite;
  }
  /* BackstageHeader-title::after's animation lives in theme.tsx
     (BackstageHeader.styleOverrides.title), nested under the same media query. */
}

/* The block caret marks a page title, wherever the page comes from: ours,
   Backstage's Header, or the BUI header the catalog uses. The caret itself sits
   outside the motion query — only its blink is animation, so a reader with
   reduced motion still gets the mark, just a steady one. */
.sc-h1::after,
:is(h1, h2, h3)[class*="bui-HeaderTitle"]::after {
  /* ContentHeader is deliberately absent: it renders empty on the create page
     (a lone floating block) and, where it does have text, it sits under a
     Header title that already carries the caret.
     The slash-empty-string suffix is the alt text of generated content: it keeps
     the caret out of the accessible name, so a screen reader announces
     "Platform Catalog", not "Platform Catalog block". The element selector
     matters too — bui also renders a HeaderTitleStack wrapper, which would
     otherwise draw a second caret.
     (No backticks in this file: the whole stylesheet is one template literal.) */
  content: '\\258C' / '';
  margin-left: 4px;
  color: hsl(var(--sc-primary));
}
/* BackstageHeader-title gets the same caret via theme.tsx
   (BackstageHeader.styleOverrides.title's '&::after'), because a class*= hook
   on that hashed name doesn't survive a production build. */

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

/* ===== The type scale =====
   One family, differentiated by weight, size and case rather than by a second
   face. This block replaced an arcade treatment written for a pixel font:
   uppercase on every piece of chrome and a hard 12px floor. Both were right for
   a bitmap-derived face and wrong for an outline grotesque, where uppercase at
   13px reads as shouting and the floor is unnecessary.

   Uppercase survives in exactly one place — the micro-label — where it is a
   wayfinding convention rather than a texture, and it gets the positive
   tracking that uppercase always needs. Everything else is sentence case with
   slight negative tracking, which is how this family is drawn to be set. */
.sc-h1, .sc-card-title, .sc-btn, .sc-badge, .sc-nav-word, .sc-nav-tx,
.sc-dialog-h, .sc-login-title, .sc-label {
  font-family: var(--sc-font-ui);
  text-transform: none;
  letter-spacing: -0.01em;
}
.sc-h1 { font-size: 30px; font-weight: 600; line-height: 1.15; letter-spacing: -0.025em; }
.sc-login-title { font-size: 22px; font-weight: 700; line-height: 1.2; }
.sc-dialog-h { font-size: 16px; font-weight: 600; line-height: 1.3; }
.sc-card-title { font-size: 15px; font-weight: 600; line-height: 1.3; }
.sc-nav-word { font-size: 16px; font-weight: 700; }
.sc-btn { font-size: 13px; font-weight: 500; letter-spacing: 0; }
.sc-nav-tx { font-size: 13px; font-weight: 500; }
.sc-badge { font-size: 12px; font-weight: 500; letter-spacing: 0; }
/* The one uppercase left standing, and the only one with positive tracking. */
.sc-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
/* Table headers are labels by another name. */
.MuiTableCell-head, .sc-table th {
  font-size: 12px !important;
  font-weight: 600 !important;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* The press IS the shadow collapsing: the button moves into the space its
   shadow occupied, which is how a 2-frame sprite button reads. */
.sc-btn {
  border: var(--sc-border-w) solid hsl(var(--sc-fg) / .8);
  box-shadow: var(--sc-shadow);
  transition: none;
}
/* Same rule for our own buttons: highlight, never displace. */
.sc-btn:active:not(:disabled) {
  transform: none;
  box-shadow: inset 0 0 0 2em hsl(var(--sc-fg) / .14);
}
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

/* The scaffolder form is Material-UI, and palette.primary is a literal colour
   fixed when the theme is built (theme.tsx, the PRIMARY constant). It cannot
   read --sc-primary, because MUI runs darken()/fade() over palette values and
   would choke on a var(). So the rendered classes are overridden instead —
   they are Mui-prefixed and therefore survive a production build, unlike the
   makeStyles names MUI discards there.
   Both spellings are listed on purpose: v4 emits MuiStepIcon-active, v5 the
   global Mui-active, and the scaffolder pulls in both majors. NOTE: no
   backticks in this file, ever — it is one template literal and a backtick in
   a comment truncates the whole stylesheet. */
.MuiStepIcon-root.MuiStepIcon-active,
.MuiStepIcon-root.MuiStepIcon-completed,
.MuiStepIcon-root.Mui-active,
.MuiStepIcon-root.Mui-completed { color: hsl(var(--sc-primary)) !important; }
.MuiStepLabel-label.MuiStepLabel-active,
.MuiStepLabel-label.Mui-active { color: hsl(var(--sc-fg)) !important; }
[class*="MuiTypography-colorPrimary"] { color: hsl(var(--sc-primary)) !important; }
/* Focus rings and underlines. */
.MuiFormLabel-root.Mui-focused { color: hsl(var(--sc-primary)) !important; }
.MuiInput-underline:after,
.MuiFilledInput-underline:after { border-bottom-color: hsl(var(--sc-primary)) !important; }
.MuiOutlinedInput-root.Mui-focused [class*="MuiOutlinedInput-notchedOutline"],
.MuiAutocomplete-inputFocused ~ [class*="MuiOutlinedInput-notchedOutline"] {
  border-color: hsl(var(--sc-primary)) !important; }
/* Selection controls. MUI v4 defaults Checkbox/Radio/Switch to the SECONDARY
   palette, not the primary one — an audit of a live template form found
   MuiCheckbox-colorSecondary — and palette.secondary is another literal fixed
   at theme construction, which is the purple that survived every primary-only
   override. Both colour variants are listed. */
.MuiCheckbox-colorPrimary.Mui-checked,
.MuiCheckbox-colorSecondary.Mui-checked,
.MuiRadio-colorPrimary.Mui-checked,
.MuiRadio-colorSecondary.Mui-checked,
.MuiSwitch-colorPrimary.Mui-checked,
.MuiSwitch-colorSecondary.Mui-checked { color: hsl(var(--sc-primary)) !important; }
.MuiSwitch-colorPrimary.Mui-checked + .MuiSwitch-track,
.MuiSwitch-colorSecondary.Mui-checked + .MuiSwitch-track {
  background-color: hsl(var(--sc-primary)) !important; }
/* Icon buttons that opted into an accent — the array field's add/remove/reorder
   controls are these. Found by scanning a live form for every element still
   painted with the theme's frozen palette; the label, svg and ripple inside
   them inherit the colour, so the button is the only thing to set. */
.MuiIconButton-colorPrimary,
.MuiIconButton-colorSecondary,
.MuiSvgIcon-colorPrimary,
.MuiSvgIcon-colorSecondary { color: hsl(var(--sc-primary)) !important; }

/* Buttons and progress. */
[class*="MuiButton-containedPrimary"] { background-color: hsl(var(--sc-primary)) !important;
  color: hsl(var(--sc-primary-fg)) !important; }
[class*="MuiButton-textPrimary"], [class*="MuiButton-outlinedPrimary"] { color: hsl(var(--sc-primary)) !important; }
.MuiChip-colorPrimary { background-color: hsl(var(--sc-primary)) !important;
  color: hsl(var(--sc-primary-fg)) !important; }

/* State sprite beside its badge. 16px is one screen pixel per sprite pixel —
   the size at which pixel art is sharpest; avoid non-integer multiples. */
.sc-state { display: inline-flex; align-items: center; gap: var(--sc-unit); }
.sc-state-ic { width: 16px; height: 16px; flex: 0 0 auto; color: currentColor; }

/* At a fractional device pixel ratio no fixed size divides evenly — 125% zoom
   over a 32px box is 2.5 device pixels per sprite pixel — and crispEdges
   resolves that by rounding neighbouring columns to different widths, which
   distorts the 2px features (eye sockets, teeth) first. Antialiasing is
   symmetric; the softness costs less than a lopsided sprite. CSS cannot ask
   "is this an integer multiple", so Chrome's fractional zoom steps are named. */
@media (resolution: 1.1dppx), (resolution: 1.25dppx), (resolution: 1.75dppx),
       (resolution: 2.25dppx), (resolution: 2.5dppx) {
  .sc-state-ic, .sc-potion svg, .sc-nav-mark svg, .sc-login-mark svg {
    shape-rendering: geometricPrecision;
  }
}

/* Sidebar: the active row is marked by a cursor, the way a menu selection is. */
.sc-nav-cursor { font-family: var(--sc-font-ui); font-size: 11px; width: 12px;
  flex: 0 0 auto; color: hsl(var(--sc-primary)); margin-left: auto; text-align: right; }
.sc-nav-item { border-radius: var(--sc-radius); border-left: var(--sc-border-w) solid transparent; }
.sc-nav-item.active { border-left-color: hsl(var(--sc-primary)); }
.sc-nav-mark { border-radius: var(--sc-radius); border: var(--sc-border-w) solid hsl(var(--sc-fg) / .8);
  box-shadow: var(--sc-shadow); }

/* The JSON tree is pixel throughout now; keys keep their weight so the
   structure still reads at a glance. */
.sc-json-key, .sc-json-toggle { font-family: var(--sc-font-ui); font-size: 12px; }
.sc-json-body { font-family: var(--sc-font-ui); font-size: 12px; }
`;
