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
  ANKH,
  ATEN_STRIP,
  CARTOUCHE,
  DJED,
  GLYPH_BAND,
  PAPYRUS,
  WEDJAT,
  TOKKURI_VESSEL,
  CAULDRON_VESSEL,
  TANKARD_VESSEL,
  CANOPIC_VESSEL,
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
      ANKH, WEDJAT, CARTOUCHE, PAPYRUS, DJED,
      TOKKURI_VESSEL, CAULDRON_VESSEL, TANKARD_VESSEL, CANOPIC_VESSEL,
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

  it('gives every vessel both layers, like the potion', () => {
    // The picker paints '~' in the scheme colour and '#' in currentColor. A
    // grid with no '~' renders as an outline with nothing inside it, which is
    // the whole failure this shelf exists to avoid — and it is silent, because
    // the sprite still draws.
    const vessels = {
      AMPHORA_VESSEL,
      TOKKURI_VESSEL,
      CAULDRON_VESSEL,
      TANKARD_VESSEL,
      CANOPIC_VESSEL,
    };
    for (const [name, sprite] of Object.entries(vessels)) {
      expect(`${name} liquid:${spriteRects(sprite, '~').length > 0}`).toBe(
        `${name} liquid:true`,
      );
      expect(`${name} glass:${spriteRects(sprite, '#').length > 0}`).toBe(
        `${name} glass:true`,
      );
      expect(sprite).toHaveLength(SPRITE_SIZE);
      for (const row of sprite) expect(row).toHaveLength(SPRITE_SIZE);
    }
  });

  it('keeps every vessel inside a one-pixel margin, which is what makes them a set', () => {
    // The five sit side by side in the picker tray, so they are read as a row.
    // A shape that touches the edge of its grid reads as cropped next to four
    // that do not, and nothing else in the sprite says which one is wrong —
    // the vessel simply looks heavier than its neighbours.
    const vessels = {
      AMPHORA_VESSEL,
      TOKKURI_VESSEL,
      CAULDRON_VESSEL,
      TANKARD_VESSEL,
      CANOPIC_VESSEL,
    };
    for (const [name, sprite] of Object.entries(vessels)) {
      expect(`${name} last row:${sprite[SPRITE_SIZE - 1]}`).toBe(
        `${name} last row:${'.'.repeat(SPRITE_SIZE)}`,
      );
      const edges = sprite.map(row => row[0] + row[SPRITE_SIZE - 1]).join('');
      expect(`${name} sides:${edges.replace(/\./g, '')}`).toBe(`${name} sides:`);
    }
  });


  it('gives every vessel a silhouette of its own', () => {
    // Two modes sharing a grid is the same bottle twice, which is what the
    // generic POTION already does for everything unornamented.
    const shapes = [
      POTION,
      AMPHORA_VESSEL,
      TOKKURI_VESSEL,
      CAULDRON_VESSEL,
      TANKARD_VESSEL,
      CANOPIC_VESSEL,
    ].map(s => s.join('/'));
    expect(new Set(shapes).size).toBe(shapes.length);
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

  it('carves the rune band with no horizontal stroke but its own rule', () => {
    // Elder Futhark has no horizontals: a chisel never runs along the grain,
    // so every letterform is a stave plus diagonals. It is also what makes the
    // band render cleanly on a pixel grid, and it is the first thing lost when
    // someone thickens a glyph to "make it read" — at which point the band
    // turns back into the picket fence this replaced.
    // The one exception is the rule the runes stand on, which is full width so
    // the band joins across its own tile seam.
    const rule = FUTHARK.filter(row => row === '#'.repeat(SPRITE_SIZE));
    expect(rule).toHaveLength(1);
    for (const row of FUTHARK) {
      if (row === rule[0]) continue;
      const longest = Math.max(0, ...(row.match(/#+/g) ?? []).map(r => r.length));
      expect(`${row}:${longest <= 2}`).toBe(`${row}:true`);
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

  it('keeps the wide Egyptian sprites on the 16px grid, at whole cells', () => {
    // Both are authored at the full grid rather than the small one: a legible
    // hieroglyph at 8px is a smudge. Width still has to be an exact multiple
    // of the height, or the last animation step lands mid-frame and smears,
    // and the last band tile is cut through a sign.
    for (const [name, strip] of Object.entries({ ATEN_STRIP, GLYPH_BAND })) {
      expect(`${name}:${strip.length}`).toBe(`${name}:${SPRITE_SIZE}`);
      for (const row of strip) {
        expect(`${name}:${row.length % SPRITE_SIZE}`).toBe(`${name}:0`);
        expect(`${name}:${row.length}`).toBe(`${name}:${strip[0].length}`);
      }
    }
  });

  it('gives the Aten two distinct frames', () => {
    // Identical frames animate into a sun that just sits there, which is the
    // still frame rather than the animation.
    const frames = Array.from({ length: 2 }, (_, f) =>
      ATEN_STRIP.map(r => r.slice(f * 16, f * 16 + 16)).join(''),
    );
    expect(new Set(frames).size).toBe(2);
  });

  it('turns the Aten rays 45 degrees between its two frames', () => {
    // The whole reason two frames is the entire rotation: eight rays map onto
    // themselves under a 45deg turn. Frame one puts them on the axes (so the
    // middle rows reach the edge), frame two on the diagonals (so they do
    // not). Lose that and it is a disk blinking.
    const axis = ATEN_STRIP.map(r => r.slice(0, 16));
    const diagonal = ATEN_STRIP.map(r => r.slice(16));
    expect(axis[7][0]).toBe('#');
    expect(diagonal[7][0]).toBe('.');
    expect(diagonal[1][1]).toBe('#');
    expect(axis[1][1]).toBe('.');
  });

  it('lands the Egyptian band on four whole signs over a ground line', () => {
    // The band is ornament made of legible signs, not writing — see the note
    // in sprites.ts. What has to hold mechanically is that it tiles: the last
    // two rows are the ground line, full width, and that is the seam.
    expect(GLYPH_BAND[0].length).toBe(SPRITE_SIZE * 4);
    expect(GLYPH_BAND[14]).toBe('#'.repeat(SPRITE_SIZE * 4));
    expect(GLYPH_BAND[15]).toBe('#'.repeat(SPRITE_SIZE * 4));
    // Each cell draws something, or one of the four is a blank gap.
    for (let cell = 0; cell < 4; cell++) {
      const glyph = GLYPH_BAND.slice(0, 14)
        .map(r => r.slice(cell * 16, cell * 16 + 16))
        .join('');
      expect(`cell${cell}:${glyph.includes('#')}`).toBe(`cell${cell}:true`);
    }
  });

  it('keeps the centred Egyptian glyphs symmetric about their axis', () => {
    // Each is a single centred glyph: one drifted pixel and the ankh leans,
    // the cartouche looks buckled. The wedjat is deliberately NOT in this
    // list, and neither is the band — its signs are individually lopsided on
    // purpose.
    for (const [name, sprite] of Object.entries({ ANKH, CARTOUCHE, DJED, PAPYRUS })) {
      for (let y = 0; y < SPRITE_SIZE; y++) {
        const mirrored = [...sprite[y]].reverse().join('');
        expect(`${name} row${y}:${sprite[y]}`).toBe(`${name} row${y}:${mirrored}`);
      }
    }
  });

  it('keeps the wedjat asymmetric, which is what makes the pair a pair', () => {
    // The tail hangs off the outer corner only. A symmetric eye mirrors into
    // itself, and the two guarding the sign-in card become one drawing twice.
    expect(mirrorSprite(WEDJAT).join('/')).not.toBe(WEDJAT.join('/'));
  });

  it('joins the two vertical Egyptian tiles through their own shaft', () => {
    // Both repeat-y. If the last row does not carry the shaft the next tile
    // starts with, the pillar comes apart every 16 pixels.
    for (const [name, sprite] of Object.entries({ DJED, PAPYRUS })) {
      const seam = `${sprite[15][7]}${sprite[15][8]}${sprite[0][7]}${sprite[0][8]}`;
      expect(`${name}:${seam}`).toBe(`${name}:####`);
    }
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
