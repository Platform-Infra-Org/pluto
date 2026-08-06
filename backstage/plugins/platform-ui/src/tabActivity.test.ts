import { FRAMES, frameAt, baseTitle } from './tabActivity';

describe('frameAt', () => {
  it('walks the frames in order and wraps', () => {
    expect([0, 1, 2, 3, 4].map(frameAt)).toEqual([
      FRAMES[0],
      FRAMES[1],
      FRAMES[2],
      FRAMES[3],
      FRAMES[0],
    ]);
  });

  it('stays in range for a tick that has run for a long time', () => {
    expect(FRAMES).toContain(frameAt(1_000_003));
  });
});

describe('baseTitle', () => {
  it('leaves an untouched title alone', () => {
    expect(baseTitle('Platform')).toBe('Platform');
  });

  it('strips a frame so ticks never accumulate', () => {
    expect(baseTitle(`${FRAMES[2]} Platform`)).toBe('Platform');
  });

  it('only strips a leading frame, not one inside the title', () => {
    expect(baseTitle(`Platform ${FRAMES[1]}`)).toBe(`Platform ${FRAMES[1]}`);
  });
});
