/**
 * Slush mode: stickers on paper.
 *
 * Read from `slush.app` itself rather than from a description of it. Three
 * things dominate its computed styles and they are what this mode is built on:
 *
 * 1. **Thick black outlines.** 72 elements at `4px solid #000` and 61 more at
 *    `2px`. Nothing else in the app draws a rule that heavy, and it is the
 *    single most recognisable thing about the design — a sticker is defined by
 *    its cut edge.
 * 2. **No elevation at all.** Not one box-shadow on the entire page. Separation
 *    comes from the outline and from flat colour, never from depth.
 * 3. **Big radii, and pills.** 30px on 79 elements, 20px on 50, 40px on 24, and
 *    82 more at 1440–1600px — which is a pill by any other number.
 *
 * The ground is black on white (1394 / 351 elements), and the colour arrives as
 * *fills*: sunburst `#ffd731`, electric blue `#4da2ff`, lavender `#e9ccff`,
 * mint `#55db9c`, ember `#fb4903`, voltage violet `#5c4ade`. They are stickers
 * stuck onto the page, not a tint applied to it.
 *
 * **Every sticker carries black text, and that is measured, not stylistic.**
 * Against black: yellow 14.94, lavender 14.57, mint 12.09, blue 7.57, ember
 * 6.12. Against white the same fills sit at 1.41–3.43 — unusable. Violet is the
 * one that inverts (3.43 black, 6.12 white) and is therefore the only fill
 * given light text. A theme that put white on all of them would be illegible on
 * five of its six accents.
 *
 * The primary action darkens the blue to 43% so it can carry white at 5.53:1;
 * the sticker blue keeps its published value for fills, where black sits on it.
 *
 * Typeface is unchanged: Clash Grotesk, the app's one family. The reference
 * sets Aeonik Pro with Lateral for display — neither is licensable here, and
 * the weight range covers the same job.
 */

