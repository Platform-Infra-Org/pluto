/**
 * Spider-Verse mode: a comic page, printed badly on purpose.
 *
 * The only mode here with no site to measure. Its source is a film's art
 * direction, and that art direction is a set of *effects* rather than a
 * palette — which is why this is hand-written where the brand modes are a
 * table row. Four things carry it:
 *
 * 1. **Ben-Day dots.** The halftone screen of cheap comic printing, drawn as a
 *    repeating radial-gradient rather than an image so it scales and recolours.
 * 2. **Chromatic aberration.** The film's signature: a red and a cyan ghost
 *    offset a pixel or two from the type, as though the plates were
 *    misregistered. Applied to display type only — see the ceiling below.
 * 3. **Panel rules.** Heavy black borders, because a comic frame is a cut edge.
 * 4. **Comic primaries.** Spider red, Kirby blue, and a caption-box yellow used
 *    the way a comic uses it: as a box, never as a wash.
 *
 * **Two ceilings keep it readable, and they are the whole risk of this mode.**
 * Chromatic aberration on body copy is illegible — it doubles every stroke — so
 * it is confined to `.sc-h1` and card titles and never reaches `.sc` body text.
 * The halftone stays at low alpha for the same reason: a dot screen at full
 * strength eats the text sitting on it. Both are asserted in the tests rather
 * than left to judgement.
 *
 * Motion is stepped here, not eased — the one mode in the app where that is a
 * design decision rather than an inherited default. Comic panels cut; they do
 * not glide, and a smooth ease would make this read as a web page wearing a
 * comic costume rather than as a comic.
 */

