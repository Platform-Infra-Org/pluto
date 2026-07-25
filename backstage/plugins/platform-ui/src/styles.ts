// A self-contained shadcn-style design layer (tokens + component classes),
// injected globally. Colors are HSL triplets in CSS variables so the color
// picker can swap the accent live. Scoped under `.sc` so it never fights
// Backstage's own MUI styles outside our pages.
export const SHADCN_CSS = `
.sc, .sc * { box-sizing: border-box; }
/* Tokens live on :root so BOTH our .sc components and the MUI/Backstage reskin
   below read the same variables (and follow the color picker). */
:root {
  --sc-radius: 0.5rem;
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
.sc {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: hsl(var(--sc-fg));
}

/* ===== Reskin the Backstage/MUI native pages (catalog, scaffolder, search,
   settings…) to the shadcn look, driven by the same tokens + color picker. ===== */
/* Backstage UI (bui) design tokens — retarget the solid accent to our picker. */
:root {
  --bui-bg-solid: hsl(var(--sc-primary));
  --bui-bg-solid-hover: hsl(var(--sc-primary) / 0.92);
  --bui-bg-solid-pressed: hsl(var(--sc-primary) / 0.85);
  --bui-fg-link: hsl(var(--sc-primary));
  --bui-border-focus: hsl(var(--sc-primary));
}
[class*="bui-ButtonLink"], [class*="bui-Button"] { border-radius: calc(var(--sc-radius) - 2px) !important; }
/* bui primary buttons resolve their own token — retarget by variant attribute. */
[data-variant="primary"][class*="bui-Button"] { background-color: hsl(var(--sc-primary)) !important; color: hsl(var(--sc-primary-fg)) !important; }
[data-variant="primary"][class*="bui-Button"]:hover { background-color: hsl(var(--sc-primary) / 0.9) !important; }
/* NB: Backstage makeStyles classes are hashed (BackstageHeader-header-42), so
   we match them with [class*="…"] attribute-contains selectors. */
body, [class*="BackstageContent"] { background: hsl(var(--sc-bg)); }
/* flatten the wave header everywhere */
header.MuiPaper-root, [class*="BackstageHeader-header"] {
  background-image: none !important; background-color: hsl(var(--sc-card)) !important;
  box-shadow: none !important; border-bottom: 1px solid hsl(var(--sc-border)) !important; }
[class*="BackstageHeader-title"], [class*="BackstageHeader-title"] * { color: hsl(var(--sc-fg)) !important; }
[class*="BackstageHeader-subtitle"], [class*="HeaderLabel-label"], [class*="BackstageHeader-type"] { color: hsl(var(--sc-muted-fg)) !important; }
/* cards / surfaces */
.MuiCard-root, .MuiPaper-elevation1, .MuiPaper-elevation2, .MuiAccordion-root, [class*="BackstageInfoCard-header"] {
  background-color: hsl(var(--sc-card)) !important; color: hsl(var(--sc-fg));
  border: 1px solid hsl(var(--sc-border)) !important; box-shadow: none !important;
  border-radius: var(--sc-radius) !important; }
.MuiInputBase-root, .MuiOutlinedInput-root { border-radius: calc(var(--sc-radius) - 2px) !important; }
.MuiOutlinedInput-notchedOutline { border-color: hsl(var(--sc-input)) !important; }
/* accent — buttons, links, tabs, selection (all follow the picker) */
.MuiButton-root { text-transform: none !important; border-radius: calc(var(--sc-radius) - 2px) !important; box-shadow: none !important; font-weight: 600 !important; }
.MuiButton-containedPrimary { background-color: hsl(var(--sc-primary)) !important; color: hsl(var(--sc-primary-fg)) !important; }
.MuiButton-outlinedPrimary, .MuiButton-textPrimary { color: hsl(var(--sc-primary)) !important; }
.MuiLink-root, a.MuiTypography-colorPrimary, .MuiTypography-colorPrimary { color: hsl(var(--sc-primary)) !important; }
.MuiTabs-indicator { background-color: hsl(var(--sc-primary)) !important; }
.MuiTab-root { text-transform: none !important; font-weight: 600 !important; }
.MuiTab-textColorPrimary.Mui-selected, .Mui-selected { color: hsl(var(--sc-primary)) !important; }
.MuiSwitch-colorPrimary.Mui-checked { color: hsl(var(--sc-primary)) !important; }
.MuiCheckbox-colorPrimary.Mui-checked, .MuiRadio-colorPrimary.Mui-checked { color: hsl(var(--sc-primary)) !important; }
.MuiChip-root { border-radius: 6px !important; }
/* ===== Graphs: React-Flow look — dark canvas + dots, compact dark nodes ===== */
/* The graph svg IS the dark dotted canvas and fills its container (no smaller
   inner box inside a larger canvas). */
svg:has([class*="PluginCatalogGraph"]), svg:has([class*="DependencyGraphDefaultNode"]) {
  background-color: #0a0a10 !important;
  background-image: radial-gradient(circle, rgba(255,255,255,.16) 1px, transparent 1px) !important;
  background-size: 17px 17px !important; border-radius: 10px;
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
.react-flow__node { border-radius: 8px !important; }
.react-flow__controls { box-shadow: none !important; }
.react-flow__controls button { background: #17171f !important; border-color: #32303e !important; }
.react-flow__controls button svg, .react-flow__controls-button svg { fill: #e7e7ef !important; }
.react-flow__attribution { display: none !important; }

/* ===== Compact headers (title bar too tall / oversized title) ===== */
[class*="BackstageHeader-header"] { padding-top: 16px !important; padding-bottom: 14px !important; min-height: 0 !important; }
[class*="BackstageHeader-title"] { font-size: 1.6rem !important; line-height: 1.2 !important; }
[class*="BackstageHeader-title"] * { font-size: inherit !important; }

/* flatten the gradient card headers (template / entity cards) */
[class*="ItemCardHeader"] {
  background-image: none !important; background: hsl(var(--sc-muted)) !important;
  border-bottom: 1px solid hsl(var(--sc-border)) !important; }
[class*="ItemCardHeader"] * { color: hsl(var(--sc-fg)) !important; }
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
.sc-action { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 8px;
  border: 1px solid hsl(var(--sc-border)); text-decoration: none; transition: background .12s, border-color .12s; }
.sc-action:hover { background: hsl(var(--sc-primary) / .06); border-color: hsl(var(--sc-primary) / .4); }
.sc-action-l { font-weight: 600; color: hsl(var(--sc-fg)); }
.sc-action-h { font-size: 12px; }

/* card */
.sc-card { background: hsl(var(--sc-card)); color: hsl(var(--sc-card-fg));
  border: 1px solid hsl(var(--sc-border)); border-radius: var(--sc-radius); overflow: hidden; }
.sc-card-h { padding: 18px 20px 0; }
.sc-card-title { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
.sc-card-desc { color: hsl(var(--sc-muted-fg)); font-size: 13px; margin-top: 2px; }
.sc-card-b { padding: 18px 20px; }

/* buttons */
.sc-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 36px; padding: 0 14px; border-radius: calc(var(--sc-radius) - 2px);
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
  border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid transparent;
  white-space: nowrap; max-width: 100%; }
.sc-dot { width: 7px; height: 7px; border-radius: 999px; background: currentColor; }
.sc-badge-muted { background: hsl(var(--sc-muted)); color: hsl(var(--sc-muted-fg)); }
.sc-badge-primary { background: hsl(var(--sc-primary) / .12); color: hsl(var(--sc-primary)); }
.sc-badge-success { background: hsl(var(--sc-success) / .14); color: hsl(var(--sc-success)); }
.sc-badge-warning { background: hsl(var(--sc-warning) / .16); color: hsl(38 92% 40%); }
.sc-badge-destructive { background: hsl(var(--sc-destructive) / .12); color: hsl(var(--sc-destructive)); }

/* table */
.sc-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.sc-table th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: .05em; color: hsl(var(--sc-muted-fg));
  border-bottom: 1px solid hsl(var(--sc-border)); }
.sc-table td { padding: 12px 14px; border-bottom: 1px solid hsl(var(--sc-border)); color: hsl(var(--sc-fg)); }
.sc-cell-ellip { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* login gate */
.sc-login { min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: hsl(var(--sc-bg)); padding: 24px; }
.sc-login-card { width: 360px; max-width: 100%; padding: 36px 32px; text-align: center;
  background: hsl(var(--sc-card)); border: 1px solid hsl(var(--sc-border));
  border-radius: var(--sc-radius); box-shadow: 0 10px 40px hsl(240 20% 10% / .12);
  display: flex; flex-direction: column; align-items: center; gap: 6px; }
.sc-login-mark { width: 52px; height: 52px; border-radius: 14px; margin-bottom: 8px;
  background: linear-gradient(135deg, hsl(var(--sc-primary)), hsl(var(--sc-primary) / .6));
  box-shadow: 0 4px 16px hsl(var(--sc-primary) / .4); }
.sc-login-title { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: hsl(var(--sc-fg)); margin: 0; }
.sc-login-sub { font-size: 14px; color: hsl(var(--sc-muted-fg)); margin: 0 0 16px; }
.sc-login-card .sc-btn { width: 100%; }
.sc-login-pick { margin-top: 20px; padding-top: 18px; border-top: 1px solid hsl(var(--sc-border)); width: 100%;
  display: flex; justify-content: center; }
.sc-table tr:last-child td { border-bottom: none; }
.sc-table tbody tr:hover { background: hsl(var(--sc-muted) / .5); }

/* input */
.sc-input, .sc-select { height: 36px; width: 100%; padding: 0 10px; font-size: 14px;
  border-radius: calc(var(--sc-radius) - 2px); border: 1px solid hsl(var(--sc-input));
  background: hsl(var(--sc-bg)); color: hsl(var(--sc-fg)); outline: none; font-family: inherit; }
.sc-input:focus, .sc-select:focus { border-color: hsl(var(--sc-ring)); box-shadow: 0 0 0 3px hsl(var(--sc-ring) / .25); }
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
.sc-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 1400;
  display: flex; align-items: center; justify-content: center; }
.sc-dialog { background: hsl(var(--sc-card)); color: hsl(var(--sc-fg));
  border: 1px solid hsl(var(--sc-border)); border-radius: var(--sc-radius);
  width: min(480px, 92vw); max-height: 88vh; overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,.3); }
.sc-dialog-h { padding: 20px 22px 0; font-size: 17px; font-weight: 600; }
.sc-dialog-b { padding: 16px 22px; }
.sc-dialog-f { padding: 12px 22px 20px; display: flex; justify-content: flex-end; gap: 8px; }

/* custom shadcn nav (replaces the Backstage sidebar) */
.sc-nav { position: fixed; top: 0; left: 0; bottom: 0; width: var(--sc-nav-w); z-index: 1200;
  background: hsl(var(--sc-card)); border-right: 1px solid hsl(var(--sc-border));
  display: flex; flex-direction: column; padding: 12px 12px 16px; overflow-x: hidden;
  transition: width .16s ease; }
.sc-nav-top { display: flex; align-items: center; justify-content: space-between; padding: 4px 6px 14px; }
.sc-nav-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; min-width: 0; }
.sc-nav-mark { width: 26px; height: 26px; border-radius: 8px; flex: 0 0 auto;
  background: linear-gradient(135deg, hsl(var(--sc-primary)), hsl(var(--sc-primary) / .65));
  box-shadow: 0 2px 8px hsl(var(--sc-primary) / .35); }
.sc-nav-word { font-weight: 700; font-size: 17px; letter-spacing: -0.02em; color: hsl(var(--sc-fg)); white-space: nowrap; }
.sc-nav-toggle { flex: 0 0 auto; width: 26px; height: 26px; border-radius: 7px; border: 1px solid hsl(var(--sc-border));
  background: transparent; color: hsl(var(--sc-muted-fg)); cursor: pointer; font-size: 13px; line-height: 1;
  display: flex; align-items: center; justify-content: center; }
.sc-nav-toggle:hover { background: hsl(var(--sc-accent)); color: hsl(var(--sc-fg)); }
.sc-nav-list { display: flex; flex-direction: column; gap: 2px; }
.sc-nav-item { position: relative; display: flex; align-items: center; gap: 11px; padding: 8px 10px; border-radius: 9px;
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
  border-radius: 3px; background: hsl(var(--sc-primary)); }
/* collapsed: icons only */
.sc-nav.collapsed .sc-nav-word, .sc-nav.collapsed .sc-nav-tx { display: none; }
.sc-nav.collapsed .sc-nav-item { justify-content: center; padding: 9px; }
.sc-nav.collapsed .sc-nav-top { justify-content: center; }
/* Force the content gutter to match the nav width (hashed SidebarPage class). */
[class*="BackstageSidebarPage-root"] { padding-left: var(--sc-nav-w) !important; transition: padding-left .16s ease; }
@media (max-width: 600px) { .sc-nav { display: none; } [class*="BackstageSidebarPage-root"] { padding-left: 0 !important; } }

/* color scheme picker */
.sc-picker { position: fixed; right: 14px; bottom: 14px; z-index: 1500;
  display: flex; align-items: center; gap: 6px; padding: 7px 9px; border-radius: 999px;
  background: hsl(var(--sc-card)); border: 1px solid hsl(var(--sc-border)); box-shadow: 0 6px 20px rgba(0,0,0,.18); }
.sc-swatch { width: 18px; height: 18px; border-radius: 999px; border: 2px solid transparent; cursor: pointer; padding: 0; }
.sc-swatch[aria-pressed="true"] { border-color: hsl(var(--sc-fg)); }
`;
