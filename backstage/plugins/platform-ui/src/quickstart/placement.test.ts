import { needsFlip, QS_BOX_GAP, QS_BOX_W } from './placement';

const VIEW = { w: 1400, h: 900 };
const BOX_H = 200;

/** A rect the size of the floating picker, positioned by its top-left corner. */
const picker = (left: number, top: number) => ({
  left,
  top,
  width: 190,
  height: 45,
});

describe('needsFlip', () => {
  it('flips when the picker sits under the dialogue', () => {
    // Default corner: the picker parked bottom-right, 14px from each edge.
    const p = picker(VIEW.w - 14 - 190, VIEW.h - 14 - 45);
    // 18px offset = the picker has been moved, so the dialogue took the space
    // back — and here the picker is right where it landed.
    expect(needsFlip(p, VIEW, BOX_H, 18)).toBe(true);
  });

  it('does not flip when 78px of clearance is enough', () => {
    // The untouched case the old hard-coded offset was written for.
    const p = picker(VIEW.w - 14 - 190, VIEW.h - 14 - 45);
    expect(needsFlip(p, VIEW, BOX_H, 78)).toBe(false);
  });

  it('does not flip for a target on the far side of the screen', () => {
    expect(needsFlip(picker(20, VIEW.h - 60), VIEW, BOX_H, 18)).toBe(false);
  });

  it('does not flip for a target at the top of the screen', () => {
    expect(needsFlip(picker(VIEW.w - 204, 20), VIEW, BOX_H, 18)).toBe(false);
  });

  it('flips for a target dragged into the middle-right, where no fixed offset would help', () => {
    // The case the CSS-only fix could never cover: the picker is draggable, so
    // it can be anywhere, including straight over the dialogue.
    const p = picker(VIEW.w - 300, VIEW.h - 150);
    expect(needsFlip(p, VIEW, BOX_H, 18)).toBe(true);
  });

  it('treats edge-touching as clear, not overlapping', () => {
    const left = VIEW.w - QS_BOX_GAP - QS_BOX_W;
    // Target's right edge exactly meets the dialogue's left edge.
    expect(
      needsFlip(
        { left: left - 100, top: VIEW.h - 100, width: 100, height: 45 },
        VIEW,
        BOX_H,
        18,
      ),
    ).toBe(false);
  });

  it('does not flip for a bottom-left target now the picker docks there', () => {
    // The dialogue is bottom-right and the picker is bottom-left, so the pair
    // that used to force the 78px offset cannot overlap in the default layout.
    expect(
      needsFlip(
        { top: 900, left: 10, width: 190, height: 46 },
        { w: 1400, h: 1000 },
        200,
        18,
      ),
    ).toBe(false);
  });
});
