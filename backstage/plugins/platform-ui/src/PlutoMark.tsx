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
 * The glyph is the **bident** — Hades' two-pronged spear, the weapon he
 * fights with and the attribute that separates him from Poseidon's trident.
 * It strokes `--sc-primary`, so the mark answers to the picked potion; the
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
        {/* Bident: two prongs off a head bar, one shaft down. */}
        <path d="M38 30v26" />
        <path d="M82 30v26" />
        <path d="M38 56h44" />
        <path d="M60 56v40" />
      </svg>
    </div>
  );
}
