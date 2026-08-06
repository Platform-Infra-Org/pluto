import { RequestState } from '@internal/plugin-platform-common';

/**
 * Sprites are authored on a 16x16 grid: '#' is a filled pixel, '.' is empty.
 *
 * A sprite may carry a second layer under another character — '~' for a
 * potion's liquid — so one grid can be drawn twice in two colours rather than
 * kept as two sprites that have to stay aligned by hand.
 */
export const SPRITE_SIZE = 16;

export type Sprite = readonly string[];

/**
 * One rect per horizontal run of filled pixels. Runs are merged because a 16x16
 * glyph is ~40 rects instead of ~120 individual pixels, and both renderers (SVG
 * and the favicon canvas) draw rects.
 */
export function spriteRects(
  sprite: Sprite,
  layer: string = '#',
): Array<{ x: number; y: number; w: number }> {
  const rects: Array<{ x: number; y: number; w: number }> = [];
  sprite.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== layer) {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x] === layer) x++;
      rects.push({ x: start, y, w: x - start });
    }
  });
  return rects;
}

/** The platform mark: a temple on its raised platform, pixel-drawn. */
export const TEMPLE: Sprite = [
  '.......##.......',
  '......####......',
  '.....######.....',
  '....########....',
  '...##########...',
  '..############..',
  '.##############.',
  '................',
  '.##############.',
  '................',
  '..##..##..##..##',
  '..##..##..##..##',
  '..##..##..##..##',
  '..##..##..##..##',
  '.##############.',
  '################',
];

export const HOURGLASS: Sprite = [
  '................',
  '..############..',
  '..############..',
  '...##########...',
  '....########....',
  '.....######.....',
  '......####......',
  '.......##.......',
  '.......##.......',
  '......####......',
  '.....######.....',
  '....########....',
  '...##########...',
  '..############..',
  '..############..',
  '................',
];

export const SCROLL: Sprite = [
  '................',
  '..############..',
  '.##..........##.',
  '.##.########.##.',
  '.##..........##.',
  '.##.########.##.',
  '.##..........##.',
  '.##.########.##.',
  '.##..........##.',
  '.##.######...##.',
  '.##..........##.',
  '.##.########.##.',
  '.##..........##.',
  '..############..',
  '................',
  '................',
];

export const GEAR: Sprite = [
  '.....######.....',
  '.....######.....',
  '..############..',
  '..############..',
  '################',
  '####......######',
  '####..##..######',
  '######....######',
  '######....######',
  '####..##..######',
  '####......######',
  '################',
  '..############..',
  '..############..',
  '.....######.....',
  '.....######.....',
];

export const CHEST: Sprite = [
  '................',
  '..############..',
  '.##############.',
  '.##..........##.',
  '.####......####.',
  '.##############.',
  '.##############.',
  '.######..######.',
  '.#####.##.#####.',
  '.######..######.',
  '.##############.',
  '.##..........##.',
  '.##############.',
  '..############..',
  '................',
  '................',
];

export const SKULL: Sprite = [
  '................',
  '...##########...',
  '..############..',
  '.##############.',
  '.##############.',
  '.###..####..###.',
  '.###..####..###.',
  '.##############.',
  '.#####.##.#####.',
  '.##############.',
  '..############..',
  '...##########...',
  '....##.##.##....',
  '....##.##.##....',
  '................',
  '................',
];

export const CROSS: Sprite = [
  '................',
  '.###........###.',
  '.####......####.',
  '..####....####..',
  '...####..####...',
  '....########....',
  '.....######.....',
  '......####......',
  '.....######.....',
  '....########....',
  '...####..####...',
  '..####....####..',
  '.####......####.',
  '.###........###.',
  '................',
  '................',
];

/** The same hourglass as PENDING_APPROVAL, run out: nobody decided in time. */
export const HOURGLASS_SPENT: Sprite = [
  '................',
  '..############..',
  '..############..',
  '...#........#...',
  '....#......#....',
  '.....#....#.....',
  '......#..#......',
  '.......##.......',
  '.......##.......',
  '......####......',
  '.....######.....',
  '....########....',
  '...##########...',
  '..############..',
  '..############..',
  '................',
];

