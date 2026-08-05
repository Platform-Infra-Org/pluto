/** Cards are direct children of the grid; the header is a descendant of each. */
const CARD = '[class*="BackstageItemCardGrid-root"] > .MuiCard-root';
const HEADER = '[class*="ItemCardHeader"]';

export interface TemplateHeaderOptions {
  images: string[];
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
export function templateHeaderCss(opts: TemplateHeaderOptions): string {
  const { images, height = '90px', position = 'center' } = opts;
  if (images.length === 0) return '';

  const n = images.length;
  const rules = images.map((src, i) => {
    // encodeURI leaves '/' and ':' alone but neutralises quotes and spaces, so
    // a filename can never terminate the url() and inject a declaration.
    const safe = encodeURI(src).replace(/"/g, '%22');
    return [
      `${CARD}:nth-child(${n}n + ${i + 1}) ${HEADER} {`,
      `  background-image: url("${safe}") !important;`,
      `  background-size: cover !important;`,
      `  background-position: ${position} !important;`,
      `  background-repeat: no-repeat !important;`,
      `}`,
    ].join('\n');
  });

  return [`${CARD} ${HEADER} { height: ${height}; }`, ...rules].join('\n');
}
