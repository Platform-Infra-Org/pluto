import { useEffect, useState } from 'react';
import {
  useApi,
  configApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import { Link } from '@backstage/core-components';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Request, isTerminal } from '@internal/plugin-platform-common';
import {
  Page,
  PageHeader,
  Card,
  PixelStar,
} from '@internal/plugin-platform-ui';
import { requestsApiRef } from '../api';
import { stateBadge } from './RequestsPage';
import { RecentlyVisited } from './HomeVisits';
import { FavouriteTemplates } from './HomeFavourites';

type Section =
  | 'quickActions'
  | 'ownedResources'
  | 'standingRequests'
  | 'pendingApprovals'
  | 'recentlyVisited'
  | 'favouriteTemplates';

interface OwnedResource {
  name: string;
  type: string;
}

const cap = <T,>(items: T[], max: number): T[] =>
  max > 0 ? items.slice(0, max) : items;

const ACTIONS = [
  { to: '/create', label: 'Create a resource', hint: 'Run a software template' },
  { to: '/catalog', label: 'Browse resources', hint: 'Edit or delete from an entity page' },
  { to: '/requests', label: 'All requests', hint: 'Track approvals and workflows' },
];

/**
 * Replays the guided tour.
 *
 * Sits opposite the page title rather than among the quick actions: it is
 * about the app itself, not one of the things you came here to do. The tour
 * is hosted at the app root, so it is asked for by event — the home page and
 * the root have no other connection.
 */
function TourButton() {
  return (
    <button
      type="button"
      className="sc-btn sc-btn-outline sc-tour"
      onClick={() => window.dispatchEvent(new Event('platform:quickstart'))}
    >
      Take the tour
      {/* Real sprites rather than square dots: a 2px box is a dot, and a dot
          is not a star. Decorative, so they carry no text of their own. */}
      <span className="sc-tour-stars" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <PixelStar key={i} className={`sc-tour-star sc-tour-star-${i}`} />
        ))}
      </span>
    </button>
  );
}