export function slushCss(): string {
  return `
/* ===== Slush — light register: paper ===== */
:root.sc-slush {
  --sc-bg: 0 0% 100%;
  --sc-fg: 0 0% 0%;
  --sc-card: 0 0% 100%;
  --sc-card-fg: 0 0% 0%;
  --sc-muted: 210 100% 96%;
  --sc-muted-fg: 0 0% 28%;
  --sc-border: 0 0% 0%;
  --sc-input: 0 0% 0%;
  --sc-primary: 213 100% 43%;
  --sc-primary-fg: 0 0% 100%;
  --sc-primary-shade: 240 10% 8%;
  --sc-ring: 213 100% 43%;
  --sc-accent: 275 100% 90%;
  --sc-accent-fg: 0 0% 8%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  /* The sticker set, at the site's own values. All of these take black text. */
  --sc-sticker: 48 100% 60%;
  --sc-sticker-alt: 154 65% 60%;
  --sc-sticker-hot: 17 98% 50%;
  /* The one that inverts — 3.43:1 on black, 6.12:1 on white. */
  --sc-sticker-deep: 247 71% 58%;
}
/* ===== dark register: the same stickers on a black table ===== */
:root.sc-slush.sc-dark {
  --sc-bg: 0 0% 4%;
  --sc-fg: 0 0% 100%;
  --sc-card: 0 0% 8%;
  --sc-card-fg: 0 0% 100%;
  --sc-muted: 0 0% 18%;
  --sc-muted-fg: 0 0% 72%;
  --sc-border: 0 0% 100%;
  --sc-input: 0 0% 100%;
  --sc-primary: 213 100% 65%;
  --sc-primary-fg: 0 0% 6%;
  --sc-primary-shade: 0 0% 100%;
  --sc-ring: 213 100% 65%;
  --sc-accent: 247 45% 22%;
  --sc-accent-fg: 0 0% 100%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
  --sc-sticker: 48 100% 60%;
  --sc-sticker-alt: 154 65% 60%;
  --sc-sticker-hot: 17 98% 50%;
  --sc-sticker-deep: 247 71% 58%;
}

/* ===== Shape =====
   The outline is the design. 2px is the working rule and 4px is reserved for
   the surfaces that need to read as cut out. */
:root.sc-slush {
  --sc-shadow: none;
  --sc-radius: 20px;
  --sc-radius-sm: 12px;
  --sc-border-w: 2px;
  --sc-ease: cubic-bezier(.2, .9, .3, 1.2);
  --sc-dur: .22s;
}

/* Cards are cut out: 30px and the heavy rule, flat. */
/* Substring form, so these reach the routes that render under a nested MUI
   ThemeProvider: there the generator emits MuiCard-root-186 and the counter
   moves between visits, so a class selector matches nothing. The two elevation
   classes keep their clean spelling beside an ANCHORED suffix match, because
   [class*="MuiPaper-elevation1"] also matches elevation10 through 19. Same
   form as the global rules in styles.ts; styles.test.ts explains it at length.
   No backticks in this comment: it lives inside a template literal. */
:root.sc-slush [class*="MuiCard-root"],
:root.sc-slush .MuiPaper-elevation1, :root.sc-slush [class*="MuiPaper-elevation1-"],
:root.sc-slush .MuiPaper-elevation2, :root.sc-slush [class*="MuiPaper-elevation2-"],
:root.sc-slush .sc-card {
  border-radius: 30px !important;
  border: 4px solid hsl(var(--sc-border)) !important;
  box-shadow: none !important;
}
/* A surface holding a table takes no radius at all — clipped cuts the table,
   rounded lets its square corner cover the arc. See the base sheet. A 4px rule
   makes both failures more obvious here, not less. */
:root.sc-slush [class*="MuiCard-root"]:has(table),
:root.sc-slush .MuiPaper-elevation1:has(table), :root.sc-slush [class*="MuiPaper-elevation1-"]:has(table),
:root.sc-slush .MuiPaper-elevation2:has(table), :root.sc-slush [class*="MuiPaper-elevation2-"]:has(table),
:root.sc-slush .sc-card:has(table) {
  overflow: hidden !important;
}

/* Buttons and tags are pills with the same cut edge. */
:root.sc-slush [class*="MuiButton-root"],
:root.sc-slush .sc-btn,
:root.sc-slush button[class*="bui-Button"],
:root.sc-slush a[class*="bui-Button"] {
  border-radius: 9999px !important;
  border: 2px solid hsl(var(--sc-border)) !important;
  box-shadow: none !important;
  font-weight: 600;
}
:root.sc-slush .sc-badge,
:root.sc-slush [class*="MuiChip-root"] {
  border-radius: 9999px !important;
  border: 2px solid hsl(var(--sc-border)) !important;
  background: hsl(var(--sc-sticker)) !important;
  color: hsl(0 0% 0%) !important;
  font-weight: 600;
}
/* The mark is a sticker: a hard-edged disc in the hot accent. */
:root.sc-slush .sc-nav-mark,
:root.sc-slush .sc-login-mark {
  background: hsl(var(--sc-sticker-hot)) !important;
  border: 2px solid hsl(var(--sc-border)) !important;
  border-radius: 9999px !important;
  box-shadow: none !important;
  color: hsl(0 0% 0%) !important;
}
:root.sc-slush .sc-nav-item {
  border-radius: 9999px;
}
:root.sc-slush .sc-input,
:root.sc-slush [class*="MuiOutlinedInput-root"] {
  border-radius: 12px !important;
}

/* Headlines are set tight and heavy — the reference's display voice is a
   compressed face, and weight plus tracking is how one family gets there. */
:root.sc-slush .sc-h1 {
  font-weight: 700 !important;
  letter-spacing: -0.035em;
}
:root.sc-slush .sc-card-title {
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* Dividers keep the rule rather than fading it — this system has no hairlines. */
:root.sc-slush [class*="MuiDivider-root"],
:root.sc-slush [class*="MuiTableCell-root"] {
  border-color: hsl(var(--sc-border) / .25) !important;
}

/* ===== Motion =====
   A sticker is pressed on, so the vocabulary here is scale rather than travel,
   on a slight overshoot. Same mode exception the design system records: the
   curves are declared as tokens, everything sits inside the reduced-motion
   query, and nothing is the only signal for a state. */
@media (prefers-reduced-motion: no-preference) {
  :root.sc-slush .sc-btn,
  :root.sc-slush [class*="MuiButton-root"],
  :root.sc-slush .sc-badge,
  :root.sc-slush [class*="MuiChip-root"],
  :root.sc-slush .sc-nav-item,
  :root.sc-slush .sc-card,
  :root.sc-slush [class*="MuiCard-root"] {
    transition:
      transform var(--sc-dur) var(--sc-ease),
      background-color var(--sc-dur) var(--sc-ease),
      color var(--sc-dur) var(--sc-ease),
      border-color var(--sc-dur) var(--sc-ease) !important;
  }
  :root.sc-slush .sc-btn:hover:not(:disabled),
  :root.sc-slush [class*="MuiButton-root"]:hover:not(.Mui-disabled) {
    transform: scale(1.04);
  }
  /* Press settles rather than displaces: a translate on :active slides the
     control out from under the pointer, which the base sheet bans app-wide. */
  :root.sc-slush .sc-btn:active:not(:disabled),
  :root.sc-slush [class*="MuiButton-root"]:active:not(.Mui-disabled) {
    transform: scale(.97);
  }
  :root.sc-slush .sc-nav-item:hover {
    transform: scale(1.02);
  }
  /* A dialog is stuck on rather than faded in. */
  @keyframes sc-slush-stick {
    from { transform: scale(.94) rotate(-1deg); opacity: 0; }
    to   { transform: scale(1) rotate(0); opacity: 1; }
  }
  :root.sc-slush [class*="bui-DialogInner"],
  :root.sc-slush [class*="MuiDialog-paper"] {
    animation: sc-slush-stick var(--sc-dur) var(--sc-ease) both;
  }
}
`;
}
