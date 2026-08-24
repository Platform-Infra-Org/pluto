import { Page, Card, CardBody } from './components';

/**
 * Pluto, drawn rather than sprited.
 *
 * The 16x16 pixel grid could carry the astrological glyph but not the planet:
 * at that size a disc with a monogram on it reads as a coin, which is what
 * made the first attempt look like anything but Pluto. What actually
 * identifies Pluto to a human eye is **Tombaugh Regio** — the pale heart
 * across its lower face — so that is the one feature drawn in full, over a
 * light-from-upper-left sphere gradient.
 *
 * No colour literals here: every stop, fill and stroke is a class styled in
 * `styles.ts` (see `.sc-pluto`). That keeps `MaintenancePage.test.tsx`'s
 * "carries no colour of its own" guard meaningful — the planet's own greys
 * live with the rest of the palette, and the glyph rides `--sc-primary`, so
 * the mark follows the picked potion exactly like every other surface.
 */
function PlutoMark() {
  return (
    <svg
      className="sc-pluto"
      viewBox="0 0 120 120"
      role="img"
      aria-label="Pluto"
      focusable="false"
    >
      <defs>
        <radialGradient id="sc-pluto-body" cx="34%" cy="28%" r="82%">
          <stop className="sc-pluto-hi" offset="0" />
          <stop className="sc-pluto-mid" offset="0.55" />
          <stop className="sc-pluto-lo" offset="1" />
        </radialGradient>
        <clipPath id="sc-pluto-clip">
          <circle cx="60" cy="60" r="52" />
        </clipPath>
      </defs>

      <circle cx="60" cy="60" r="52" fill="url(#sc-pluto-body)" />

      <g clipPath="url(#sc-pluto-clip)">
        {/* Tombaugh Regio. Authored in a 0..1 box and placed by transform, so
            the lobes stay symmetrical if it is ever moved or resized. */}
        <path
          className="sc-pluto-heart"
          transform="translate(30 52) scale(54 46)"
          d="M0.5 1C0.1 0.72 0 0.42 0.19 0.24C0.34 0.1 0.5 0.22 0.5 0.34C0.5 0.22 0.66 0.1 0.81 0.24C1 0.42 0.9 0.72 0.5 1Z"
        />
        <circle className="sc-pluto-crater" cx="44" cy="34" r="7" />
        <circle className="sc-pluto-crater" cx="72" cy="26" r="4.5" />
        <circle className="sc-pluto-crater" cx="30" cy="56" r="5" />
      </g>

      {/* The PL monogram, floating over the disc. */}
      <g className="sc-pluto-glyph">
        <path d="M45 34V86" />
        <path d="M45 34h13a13 13 0 0 1 0 26H45" />
        <path d="M45 86h30" />
      </g>
    </svg>
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
