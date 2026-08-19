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
 * A sprite turned a quarter turn clockwise.
 *
 * CSS cannot rotate a background image, so a motif that is NOT symmetric under
 * a quarter turn — a corner bracket, a vine that runs one way — needs one grid
 * per orientation. Generating the other three from the authored one is what
 * keeps them from drifting apart the first time the authored one is edited.
 *
 * Reads column x from bottom to top, which is the clockwise turn: the top-left
 * corner ornament comes back as the top-right one.
 */
export const rotateSprite = (sprite: Sprite): Sprite =>
  Array.from({ length: sprite[0]?.length ?? 0 }, (_, y) =>
    sprite.map(row => row[y]).reverse().join(''),
  );

/**
 * A sprite mirrored left to right.
 *
 * For a PAIR: two of the same creature both facing the same way read as one
 * drawing used twice, which is exactly what it is. One line, and it is the
 * difference between two ravens flanking a door and two ravens queueing.
 */
export const mirrorSprite = (sprite: Sprite): Sprite =>
  sprite.map(row => [...row].reverse().join(''));

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
 *
 * Drawn to the shelf proportions the note below sets out: a flared lip, a
 * collared neck, the handles hung off the shoulder rather than the belly, and
 * a foot that tapers to four pixels instead of sitting flat.
 */
export const AMPHORA_VESSEL: Sprite = [
  '.....######.....',
  '.....#~~~~#.....',
  '......####......',
  '......#~~#......',
  '..##..#~~#..##..',
  '.##..#~~~~#..##.',
  '.##.#~~~~~~#.##.',
  '..###~~~~~~###..',
  '...#~~~~~~~~#...',
  '...#~~~~~~~~#...',
  '...#~~~~~~~~#...',
  '....#~~~~~~#....',
  '.....#~~~~#.....',
  '......#~~#......',
  '......####......',
  '................',
];

/* The rest of the vessel shelf: one bottle per ornamented mode.
   Every one carries BOTH layers the picker draws — '~' for the liquid, which
   takes the scheme colour, and '#' for the vessel, which takes currentColor.
   A grid with no '~' comes back as an outline with nothing in it, which is
   the whole of what these exist to avoid. Silhouette is what separates them
   at 16px, not detail: a flask, a pot on legs, a tapering horn and a lidded
   jar with a head on it are four different shapes at a glance, and the
   generic POTION is still what every unornamented mode gets.

   THEY ARE READ AS A ROW, not one at a time — five of them sit side by side in
   the picker tray — so the shelf keeps four rules and each vessel varies only
   within them. Break one and that vessel stops belonging to the set:

   - a one-pixel margin all round, and the bottom row empty. A shape that
     touches the edge of its box reads as cropped rather than drawn, and next
     to four that do not, it reads as the odd one out.
   - hairline walls: one pixel, never two. The old shelf mixed both weights,
     which is most of what made it look chunky.
   - the liquid mass sits low, in the belly. It is the only coloured thing in
     the sprite and it is what the tray is actually showing.
   - taller than wide where the vessel allows it: nothing spans more than
     twelve of the sixteen columns.

   sprites.test.ts pins the margin, which is the one a redraw loses silently. */

/** Hanami: a tokkuri, the sake flask — flared lip, collared neck, round belly. */
export const TOKKURI_VESSEL: Sprite = [
  '.....######.....',
  '.....#~~~~#.....',
  '......####......',
  '......#~~#......',
  '......#~~#......',
  '......#~~#......',
  '.....#~~~~#.....',
  '....#~~~~~~#....',
  '...#~~~~~~~~#...',
  '..#~~~~~~~~~~#..',
  '..#~~~~~~~~~~#..',
  '..#~~~~~~~~~~#..',
  '...#~~~~~~~~#...',
  '....#~~~~~~#....',
  '.....######.....',
  '................',
];

