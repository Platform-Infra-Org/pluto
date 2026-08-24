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
          The Hades sigil: a stylised bident. Two needle prongs taper from
          sharp tips down to a narrow waist, flare out into barbs, then close
          to a point — with a diamond cut out of the lower body.

          One filled outline rather than strokes, because the silhouette IS
          the mark: stroked lines of even width read as a garden fork. Wound
          bottom point -> left barb -> left tip -> back down the inner edge to
          the crotch -> up the right prong, so the gap between the blades is
          part of the outline and narrows downward the way the original does.
        */}
        <path
          fillRule="evenodd"
          d="M60 108 L48 85 L39.5 71 L52.5 63 L57.2 13 L59.1 63 L60 71
             L60.9 63 L62.8 13 L67.5 63 L80.5 71 L72 85 Z
             M60 80 L63.4 88 L60 96 L56.6 88 Z"
        />
      </svg>
    </div>
  );
}
