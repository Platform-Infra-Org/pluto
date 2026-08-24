/**
 * The Hades potion: one mode, nine boons.
 *
 * Unlike the other crafted modes, this one carries a second axis. `data-boon`
 * on the root selects a god, and each god redefines the accent tokens and swaps
 * the ornament and animation layer. Nine bottles on the shelf would have been
 * nine silhouettes to draw and nine rows to keep in contrast; one bottle and a
 * wheel is the same variety at a ninth of the surface.
 *
 * An unset `data-boon` is deliberate and is Hades' own register — the centre of
 * the wheel, which is the emblem rather than a god. Obsidian ground, crimson
 * accent, gold trim: the House itself, before any boon is drawn.
 *
 * One register only, unlike greek/egyptian/nightshade/rimefast: those pair a
 * day and a night register because their subject has both. The Underworld does
 * not — there is no daylit Hades — so `:root.sc-hades.sc-dark` does not exist,
 * and `:root.sc-hades` alone carries the dark, obsidian values `.sc-dark` would
 * otherwise supply.
 *
 * Kept out of styles.ts for the reason greek.ts and egyptian.ts both give: that
 * file is one template literal, silently truncated by a stray backtick twice
 * already, and a whole second art direction inline would make that hazard
 * worse.
 */

export const BOONS = [
  'zeus', 'poseidon', 'demeter', 'hermes', 'dionysus',
  'ares', 'artemis', 'aphrodite', 'chaos',
] as const;
export type Boon = (typeof BOONS)[number];

/** Shown beside the wheel: the equipped boon must be readable, not only visible. */
export const BOON_LABELS: Record<Boon, string> = {
  zeus: 'Zeus', poseidon: 'Poseidon', demeter: 'Demeter',
  hermes: 'Hermes', dionysus: 'Dionysus', ares: 'Ares',
  artemis: 'Artemis', aphrodite: 'Aphrodite', chaos: 'Chaos',
};

