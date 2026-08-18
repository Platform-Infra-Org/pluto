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

/**
 * A sprite as an SVG data URI, for use as a CSS background or border image.
 *
 * The same run-merged rects `spriteRects` produces, wrapped in an SVG document
 * small enough to inline. This is how an ornament authored on the pixel grid
 * reaches CSS at all: a repeating band, a tiled field or a border-image corner
 * cannot be drawn by a gradient without lying about the shape.
 *
 * The fill is baked in rather than read from a custom property, because a data
 * URI is a separate document — it inherits neither `currentColor` nor
 * `var(--x)` from the page. Callers that need two colours generate two URIs.
 *
 * The CSP is Helmet's default (`img-src 'self' data:`), which permits these;
 * they are same-origin data, not a network fetch.
 */
export function spriteDataUri(
  sprite: Sprite,
  fill: string,
  layer: string = '#',
): string {
  const h = sprite.length;
  const w = sprite[0]?.length ?? h;
  const rects = spriteRects(sprite, layer)
    .map(r => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1"/>`)
    .join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" ` +
    `viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" fill="${fill}">` +
    `${rects}</svg>`;
  // Encoded, not raw: a raw '#' terminates the URL and a raw '<' breaks some
  // CSS parsers. encodeURIComponent also leaves no backtick behind, which
  // matters because the result is interpolated into a template literal.
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * A sprite as a CSS `url()`, ready to interpolate into a mode sheet.
 *
 * The fill is baked, so a two-colour motif is two calls — see spriteDataUri.
 */
export const spriteUrl = (sprite: Sprite, fill: string, layer?: string) =>
  `url("${spriteDataUri(sprite, fill, layer)}")`;

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

/**
 * The amphora as a *vessel*: '#' is the clay, '~' is what it holds.
 *
 * Two layers rather than reusing AMPHORA, which is a solid silhouette and has
 * nothing for the picker to fill with the scheme colour. Same reason POTION
 * and RUPEE carry a second layer.
 */
export const AMPHORA_VESSEL: Sprite = [
  '.....######.....',
  '.....#~~~~#.....',
  '......####......',
  '..##..#~~#..##..',
  '.####.#~~#.####.',
  '.##.##~~~~##.##.',
  '.##.#~~~~~~#.##.',
  '..#~~~~~~~~~~#..',
  '..#~~~~~~~~~~#..',
  '..#~~~~~~~~~~#..',
  '..#~~~~~~~~~~#..',
  '...#~~~~~~~~#...',
  '....#~~~~~~#....',
  '.....#~~~~#.....',
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

/**
 * The rupee beside the experience bar. Two layers like the potion: '#' is the
 * facet edge, '~' the fill that takes the accent.
 */
export const RUPEE: Sprite = [
  '.......##.......',
  '......#~~#......',
  '.....#~~~~#.....',
  '....#~~~~~~#....',
  '...#~~~~~~~~#...',
  '..#~~~~~~~~~~#..',
  '.#~~~~~~~~~~~~#.',
  '#~~~~~~~~~~~~~~#',
  '#~~~~~~~~~~~~~~#',
  '.#~~~~~~~~~~~~#.',
  '..#~~~~~~~~~~#..',
  '...#~~~~~~~~#...',
  '....#~~~~~~#....',
  '.....#~~~~#.....',
  '......#~~#......',
  '.......##.......',
];

/**
 * The creatures that run along the bar while a workflow is executing.
 *
 * 8x8 rather than the usual 16, so several fit on a 12px bar. Sprites on this
 * smaller grid are the only ones here that are not SPRITE_SIZE square. Two
 * frames, legs apart and legs together, which is the whole of an 8-bit run
 * cycle.
 */
export const SMALL_SPRITE_SIZE = 8;

export const CREEP_A: Sprite = [
  '..####..',
  '.######.',
  '##.##.##',
  '########',
  '########',
  '.######.',
  '.#....#.',
  '#......#',
];

export const CREEP_B: Sprite = [
  '..####..',
  '.######.',
  '##.##.##',
  '########',
  '########',
  '.######.',
  '..#..#..',
  '.#....#.',
];

/**
 * A four-point sparkle, on the small 8px grid.
 *
 * Thin arms and a solid middle: a square with rounded expectations reads as a
 * dot, and a dot is not a star.
 */
export const STAR: Sprite = [
  '...##...',
  '...##...',
  '..####..',
  '########',
  '########',
  '..####..',
  '...##...',
  '...##...',
];

/* ===== Ancient Greek ornament =====
   Motifs rather than colours: these are what make the Greek mode read as Greek
   at a glance, and they are authored on the same pixel grid as everything else
   so they stay in the same visual language as the rest of the app. Rendered
   into CSS through spriteDataUri. */

/**
 * The meander — the Greek key. The single most recognisable ornament in Greek
 * art, running along the rim of almost every red-figure vase and the frieze of
 * almost every temple.
 *
 * Authored to tile horizontally: the top and bottom rails run the full width so
 * they join seamlessly, and the two blank columns on the right are the gap that
 * separates one key from the next.
 */
export const MEANDER: Sprite = [
  '################',
  '################',
  '##..........##..',
  '##..........##..',
  '##..######..##..',
  '##..######..##..',
  '##..##..##..##..',
  '##..##..##..##..',
  '##..##..##..##..',
  '##..##..##..##..',
  '##..##......##..',
  '##..##......##..',
  '##..##########..',
  '##..##########..',
  '################',
  '################',
];

/**
 * The palmette (anthemion) — the fan of petals on a vase rim or the akroterion
 * at the peak of a temple roof. Symmetric about its stem, so it reads upright
 * wherever it is placed.
 */
export const PALMETTE: Sprite = [
  '.......##.......',
  '......####......',
  '.....##..##.....',
  '..#..##..##..#..',
  '.###.##..##.###.',
  '.###.##..##.###.',
  '.###..####..###.',
  '..###.####.###..',
  '..###.####.###..',
  '...##########...',
  '....########....',
  '.....######.....',
  '......####......',
  '.......##.......',
  '.......##.......',
  '......####......',
];

/** A fluted Doric column: abacus and echinus above, the shaft's flutes below. */
export const COLUMN: Sprite = [
  '################',
  '################',
  '.##############.',
  '..############..',
  '..#.##.##.##.#..',
  '..#.##.##.##.#..',
  '..#.##.##.##.#..',
  '..#.##.##.##.#..',
  '..#.##.##.##.#..',
  '..#.##.##.##.#..',
  '..#.##.##.##.#..',
  '..#.##.##.##.#..',
  '..############..',
  '.##############.',
  '################',
  '################',
];

/**
 * A rosette medallion, on the small 8px grid.
 *
 * Deliberately symmetric under a quarter turn, which is what lets one sprite
 * serve all four corners of a frame as four background layers — an element has
 * only two pseudo-elements, and this sidesteps that ceiling entirely rather
 * than settling for two corners.
 */
export const ROSETTE: Sprite = [
  '..#..#..',
  '.######.',
  '#.####.#',
  '.######.',
  '.######.',
  '#.####.#',
  '.######.',
  '..#..#..',
];

/**
 * A pomegranate — the fruit Persephone ate in the underworld, which is why she
 * returns to it. The most load-bearing object in the myth the Hades games are
 * built on.
 */
export const POMEGRANATE: Sprite = [
  '.......##.......',
  '......####......',
  '.....##..##.....',
  '......####......',
  '....########....',
  '...##########...',
  '..############..',
  '.##############.',
  '.##############.',
  '.##############.',
  '.##############.',
  '.##############.',
  '..############..',
  '...##########...',
  '....########....',
  '......####......',
];

/** An owl — Athena's bird, and the stamp on the Athenian tetradrachm. */
export const OWL: Sprite = [
  '..##........##..',
  '.####......####.',
  '.##############.',
  '################',
  '##.####..####.##',
  '##.#..#..#..#.##',
  '##.#..#..#..#.##',
  '##.####..####.##',
  '################',
  '.####..##..####.',
  '.##############.',
  '.##.########.##.',
  '.##.########.##.',
  '..############..',
  '...##########...',
  '..##..####..##..',
];

/** A snow crystal: four arms with branches, symmetric under a quarter turn. */
/**
 * The small flake that drifts inside the winter bottle, on the 8px grid.
 *
 * Its own sprite rather than a scaled SNOWFLAKE: at six user units the big
 * crystal's single-pixel branches fall below one device pixel and dissolve into
 * grey mush, which is the usual way pixel art dies when it is merely resized.
 */
/**
 * An icicle fringe, 16x10, tiling horizontally under a rail.
 *
 * Teeth of three different lengths: an even comb reads as a machine part, and
 * ice does not grow evenly.
 */
/**
 * Spring: a flower rather than a tree — petals, a centre, a stem and one leaf.
 *
 * The gap between the petals is what makes it a bloom instead of a blob at this
 * size; a solid disc on a stalk reads as a lollipop.
 */
/** Summer: the sun at its height, four rays and a full disc. */
/**
 * Autumn: a fallen leaf, tilted, on its stem.
 *
 * A leaf rather than a lantern because the blade and stem read at eight pixels
 * where a carved face does not — two eyes and a mouth need holes, and holes
 * that small close up the moment the sprite is scaled into a bottle.
 */
/** Space: a world with a ring through it. */
/** Zeus: the bolt itself, the one object in the set that is pure motion. */
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

/* ===== Hanami ornament =====
   Objects and patterns, not creatures: the koi and the kitsune mask were both
   drawn and both dropped, for the reason already recorded above the item
   vocabulary — a 16x16 silhouette that has to read as a living thing takes
   several attempts and still reads as a blob, while a torii or a wave says
   what it is at a glance. Asanoha went the same way: the hemp leaf needs three
   distinguishable line weights across one hexagon and collapses into a grey
   mesh at this size. */

/**
 * Seigaiha — the blue-sea-wave scale pattern, as a true unit cell.
 *
 * Two half-offset rows of nested arcs in one 16x16 tile, so it tiles in both
 * directions with no seam: the second row is the first shifted by half a
 * scale, which is exactly what the pattern does on a kimono bolt.
 */
export const SEIGAIHA: Sprite = [
  '......####......',
  '....##....##....',
  '...#........#...',
  '..#...####...#..',
  '..#..#....#..#..',
  '.#..#..##..#..#.',
  '.#..#.#..#.#..#.',
  '#...#.#..#.#...#',
  '##............##',
  '..##........##..',
  '....#......#....',
  '##...#....#...##',
  '..#..#....#..#..',
  '#..#..#..#..#..#',
  '.#.#..#..#..#.#.',
  '.#.#...##...#.#.',
];

/** A torii: kasagi over nuki over two pillars. The threshold, so it marks one. */
export const TORII: Sprite = [
  '################',
  '.##############.',
  '................',
  '.##############.',
  '.##############.',
  '...##......##...',
  '...##......##...',
  '...##......##...',
  '...##......##...',
  '...##......##...',
  '...##......##...',
  '...##......##...',
  '...##......##...',
  '...##......##...',
  '..####....####..',
  '..####....####..',
];

/**
 * A blossom on the small 8px grid, symmetric under a quarter turn.
 *
 * The symmetry is the point, the same as ROSETTE: one sprite serves all four
 * corners of a frame as four background layers, which is how a two-pseudo-
 * element ceiling gets sidestepped entirely.
 */
export const BLOSSOM: Sprite = [
  '...##...',
  '..####..',
  '.##..##.',
  '##.##.##',
  '##.##.##',
  '.##..##.',
  '..####..',
  '...##...',
];

/**
 * The falling petal, as a four-frame tumble strip: 8x8 frames laid side by
 * side, so 32x8.
 *
 * A strip rather than four sprites because CSS advances one background-position
 * in whole steps; four images would need four elements. Frames run flat, part
 * turned, edge on, part turned the other way — the whole of a petal's tumble.
 */
export const PETAL_STRIP: Sprite = [
  '................................',
  '..####.....##......##.....##....',
  '.######...####.....##.....###...',
  '.######...####.....##.....####..',
  '.######...####.....##......###..',
  '..####.....##......##.......##..',
  '................................',
  '................................',
];

/* ===== Nightshade ornament =====
   The moth went the way of the koi: a creature silhouette at this size reads as
   a smudge with antennae. What survived are objects and a pattern, which is the
   same rule the item vocabulary above already follows. */

/**
 * A crescent cradling a witch-green flame: '#' is the moon, '~' the fire.
 *
 * Two layers rather than two sprites, so the flame cannot drift out of the
 * crescent's mouth when one of them is edited.
 */
export const CRESCENT_FLAME: Sprite = [
  '.....#####......',
  '...###...###....',
  '..##.......##...',
  '.##.......~~....',
  '.##......~~~~...',
  '##......~~~~~~..',
  '##......~~~~~~..',
  '##.....~~~~~~~~.',
  '##.....~~~~~~~~.',
  '##......~~~~~~..',
  '##......~~~~~~..',
  '.##......~~~~...',
  '.##.......~~....',
  '..##.......##...',
  '...###...###....',
  '.....#####......',
];

/**
 * A cauldron with three bubbles rising: '#' is the iron, '~' the brew.
 *
 * The bubbles are the brew colour and sit clear of the rim, or the whole thing
 * reads as a cooking pot with crumbs on it.
 */
export const CAULDRON: Sprite = [
  '....~.......~...',
  '................',
  '.......~........',
  '................',
  '################',
  '#~~~~~~~~~~~~~~#',
  '#~~~~~~~~~~~~~~#',
  '.##############.',
  '.##############.',
  '.##############.',
  '..############..',
  '..############..',
  '...##########...',
  '....########....',
  '...##......##...',
  '..###......###..',
];

/**
 * A filigree medallion on the small 8px grid, symmetric under a quarter turn.
 *
 * Same trick as ROSETTE and BLOSSOM: one sprite serves all four corners of a
 * frame as four background layers, which sidesteps the two-pseudo-element
 * ceiling rather than settling for two corners.
 */
export const FILIGREE: Sprite = [
  '..####..',
  '.#....#.',
  '#.#..#.#',
  '#..##..#',
  '#..##..#',
  '#.#..#.#',
  '.#....#.',
  '..####..',
];

/**
 * A nightshade sprig, tiling horizontally along the stem in the middle row.
 *
 * Leaves above and below so the band has vertical weight — a vine drawn only
 * along its stem reads as a dotted rule.
 */
export const SPRIG: Sprite = [
  '....##....##....',
  '...####..####...',
  '....##....##....',
  '.....#....#.....',
  '......#..#......',
  '.......##.......',
  '..##...##...##..',
  '#####..##..#####',
  '..##...##...##..',
  '.......##.......',
  '......#..#......',
  '.....#....#.....',
  '....##....##....',
  '...####..####...',
  '....##....##....',
  '................',
];

/**
 * The eight phases of the moon as one 64x8 strip: eight 8x8 frames.
 *
 * A strip because CSS advances one background-position in whole steps; eight
 * images would need eight elements. New moon is drawn as an outline rather
 * than left blank, so the ornament never simply disappears for an eighth of
 * the cycle.
 */
export const MOON_STRIP: Sprite = [
  '......#.....##....####....####....####....##.....#........####..',
  '.....##.....###...#####..######..#####...###.....##......#....#.',
  '......##....####.######################.####....##......#......#',
  '......##....####.######################.####....##......#......#',
  '......##....####.######################.####....##......#......#',
  '......##....####.######################.####....##......#......#',
  '.....##.....###...#####..######..#####...###.....##......#....#.',
  '......#.....##....####....####....####....##.....#........####..',
];
