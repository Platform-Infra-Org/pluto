import {
  mirrorSprite,
  rotateSprite,
  spriteRects,
  STATE_SPRITES,
  TEMPLE,
  SPRITE_SIZE,
  AMPHORA,
  AMPHORA_VESSEL,
  KEY,
  LAUREL,
  HELM,
  TORCH,
  SCROLL,
  POTION,
  RUPEE,
  CREEP_A,
  CREEP_B,
  SMALL_SPRITE_SIZE,
  STAR,
  SEIGAIHA,
  TORII,
  ASANOHA,
  KOI,
  BLOSSOM,
  PETAL_STRIP,
  CRESCENT_FLAME,
  CAULDRON,
  FILIGREE,
  SPRIG,
  SCROLL_CORNER,
  MOON_STRIP,
  FUTHARK,
  YGGDRASIL,
  KNOTWORK,
  RAVEN,
  AURORA,
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

describe('rotateSprite', () => {
  it('turns the grid a quarter turn clockwise', () => {
    // The top-left cell has to arrive top-right, or every derived corner
    // ornament is mirrored and the frame reads inside out.
    expect(rotateSprite(grid('#.', '..'))).toEqual(['.#', '..']);
  });

  it('comes back to itself in four turns', () => {
    const four = rotateSprite(
      rotateSprite(rotateSprite(rotateSprite(SCROLL_CORNER))),
    );
    expect(four.join('/')).toBe(SCROLL_CORNER.join('/'));
  });
});

describe('mirrorSprite', () => {
  it('flips left to right and back again', () => {
    expect(mirrorSprite(grid('#..', '..#'))).toEqual(['..#', '#..']);
    expect(mirrorSprite(mirrorSprite(RAVEN as string[])).join('/')).toBe(RAVEN.join('/'));
  });

  it('gives the raven a mirror that is actually a different bird', () => {
    // If the sprite were symmetric the pair would face the same way, which is
    // one drawing used twice rather than two ravens flanking a door.
    expect(mirrorSprite(RAVEN).join('/')).not.toBe(RAVEN.join('/'));
  });
});

describe('sprite data', () => {
  it('every sprite is a square grid of the declared size', () => {
    const items = {
      AMPHORA, KEY, LAUREL, HELM, TORCH, SCROLL, POTION, RUPEE,
      SEIGAIHA, TORII, ASANOHA, KOI, CRESCENT_FLAME, CAULDRON, SPRIG,
      FUTHARK, YGGDRASIL, KNOTWORK, SCROLL_CORNER, RAVEN,
    };
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

  it('draws the rupee in two layers that do not overlap', () => {
    const edge = spriteRects(RUPEE, '#');
    const fill = spriteRects(RUPEE, '~');
    expect(edge.length).toBeGreaterThan(0);
    expect(fill.length).toBeGreaterThan(0);
    const cells = (rs: ReturnType<typeof spriteRects>) =>
      new Set(rs.flatMap(r => Array.from({ length: r.w }, (_, i) => `${r.x + i},${r.y}`)));
    const e = cells(edge);
    for (const c of cells(fill)) expect(e.has(c)).toBe(false);
  });

  it('keeps the small sprites square at their own documented size', () => {
    // The only sprites here that are not SPRITE_SIZE: several must fit on a
    // 12px bar, so they are 8x8 and say so.
    for (const [name, sprite] of Object.entries({ CREEP_A, CREEP_B, STAR, BLOSSOM, FILIGREE })) {
      expect(`${name}:${sprite.length}`).toBe(`${name}:${SMALL_SPRITE_SIZE}`);
      for (const row of sprite) {
        expect(`${name}:${row.length}`).toBe(`${name}:${SMALL_SPRITE_SIZE}`);
      }
    }
  });

  it('gives the run cycle two distinct frames', () => {
    // Identical frames animate into a static smudge.
    expect(CREEP_A.join('')).not.toBe(CREEP_B.join(''));
  });

  it('gives the amphora vessel both layers, like the potion', () => {
    // The picker paints '~' in the scheme colour and '#' in currentColor. A
    // grid with no '~' renders as an outline with nothing inside it.
    expect(spriteRects(AMPHORA_VESSEL, '~').length).toBeGreaterThan(0);
    expect(spriteRects(AMPHORA_VESSEL, '#').length).toBeGreaterThan(0);
  });

  it('keeps the amphora vessel on the 16x16 grid', () => {
    expect(AMPHORA_VESSEL).toHaveLength(SPRITE_SIZE);
    for (const row of AMPHORA_VESSEL) expect(row).toHaveLength(SPRITE_SIZE);
  });
});

describe('mode ornament sprites', () => {
  it('keeps every wide strip on the 8px grid, at a whole number of cells', () => {
    // A strip is the one shape that is deliberately not square: CSS advances
    // one background-position in whole steps, so N frames of an animation have
    // to be one image. Height is the grid; width must be an exact multiple of
    // it, or the last step lands mid-frame and the sprite smears. AURORA is
    // the same geometry used as a tile rather than as frames.
    for (const [name, strip] of Object.entries({ PETAL_STRIP, MOON_STRIP, AURORA })) {
      expect(`${name}:${strip.length}`).toBe(`${name}:${SMALL_SPRITE_SIZE}`);
      for (const row of strip) {
        expect(`${name}:${row.length % SMALL_SPRITE_SIZE}`).toBe(`${name}:0`);
        expect(`${name}:${row.length === strip[0].length}`).toBe(`${name}:true`);
      }
    }
  });

  it('gives the petal strip four distinct frames', () => {
    // Identical frames animate into a static smudge, the same failure the run
    // cycle guards against above.
    const frames = Array.from({ length: 4 }, (_, f) =>
      PETAL_STRIP.map(r => r.slice(f * 8, f * 8 + 8)).join(''),
    );
    expect(new Set(frames).size).toBe(4);
  });

  it('tiles seigaiha as a true unit cell', () => {
    // The second row of scales is the first shifted by half a scale. If that
    // ever stops holding, the pattern grows a visible seam every 16px.
    for (let y = 0; y < 8; y++) {
      const shifted = SEIGAIHA[y].slice(8) + SEIGAIHA[y].slice(0, 8);
      expect(`row${y}:${SEIGAIHA[y + 8]}`).toBe(`row${y}:${shifted}`);
    }
  });

  it('keeps Yggdrasil symmetric about its trunk, crown to root', () => {
    // The mirror IS the tree: nine worlds above and below one axis. A drifted
    // branch reads as a lopsided shrub.
    for (let y = 0; y < 16; y++) {
      const mirrored = [...YGGDRASIL[y]].reverse().join('');
      expect(`row${y}:${YGGDRASIL[y]}`).toBe(`row${y}:${mirrored}`);
      expect(`row${y}:${YGGDRASIL[y]}`).toBe(`row${y}:${YGGDRASIL[15 - y]}`);
    }
  });

  it('keeps the corner medallions symmetric under a quarter turn', () => {
    // The whole reason each can serve all four corners of a frame from ONE
    // sprite as four background layers.
    // ASANOHA rides along: it is not a corner medallion, but the same
    // symmetry is what makes the lattice tile in both directions with no seam,
    // and it is generated from one quarter arc precisely so it holds.
    for (const [name, sprite] of Object.entries({ BLOSSOM, FILIGREE, ASANOHA })) {
      const turned = sprite.map((_, x) =>
        sprite.map(row => row[x]).reverse().join(''),
      );
      expect(`${name}:${turned.join('/')}`).toBe(`${name}:${sprite.join('/')}`);
    }
  });

  it('keeps the corner bracket asymmetric, which is why it needs four of them', () => {
    // The inverse of the medallion test below. A bracket that survives a
    // quarter turn unchanged has no corner in it, and the four rotations it is
    // drawn for would all look the same.
    const turned = rotateSprite(SCROLL_CORNER);
    expect(turned.join('/')).not.toBe(SCROLL_CORNER.join('/'));
    // Rails on the top and left edges: that is what makes it a top-left corner.
    expect(SCROLL_CORNER[0]).toBe('#'.repeat(16));
    expect(SCROLL_CORNER.every(row => row.startsWith('##'))).toBe(true);
  });

  it('keeps the koi notched, which is the only reason it reads as a fish', () => {
    // Fill the tail notch and it is a torpedo; fill the eye and it is a bean.
    // Both are one pixel, so a well-meaning tidy-up removes them silently.
    expect(KOI[5][4]).toBe('.');
    expect(KOI[5][12]).toBe('.');
    expect(KOI[5][11]).toBe('#');
    expect(KOI[5][13]).toBe('#');
  });

  it('draws both layers of every two-colour motif', () => {
    // A data URI inherits no custom property, so a two-colour motif is two
    // images. A grid missing one layer renders as half a picture.
    for (const [name, sprite] of Object.entries({ CRESCENT_FLAME, CAULDRON })) {
      expect(`${name}:${spriteRects(sprite, '#').length > 0}`).toBe(`${name}:true`);
      expect(`${name}:${spriteRects(sprite, '~').length > 0}`).toBe(`${name}:true`);
    }
  });
});
