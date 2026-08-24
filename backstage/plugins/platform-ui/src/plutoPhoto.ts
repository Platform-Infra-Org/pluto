/**
 * Pluto, photographed by New Horizons on 14 July 2015.
 *
 * NASA/JHUAPL/SwRI, public domain — the "true colour" global mosaic, cropped
 * square to the disc, alpha-masked to a circle, and downsampled to 72x72.
 *
 * The downsample is the point, not a compromise. A full-resolution photograph
 * dropped into an 8-bit interface reads as a screenshot of another
 * application; at 72px, rendered back up with `image-rendering: pixelated`,
 * it is the same chunky grid every sprite here is drawn on, while still being
 * an actual photograph of the actual planet. Tombaugh Regio — the pale heart
 * that identifies Pluto at a glance — survives the reduction, which is the
 * whole reason a drawn substitute was not good enough.
 *
 * Inlined as a data URI rather than shipped as a file in the app's public
 * folder: this plugin has no public folder of its own, the CSP is
 * `img-src 'self' data:` so a remote URL would fail silently, and 12kB of PNG
 * costs less than a second asset pipeline. The circular alpha is baked in and
 * deliberately hard-edged — no antialiasing — for the same reason sprites use
 * `shapeRendering="crispEdges"`.
 *
 * Regenerate: crop the source to the disc's bounding box, resize to 72x72
 * (Lanczos), apply a hard circular alpha, save optimized PNG, base64.
 */
export const PLUTO_PHOTO =
  'data:image/png;base64,' +
  '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';