export function hadesCss(): string {
  return `
/* ===== Hades — the House itself, before any boon is drawn ===== */
:root.sc-hades {
  --sc-bg: 260 18% 7%;
  --sc-fg: 40 30% 92%;
  --sc-card: 260 16% 10%;
  --sc-card-fg: 40 30% 92%;
  --sc-muted: 260 12% 14%;
  --sc-muted-fg: 40 14% 65%;
  --sc-border: 260 14% 18%;
  --sc-input: 260 14% 18%;
  --sc-primary: 352 72% 45%;
  --sc-primary-fg: 0 0% 100%;
  --sc-primary-shade: 240 10% 8%;
  --sc-ring: 352 72% 45%;
  --sc-accent: 43 74% 55%;
  --sc-accent-fg: 240 10% 8%;
  --sc-success: 152 42% 40%;
  --sc-warning: 35 68% 47%;
  --sc-destructive: 0 60% 51%;
}

/* ===== The nine boons =====
   Each block redefines only the accent tokens and the ornament layer —
   everything else (ground, ink, gold trim) stays the House's own, because a
   boon retints the room, it does not redecorate it. Every animation targets
   the same element the two worked patterns below settle on, .sc-card-h::after,
   so a boon change is one thing to look at rather than nine different
   surfaces each doing their own thing.

   --sc-primary-fg is picked per boon as WHITE or near-black, whichever clears
   4.5:1 against that boon's own --sc-primary — contrast.test.ts measures every
   one, because nine gods that all fail the same way is as bad as nine gods
   that all render the same colour. */

/* ZEUS — electric gold. Forked bolts in the header rule, arc-flicker.
   The flicker is two stops, not a fade: a bolt either strikes or it does not,
   and steps() is the only cadence that reads as electricity rather than as a
   dimmer. */
:root.sc-hades[data-boon="zeus"] {
  --sc-primary: 45 96% 55%;
  --sc-primary-fg: 240 10% 8%;
  --sc-boon-ornament: linear-gradient(115deg, transparent 45%, hsl(45 96% 55% / 0.5) 46%, transparent 47%);
}
@media (prefers-reduced-motion: no-preference) {
  :root.sc-hades[data-boon="zeus"] .sc-card-h::after {
    animation: sc-hades-zeus 1.4s steps(2, end) infinite;
  }
}
@keyframes sc-hades-zeus { 0%, 80% { opacity: 0; } 81%, 100% { opacity: 1; } }

/* POSEIDON — deep aqua. A wave meander along card edges, swelling in four
   stops so the crest moves in discrete cells like the rest of the pixel
   furniture.
   --sc-primary-fg is near-black rather than white: white on this aqua at 42%
   lightness measures 2.90, well under the 4.5:1 floor, where near-black
   measures 6.43 — the same rule every other boon below follows, applied here
   too rather than left as the one exception. */
:root.sc-hades[data-boon="poseidon"] {
  --sc-primary: 190 82% 42%;
  --sc-primary-fg: 240 10% 8%;
  --sc-boon-ornament: repeating-linear-gradient(90deg, hsl(190 82% 42% / 0.45) 0 6px, transparent 6px 12px);
}
@media (prefers-reduced-motion: no-preference) {
  :root.sc-hades[data-boon="poseidon"] .sc-card-h::after {
    animation: sc-hades-poseidon 2s steps(4, end) infinite;
  }
}
@keyframes sc-hades-poseidon { from { background-position: 0 0; } to { background-position: 24px 0; } }

/* DEMETER — frost over wheat. A hatch of diagonal stripes, the slowest thing
   on the wheel: a harvest goddess's ornament drifts, it does not strike. */
:root.sc-hades[data-boon="demeter"] {
  --sc-primary: 195 40% 88%;
  --sc-primary-fg: 240 10% 8%;
  --sc-boon-ornament: repeating-linear-gradient(45deg, hsl(195 40% 88% / .5) 0 4px, transparent 4px 8px);
}
@media (prefers-reduced-motion: no-preference) {
  :root.sc-hades[data-boon="demeter"] .sc-card-h::after {
    animation: sc-hades-demeter 6s steps(6, end) infinite;
  }
}
@keyframes sc-hades-demeter { from { background-position: 0 0; } to { background-position: 24px 0; } }

/* HERMES — bright orange. Tight speed lines on the nav cursor, the fastest
   cadence on the wheel and the shortest duration of any boon here — 0.6s is
   what makes it read as speed rather than as a blink. */
:root.sc-hades[data-boon="hermes"] {
  --sc-primary: 32 92% 55%;
  --sc-primary-fg: 240 10% 8%;
  --sc-boon-ornament: repeating-linear-gradient(100deg, hsl(32 92% 55% / .55) 0 3px, transparent 3px 9px);
}
@media (prefers-reduced-motion: no-preference) {
  :root.sc-hades[data-boon="hermes"] .sc-card-h::after {
    animation: sc-hades-hermes .6s steps(3, end) infinite;
  }
}
@keyframes sc-hades-hermes { from { background-position: 0 0; } to { background-position: 18px 0; } }

/* DIONYSUS — violet-purple. Vine-and-goblet dots at the corners, rising like
   bubbles through wine.
   --sc-primary is 56% lightness rather than the more obvious 58%: at 58% both
   white (4.31) and near-black (4.33) sit just under the 4.5:1 floor, and 56%
   is the smallest drop that clears it (4.63 on white) without moving the hue
   or saturation that make this boon read as Dionysus. */
:root.sc-hades[data-boon="dionysus"] {
  --sc-primary: 280 62% 56%;
  --sc-primary-fg: 0 0% 100%;
  --sc-boon-ornament: radial-gradient(circle, hsl(280 62% 56% / .55) 0 2px, transparent 3px) 0 0 / 10px 10px;
}
@media (prefers-reduced-motion: no-preference) {
  :root.sc-hades[data-boon="dionysus"] .sc-card-h::after {
    animation: sc-hades-dionysus 2.4s steps(5, end) infinite;
  }
}
@keyframes sc-hades-dionysus { from { background-position: 0 0; } to { background-position: 0 -20px; } }

/* ARES — blood red. Crossed spears in the header rule, flashing like a blade
   catching light rather than pulsing like an ember — two stops, the same
   binary cadence zeus's lightning uses, because a blade also either flashes
   or it does not. */
:root.sc-hades[data-boon="ares"] {
  --sc-primary: 0 78% 46%;
  --sc-primary-fg: 0 0% 100%;
  --sc-boon-ornament: linear-gradient(60deg, transparent 40%, hsl(0 78% 46% / .6) 42%, transparent 44%),
    linear-gradient(120deg, transparent 40%, hsl(0 78% 46% / .6) 42%, transparent 44%);
}
@media (prefers-reduced-motion: no-preference) {
  :root.sc-hades[data-boon="ares"] .sc-card-h::after {
    animation: sc-hades-ares 1.1s steps(2, end) infinite;
  }
}
@keyframes sc-hades-ares { 0%, 70% { opacity: 0; } 71%, 100% { opacity: 1; } }

/* ARTEMIS — forest green. An arrow rule beneath the title, streaking across
   in four stops like a shot loosed and landing. */
:root.sc-hades[data-boon="artemis"] {
  --sc-primary: 140 55% 45%;
  --sc-primary-fg: 240 10% 8%;
  --sc-boon-ornament: linear-gradient(90deg, transparent 0 20%, hsl(140 55% 45% / .6) 20% 24%, transparent 24% 40%, hsl(140 55% 45% / .6) 40% 44%, transparent 44%);
}
@media (prefers-reduced-motion: no-preference) {
  :root.sc-hades[data-boon="artemis"] .sc-card-h::after {
    animation: sc-hades-artemis 1.8s steps(4, end) infinite;
  }
}
@keyframes sc-hades-artemis { from { background-position: 0 0; } to { background-position: 16px 0; } }

/* APHRODITE — rose pink. Heart-laurel marks at the corners, pulsing in four
   stops rather than fading — the same discipline the ember bloom in
   greek.ts and egyptian.ts's gild both keep: no interpolation, ever. */
:root.sc-hades[data-boon="aphrodite"] {
  --sc-primary: 330 78% 62%;
  --sc-primary-fg: 240 10% 8%;
  --sc-boon-ornament: radial-gradient(circle, hsl(330 78% 62% / .5) 0 3px, transparent 4px) 4px 4px / 12px 12px;
}
@media (prefers-reduced-motion: no-preference) {
  :root.sc-hades[data-boon="aphrodite"] .sc-card-h::after {
    animation: sc-hades-aphrodite 2s steps(4, end) infinite;
  }
}
@keyframes sc-hades-aphrodite { 0%, 50% { opacity: .4; } 51%, 100% { opacity: 1; } }

/* CHAOS — indigo void. Rings orbiting the mark, the one boon whose motion is
   rotation rather than a slide or a flicker — eight stops for the eight
   points a ring visibly holds as it turns, the same logic egyptian.ts's Aten
   uses for its own rotation. */
:root.sc-hades[data-boon="chaos"] {
  --sc-primary: 268 45% 52%;
  --sc-primary-fg: 0 0% 100%;
  --sc-boon-ornament: repeating-radial-gradient(circle, transparent 0 4px, hsl(268 45% 52% / .4) 4px 5px, transparent 5px 9px);
}
@media (prefers-reduced-motion: no-preference) {
  :root.sc-hades[data-boon="chaos"] .sc-card-h::after {
    animation: sc-hades-chaos 4s steps(8, end) infinite;
  }
}
@keyframes sc-hades-chaos { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* The flare: one shot on pick, in whatever accent is current — the House's
   own crimson at the centre of the wheel, or the boon's own colour once one
   is equipped. Not gated per-boon: it belongs to the pick itself. */
@media (prefers-reduced-motion: no-preference) {
  .sc-boon-flare { animation: sc-hades-flare 420ms steps(6, end) 1; }
}
@keyframes sc-hades-flare {
  from { box-shadow: 0 0 0 0 hsl(var(--sc-primary) / 0.9); }
  to { box-shadow: 0 0 0 18px hsl(var(--sc-primary) / 0); }
}
`;
}
