import { useEffect, useState } from 'react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
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
import { Entity } from '@backstage/catalog-model';
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

type ReplayTemplate = {
  path: string;
  resourceType: string;
  parameterPaths: ReadonlyMap<string, string>;
  resourceNamePath?: string;
  resourceNamesPath?: string;
};

const parameterPath = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  return /^\s*\$\{\{\s*parameters\.([\w.-]+)\s*\}\}\s*$/.exec(value)?.[1];
};

const setPath = (
  target: Record<string, unknown>,
  path: string,
  value: unknown,
) => {
  const parts = path.split('.');
  let current = target;
  for (const part of parts.slice(0, -1)) {
    const next = current[part];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
};

/** Read the reverse form mapping from a Template's request-submit step. */
export function replayTemplate(entity: Entity): ReplayTemplate | undefined {
  const spec = entity.spec as { steps?: unknown[] } | undefined;
  const step = spec?.steps?.find(candidate => {
    const value = candidate as { action?: unknown };
    return value?.action === 'platform:request:submit';
  }) as { input?: Record<string, unknown> } | undefined;
  if (!step?.input) return undefined;

  const input = step.input;
  const resourceType =
    entity.metadata.annotations?.['platform.io/resource-type'] ??
    (typeof input.resourceType === 'string' && !parameterPath(input.resourceType)
      ? input.resourceType
      : entity.metadata.name);
  const mappings = new Map<string, string>();
  if (input.params && typeof input.params === 'object') {
    for (const [storedKey, expression] of Object.entries(input.params)) {
      const path = parameterPath(expression);
      if (path) mappings.set(storedKey, path);
    }
  }
  const namespace = entity.metadata.namespace ?? 'default';
  return {
    path: `/create/templates/${encodeURIComponent(
      namespace,
    )}/${encodeURIComponent(entity.metadata.name)}`,
    resourceType,
    parameterPaths: mappings,
    resourceNamePath: parameterPath(input.resourceName),
    resourceNamesPath: parameterPath(input.resourceNames),
  };
}

/** Pick the closest Template when several templates submit one resource type. */
export function replayForRequest(
  request: Request,
  candidates: readonly ReplayTemplate[],
) {
  const keys = Object.keys(request.params);
  const score = (candidate: ReplayTemplate) => {
    const mapped = keys.filter(key => candidate.parameterPaths.has(key)).length;
    const unknown = keys.length - mapped;
    return mapped * 10 - unknown + (candidate.resourceNamePath ? 1 : 0);
  };
  return [...candidates].sort((a, b) => score(b) - score(a))[0];
}

export function startOverData(request: Request, template?: ReplayTemplate) {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(request.params)) {
    setPath(data, template?.parameterPaths.get(key) ?? key, value);
  }
  if (template?.resourceNamePath) {
    setPath(data, template.resourceNamePath, request.resourceName);
  }
  if (template?.resourceNamesPath && request.resourceNames) {
    setPath(data, template.resourceNamesPath, request.resourceNames);
  }
  return data;
}

export function RequestsPage() {
  const api = useApi(requestsApiRef);
  const catalog = useApi(catalogApiRef);
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab: Tab = TABS.some(t => t.id === requestedTab)
    ? (requestedTab as Tab)
    : 'mine';
  const [rows, setRows] = useState<Request[]>();
  const [error, setError] = useState<string>();
  const [replayTemplates, setReplayTemplates] = useState<
    ReadonlyMap<string, ReplayTemplate[]> | undefined
  >();

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
        const templates = new Map<string, ReplayTemplate[]>();
        for (const entity of items) {
          const replay = replayTemplate(entity);
          if (!replay) continue;
          templates.set(replay.resourceType, [
            ...(templates.get(replay.resourceType) ?? []),
            replay,
          ]);
        }
        setReplayTemplates(templates);
      })
      .catch(() => {
        if (live) setReplayTemplates(new Map());
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
                    {(() => {
                      const replay = replayForRequest(
                        r,
                        replayTemplates?.get(r.resourceType) ?? [],
                      );
                      if (!replay) {
                        return (
                          <span
                            className="sc-icon-link sc-icon-link-disabled"
                            aria-label={`Start over request #${r.id} unavailable`}
                            title={
                              replayTemplates
                                ? 'Template unavailable'
                                : 'Loading template…'
                            }
                          >
                            <ReplayIcon fontSize="small" />
                          </span>
                        );
                      }
                      /* A full navigation is intentional. Backstage's Stepper
                         reads formData only when it mounts; SPA reuse can keep
                         the empty state from the previous create route. */
                      return (
                        <button
                          type="button"
                          className="sc-icon-link"
                          aria-label={`Start over request #${r.id}`}
                          title="Start over with saved values"
                          onClick={async () => {
                            let data = startOverData(r, replay);
                            if (r.scaffolderTaskId) {
                              try {
                                const base = await discovery.getBaseUrl('scaffolder');
                                const response = await fetchApi.fetch(
                                  `${base}/v2/tasks/${encodeURIComponent(
                                    r.scaffolderTaskId,
                                  )}`,
                                );
                                if (response.ok) {
                                  const task = (await response.json()) as {
                                    spec?: { parameters?: Record<string, unknown> };
                                  };
                                  data = task.spec?.parameters ?? data;
                                }
                              } catch {
                                // Older/removed tasks still use request.params.
                              }
                            }
                            window.location.assign(startOverPath(replay.path, data));
                          }}
                        >
                          <ReplayIcon fontSize="small" />
                        </button>
                      );
                    })()}
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