/* The item vocabulary. Objects, not creatures: a 16x16 silhouette that reads as
   a creature takes several attempts and says nothing about a request, while an
   object says what it means at a glance and is drawn once. */

/** Stored data — the vessel a database request fills. */
export const AMPHORA: Sprite = [
  '.....######.....',
  '.....######.....',
  '......####......',
  '..##..####..##..',
  '.####.####.####.',
  '.##.########.##.',
  '.##.########.##.',
  '..############..',
  '..############..',
  '..############..',
  '..############..',
  '...##########...',
  '....########....',
  '.....######.....',
  '......####......',
  '.....######.....',
];

/** A secret: what a request carries that must not be printed. */
export const KEY: Sprite = [
  '....######......',
  '...########.....',
  '..####..####....',
  '..###....###....',
  '..###....###....',
  '..####..####....',
  '...########.....',
  '....######......',
  '......##........',
  '......##........',
  '......####......',
  '......##........',
  '......####......',
  '......##........',
  '......##........',
  '......###.......',
];

/** Granted. The wreath is the Greek register's word for approved. */
export const LAUREL: Sprite = [
  '................',
  '..##........##..',
  '.###........###.',
  '###..........###',
  '.###........###.',
  '###..........###',
  '.###........###.',
  '###..........###',
  '.###........###.',
  '..###......###..',
  '...###....###...',
  '....##....##....',
  '.....##..##.....',
  '......####......',
  '.......##.......',
  '.......##.......',
];

/** An owning team: the helm stands for whoever answers for the resource. */
export const HELM: Sprite = [
  '.......##.......',
  '......####......',
  '.....######.....',
  '...##########...',
  '..############..',
  '.##############.',
  '.##############.',
  '.###..####..###.',
  '.###..####..###.',
  '.##############.',
  '.####..##..####.',
  '.####..##..####.',
  '.####..##..####.',
  '..###..##..###..',
  '...##..##..##...',
  '...##......##...',
];

/** Something is running. The flame floats clear of the bowl, or the whole
    thing reads as a fire hydrant. */
export const TORCH: Sprite = [
  '.......##.......',
  '......####......',
  '.....######.....',
  '....########....',
  '....########....',
  '.....######.....',
  '......####......',
  '................',
  '...##########...',
  '....########....',
  '.....######.....',
  '......####......',
  '......####......',
  '......####......',
  '....########....',
  '..############..',
];

/**
 * A potion, in two layers: '#' is the glass and '~' is the liquid.
 *
 * The liquid is drawn in the scheme's own colour, which is what makes the
 * colour picker a shelf of potions rather than a row of coloured squares. The
 * air gap under the neck is what stops it reading as a solid bottle.
 */
export const POTION: Sprite = [
  '......####......',
  '......####......',
  '.......##.......',
  '.......##.......',
  '......####......',
  '.....##..##.....',
  '....##....##....',
  '...##~~~~~~##...',
  '..##~~~~~~~~##..',
  '..##~~~~~~~~##..',
  '..##~~~~~~~~##..',
  '..##~~~~~~~~##..',
  '...##~~~~~~##...',
  '....########....',
  '................',
  '................',
];

export const STATE_SPRITES: Record<RequestState, Sprite> = {
  PENDING_APPROVAL: HOURGLASS,
  /* Was SCROLL, which meant nothing in particular and is now free for what it
     should always have meant: documentation. */
  APPROVED: LAUREL,
  IN_PROGRESS: GEAR,
  /* Lit and waiting to be carried on: the workflow is alive but stopped at a
     suspend step until someone releases it. */
  AWAITING_INPUT: TORCH,
  SUCCEEDED: CHEST,
  FAILED: SKULL,
  REJECTED: CROSS,
  EXPIRED: HOURGLASS_SPENT,
};
