import { Page, Card, CardBody } from './components';
import { PLUTO_PHOTO } from './plutoPhoto';

/**
 * Pluto: the New Horizons photograph, pixelated to match everything else.
 *
 * A sprite could carry the astrological glyph but not the planet — at 16x16 a
 * disc with a monogram on it reads as a coin, which is exactly how the first
 * attempt looked. A drawn substitute did better but was still a drawing. This
 * is the real photograph (see `plutoPhoto.ts` for provenance and licence),
 * downsampled to 72px and rendered back up with `image-rendering: pixelated`,
 * so it lands on the same chunky grid as the sprites instead of looking like
 * a screenshot pasted in from another application.
 *
 * The glyph floats over it in `--sc-primary`, so the mark still answers to
 * the picked potion, and a scanline layer ties the disc to the page's own
 * texture. No colour literals here — see `.sc-pluto*` in `styles.ts`.
 */
function PlutoMark() {
  return (
    <div className="sc-pluto">
      <img className="sc-pluto-disc" src={PLUTO_PHOTO} alt="Pluto" />
      <svg
        className="sc-pluto-glyph"
        viewBox="0 0 120 120"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M45 34V86" />
        <path d="M45 34h13a13 13 0 0 1 0 26H45" />
        <path d="M45 86h30" />
      </svg>
    </div>
  );
}

/**
 * What a non-admin sees instead of the request form while maintenance is on.
 *
 * Built from our own furniture and nothing else — no colour literals — so it
 * follows the picked potion. A maintenance screen that ignored the theme would
 * look like an error page from another application, which is exactly the wrong
 * impression: nothing is broken.
 *
 * It fills the content area rather than sitting as a short card under the
 * header: this is the whole answer to "can I file a request right now", not a
 * notice attached to a page that still has something else on it.
 *
 * The Hebrew line is the joke. Pluto is in retrograde, so the platform is
 * resting; astrology is as good an explanation as most incident reports.
 */
export function MaintenancePage() {
  return (
    <Page>
      <div className="sc-maint">
        <Card className="sc-maint-card">
          <CardBody>
            <div className="sc-empty sc-maint-empty">
              <PlutoMark />
              <div className="sc-empty-title">Maintenance</div>
              <p className="sc-muted" lang="he" dir="rtl">
                פלוטו בנסיגה...
              </p>
              <p className="sc-muted sc-empty-hint">
                New requests are paused while the platform is being worked on.
                Anything already filed is unaffected.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </Page>
  );
}
