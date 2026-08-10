/** A rectangle in viewport coordinates. */
export type Rect = { top: number; left: number; width: number; height: number };

/** Matches `.sc-qs-box` in styles.ts — width and the gap it keeps from the edge. */
export const QS_BOX_W = 320;
export const QS_BOX_GAP = 18;

/**
 * Should the tour dialogue move to the top of the screen?
 *
 * It parks in the bottom-right corner. That used to collide with the colour
 * picker, which needed a hard-coded 78px of clearance; the picker now docks at
 * the bottom-LEFT of the sidebar, so the default case no longer overlaps at
 * all. But the picker is draggable, so it can still be sitting exactly where
 * the dialogue wants to be, and a step that highlights an element
 * while covering it is worse than useless.
 *
 * Pure, and takes the dialogue's measured height rather than assuming one,
 * because the body text sets the height and it differs per step.
 */
export function needsFlip(
  target: Rect,
  view: { w: number; h: number },
  boxHeight: number,
  bottomOffset: number,
): boolean {
  const left = view.w - QS_BOX_GAP - QS_BOX_W;
  const top = view.h - bottomOffset - boxHeight;
  // Standard rectangle overlap: they miss if either axis has a gap.
  return !(
    target.left >= left + QS_BOX_W ||
    target.left + target.width <= left ||
    target.top >= top + boxHeight ||
    target.top + target.height <= top
  );
}
