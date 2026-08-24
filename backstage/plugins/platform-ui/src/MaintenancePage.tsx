import { Page, Card, CardBody, PixelSprite } from './components';
import { PLUTO } from './sprites';

/**
 * What a non-admin sees instead of the request form while maintenance is on.
 *
 * Built from our own furniture and nothing else — no colour literals — so it
 * follows the picked potion, Hades boons included. A maintenance screen that
 * ignored the theme would look like an error page from another application,
 * which is exactly the wrong impression: nothing is broken.
 *
 * The Hebrew line is the joke. Pluto is in retrograde, so the platform is
 * resting; astrology is as good an explanation as most incident reports.
 */
export function MaintenancePage() {
  return (
    <Page>
      <Card>
        <CardBody>
          <PixelSprite sprite={PLUTO} />
          <div className="sc-empty-title">Maintenance</div>
          <p className="sc-muted" lang="he" dir="rtl">
            פלוטו בנסיגה...
          </p>
          <p className="sc-muted">
            New requests are paused while the platform is being worked on.
            Anything already filed is unaffected.
          </p>
        </CardBody>
      </Card>
    </Page>
  );
}
