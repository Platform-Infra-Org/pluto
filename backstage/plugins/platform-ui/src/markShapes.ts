/**
 * The built-in Platform glyph: an ancient Greek temple facade (pediment,
 * columns, stylobate) — the temple resting on its raised platform.
 *
 * Kept as data rather than JSX because two renderers need it: `PlatformMark`
 * draws it as SVG, and `updateFavicon` draws the same shapes on a canvas for the
 * browser tab. One definition, so the tab icon can never drift from the sidebar.
 *
 * Coordinates are in the 24x24 space of `MARK_VIEWBOX`.
 */
export const MARK_VIEWBOX = 24;

export type MarkShape =
  | { path: string }
  | { x: number; y: number; w: number; h: number; r: number };

export const MARK_SHAPES: MarkShape[] = [
  { path: 'M12 3.2 20.6 8.4 3.4 8.4Z' }, // pediment (roof)
  { x: 4.2, y: 8.7, w: 15.6, h: 1.5, r: 0.3 }, // architrave
  { x: 6, y: 10.7, w: 1.5, h: 6.1, r: 0.2 }, // columns
  { x: 9.4, y: 10.7, w: 1.5, h: 6.1, r: 0.2 },
  { x: 13.1, y: 10.7, w: 1.5, h: 6.1, r: 0.2 },
  { x: 16.5, y: 10.7, w: 1.5, h: 6.1, r: 0.2 },
  { x: 3.8, y: 17.2, w: 16.4, h: 1.6, r: 0.3 }, // stylobate (the platform)
  { x: 2.6, y: 19.3, w: 18.8, h: 1.7, r: 0.4 },
];
