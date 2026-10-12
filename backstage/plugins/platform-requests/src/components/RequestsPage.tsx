import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Link } from '@backstage/core-components';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import ReplayIcon from '@material-ui/icons/Replay';
import { useSearchParams } from 'react-router-dom';
import {
  Page,
  PageHeader,
  Card,
  Badge,
  PixelSprite,
  STATE_SPRITES,
} from '@internal/plugin-platform-ui';
import { Request, RequestState } from '@internal/plugin-platform-common';
import { requestsApiRef } from '../api';
import {
  titleOf,
  useResourceTitles,
  useUserDisplayNames,
} from '../useResourceTitles';

/** ISO string -> locale date + time (e.g. "Jul 26, 2026, 3:04 PM"). */
export const formatTs = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

/**
 * The state badge, with its sprite. The sprite is decoration on top of the
 * badge text — never instead of it, so the accessible name is unchanged. The
 * gear spins while a workflow is actually running.
 */
export const teamName = (group?: string) =>
  group
    ?.split('/')
    .pop()
    ?.replace(/[-_]/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase()) || 'Admins';

export function stateBadge(
  s: RequestState,
  ownerGroup?: string,
  inputGroup?: string,
) {
  // ownerGroup is copied from the catalog Template's spec.owner at creation.
  // inputGroup comes from the suspended WorkflowTemplate's approver annotation.
  const approverTeam = teamName(ownerGroup);
  const inputTeam = teamName(inputGroup ?? ownerGroup);
  const label: Record<RequestState, string> = {
    PENDING_APPROVAL: `Pending Approval by ${approverTeam}`,
    APPROVED: 'Approved',
    IN_PROGRESS: 'In progress',
    SUCCEEDED: 'Succeeded',
    FAILED: 'Failed',
    REJECTED: 'Rejected',
    AWAITING_INPUT: `Awaiting Input by ${inputTeam}`,
    EXPIRED: 'Expired',
  };
  const tone: Record<
    RequestState,
    'warning' | 'primary' | 'success' | 'destructive' | 'muted'
  > = {
    PENDING_APPROVAL: 'warning',
    APPROVED: 'primary',
    IN_PROGRESS: 'primary',
    SUCCEEDED: 'success',
    FAILED: 'destructive',
    REJECTED: 'muted',
    // Yellow, the same signal the suspended node carries in the graph.
    AWAITING_INPUT: 'warning',
    EXPIRED: 'muted',
  };
  const sprite = STATE_SPRITES[s];
  if (!sprite) return <Badge>{s}</Badge>;
  return (
    <span className="sc-state">
      <PixelSprite
        sprite={sprite}
        className={`sc-state-ic${s === 'IN_PROGRESS' ? ' spinning' : ''}`}
      />
      <Badge tone={tone[s]} dot>
        {label[s]}
      </Badge>
    </span>
  );
}

type Tab = 'mine' | 'approval' | 'all';

const TABS: { id: Tab; label: string }[] = [
  { id: 'mine', label: 'My requests' },
  { id: 'approval', label: 'For approval' },
  { id: 'all', label: 'All requests' },
];

// What each tab fetches. `approval` is what is waiting on the caller: requests
// they may approve, and requests parked at a suspend step they may answer
// (`scope=actionable`); `all` is every state in the caller's scope (admin:
// everything; otherwise their teams' — owned, or gated by the team).
const FETCH: Record<
  Tab,
  { mine?: boolean; scope?: 'approval' | 'actionable'; state?: string }
> = {
  mine: { mine: true },
  approval: { scope: 'actionable' },
  all: { scope: 'approval' },
};

const STATES: RequestState[] = [
  'PENDING_APPROVAL',
  'APPROVED',
  'IN_PROGRESS',
  'SUCCEEDED',
  'FAILED',
  'REJECTED',
];

const human = (s: string) =>
  s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export function startOverPath(
  templatePath: string,
  params: Record<string, unknown>,
) {
  const query = new URLSearchParams({ formData: JSON.stringify(params) });
  return `${templatePath}?${query.toString()}`;
}

