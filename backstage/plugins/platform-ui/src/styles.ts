// A self-contained shadcn-style design layer (tokens + component classes),
// injected globally. Colors are HSL triplets in CSS variables so the color
// picker can swap the accent live. Scoped under `.sc` so it never fights
// Backstage's own MUI styles outside our pages.
export const SHADCN_CSS = `
.sc, .sc * { box-sizing: border-box; }
.sc {
  --sc-radius: 0.5rem;
  --sc-bg: 0 0% 100%;
  --sc-fg: 240 10% 3.9%;
  --sc-card: 0 0% 100%;
  --sc-card-fg: 240 10% 3.9%;
  --sc-muted: 240 4.8% 95.9%;
  --sc-muted-fg: 240 3.8% 46.1%;
  --sc-border: 240 5.9% 90%;
  --sc-input: 240 5.9% 90%;
  --sc-primary: 262 83% 58%;
  --sc-primary-fg: 0 0% 100%;
  --sc-ring: 262 83% 58%;
  --sc-accent: 240 4.8% 95.9%;
  --sc-accent-fg: 240 5.9% 10%;
  --sc-success: 142 71% 45%;
  --sc-warning: 38 92% 50%;
  --sc-destructive: 0 72% 51%;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: hsl(var(--sc-fg));
}
.sc-dark .sc, .sc.sc-dark {
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

/* page + layout */
.sc-page { padding: 28px 32px; background: hsl(var(--sc-bg)); min-height: 100%; }
.sc-h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; margin: 0; color: hsl(var(--sc-fg)); }
.sc-sub { color: hsl(var(--sc-muted-fg)); margin-top: 4px; font-size: 14px; }
.sc-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 24px; }
.sc-grid { display: grid; gap: 16px; }

/* card */
.sc-card { background: hsl(var(--sc-card)); color: hsl(var(--sc-card-fg));
  border: 1px solid hsl(var(--sc-border)); border-radius: var(--sc-radius); }
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
  border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid transparent; }
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
.sc-nav { position: fixed; top: 0; left: 0; bottom: 0; width: 248px; z-index: 1200;
  background: hsl(var(--sc-card)); border-right: 1px solid hsl(var(--sc-border));
  display: flex; flex-direction: column; padding: 14px 12px 64px; overflow-y: auto; }
.sc-nav-brand { display: flex; align-items: center; gap: 10px; padding: 6px 8px 16px; text-decoration: none; }
.sc-nav-mark { width: 24px; height: 24px; border-radius: 7px;
  background: linear-gradient(135deg, hsl(var(--sc-primary)), hsl(262 83% 62%)); }
.sc-nav-word { font-weight: 700; font-size: 18px; letter-spacing: -0.02em; color: hsl(var(--sc-fg)); }
.sc-nav-list { display: flex; flex-direction: column; gap: 2px; }
.sc-nav-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px;
  color: hsl(var(--sc-muted-fg)); text-decoration: none; font-size: 14px; font-weight: 500; transition: background .12s; }
.sc-nav-item:hover { background: hsl(var(--sc-accent)); color: hsl(var(--sc-fg)); }
.sc-nav-item.active { background: hsl(var(--sc-primary) / .12); color: hsl(var(--sc-primary)); }
.sc-nav-item svg { width: 19px; height: 19px; }
/* Force the content gutter to match the custom nav width (overrides SidebarPage). */
.BackstageSidebarPage-root { padding-left: 248px !important; }
@media (max-width: 600px) { .sc-nav { display: none; } .BackstageSidebarPage-root { padding-left: 0 !important; } }

/* color scheme picker */
.sc-picker { position: fixed; right: 14px; bottom: 14px; z-index: 1500;
  display: flex; align-items: center; gap: 6px; padding: 7px 9px; border-radius: 999px;
  background: hsl(var(--sc-card)); border: 1px solid hsl(var(--sc-border)); box-shadow: 0 6px 20px rgba(0,0,0,.18); }
.sc-swatch { width: 18px; height: 18px; border-radius: 999px; border: 2px solid transparent; cursor: pointer; padding: 0; }
.sc-swatch[aria-pressed="true"] { border-color: hsl(var(--sc-fg)); }
`;