function QuickActions() {
  return (
    <Card>
      <div className="sc-card-h">
        <div className="sc-card-title">Quick actions</div>
      </div>
      <div className="sc-card-b sc-grid" style={{ gap: 8 }}>
        {ACTIONS.map(a => (
          <Link key={a.to} to={a.to} className="sc-action">
            <span className="sc-action-l">{a.label}</span>
            <span className="sc-action-h sc-muted">{a.hint}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function OwnedResources({ max }: { max: number }) {
  const catalog = useApi(catalogApiRef);
  const identity = useApi(identityApiRef);
  const [rows, setRows] = useState<OwnedResource[]>();

  useEffect(() => {
    (async () => {
      const { ownershipEntityRefs } = await identity.getBackstageIdentity();
      const owned = new Set(ownershipEntityRefs);
      const res = await catalog.getEntities({ filter: { kind: 'Resource' } });
      setRows(
        res.items
          .filter(e => owned.has(String(e.spec?.owner ?? '')))
          .map(e => ({
            name: e.metadata.name,
            type: (e.spec?.type as string) ?? 'resource',
          })),
      );
    })();
  }, [catalog, identity]);

  return (
    <Card>
      <div className="sc-card-h">
        <div className="sc-card-title">Your resources</div>
      </div>
      {!rows && <div className="sc-card-b sc-muted">Loading…</div>}
      {rows && rows.length === 0 && (
        <div className="sc-card-b sc-muted">You don't own any resources yet.</div>
      )}
      {rows && rows.length > 0 && (
        <div className="sc-table-wrap"><table className="sc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {cap(rows, max).map(r => (
              <tr key={r.name}>
                <td>
                  <Link to={`/catalog/default/resource/${r.name}`} className="sc-link">
                    {r.name}
                  </Link>
                </td>
                <td className="sc-muted">{r.type}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </Card>
  );
}

function StandingRequests({ max }: { max: number }) {
  const requests = useApi(requestsApiRef);
  const [rows, setRows] = useState<Request[]>();

  useEffect(() => {
    requests
      .list({ mine: true })
      .then(rs => setRows(rs.filter(r => !isTerminal(r.state))));
  }, [requests]);

  return (
    <Card className="sc-span-2">
      <div className="sc-card-h">
        <div className="sc-card-title">Standing requests</div>
      </div>
      {!rows && <div className="sc-card-b sc-muted">Loading…</div>}
      {rows && rows.length === 0 && (
        <div className="sc-card-b sc-muted">No open requests.</div>
      )}
      {rows && rows.length > 0 && (
        <div className="sc-table-wrap"><table className="sc-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Resource</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {cap(rows, max).map(r => (
              <tr key={r.id}>
                <td>
                  <Link to={`/requests/${r.id}`} className="sc-link">
                    #{r.id}
                  </Link>
                </td>
                <td className="sc-cell-ellip">
                  {r.resourceType}/{r.resourceName}
                </td>
                <td>{stateBadge(r.state)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </Card>
  );
}

function PendingApprovals({ max }: { max: number }) {
  const requests = useApi(requestsApiRef);
  const [rows, setRows] = useState<Request[]>();

  useEffect(() => {
    // Only what this user may approve (admin: all; service owner: their teams').
    requests
      .list({ scope: 'approval', state: 'PENDING_APPROVAL' })
      .then(setRows);
  }, [requests]);

  return (
    <Card>
      <div className="sc-card-h">
        <div className="sc-card-title">Awaiting approval</div>
      </div>
      {!rows && <div className="sc-card-b sc-muted">Loading…</div>}
      {rows && rows.length === 0 && (
        <div className="sc-card-b sc-muted">Nothing waiting for approval.</div>
      )}
      {rows && rows.length > 0 && (
        <div className="sc-table-wrap"><table className="sc-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Resource</th>
              <th>Requester</th>
            </tr>
          </thead>
          <tbody>
            {cap(rows, max).map(r => (
              <tr key={r.id}>
                <td>
                  <Link to={`/requests/${r.id}`} className="sc-link">
                    #{r.id}
                  </Link>
                </td>
                <td>
                  {r.resourceType}/{r.resourceName}
                </td>
                <td className="sc-muted">{r.requester}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </Card>
  );
}

export function HomePage() {
  const config = useApi(configApiRef);
  const home = config.getOptionalConfig('platform.home');

  const title = home?.getOptionalString('title') ?? 'Home';
  const subtitle =
    home?.getOptionalString('subtitle') ?? 'Your resources and open requests';
  const sections = (home?.getOptionalStringArray('sections') as
    | Section[]
    | undefined) ?? [
    'quickActions',
    'ownedResources',
    'standingRequests',
    'pendingApprovals',
    'recentlyVisited',
    'favouriteTemplates',
  ];
  const maxItems = home?.getOptionalNumber('maxItems') ?? 8;

  return (
    <Page>
      <PageHeader title={title} subtitle={subtitle} actions={<TourButton />} />
      <div className="sc-grid-2">
        {sections.map(s => {
          switch (s) {
            case 'quickActions':
              return <QuickActions key={s} />;
            case 'ownedResources':
              return <OwnedResources key={s} max={maxItems} />;
            case 'standingRequests':
              return <StandingRequests key={s} max={maxItems} />;
            case 'pendingApprovals':
              return <PendingApprovals key={s} max={maxItems} />;
            case 'recentlyVisited':
              // 5, not maxItems: a longer list stops being "recent".
              return <RecentlyVisited key={s} max={5} />;
            case 'favouriteTemplates':
              // 6: beyond that it stops being a favourites list.
              return <FavouriteTemplates key={s} max={6} />;
            default:
              return null;
          }
        })}
      </div>
    </Page>
  );
}
