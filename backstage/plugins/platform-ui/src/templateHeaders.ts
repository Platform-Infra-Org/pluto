/**
 * Production-safe selectors.
 *
 * Material-UI keeps a makeStyles name in the generated class only OUTSIDE
 * production, so [class*="BackstageItemCardGrid-root"] and
 * [class*="ItemCardHeader"] match nothing in a built image — they were silently
 * dead there while working on the dev server, which is the worst failure mode
 * available. MuiCard-root and MuiBox-root survive, because MUI keeps names
 * beginning with Mui.
 *
 * The header is the card's first element child and cards are direct children of
 * the grid, so :nth-child still cycles the images. `.sc-route-create` scopes it
 * to the templates page: .MuiCard-root on its own is every card in the app.
 */
const CARD = '.sc-route-create .MuiCard-root';
const HEADER = '> .MuiBox-root:first-child';

export interface TemplateHeaderOptions {
  images: string[];
  /**
   * Text tone per image, parallel to `images`. 'light' means white text with a
   * dark outline; 'dark' the reverse. Missing entries fall back to the scheme's
   * own foreground, which is what the pixel-art headers use.
   */
  tones?: Array<'light' | 'dark' | undefined>;
  /** Header height. Default '90px' — what the cards already render at. */
  height?: string;
  /** background-position for the crop. Default 'center'. */
  position?: string;
}

/**
 * One rule per supplied image, cycling across card positions: card i shows
 * image i mod N. Returns '' when no images are supplied, so the caller can
 * inject unconditionally and the pixel-art fallback stays in place.
 */
const WHITE = '0 0% 100%';
const INK = '240 10% 8%';

/** Title colour + a 1px outline in the opposite tone, so it reads on artwork. */
function toneRules(tone?: 'light' | 'dark'): string {
  if (!tone) return '';
  const fg = tone === 'light' ? WHITE : INK;
  const shade = tone === 'light' ? INK : WHITE;
  return [
    `  color: hsl(${fg}) !important;`,
    `  text-shadow:`,
    `    1px 0 0 hsl(${shade}), -1px 0 0 hsl(${shade}),`,
    `    0 1px 0 hsl(${shade}), 0 -1px 0 hsl(${shade}),`,
    `    2px 2px 0 hsl(${shade} / .55) !important;`,
  ].join('\n');
}

export function templateHeaderCss(opts: TemplateHeaderOptions): string {
  const { images, tones = [], height = '90px', position = 'center' } = opts;
  if (images.length === 0) return '';

  const n = images.length;
  const rules = images.map((src, i) => {
    // encodeURI leaves '/' and ':' alone but neutralises quotes and spaces, so
    // a filename can never terminate the url() and inject a declaration.
    const safe = encodeURI(src).replace(/"/g, '%22');
    const sel = `${CARD}:nth-child(${n}n + ${i + 1}) ${HEADER}`;
    const tone = toneRules(tones[i]);
    return [
      `${sel} {`,
      `  background-image: url("${safe}") !important;`,
      `  background-size: cover !important;`,
      `  background-position: ${position} !important;`,
      `  background-repeat: no-repeat !important;`,
      `}`,
      // The title and its label are children, so the colour goes on both.
      ...(tone ? [`${sel}, ${sel} * {`, tone, `}`] : []),
    ].join('\n');
  });

  return [`${CARD} ${HEADER} { height: ${height}; }`, ...rules].join('\n');
}
