import { PLUTO_PHOTO } from './plutoPhoto';

/**
 * Pluto: the New Horizons photograph, with Hades' bident floating over it.
 *
 * A sprite could carry a glyph but not the planet — at 16x16 a disc with a
 * mark on it reads as a coin, which is exactly how the first attempt looked.
 * This is the real photograph (see `plutoPhoto.ts` for provenance and
 * licence), downsampled to 72px and rendered back up with
 * `image-rendering: pixelated`, so it lands on the same chunky grid as the
 * sprites instead of looking like a screenshot from another application.
 *
 * The glyph is the **bident** — Hades' two-pronged spear, drawn as the
 * game's own stylisation of it rather than the plain fork: needle prongs,
 * flared barbs, a diamond cut out of the body. It is filled with
 * `--sc-primary`, so the mark answers to the picked potion; the
 * photograph keeps colours of its own, which it must. No colour literals
 * here — see `.sc-pluto*` in `styles.ts`.
 *
 * Shared by the maintenance page and the home page's decorative block, so the
 * planet is defined once. `decorative` drops it out of the accessibility tree
 * entirely: on the home page it says nothing a screen reader needs, while on
 * the maintenance page it is the illustration for the message beside it.
 */
export function PlutoMark({ decorative = false }: { decorative?: boolean }) {
  return (
    <div className="sc-pluto">
      <img
        className="sc-pluto-disc"
        src={PLUTO_PHOTO}
        alt={decorative ? '' : 'Pluto'}
        aria-hidden={decorative || undefined}
      />
      <svg
        className="sc-pluto-glyph"
        viewBox="0 0 120 120"
        aria-hidden="true"
        focusable="false"
      >
        {/*
          The Hades sigil, traced from the game's own mark rather than drawn
          by eye — three attempts by eye all missed the same thing, which is
          that this is not a symmetrical fork.

          Two subpaths, because the mark is genuinely two pieces: the right
          blade runs unbroken into the angular hook at the foot, while the
          LEFT BLADE IS DETACHED and simply stops above it. That asymmetry
          is the whole character of the thing, and it is why a tidy mirrored
          bident reads as a garden fork instead.

          Filled, not stroked: the silhouette is the mark, and the blades
          taper to nothing at the tips, which no uniform stroke can do.
        */}
        <path
          d="
            M61.2 12.8 L66.0 50.6 L68.8 64.7 L71.8 74.0 L56.1 91.0
            L55.7 92.1 L59.9 96.7 L60.3 96.5 L64.3 91.9 L63.7 90.4
            L62.0 88.7 L66.7 83.4 L71.6 87.0 L76.2 91.4 L59.9 108.0
            L43.8 91.2 L64.8 73.2 L62.9 64.2 L61.6 50.6 L61.0 35.4
            L61.2 21.8 L60.9 21.4 Z
            M58.6 12.0 L59.0 12.4 L59.1 28.8 L58.4 51.5 L57.1 64.2
            L55.2 72.3 L55.2 73.2 L57.8 75.5 L57.8 76.1 L53.3 79.5
            L48.2 73.6 L50.5 67.9 L53.7 53.4 L56.7 31.3 Z
          "
        />
      </svg>
    </div>
  );
}
