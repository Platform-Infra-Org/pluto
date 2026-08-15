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
`;
}
