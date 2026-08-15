/**
 * Ancient Greek mode: the seventh potion, and the first that is a *mode*
 * rather than an accent.
 *
 * Everything here hangs off one root class, `sc-greek`, toggled by
 * `applyScheme()`. That works because `:root.sc-greek` is specificity (0,2,0)
 * and the injected accent sheet's `:root` is (0,1,0) — Greek wins regardless
 * of injection order, which is the same reason `sc-konami` can override the
 * picked accent. `:root.sc-greek.sc-dark` is (0,3,0) and settles the dark
 * register over both.
 *
 * Kept out of styles.ts deliberately: that file is 1382 lines of a single
 * template literal and has been silently truncated by a stray backtick twice.
 * A whole second art direction inline makes a known hazard worse.
 *
 * Colour values are solved, not chosen: every pair that carries text clears
 * 4.5:1, the gold rule clears 3:1 against its card, and the status set clears
 * 5.0:1 against both card and dithered cell. See statusTokens.ts.
 */
export function greekCss(): string {
  return `
/* ===== Ancient Greek mode — light register: Olympus ===== */
:root.sc-greek {
  --sc-bg: 40 30% 96%;
  --sc-fg: 30 14% 13%;
  --sc-card: 42 45% 98%;
  --sc-card-fg: 30 14% 13%;
  --sc-muted: 40 20% 92%;
  --sc-muted-fg: 35 14% 34%;
  --sc-border: 40 55% 46%;
  --sc-input: 40 55% 46%;
  --sc-primary: 10 68% 34%;
  --sc-primary-fg: 0 0% 100%;
  --sc-primary-shade: 240 10% 8%;
  --sc-ring: 10 68% 34%;
  --sc-accent: 40 25% 90%;
  --sc-accent-fg: 30 14% 20%;
  --sc-success: 58 62% 42%;
  --sc-warning: 188 65% 45%;
  --sc-destructive: 12 78% 50%;
  /* The filigree gold, used by the chrome. Not a shadcn token. */
  --sc-gold: 40 55% 46%;
}
/* ===== dark register: the Underworld ===== */
:root.sc-greek.sc-dark {
  --sc-bg: 265 32% 6%;
  --sc-fg: 40 28% 92%;
  --sc-card: 265 26% 10%;
  --sc-card-fg: 40 28% 92%;
  --sc-muted: 265 18% 18%;
  --sc-muted-fg: 40 14% 70%;
  --sc-border: 43 62% 46%;
  --sc-input: 43 62% 46%;
  --sc-primary: 14 88% 55%;
  --sc-primary-fg: 240 10% 8%;
  --sc-primary-shade: 0 0% 100%;
  --sc-ring: 14 88% 55%;
  --sc-accent: 265 20% 16%;
  --sc-accent-fg: 40 28% 92%;
  --sc-success: 58 62% 42%;
  --sc-warning: 188 65% 45%;
  --sc-destructive: 12 78% 50%;
  --sc-gold: 43 62% 46%;
}

/* ===== Ornate chrome. One grammar, two brightnesses: the light register is
   the same filigree in bronze on bone, the dark one is gold on obsidian with
   the glow doing real work. No image assets — box-shadow and gradients. ===== */

/* Cards get a gold rule and a thin inner line. Single frame only.
   ponytail: the spec's clipped corner notches (clip-path) are dropped — the
   gold rule plus the inset line already reads as a distinct surface, and
   clip-path would clip away the hard offset shadow every surface in this
   design system carries.
   No backticks in this comment: it lives inside a template literal, and one
   stray backtick truncates the whole sheet. */
:root.sc-greek .MuiCard-root,
:root.sc-greek .MuiPaper-elevation1,
:root.sc-greek .MuiPaper-elevation2,
:root.sc-greek .sc-card {
  border-color: hsl(var(--sc-gold)) !important;
  box-shadow:
    inset 0 0 0 1px hsl(var(--sc-gold) / .3),
    var(--sc-shadow) !important;
}

/* The command window, in gold. Same three-shadow construction the base sheet
   already uses for dialogs, retinted, plus an ember bloom behind it. */
:root.sc-greek [class*="bui-DialogInner"],
:root.sc-greek .MuiDialog-paper {
  position: relative;
  border-color: hsl(var(--sc-gold)) !important;
  box-shadow:
    0 0 0 2px hsl(var(--sc-card)),
    0 0 0 4px hsl(var(--sc-gold)),
    0 0 14px hsl(var(--sc-primary) / .3),
    var(--sc-shadow) !important;
}
/* Diamond corner marks. ponytail: two corners, not four — a diamond needs its
   own box and an element has two pseudo-elements. Asymmetric corner accents
   are a real Hades motif, so this is a deliberate stop rather than a
   limitation; add a wrapper span if four are ever wanted. */
:root.sc-greek [class*="bui-DialogInner"]::before,
:root.sc-greek .MuiDialog-paper::before,
:root.sc-greek [class*="bui-DialogInner"]::after,
:root.sc-greek .MuiDialog-paper::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  background: hsl(var(--sc-gold));
  transform: rotate(45deg);
  pointer-events: none;
  z-index: 1;
}
/* Inside the border box, not outside it: styles.ts sets overflow: hidden on
   this same element so its header and footer edges follow the rounded corners,
   and that clips any absolutely positioned child of it. A mark at -8px paints
   nothing at all. */
:root.sc-greek [class*="bui-DialogInner"]::before,
:root.sc-greek .MuiDialog-paper::before { top: 3px; left: 3px; }
:root.sc-greek [class*="bui-DialogInner"]::after,
:root.sc-greek .MuiDialog-paper::after { bottom: 3px; right: 3px; }

/* The filigree band behind page headers. Read by theme.tsx through
   --sc-header-art, because a selector naming BackstageHeader is dead in a
   production build (its makeStyles class hashes to jss<n>). */
:root.sc-greek {
  --sc-header-art:
    repeating-linear-gradient(
      90deg,
      hsl(var(--sc-gold) / .22) 0 2px,
      transparent 2px 6px,
      hsl(var(--sc-gold) / .22) 6px 8px,
      transparent 8px 18px
    );
}

/* Primary buttons carry the gold rule too. */
:root.sc-greek .MuiButton-containedPrimary,
:root.sc-greek .sc-btn-primary {
  border: var(--sc-border-w) solid hsl(var(--sc-gold)) !important;
}

/* The ember bloom on primary surfaces. Two frames, stepped — no interpolation,
   which is the rule the whole design system follows. The unanimated default
   below is the LIT frame, so someone who asked for stillness gets the intended
   look rather than a glow frozen halfway.
   filter: drop-shadow(), not box-shadow: styles.ts claims box-shadow with
   !important on the button root, and an important author declaration beats
   both a normal one at any specificity AND the animation origin — so a
   box-shadow glow here would never paint, animated or not. Nothing claims
   filter. */
:root.sc-greek .MuiButton-containedPrimary,
:root.sc-greek .sc-btn-primary,
:root.sc-greek [data-variant="primary"][class*="bui-Button"] {
  filter: drop-shadow(0 0 5px hsl(var(--sc-primary) / .5));
}
@media (prefers-reduced-motion: no-preference) {
  @keyframes sc-greek-ember {
    0%, 100% { filter: drop-shadow(0 0 5px hsl(var(--sc-primary) / .5)); }
    50% { filter: drop-shadow(0 0 9px hsl(var(--sc-primary) / .8)); }
  }
  :root.sc-greek .MuiButton-containedPrimary,
  :root.sc-greek .sc-btn-primary,
  :root.sc-greek [data-variant="primary"][class*="bui-Button"] {
    animation: sc-greek-ember 1.6s steps(2) infinite;
  }
}
`;
}