/**
 * Nightshade: the cauldron, slung under its bail handle and standing on two
 * feet.
 *
 * Not the CAULDRON above, which is a solid iron body with three bubbles over
 * it: at bottle scale that reads as a black pot and the scheme colour barely
 * appears. Here the pot is an outline and the brew fills it.
 *
 * The one vessel on the shelf that is wider than it is tall in the body, which
 * is what a cauldron is. It keeps to the shelf by carrying the height in the
 * handle above and the legs below instead of in a neck.
 */
export const CAULDRON_VESSEL: Sprite = [
  '......####......',
  '....##....##....',
  '...#........#...',
  '...#........#...',
  '.##############.',
  '..#~~~~~~~~~~#..',
  '..#~~~~~~~~~~#..',
  '..#~~~~~~~~~~#..',
  '...#~~~~~~~~#...',
  '...#~~~~~~~~#...',
  '....#~~~~~~#....',
  '.....######.....',
  '....##....##....',
  '....##....##....',
  '...####..####...',
  '................',
];

/**
 * Rimefast: a stave tankard — the banded wooden cup, not the drinking horn.
 *
 * The horn was the obvious Norse vessel and the wrong one for this shelf: a
 * long tapering curve reads as a crescent or a claw at 16px, and beside four
 * upright vessels it was the one shape that did not look like it belonged to
 * the set. A tankard keeps the culture (coopered staves, iron hoops, a mead
 * cup) and the family silhouette: upright, hairline walls, liquid sitting low.
 * The two full-width bands are the hoops, and they double as the only place
 * the wall reads as thick, which is what makes it read as wood rather than
 * glass.
 */
export const TANKARD_VESSEL: Sprite = [
  '................',
  '...########.....',
  '...#......#.....',
  '...#......#.###.',
  '...#......#...#.',
  '...########...#.',
  '...#......#...#.',
  '...#~~~~~~#...#.',
  '...#~~~~~~#...#.',
  '...########...#.',
  '...#~~~~~~#.###.',
  '...#~~~~~~#.....',
  '...#~~~~~~#.....',
  '...########.....',
  '................',
  '................',
];

/**
 * Egyptian: a canopic jar, the head-stoppered vessel of the burial set.
 *
 * The lid is the whole of the recognition at this size. It is the jackal, and
 * it is drawn as an outline with two upright ears and a knocked-out pair of
 * eyes rather than as a solid block: a filled head at 16px is a domino, and
 * the ears are what separate this from the tokkuri's stopper across the tray.
 * The liquid starts under the lid rim, where a stoppered jar would hold it.
 */