export function spiderverseCss(): string {
  return `
/* ===== Spider-Verse — light register: newsprint ===== */
:root.sc-spiderverse {
  --sc-bg: 45 42% 94%;
  --sc-fg: 0 0% 6%;
  --sc-card: 45 60% 98%;
  --sc-card-fg: 0 0% 6%;
  --sc-muted: 45 35% 88%;
  --sc-muted-fg: 0 0% 26%;
  --sc-border: 0 0% 6%;
  --sc-input: 0 0% 6%;
  --sc-primary: 355 82% 42%;
  --sc-primary-fg: 45 60% 98%;
  --sc-primary-shade: 0 0% 100%;
  --sc-ring: 355 82% 42%;
  --sc-accent: 50 100% 88%;
  --sc-accent-fg: 0 0% 6%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  /* The plates. Red and cyan are the misregistration; yellow is the caption. */
  --sc-plate-r: 355 90% 55%;
  --sc-plate-c: 186 90% 55%;
  --sc-caption: 50 100% 60%;
  --sc-halftone: 0 0% 6%;
}
/* ===== dark register: the night city ===== */
:root.sc-spiderverse.sc-dark {
  --sc-bg: 260 30% 6%;
  --sc-fg: 45 42% 96%;
  --sc-card: 260 25% 11%;
  --sc-card-fg: 45 42% 96%;
  --sc-muted: 260 20% 22%;
  --sc-muted-fg: 45 20% 76%;
  --sc-border: 260 15% 44%;
  --sc-input: 260 15% 44%;
  --sc-primary: 355 90% 64%;
  --sc-primary-fg: 260 45% 8%;
  --sc-primary-shade: 0 0% 100%;
  --sc-ring: 355 90% 64%;
  --sc-accent: 260 22% 18%;
  --sc-accent-fg: 45 42% 96%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  --sc-plate-r: 355 95% 62%;
  --sc-plate-c: 186 95% 60%;
  --sc-caption: 50 100% 60%;
  --sc-halftone: 45 42% 96%;
}

/* ===== Shape: the panel ===== */
:root.sc-spiderverse {
  --sc-shadow: 4px 4px 0 hsl(var(--sc-fg));
  /* A comic panel is a hard rectangle, but a 2px corner on every surface in an
     app reads as unfinished rather than as a panel. The corners join the house
     radius; the 3px rule and the hard offset shadow are what actually carry
     the panel, and neither moves. */
  --sc-radius: 12px;
  --sc-radius-sm: 8px;
  --sc-border-w: 3px;
}

/* A card is a panel: square, heavy-ruled, with the hard offset a comic drop
   shadow has. This is the one mode that keeps a shadow, because a printed
   panel really does throw one. */
/* Substring form, so these reach the routes that render under a nested MUI
   ThemeProvider: there the generator emits MuiCard-root-186 and the counter
   moves between visits, so a class selector matches nothing. The two elevation
   classes keep their clean spelling beside an ANCHORED suffix match, because
   [class*="MuiPaper-elevation1"] also matches elevation10 through 19. Same
   form as the global rules in styles.ts; styles.test.ts explains it at length.
   No backticks in this comment: it lives inside a template literal. */
:root.sc-spiderverse [class*="MuiCard-root"],
:root.sc-spiderverse .MuiPaper-elevation1, :root.sc-spiderverse [class*="MuiPaper-elevation1-"],
:root.sc-spiderverse .MuiPaper-elevation2, :root.sc-spiderverse [class*="MuiPaper-elevation2-"],
:root.sc-spiderverse .sc-card {
  border-radius: var(--sc-radius) !important;
  border: 3px solid hsl(var(--sc-fg)) !important;
  box-shadow: 4px 4px 0 hsl(var(--sc-fg)) !important;
  /* Ben-Day dots, at the alpha that keeps type on top of them readable. The
     screen is the texture of the printing, not a pattern to look at. */
  background-image: radial-gradient(
    hsl(var(--sc-halftone) / .07) 1px, transparent 1px);
  background-size: 6px 6px;
}
/* A surface holding a table keeps its corners and clips the table to them, the
   same as the base sheet — the header no longer paints an opaque square into
   the arc, so there is nothing left to fight it. */
:root.sc-spiderverse [class*="MuiCard-root"]:has(table),
:root.sc-spiderverse .MuiPaper-elevation1:has(table), :root.sc-spiderverse [class*="MuiPaper-elevation1-"]:has(table),
:root.sc-spiderverse .MuiPaper-elevation2:has(table), :root.sc-spiderverse [class*="MuiPaper-elevation2-"]:has(table),
:root.sc-spiderverse .sc-card:has(table) {
  overflow: hidden !important;
}

:root.sc-spiderverse [class*="MuiButton-root"],
:root.sc-spiderverse .sc-btn,
:root.sc-spiderverse button[class*="bui-Button"],
:root.sc-spiderverse a[class*="bui-Button"] {
  border-radius: var(--sc-radius-sm) !important;
  border: 3px solid hsl(var(--sc-fg)) !important;
  box-shadow: 3px 3px 0 hsl(var(--sc-fg)) !important;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
/* A badge is a caption box. */
:root.sc-spiderverse .sc-badge,
:root.sc-spiderverse [class*="MuiChip-root"] {
  border-radius: var(--sc-radius-sm) !important;
  border: 2px solid hsl(var(--sc-fg)) !important;
  background: hsl(var(--sc-caption)) !important;
  color: hsl(0 0% 6%) !important;
  font-weight: 700;
}
:root.sc-spiderverse .sc-nav-mark,
:root.sc-spiderverse .sc-login-mark {
  border-radius: var(--sc-radius-sm) !important;
  border: 3px solid hsl(var(--sc-fg)) !important;
  background: hsl(var(--sc-primary)) !important;
  box-shadow: 3px 3px 0 hsl(var(--sc-fg)) !important;
}

/* ===== The misregistered plates =====
   Display type only. On body copy this doubles every stroke and the text stops
   being readable — which is the single most likely way this mode could go
   wrong, so the selector list is deliberately short and the tests check that
   it never widens to .sc body text. */
:root.sc-spiderverse .sc-h1,
:root.sc-spiderverse .sc-card-title {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: -0.01em;
  text-shadow:
    -2px 0 hsl(var(--sc-plate-r) / .85),
    2px 0 hsl(var(--sc-plate-c) / .85);
}
:root.sc-spiderverse .sc-h1 {
  font-size: 34px;
  line-height: 1.05;
}

:root.sc-spiderverse [class*="MuiDivider-root"],
:root.sc-spiderverse [class*="MuiTableCell-root"] {
  border-color: hsl(var(--sc-fg) / .35) !important;
}

/* ===== Motion =====
   Stepped, deliberately. Every other mode in this app that owns its motion
   uses a smooth curve because its reference does; a comic panel cuts. Two
   frames and a hold is the whole vocabulary, which is also the pixel system's
   original rule arriving here for a reason of its own rather than by default.
   Behind the reduced-motion query, and nothing is the only signal for a state. */
@media (prefers-reduced-motion: no-preference) {
  @keyframes sc-sv-snap {
    0%   { transform: translate(6px, -6px) rotate(1.5deg); opacity: 0; }
    100% { transform: translate(0, 0) rotate(0); opacity: 1; }
  }
  :root.sc-spiderverse [class*="bui-DialogInner"],
  :root.sc-spiderverse [class*="MuiDialog-paper"] {
    animation: sc-sv-snap .12s steps(2) both;
  }
  /* The press collapses into its own shadow, which is how a printed button
     would move if it moved at all. No translate: sliding a control out from
     under the pointer is banned app-wide. */
  :root.sc-spiderverse .sc-btn:active:not(:disabled),
  :root.sc-spiderverse [class*="MuiButton-root"]:active:not(.Mui-disabled) {
    box-shadow: 0 0 0 hsl(var(--sc-fg)) !important;
  }
  /* The plates jitter apart on hover, one step, like a frame held too long. */
  @keyframes sc-sv-shift {
    0%, 100% { text-shadow: -2px 0 hsl(var(--sc-plate-r) / .85), 2px 0 hsl(var(--sc-plate-c) / .85); }
    50%      { text-shadow: -3px 0 hsl(var(--sc-plate-r) / .9), 3px 0 hsl(var(--sc-plate-c) / .9); }
  }
  :root.sc-spiderverse .sc-card:hover .sc-card-title {
    animation: sc-sv-shift .3s steps(2) infinite;
  }
}
`;
}