export function RequestsPage() {
  const api = useApi(requestsApiRef);
  const catalog = useApi(catalogApiRef);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab: Tab = TABS.some(t => t.id === requestedTab)
    ? (requestedTab as Tab)
    : 'mine';
  const [rows, setRows] = useState<Request[]>();
  const [error, setError] = useState<string>();
  const [templatePaths, setTemplatePaths] = useState<
    ReadonlyMap<string, string>
  >(new Map());

  // Filters / sort (client-side, shared across tabs).
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<'ALL' | RequestState>('ALL');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');

  useEffect(() => {
    setRows(undefined);
    setError(undefined);
    api
      .list(FETCH[tab])
      .then(setRows)
      .catch(e => setError(String(e)));
  }, [api, tab]);

  // Resolve the same resource-type annotation the backend uses to find a
  // request's owning Template. This keeps Start Over generic when the Template
  // name and resource type differ.
  useEffect(() => {
    let live = true;
    catalog
      .getEntities({ filter: { kind: 'Template' } })
      .then(({ items }) => {
        if (!live) return;
        const paths = new Map<string, string>();
        for (const entity of items) {
          const resourceType =
            entity.metadata.annotations?.['platform.io/resource-type'] ??
            entity.metadata.name;
          const namespace = entity.metadata.namespace ?? 'default';
          if (!paths.has(resourceType)) {
            paths.set(
              resourceType,
              `/create/templates/${encodeURIComponent(
                namespace,
              )}/${encodeURIComponent(entity.metadata.name)}`,
            );
          }
        }
        setTemplatePaths(paths);
      })
      .catch(() => {
        if (live) setTemplatePaths(new Map());
      });
    return () => {
      live = false;
    };
  }, [catalog]);

  // The "For approval" tab is two fixed states, so it has no state filter.
  const stateFilterEnabled = tab !== 'approval';

  // Fed from `rows`, not `displayed`: the filter reads titles, so looking them
  // up from the filtered set would make the two circular.
  const titles = useResourceTitles((rows ?? []).map(r => r.resourceName));
  const requesterNames = useUserDisplayNames(
    (rows ?? []).map(r => r.requester),
  );

  const displayed = (rows ?? [])
    .filter(
      r =>
        !stateFilterEnabled || stateFilter === 'ALL' || r.state === stateFilter,
    )
    .filter(r => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      // Title *or* name. The name still matches because that is what appears in
      // Argo logs and tickets — arriving with one in hand must find its request.
      //
      // The loading window is deliberate: until the titles land this matches
      // names only, so a title typed in the first moment returns nothing and
      // then fills in. The alternative is blocking the whole table on a catalog
      // call, which is a worse trade for the common case.
      return (
        r.resourceType.toLowerCase().includes(q) ||
        r.resourceName.toLowerCase().includes(q) ||
        (titles.get(r.resourceName)?.toLowerCase().includes(q) ?? false) ||
        r.requester.toLowerCase().includes(q) ||
        (requesterNames.get(r.requester)?.toLowerCase().includes(q) ?? false)
      );
    })
    .sort((a, b) => (sort === 'newest' ? b.id - a.id : a.id - b.id));

  const EMPTY_MESSAGE: Record<string, string> = {
    mine: "You haven't made any requests yet.",
    approval: 'Nothing awaiting your approval.',
  };
  const empty = EMPTY_MESSAGE[tab] ?? 'No requests in your scope.';

  return (
    <Page>
      <PageHeader title="Requests" subtitle="Resource requests + approvals" />
      <div className="sc-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`sc-tab${tab === t.id ? ' active' : ''}`}
            onClick={() =>
              setSearchParams(t.id === 'mine' ? {} : { tab: t.id })
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="sc-toolbar">
        <input
          className="sc-input"
          placeholder="Search resource, type, requester…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {stateFilterEnabled && (
          <select
            className="sc-select"
            value={stateFilter}
            onChange={e =>
              setStateFilter(e.target.value as 'ALL' | RequestState)
            }
          >
            <option value="ALL">All states</option>
            {STATES.map(s => (
              <option key={s} value={s}>
                {human(s)}
              </option>
            ))}
          </select>
        )}
        <select
          className="sc-select"
          value={sort}
          onChange={e => setSort(e.target.value as 'newest' | 'oldest')}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      <Card>
        <div className="sc-table-wrap">
          <table className="sc-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Kind</th>
                <th>Type</th>
                <th>Resource</th>
                <th>Requester</th>
                <th>Created</th>
                <th>State</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {displayed.map(r => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/requests/${r.id}`} className="sc-link">
                      #{r.id}
                    </Link>
                  </td>
                  <td>{r.kind}</td>
                  <td>{r.resourceType}</td>
                  {/* The tooltip keeps the name reachable: it is the row's only
                    remaining exposure of the addressable id. */}
                  <td title={r.resourceName}>
                    {r.resourceNames
                      ? `${r.resourceNames.length} resources`
                      : titleOf(r.resourceName, titles)}
                  </td>
                  <td title={r.requester}>
                    {requesterNames.get(r.requester) ?? r.requester}
                  </td>
                  <td className="sc-muted">{formatTs(r.createdAt)}</td>
                  <td>
                    {stateBadge(
                      r.state,
                      r.ownerGroup,
                      r.suspendedNodes?.[0]?.approverGroup,
                    )}
                  </td>
                  <td className="sc-table-action">
                    <Link
                      to={startOverPath(
                        templatePaths.get(r.resourceType) ?? '/create',
                        r.params,
                      )}
                      className="sc-icon-link"
                      aria-label={`Start over request #${r.id}`}
                      title="Start over"
                    >
                      <ReplayIcon fontSize="small" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error && <div className="sc-card-b sc-muted">{error}</div>}
        {rows && displayed.length === 0 && (
          <div className="sc-card-b sc-muted">
            {rows.length === 0 ? empty : 'No requests match the filter.'}
          </div>
        )}
        {!rows && !error && <div className="sc-card-b sc-muted">Loading…</div>}
      </Card>
    </Page>
  );
}