export const CANOPIC_VESSEL: Sprite = [
  '....##....##....',
  '....##....##....',
  '....########....',
  '....#.####.#....',
  '....########....',
  '.....######.....',
  '......####......',
  '..############..',
  '...#~~~~~~~~#...',
  '..#~~~~~~~~~~#..',
  '..#~~~~~~~~~~#..',
  '..#~~~~~~~~~~#..',
  '..#~~~~~~~~~~#..',
  '...#~~~~~~~~#...',
  '...##########...',
  '................',
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
 * The key again, as a FIELD rather than a band: a two-by-two of mirrored
 * single-line spirals, tiling in both directions.
 *
 * A separate sprite and not MEANDER at a smaller size, for the reason that
 * decides every ground pattern in this design system: MEANDER is drawn with
 * two-pixel rails because it is a band read at the size of a heading rule, and
 * tiled across a whole panel those rails are half the surface. This one is one
 * pixel throughout — about a third ink, the weight asanoha carries in the
 * hanami sidebar — so at a ground tint it prints into the panel instead of
 * sitting on top of it.
 *
 * Mirrored in pairs because that is how a fret is actually laid out on a wall:
 * two spirals facing each other under one continuous rail.
 */
export const FRET: Sprite = [
  '################',
  '......#..#......',
  '..###.#..#.###..',
  '..#.#.#..#.#.#..',
  '..#...#..#...#..',
  '..#####..#####..',
  '................',
  '................',
  '################',
  '......#..#......',
  '..###.#..#.###..',
  '..#.#.#..#.#.#..',
  '..#...#..#...#..',
  '..#####..#####..',
  '................',
  '................',
];

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
   Objects and patterns first: a torii or a wave says what it is at a glance,
   which is why they carry the mode. Two motifs recorded here as dropped are
   back, on terms that answer why they failed the first time:

   - **Asanoha** is drawn as the LATTICE, not as a hexagon. The literal hemp
     leaf needs three distinguishable line weights across one hexagon and does
     collapse into grey mesh at 16px; the diamond lattice the pattern is built
     from survives at one pixel a line, and it is what the eye reads as asanoha
     on a paper screen anyway.
   - **The koi** is 16x16 and is a fish, which is the one silhouette that does
     survive at this size — a body, a forked tail and one eye gap. The kitsune
     mask stays dropped: a face needs holes, and holes this small close up.

   Anything living that needs more than a silhouette still does not belong on
   this grid. */

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

/**
 * Asanoha, as the diamond lattice the hemp-leaf pattern is built from.
 *
 * Generated rather than eyeballed: the two full diagonals plus one quarter arc
 * unioned with its three quarter turns, which is what makes the tile symmetric
 * under a quarter turn — and that symmetry is what makes it tile in both
 * directions with no seam, because each edge meets its own mirror. The period
 * is 8, so a 16px tile shows four cells and a 32px tile still reads as fabric
 * rather than as four big diamonds.
 */
export const ASANOHA: Sprite = [
  '#......##......#',
  '.#....#..#....#.',
  '..#..#....#..#..',
  '...##......##...',
  '...##......##...',
  '..#..#....#..#..',
  '.#....#..#....#.',
  '#......##......#',
  '#......##......#',
  '.#....#..#....#.',
  '..#..#....#..#..',
  '...##......##...',
  '...##......##...',
  '..#..#....#..#..',
  '.#....#..#....#.',
  '#......##......#',
];

/**
 * A koi, facing right, with the forked tail at the left and one eye gap.
 *
 * The gaps are the whole sprite: fill the notch at the tail and it is a
 * torpedo, fill the eye and it is a bean. Both are single pixels wide because
 * this is drawn at 32px in the wave field, where one grid pixel is two device
 * pixels.
 */
export const KOI: Sprite = [
  '................',
  '.........####...',
  '.......#######..',
  '.#....##########',
  '.##..###########',
  '.###.#######.###',
  '.###############',
  '.###############',
  '.###############',
  '.###.###########',
  '.##..###########',
  '.#....##########',
  '.......#######..',
  '.........####...',
  '................',
  '................',
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
 * A corner bracket with a knot in its elbow — the nouveau frame corner.
 *
 * Deliberately NOT symmetric under a quarter turn, which is the opposite of
 * what ROSETTE, BLOSSOM and FILIGREE are for: those exist so one tile can serve
 * four corners, and the price of that trick is that a rotationally symmetric
 * ornament has no corner in it. This one has two rails meeting at an elbow, so
 * it reads as a frame rather than as a dot, and the other three orientations
 * come from rotateSprite.
 *
 * Authored as the TOP-LEFT corner: rails along the top and left edges.
 */
export const SCROLL_CORNER: Sprite = [
  '################',
  '################',
  '##..............',
  '##...######.....',
  '##..##....##....',
  '##.##..##..##...',
  '##.##.####.##...',
  '##.##..##..##...',
  '##..##....##....',
  '##...######.....',
  '##..............',
  '##..............',
  '##..............',
  '##..............',
  '##..............',
  '##..............',
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

/* ===== Rimefast ornament =====
   EXCLUDED, DELIBERATELY, AND NOT BY OVERSIGHT: the Valknut, Othala,
   Sowilo (the sig-rune), the Tyr rune and the sunwheel. Every one of them is a
   genuine Norse form, and every one is catalogued as an appropriated extremist
   symbol. Nobody should add one later thinking the set was left incomplete.
   Ravens, Yggdrasil, knotwork and a generic futhark band carry no such
   freight, and rimefast.test.ts asserts the sheet never names the five.
   The raven was dropped once at EIGHT pixels, where a bird silhouette reads as
   a comma. It is drawn below at sixteen, where the head, the beak and the legs
   are each two pixels and the bird survives — the same correction the koi got
   in the hanami set. The moth stays dropped: wings need a pattern, and a
   pattern needs pixels the moth does not have. */

/**
 * A decorative rune band: two letterforms standing on a carved rule, tiling
 * horizontally.
 *
 * DECORATIVE AND NON-SEMANTIC, and that is a design constraint rather than a
 * shrug — a band that spells something spells it wrong, in a language nobody
 * here writes, on every page of a corporate portal. Two glyphs alternating
 * with even spacing read as a carved border; a longer sequence starts to look
 * like text and invites being read as one.
 *
 * The two are Gebo (the X) and Ehwaz (the M), chosen because they are the
 * cleanest straight-stroke forms in the row and because neither appears on the
 * excluded list above. Elder Futhark has no horizontals at all — staves and
 * diagonals only, so a chisel never runs along the grain of the wood — which
 * is exactly the discipline a pixel grid renders without a single soft edge.
 * The one horizontal here is the rule the runes stand on, at row 13, and it
 * runs the full width so the band joins across its own seam.
 *
 * The previous version packed four narrow staves into the same sixteen pixels
 * at a period of four, which at 16px was a picket fence rather than writing.
 */
export const FUTHARK: Sprite = [
  '................',
  '................',
  '.#...#...#...#..',
  '.#...#...#...#..',
  '..#.#....##.##..',
  '..#.#....##.##..',
  '...#.....#.#.#..',
  '...#.....#.#.#..',
  '..#.#....#...#..',
  '..#.#....#...#..',
  '.#...#...#...#..',
  '.#...#...#...#..',
  '................',
  '################',
  '................',
  '................',
];

/**
 * Yggdrasil: a 2px trunk, three branches, three roots, symmetric about the
 * trunk.
 *
 * The mirror between crown and roots is the point of the tree — nine worlds
 * above and below one axis — and it also means the sprite reads the same way
 * up if anyone ever flips it.
 */
export const YGGDRASIL: Sprite = [
  '..##...##...##..',
  '...#...##...#...',
  '....#..##..#....',
  '.....#.##.#.....',
  '......####......',
  '.......##.......',
  '.......##.......',
  '.......##.......',
  '.......##.......',
  '.......##.......',
  '.......##.......',
  '......####......',
  '.....#.##.#.....',
  '....#..##..#....',
  '...#...##...#...',
  '..##...##...##..',
];

/**
 * Urnes-style interlace, as two 2px bands crossing with a 1px break where one
 * passes under the other.
 *
 * 16x16 is the floor for this and not a preference: an interlace needs three
 * distinguishable bands across a crossing — over, gap, under — and below that
 * the crossing closes up into a solid blob and the knot stops being a knot.
 */
export const KNOTWORK: Sprite = [
  '##......##......',
  '.##......##.....',
  '..##..##..##..##',
  '...##......##...',
  '....##......##..',
  '.....##......##.',
  '..##..##..##..##',
  '#......##......#',
  '##......##......',
  '.##......##.....',
  '..##..##..##..##',
  '...##......##...',
  '....##......##..',
  '.....##......##.',
  '..##..##..##..##',
  '#......##......#',
];

/**
 * A raven, perched, facing left. Huginn or Muninn, depending on the corner.
 *
 * The legs are what make it a perched bird rather than a blot: two two-pixel
 * uprights with a gap between them and feet at the bottom. The beak is the
 * other load-bearing pixel — take the three-pixel point off the head and this
 * is a pigeon.
 *
 * Its mirror comes from mirrorSprite, so the pair faces inward.
 */
export const RAVEN: Sprite = [
  '.....####.......',
  '....######......',
  '..########......',
  '.#########......',
  '..#########.....',
  '...##########...',
  '..############..',
  '.##############.',
  '.##############.',
  '.############.##',
  '..##########.###',
  '..#########.###.',
  '...#######.##...',
  '....##.##.......',
  '....##.##.......',
  '...####.###.....',
];

/**
 * The aurora, as a 32x8 dithered curtain that tiles horizontally.
 *
 * Dithered rather than faded, because this design system has no gradients in
 * its ornament: the soft edge is a checkerboard, which is how an 8-bit machine
 * drew one and how this app draws every other translucent fill.
 */
export const AURORA: Sprite = [
  '###########.#################.##',
  '##########.#.###############.#.#',
  '#########.....###.#####.#.#.#...',
  '##########...#.#.#######.#.#....',
  '###.#.###.........#####.........',
  '.#.#...#...........###..........',
  '....................#...........',
  '................................',
];

/* ===== Ancient Egyptian ornament =====
   Four candidates were drawn and dropped, for the same reason the koi note
   above records: a shape has to survive a 16x16 grid.
   - The sphinx and the jackal are creatures with a profile: at this size a
     lion body under a human head is a lump with a hat, and Anubis is a dog.
   - The pyramid is a triangle, and a triangle reads as a triangle. Nothing in
     it says Egypt that a play button does not also say.
   - The winged sun disk loses the feathering that makes the wings wings, and
     comes back as a disk with a moustache.
   - The lotus frieze was drawn, shipped, and then replaced by GLYPH_BAND: the
     mode is meant to read as hieroglyphic and a flower border reads as a
     flower border.

   ON THE GLYPHS, AND DO NOT "FIX" THIS LATER. The signs below are real and
   individually legible on purpose, and their ARRANGEMENT is deliberately not.
   A band of genuine glyphs in sequence spells something, and a decorative band
   that spells something spells it wrong — so the band is a repeating ornamental
   register (ankh, feather, water, reed, over a ground line) chosen for how the
   four shapes alternate, never for what they would transliterate to. The
   cartouche holds one ankh rather than a name for exactly the same reason: a
   cartouche is a name-ring, and any name we could put in it would be a lie.
   This is the same call rimefast made with its non-semantic futhark band. */

/**
 * The ankh, the one Egyptian glyph that is unmistakable at any size.
 *
 * Mirror-symmetric about the stem, which is what keeps it from reading as a
 * lopsided key: the loop, the crossbar and the shaft all share one axis.
 */
export const ANKH: Sprite = [
  '......####......',
  '....##....##....',
  '...##......##...',
  '...##......##...',
  '...##......##...',
  '....##....##....',
  '......####......',
  '.##############.',
  '.##############.',
  '......####......',
  '......####......',
  '......####......',
  '......####......',
  '......####......',
  '......####......',
  '......####......',
];

/**
 * The wedjat, the Eye of Horus, facing right: brow, lidded eye, and the tail
 * and teardrop that hang below it.
 *
 * Deliberately asymmetric — the tail drops from the outer corner only — so
 * mirrorSprite() gives a genuine pair rather than the same drawing twice.
 */
export const WEDJAT: Sprite = [
  '................',
  '..############..',
  '................',
  '....########....',
  '..###......###..',
  '.###..####..###.',
  '.##...####...##.',
  '.###..####..###.',
  '..###......###..',
  '....########....',
  '.###.....##.....',
  '.##......##.....',
  '.##.......##....',
  '.##.......##....',
  '.####.....###...',
  '................',
];

/**
 * The glyph register: four signs over a ground line, 64x16 — ankh, feather of
 * Maat, water ripple, reed — each on its own 16px cell.
 *
 * ORNAMENT, NOT WRITING. See the note above the ankh: the signs are real and
 * the order is not a sentence, and turning it into one is the bug. The order
 * here is chosen so no two similar silhouettes touch, at the seam included —
 * the reed ends one tile and the ankh opens the next.
 *
 * The ground line runs the full width on the last two rows, which is both what
 * puts the signs in a register and what makes the tile butt seamlessly against
 * its neighbour.
 */
export const GLYPH_BAND: Sprite = [
  '.........................##.....................................',
  '......####..............####..........................###.......',
  '.....##..##............#####.........................####.......',
  '.....##..##...........######.......##..##..##.......#####.......',
  '......####...........#######......#..##..##..#.....######.......',
  '.......##............#######.......................#####........',
  '..############.......#######........................####........',
  '..############.......#######.......##..##..##........###........',
  '.......##............#######......#..##..##..#........##........',
  '.......##............#######..........................##........',
  '.......##.............######..........................##........',
  '.......##.............#####........##..##..##.........##........',
  '.......##..............###........#..##..##..#........##........',
  '.......##...............#.............................##........',
  '################################################################',
  '################################################################',
];

/**
 * A cartouche: the name-ring, with a single ankh inside it.
 *
 * An ankh and not a name, and not a plausible-looking string of signs either.
 * A cartouche means "the thing inside this is a royal name", so filling it
 * with ornament we cannot read is the honest version — see the note above.
 * Mirror-symmetric about the stem, so it never looks like it is leaning.
 */
export const CARTOUCHE: Sprite = [
  '................',
  '.....######.....',
  '....##....##....',
  '...##..##..##...',
  '...##.#..#.##...',
  '...##..##..##...',
  '...##..##..##...',
  '...##.####.##...',
  '...##..##..##...',
  '...##..##..##...',
  '...##..##..##...',
  '...##..##..##...',
  '...##..##..##...',
  '....##....##....',
  '.....######.....',
  '..############..',
];

/**
 * A papyrus stalk with its umbel, tiling vertically.
 *
 * The shaft holds columns 7 and 8 on every row including the last, so the tile
 * above joins the tile below through the middle of the spray rather than
 * stopping short of it.
 */
export const PAPYRUS: Sprite = [
  '..#..#.##.#..#..',
  '..#..#.##.#..#..',
  '...##.####.##...',
  '.....######.....',
  '.......##.......',
  '.......##.......',
  '.......##.......',
  '.......##.......',
  '.......##.......',
  '.......##.......',
  '.......##.......',
  '.......##.......',
  '.......##.......',
  '.......##.......',
  '.......##.......',
  '.......##.......',
];

/**
 * The djed pillar: four crossbars over a shaft, tiling vertically.
 *
 * Stability, and the one Egyptian column form that is a repeating unit already
 * — the bars are the tile, the shaft is what carries it into the next one.
 */
export const DJED: Sprite = [
  '......####......',
  '..############..',
  '......####......',
  '..############..',
  '......####......',
  '..############..',
  '......####......',
  '..############..',
  '......####......',
  '......####......',
  '......####......',
  '......####......',
  '......####......',
  '......####......',
  '......####......',
  '......####......',
];

/**
 * The Aten as a two-frame strip: 16x16 frames side by side, so 32x16.
 *
 * Eight rays around a disk map onto themselves under a 45deg turn, so the
 * whole of the rotation is two frames — rays on the axes, then rays on the
 * diagonals — and the disk itself never moves. That is what makes this the
 * cheap animation to step: there is no in-between position to interpolate to,
 * only the two the rays are ever in.
 *
 * The rays stand clear of the disk in both frames, for the reason the frieze
 * records: joined to the body they thicken it into a cog, and the gap is the
 * only thing at this size that says light rather than machinery.
 */
export const ATEN_STRIP: Sprite = [
  '.......##.......................',
  '.......##........##..........##.',
  '.................##..........##.',
  '................................',
  '......####............####......',
  '.....######..........######.....',
  '....########........########....',
  '##..########..##....########....',
  '##..########..##....########....',
  '....########........########....',
  '.....######..........######.....',
  '......####............####......',
  '................................',
  '.................##..........##.',
  '.......##........##..........##.',
  '.......##.......................',
];
