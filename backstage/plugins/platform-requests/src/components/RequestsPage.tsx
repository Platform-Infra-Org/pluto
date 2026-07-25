import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Link } from '@backstage/core-components';
import { Page, PageHeader, Card, Badge } from '@internal/plugin-platform-ui';
import { Request, RequestState } from '@internal/plugin-platform-common';
import { requestsApiRef } from '../api';

/** ISO string -> locale date + time (e.g. "Jul 26, 2026, 3:04 PM"). */
export const formatTs = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

export function stateBadge(s: RequestState) {
  switch (s) {
    case 'PENDING_APPROVAL':
      return (
        <Badge tone="warning" dot>
          Pending approval
        </Badge>
      );
    case 'APPROVED':
    case 'IN_PROGRESS':
      return (
        <Badge tone="primary" dot>
          {s === 'APPROVED' ? 'Approved' : 'In progress'}
        </Badge>
      );
    case 'SUCCEEDED':
      return (
        <Badge tone="success" dot>
          Succeeded
        </Badge>
      );
    case 'FAILED':
      return (
        <Badge tone="destructive" dot>
          Failed
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge tone="muted" dot>
          Rejected
        </Badge>
      );
    default:
      return <Badge>{s}</Badge>;
  }
}

type Tab = 'mine' | 'approval' | 'all';

const TABS: { id: Tab; label: string }[] = [
  { id: 'mine', label: 'My requests' },
  { id: 'approval', label: 'For approval' },
  { id: 'all', label: 'All requests' },
];

// What each tab fetches. `approval` is always PENDING_APPROVAL; `all` is every
// state in the caller's scope (admin: everything; owner: their teams').
const FETCH: Record<Tab, { mine?: boolean; scope?: 'approval'; state?: string }> = {
  mine: { mine: true },
  approval: { scope: 'approval', state: 'PENDING_APPROVAL' },
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

export function RequestsPage() {
  const api = useApi(requestsApiRef);
  const [tab, setTab] = useState<Tab>('mine');
  const [rows, setRows] = useState<Request[]>();
  const [error, setError] = useState<string>();

  // Filters / sort (client-side, shared across tabs).
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<'ALL' | RequestState>('ALL');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');

  useEffect(() => {
    setRows(undefined);
    setError(undefined);
    api.list(FETCH[tab]).then(setRows).catch(e => setError(String(e)));
  }, [api, tab]);

  // The "For approval" tab is pending-only, so it has no state filter.
  const stateFilterEnabled = tab !== 'approval';

  const displayed = (rows ?? [])
    .filter(r => !stateFilterEnabled || stateFilter === 'ALL' || r.state === stateFilter)
    .filter(r => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.resourceType.toLowerCase().includes(q) ||
        r.resourceName.toLowerCase().includes(q) ||
        r.requester.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (sort === 'newest' ? b.id - a.id : a.id - b.id));

  const empty =
    tab === 'mine'
      ? "You haven't made any requests yet."
      : tab === 'approval'
      ? 'Nothing awaiting your approval.'
      : 'No requests in your scope.';

  return (
    <Page>
      <PageHeader title="Requests" subtitle="Resource requests + approvals" />
      <div className="sc-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`sc-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
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
            onChange={e => setStateFilter(e.target.value as 'ALL' | RequestState)}
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
        <div className="sc-table-wrap"><table className="sc-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Kind</th>
              <th>Type</th>
              <th>Resource</th>
              <th>Requester</th>
              <th>Created</th>
              <th>State</th>
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
                <td>{r.resourceName}</td>
                <td>{r.requester}</td>
                <td className="sc-muted">{formatTs(r.createdAt)}</td>
                <td>{stateBadge(r.state)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
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
