import {
  spriteRects,
  STATE_SPRITES,
  TEMPLE,
  SPRITE_SIZE,
  AMPHORA,
  KEY,
  LAUREL,
  HELM,
  TORCH,
  SCROLL,
  POTION,
} from './sprites';

const grid = (...rows: string[]) => rows;

describe('spriteRects', () => {
  it('merges each horizontal run into one rect', () => {
    expect(spriteRects(grid('##..##'))).toEqual([
      { x: 0, y: 0, w: 2 },
      { x: 4, y: 0, w: 2 },
    ]);
  });

  it('emits one rect per row, never merging vertically', () => {
    expect(spriteRects(grid('##', '##'))).toEqual([
      { x: 0, y: 0, w: 2 },
      { x: 0, y: 1, w: 2 },
    ]);
  });

  it('returns nothing for an empty grid', () => {
    expect(spriteRects(grid('....', '....'))).toEqual([]);
  });

  it('handles a run that reaches the right edge', () => {
    expect(spriteRects(grid('..##'))).toEqual([{ x: 2, y: 0, w: 2 }]);
  });
});

describe('sprite data', () => {
  it('every sprite is a square grid of the declared size', () => {
    const items = { AMPHORA, KEY, LAUREL, HELM, TORCH, SCROLL, POTION };
    for (const [name, sprite] of Object.entries({
      TEMPLE,
      ...items,
      ...STATE_SPRITES,
    })) {
      expect(`${name}:${sprite.length}`).toBe(`${name}:${SPRITE_SIZE}`);
      for (const row of sprite) {
        expect(`${name}:${row.length}`).toBe(`${name}:${SPRITE_SIZE}`);
      }
    }
  });

  it('uses only the two authored characters', () => {
    for (const [name, sprite] of Object.entries({
      AMPHORA, KEY, LAUREL, HELM, TORCH, ...STATE_SPRITES,
    })) {
      const stray = sprite.join('').replace(/[#.]/g, '');
      expect(`${name}:${stray}`).toBe(`${name}:`);
    }
  });

  it('draws something in every item sprite', () => {
    for (const [name, sprite] of Object.entries({ AMPHORA, KEY, LAUREL, HELM, TORCH })) {
      expect(`${name}:${spriteRects(sprite).length > 0}`).toBe(`${name}:true`);
    }
  });

  it('grants approval with the laurel, freeing the scroll for docs', () => {
    expect(STATE_SPRITES.APPROVED).toBe(LAUREL);
    expect(STATE_SPRITES.APPROVED).not.toBe(SCROLL);
  });

  it('covers every request state', () => {
    expect(Object.keys(STATE_SPRITES).sort()).toEqual([
      'APPROVED',
      'AWAITING_INPUT',
      'EXPIRED',
      'FAILED',
      'IN_PROGRESS',
      'PENDING_APPROVAL',
      'REJECTED',
      'SUCCEEDED',
    ]);
  });

  it('draws the potion in two layers that do not overlap', () => {
    const glass = spriteRects(POTION, '#');
    const liquid = spriteRects(POTION, '~');
    expect(glass.length).toBeGreaterThan(0);
    expect(liquid.length).toBeGreaterThan(0);
    // Every cell belongs to one layer or the other, never both.
    const cells = (rs: ReturnType<typeof spriteRects>) =>
      new Set(rs.flatMap(r => Array.from({ length: r.w }, (_, i) => `${r.x + i},${r.y}`)));
    const g = cells(glass);
    for (const c of cells(liquid)) expect(g.has(c)).toBe(false);
  });

  it('reads the default layer when none is named', () => {
    expect(spriteRects(POTION)).toEqual(spriteRects(POTION, '#'));
  });
});
