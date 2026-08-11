import {
  clampToViewport,
  fromAnchored,
  readStoredPos,
  toAnchored,
} from './pickerPos';

const BOX = { w: 200, h: 50 };
const VIEW = { w: 1000, h: 800 };

describe('clampToViewport', () => {
  it('leaves a position that is already inside alone', () => {
    expect(clampToViewport({ x: 300, y: 400 }, BOX, VIEW)).toEqual({
      x: 300,
      y: 400,
    });
  });

  it('pulls back from the left and top edges', () => {
    expect(clampToViewport({ x: -50, y: -50 }, BOX, VIEW)).toEqual({
      x: 8,
      y: 8,
    });
  });

  it('pulls back from the right and bottom edges', () => {
    // 1000 - 200 - 8 = 792, 800 - 50 - 8 = 742
    expect(clampToViewport({ x: 9999, y: 9999 }, BOX, VIEW)).toEqual({
      x: 792,
      y: 742,
    });
  });

  it('honours a custom margin', () => {
    expect(clampToViewport({ x: -50, y: -50 }, BOX, VIEW, 20)).toEqual({
      x: 20,
      y: 20,
    });
  });

  it('lands at the margin when the box is bigger than the viewport', () => {
    // Never a negative coordinate, which would put it off the top-left.
    expect(
      clampToViewport({ x: 500, y: 500 }, { w: 2000, h: 2000 }, VIEW),
    ).toEqual({ x: 8, y: 8 });
  });

  it('produces no NaN for a zero-sized viewport', () => {
    const r = clampToViewport({ x: 10, y: 10 }, BOX, { w: 0, h: 0 });
    expect(Number.isFinite(r.x)).toBe(true);
    expect(Number.isFinite(r.y)).toBe(true);
  });
});

describe('readStoredPos', () => {
  it('reads a valid stored position', () => {
    expect(readStoredPos('{"x":12,"y":34}')).toEqual({ x: 12, y: 34 });
  });

  it('rejects nothing stored', () => {
    expect(readStoredPos(null)).toBeUndefined();
    expect(readStoredPos('')).toBeUndefined();
  });

  it('rejects values that are not JSON', () => {
    expect(readStoredPos('not json')).toBeUndefined();
  });

  it('rejects the wrong shape', () => {
    expect(readStoredPos('{"x":1}')).toBeUndefined();
    expect(readStoredPos('[1,2]')).toBeUndefined();
    expect(readStoredPos('"12,34"')).toBeUndefined();
    expect(readStoredPos('null')).toBeUndefined();
  });

  it('rejects non-finite numbers', () => {
    // JSON.parse('1e999') is Infinity, and `left: Infinitypx` is dropped by the
    // browser — the picker would then report itself moved while sitting with no
    // anchors at all, i.e. unreachable.
    expect(readStoredPos('{"x":1e999,"y":0}')).toBeUndefined();
    expect(readStoredPos('{"x":null,"y":0}')).toBeUndefined();
  });
});

describe('corner anchoring', () => {
  const CORNER_BOX = { w: 190, h: 46 };

  it('anchors to the nearest corner', () => {
    // Bottom-left in a 1000x800 view.
    expect(toAnchored({ x: 14, y: 740 }, CORNER_BOX, { w: 1000, h: 800 })).toEqual({
      ax: 'left', ay: 'bottom', dx: 14, dy: 14,
    });
  });

  it('anchors to the bottom-right when nearer to it', () => {
    expect(toAnchored({ x: 796, y: 740 }, CORNER_BOX, { w: 1000, h: 800 })).toEqual({
      ax: 'right', ay: 'bottom', dx: 14, dy: 14,
    });
  });

  it('round-trips unchanged when the viewport does not change', () => {
    const view = { w: 1000, h: 800 };
    const pos = { x: 796, y: 740 };
    expect(fromAnchored(toAnchored(pos, CORNER_BOX, view), CORNER_BOX, view)).toEqual(pos);
  });

  it('keeps a bottom-right picker in the corner when the window shrinks', () => {
    const a = toAnchored({ x: 796, y: 740 }, CORNER_BOX, { w: 1000, h: 800 });
    // 300px narrower, 200px shorter: it must stay 14px off both edges.
    expect(fromAnchored(a, CORNER_BOX, { w: 700, h: 600 })).toEqual({ x: 496, y: 540 });
  });

  it('clamps when the new viewport cannot hold the offset', () => {
    const a = toAnchored({ x: 796, y: 740 }, CORNER_BOX, { w: 1000, h: 800 });
    const out = fromAnchored(a, CORNER_BOX, { w: 150, h: 100 });
    expect(out.x).toBeGreaterThanOrEqual(8);
    expect(out.y).toBeGreaterThanOrEqual(8);
  });
});
