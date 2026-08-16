/**
 * Agence Foudre mode, built from the site's own HTML and CSS.
 *
 * An earlier version of this file was built from a third-party summary of the
 * brand and was close but wrong in the specifics. Driving `agencefoudre.com`
 * with a browser and reading computed styles across its whole DOM corrected
 * four things a description could not have given:
 *
 * 1. **The hairline is lilac**, `1px solid #d1cfe4`, on every bordered element.
 *    The summary implied a magenta rule; the site never draws one.
 * 2. **The default box is 10px**, not 20px — 73 elements against 40 at the
 *    larger radius.
 * 3. **Its buttons are circles.** 35 elements sit at `border-radius: 50%`, and
 *    the primary action is a 60px bubblegum disc with forest-green text. That
 *    is the most recognisable thing about the chrome and no summary named it.
 * 4. **The motion is the design.** Over 950 elements transition on
 *    `cubic-bezier(.23, 1, .32, 1)`, with a second, overshooting curve at
 *    `cubic-bezier(.17, .67, .3, 1.33)` for arrivals. Reproducing the colours
 *    over stepped timing would be this design wearing the pixel system's clock
 *    — see the motion exception in docs/explanation/design-system.md, which was
 *    amended before this file relied on it.
 *
 * Measured proportions from the same pass: chalk is the dominant text colour
 * (583 elements), magenta serves as both display type and fill (245 / 50),
 * forest green carries body text (161), and there is exactly one box-shadow on
 * the entire page — the system is flat.
 *
 * Two departures, both forced by measurement:
 *
 * 1. **Magenta darkens where it fills.** At the site's `#db3c8a` it carries
 *    chalk at 3.3:1, below AA; at 36% lightness it carries it at 7.32:1. It
 *    keeps full intensity as *display type*, where it measures 4.15:1 against
 *    the card — past the 3:1 that applies to large text, and exactly the role
 *    the site gives it.
 * 2. **The rule is a darkened lilac; the true lilac stays a hairline.** At
 *    `#d1cfe4` it measures about 1.4:1 on white and cannot carry a border that
 *    means anything. `--sc-border` takes a deeper tone clearing 3:1 and
 *    `--sc-hairline` keeps the original for dividers, which is its job on the
 *    site too.
 *
 * The display face is Anton, self-hosted. The site sets its headlines in Beni
 * Black, which has no free licence; Anton is the closest licensable match in
 * proportion and is not the same typeface.
 */

