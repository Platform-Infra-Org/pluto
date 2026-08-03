import { spriteRects, STATE_SPRITES, TEMPLE, SPRITE_SIZE } from './sprites';

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
    for (const [name, sprite] of Object.entries({ TEMPLE, ...STATE_SPRITES })) {
      expect(`${name}:${sprite.length}`).toBe(`${name}:${SPRITE_SIZE}`);
      for (const row of sprite) {
        expect(`${name}:${row.length}`).toBe(`${name}:${SPRITE_SIZE}`);
      }
    }
  });

  it('covers every request state', () => {
    expect(Object.keys(STATE_SPRITES).sort()).toEqual([
      'APPROVED',
      'FAILED',
      'IN_PROGRESS',
      'PENDING_APPROVAL',
      'REJECTED',
      'SUCCEEDED',
    ]);
  });
});
