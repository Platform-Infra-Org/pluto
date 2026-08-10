/** Where the floating picker sits: viewport pixels from the top-left. */
export type PickerPos = { x: number; y: number };

/**
 * Beside `platform-scheme`, which `SchemePicker` already uses for the colour.
 *
 * localStorage rather than the user-settings backend because the same component
 * renders on the sign-in gate, where there is no API context to read.
 */
export const PICKER_POS_KEY = 'platform-picker-pos';

/**
 * Keep the whole box on screen, with a margin.
 *
 * Runs on drop and on resize. A position that was fine in a wide window is off
 * the edge in a narrow one, and a picker that cannot be reached cannot be
 * dragged back — the only recovery would be clearing site data.
 */
export function clampToViewport(
  pos: PickerPos,
  box: { w: number; h: number },
  view: { w: number; h: number },
  margin = 8,
): PickerPos {
  // Math.max against the margin covers the box being larger than the viewport:
  // the upper bound would otherwise fall below the lower one and produce a
  // negative coordinate, putting it off the top-left instead of the bottom.
  const maxX = Math.max(margin, view.w - box.w - margin);
  const maxY = Math.max(margin, view.h - box.h - margin);
  return {
    x: Math.min(Math.max(pos.x, margin), maxX),
    y: Math.min(Math.max(pos.y, margin), maxY),
  };
}

/**
 * Parse a stored position, rejecting anything unusable.
 *
 * Rejecting on read is much cheaper than recovering from a bad value: a NaN or
 * Infinity becomes `left: NaNpx`, which the browser discards, leaving a picker
 * that reports itself as moved (so the corner anchors are gone) while having no
 * position of its own.
 */
export function readStoredPos(raw: string | null): PickerPos | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined;
    }
    const { x, y } = parsed as Record<string, unknown>;
    if (typeof x !== 'number' || typeof y !== 'number') return undefined;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    return { x, y };
  } catch {
    return undefined;
  }
}

/** A position expressed as a gap from the nearest corner. */
export type AnchoredPos = {
  ax: 'left' | 'right';
  ay: 'top' | 'bottom';
  dx: number;
  dy: number;
};

/**
 * Which corner is the picker nearest, and how far from it?
 *
 * Storing absolute top-left coordinates meant a picker parked in the
 * bottom-right corner drifted into the middle of a narrowed window — it was
 * still "on screen", so clampToViewport had nothing to correct. A gap from the
 * nearest corner is what people actually mean by where they put it.
 */
export function toAnchored(
  pos: PickerPos,
  box: { w: number; h: number },
  view: { w: number; h: number },
): AnchoredPos {
  const fromRight = view.w - (pos.x + box.w);
  const fromBottom = view.h - (pos.y + box.h);
  const ax = pos.x <= fromRight ? 'left' : 'right';
  const ay = pos.y <= fromBottom ? 'top' : 'bottom';
  return {
    ax,
    ay,
    dx: ax === 'left' ? pos.x : fromRight,
    dy: ay === 'top' ? pos.y : fromBottom,
  };
}

/** The inverse, clamped so a much smaller viewport still yields a reachable box. */
export function fromAnchored(
  a: AnchoredPos,
  box: { w: number; h: number },
  view: { w: number; h: number },
): PickerPos {
  const x = a.ax === 'left' ? a.dx : view.w - box.w - a.dx;
  const y = a.ay === 'top' ? a.dy : view.h - box.h - a.dy;
  return clampToViewport({ x, y }, box, view);
}