export function foudreCss(): string {
  return `
/* ===== Agence Foudre — light register: warm chalk ===== */
:root.sc-foudre {
  --sc-bg: 13 100% 98%;
  --sc-fg: 0 0% 0%;
  --sc-card: 0 0% 100%;
  --sc-card-fg: 0 0% 0%;
  --sc-muted: 12 83% 93%;
  --sc-muted-fg: 153 100% 16%;
  --sc-border: 246 20% 62%;
  --sc-input: 246 20% 62%;
  --sc-primary: 331 69% 36%;
  --sc-primary-fg: 13 100% 98%;
  --sc-primary-shade: 240 10% 8%;
  --sc-ring: 331 69% 36%;
  --sc-accent: 12 83% 93%;
  --sc-accent-fg: 153 100% 14%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  /* Magenta at the intensity the site prints it, for display type only. */
  --sc-display: 331 69% 55%;
  --sc-bubblegum: 338 76% 78%;
  --sc-hairline: 246 28% 85%;
}
/* ===== dark register: forest ===== */
:root.sc-foudre.sc-dark {
  --sc-bg: 153 100% 4%;
  --sc-fg: 13 100% 98%;
  --sc-card: 153 60% 7%;
  --sc-card-fg: 13 100% 98%;
  --sc-muted: 153 40% 20%;
  --sc-muted-fg: 12 60% 84%;
  --sc-border: 246 28% 70%;
  --sc-input: 246 28% 70%;
  --sc-primary: 338 76% 78%;
  --sc-primary-fg: 153 100% 10%;
  --sc-primary-shade: 0 0% 100%;
  --sc-ring: 338 76% 78%;
  --sc-accent: 153 45% 16%;
  --sc-accent-fg: 13 100% 98%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  --sc-display: 338 76% 78%;
  --sc-bubblegum: 338 76% 78%;
  --sc-hairline: 246 28% 70%;
}

/* ===== Shape =====
   The site's own radius set, in its own proportions: 10px the default box,
   20px the larger surface, 50% the buttons. */
:root.sc-foudre {
  --sc-shadow: none;
  --sc-radius: 10px;
  --sc-radius-sm: 10px;
  --sc-border-w: 1px;
  --sc-font-display: Anton, 'Archivo Narrow', Impact, sans-serif;
  /* The easing vocabulary, declared once so every rule below uses the same
     curves. Taken from the site: the first is on ~950 of its elements, the
     second overshoots and is reserved for arrivals. */
  --sc-ease: cubic-bezier(.23, 1, .32, 1);
  --sc-ease-back: cubic-bezier(.17, .67, .3, 1.33);
  --sc-dur: .4s;
  --sc-dur-slow: .8s;
}

/* Cards: 20px, a lilac rule, flat. */
:root.sc-foudre .MuiCard-root,
:root.sc-foudre .MuiPaper-elevation1,
:root.sc-foudre .MuiPaper-elevation2,
:root.sc-foudre .sc-card {
  border-radius: 20px !important;
  border-width: 1px !important;
  border-color: hsl(var(--sc-border)) !important;
  box-shadow: none !important;
}
/* A surface holding a table takes no radius at all — clipped cuts the table,
   rounded lets its square corner cover the arc. See the base sheet. */
:root.sc-foudre .MuiCard-root:has(table),
:root.sc-foudre .MuiPaper-elevation1:has(table),
:root.sc-foudre .MuiPaper-elevation2:has(table),
:root.sc-foudre .sc-card:has(table) {
  border-radius: 0 !important;
}

/* Buttons take the 10px box; an icon-only control becomes a disc, which is the
   shape the site gives every one of its actions. A text button keeps the box
   deliberately — a label does not fit in a circle, and truncating one to honour
   a motif would be the motif costing the app its function. */
:root.sc-foudre .MuiButton-root,
:root.sc-foudre .sc-btn,
:root.sc-foudre button[class*="bui-Button"],
:root.sc-foudre a[class*="bui-Button"] {
  border-radius: 10px !important;
  box-shadow: none !important;
  text-transform: none;
  letter-spacing: 0;
}
:root.sc-foudre .MuiIconButton-root,
:root.sc-foudre .sc-nav-toggle {
  border-radius: 50% !important;
}
/* The mark is one of the site's discs: flat bubblegum, no tile, no shadow. */
:root.sc-foudre .sc-nav-mark,
:root.sc-foudre .sc-login-mark {
  background: hsl(var(--sc-bubblegum)) !important;
  border-radius: 50% !important;
  border: none !important;
  box-shadow: none !important;
  color: hsl(153 100% 16%) !important;
}

/* ===== Type =====
   Anton at a 0.70 line-height, the ratio the site sets Beni at (94px over
   65.8px), which is what makes a headline read as a block rather than a line.
   Display sizes only: at body size that leading clips descenders. */
:root.sc-foudre .sc-h1 {
  font-family: var(--sc-font-display) !important;
  font-weight: 400;
  font-size: 38px;
  line-height: .70;
  letter-spacing: -0.02em;
  text-transform: uppercase;
  color: hsl(var(--sc-display));
}
:root.sc-foudre .sc-card-title {
  font-family: var(--sc-font-display) !important;
  font-weight: 400;
  letter-spacing: -0.01em;
  text-transform: uppercase;
  font-size: 18px;
}
:root.sc-foudre .sc-btn,
:root.sc-foudre .sc-badge,
:root.sc-foudre .sc-nav-tx,
:root.sc-foudre .sc-nav-word,
:root.sc-foudre .sc-label,
:root.sc-foudre .MuiTableCell-head {
  text-transform: none;
  letter-spacing: 0;
}

/* Tags are fully round; links carry the forest ink and stay underlined. */
:root.sc-foudre .sc-badge,
:root.sc-foudre .MuiChip-root {
  border-radius: 9999px !important;
  background: hsl(var(--sc-accent)) !important;
}
:root.sc-foudre .sc-link,
:root.sc-foudre a[class*="bui-Link"] {
  color: hsl(var(--sc-muted-fg));
  text-decoration: underline;
  text-underline-offset: 3px;
}
:root.sc-foudre .MuiDivider-root,
:root.sc-foudre .MuiTableCell-root {
  border-color: hsl(var(--sc-hairline)) !important;
}

/* ===== Motion =====
   The mode exception the design system now records: this theme replaces the
   stepped vocabulary wholesale rather than mixing the two. Every rule uses the
   tokens above, all of it sits inside the reduced-motion query, and none of it
   is the only signal for any state — each is a response to a pointer.

   The site's restraint is worth copying too: it animates transform, colour and
   opacity and nothing else. Those are the properties a compositor can run
   without touching layout, which is why the result reads as smooth rather than
   as busy. */
@media (prefers-reduced-motion: no-preference) {
  :root.sc-foudre .sc-nav-item,
  :root.sc-foudre .sc-btn,
  :root.sc-foudre .MuiButton-root,
  :root.sc-foudre .MuiChip-root,
  :root.sc-foudre .sc-card,
  :root.sc-foudre .MuiCard-root {
    transition:
      transform var(--sc-dur) var(--sc-ease),
      background-color var(--sc-dur) var(--sc-ease),
      color var(--sc-dur) var(--sc-ease),
      border-color var(--sc-dur) var(--sc-ease),
      opacity var(--sc-dur) var(--sc-ease) !important;
  }
  /* A row slides toward the pointer rather than lighting up under it. */
  :root.sc-foudre .sc-nav-item:hover {
    transform: translateX(3px);
  }
  /* Buttons lift on hover and settle on press. The overshoot curve is what
     makes the lift read as a response rather than a move. */
  :root.sc-foudre .sc-btn:hover:not(:disabled),
  :root.sc-foudre .MuiButton-root:hover:not(.Mui-disabled) {
    transform: translateY(-2px);
    transition-timing-function: var(--sc-ease-back);
  }
  /* Press settles rather than displaces. A translate on :active is banned app
     wide — it slides the button out from under the pointer, which is the exact
     glitch that rule was written for. A scale keeps the press legible without
     the control moving anywhere. */
  :root.sc-foudre .sc-btn:active:not(:disabled),
  :root.sc-foudre .MuiButton-root:active:not(.Mui-disabled) {
    transform: scale(.98);
  }
  /* Cards rise slightly on hover, at the slow duration so a grid of them does
     not feel twitchy as the pointer crosses it. */
  :root.sc-foudre .sc-card:hover,
  :root.sc-foudre .MuiCard-root:hover {
    transform: translateY(-3px);
    transition-duration: var(--sc-dur-slow);
  }
  /* A dialog arrives rather than appears, on the overshoot curve. */
  @keyframes sc-foudre-arrive {
    from { transform: translateY(12px) scale(.98); opacity: 0; }
    to   { transform: translateY(0) scale(1); opacity: 1; }
  }
  :root.sc-foudre [class*="bui-DialogInner"],
  :root.sc-foudre .MuiDialog-paper {
    animation: sc-foudre-arrive var(--sc-dur) var(--sc-ease-back) both;
  }
  /* The mark flickers on hover, echoing the site's own flicker keyframe. The
     unanimated default is the lit frame. */
  @keyframes sc-foudre-flicker {
    0%, 100% { opacity: 1; }
    50%      { opacity: .72; }
  }
  :root.sc-foudre .sc-nav-brand:hover .sc-nav-mark {
    animation: sc-foudre-flicker var(--sc-dur-slow) var(--sc-ease) infinite;
  }
}
`;
}
