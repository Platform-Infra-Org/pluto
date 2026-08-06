import { useCallback, useEffect, useState } from 'react';
import {
  useApi,
  identityApiRef,
  configApiRef,
} from '@backstage/core-plugin-api';
import { useRouteRefParams } from '@backstage/frontend-plugin-api';
import { Link } from '@backstage/core-components';
import {
  Page,
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  useTabActivity,
  EmptyState,
  HOURGLASS,
} from '@internal/plugin-platform-ui';
import {
  Request,
  isTerminal,
  approvalProgress,
} from '@internal/plugin-platform-common';
import { requestsApiRef } from '../api';
import { requestRouteRef } from '../routes';
import { WorkflowGraph } from './WorkflowGraph';
import { SuspendPanel } from './SuspendPanel';
import { stateBadge, formatTs } from './RequestsPage';

/**
 * Approvals as a segmented bar with the count beside it.
 *
 * The count is the point. An RPG never shows a bare HP bar — it shows 23/40 —
 * and that convention is also the accessible one: the number is readable by a
 * screen reader and by anyone who cannot separate a filled cell from an empty
 * one by colour.
 */
function ApprovalProgress({ request }: { request: Request }) {
  const { granted, required } = approvalProgress(request);
  return (
    <div className="sc-approvals">
      <div
        className="sc-approvals-bar"
        role="img"
        aria-label={`${granted} of ${required} approvals`}
      >
        {Array.from({ length: required }, (_, i) => (
          <span
            key={i}
            className={`sc-approvals-cell${i < granted ? ' filled' : ''}`}
          />
        ))}
      </div>
      <span className="sc-approvals-count">
        {granted}/{required} APPROVALS
      </span>
    </div>
  );
}

export function RequestPage() {
  const api = useApi(requestsApiRef);
  const identity = useApi(identityApiRef);
  const config = useApi(configApiRef);
  const adminGroups = config.getOptionalStringArray(
    'platform.rbac.adminGroups',
  ) ?? ['group:default/platform-admins'];
  const { id } = useRouteRefParams(requestRouteRef);
  const [request, setRequest] = useState<Request>();
  const [myGroups, setMyGroups] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  // While this request's workflow runs, the tab says so — the page is worth
  // leaving open and coming back to.
  useTabActivity(request?.state === 'IN_PROGRESS');

  const load = useCallback(() => {
    api.get(Number(id)).then(setRequest).catch(e => setError(String(e)));
  }, [api, id]);
  useEffect(load, [load]);

  useEffect(() => {
    identity
      .getBackstageIdentity()
      .then(i => setMyGroups(i.ownershipEntityRefs));
  }, [identity]);

  const decide = async (decision: 'approve' | 'reject') => {
    setBusy(true);
    setError(undefined);
    try {
      const updated = await (decision === 'approve'
        ? api.approve(Number(id), note || undefined)
        : api.reject(Number(id), note || undefined));
      setRequest(updated);
      setNote('');
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!request) {
    return (
      <Page>
        <PageHeader title={`Request #${id}`} />
        <div className="sc-muted">{error ?? 'Loading…'}</div>
      </Page>
    );
  }

  const pending = request.state === 'PENDING_APPROVAL';
  // Link to the created resource once the workflow reports it: a bare ref -> the
  // catalog entity page; anything with a scheme -> that URL.
  let resourceLink: string | undefined;
  if (request.resultRef) {
    resourceLink = request.resultRef.includes('://')
      ? request.resultRef
      : `/catalog/default/resource/${request.resultRef}`;
  }
  // Only an admin, or a member of the owning service team, may decide it.
  const canApprove =
    myGroups.some(g => adminGroups.includes(g)) ||
    (!!request.ownerGroup && myGroups.includes(request.ownerGroup));

  return (
    <Page>
      <PageHeader
        title={`Request #${request.id}`}
        subtitle={`${request.kind} · ${request.resourceType}/${request.resourceName}`}
        actions={stateBadge(request.state)}
      />
      {request.state === 'SUCCEEDED' && resourceLink && (
        <div className="sc-notice" style={{ marginBottom: 12 }}>
          ✓ Created resource:{' '}
          <Link to={resourceLink} className="sc-link">
            {request.resultRef}
          </Link>
        </div>
      )}
      <div className="sc-grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <Card>
          <CardHeader title="Details" />
          <CardBody>
            <dl className="sc-kv">
              <dt>State</dt>
              <dd>{request.state}</dd>
              <dt>Kind</dt>
              <dd>{request.kind}</dd>
              <dt>Type</dt>
              <dd>{request.resourceType}</dd>
              <dt>Resource</dt>
              <dd>{request.resourceName}</dd>
              <dt>Requester</dt>
              <dd>{request.requester}</dd>
              <dt>Owner team</dt>
              <dd>
                {request.ownerGroup
                  ? request.ownerGroup.split('/').pop()
                  : '— (admin only)'}
              </dd>
              <dt>Policy</dt>
              <dd>{JSON.stringify(request.policy)}</dd>
              <dt>Workflow</dt>
              <dd>{request.workflowName ?? '—'}</dd>
              <dt>Phase</dt>
              <dd>{request.workflowPhase ?? '—'}</dd>
              <dt>Created</dt>
              <dd>{formatTs(request.createdAt)}</dd>
              <dt>Updated</dt>
              <dd>{formatTs(request.updatedAt)}</dd>
              <dt>Params</dt>
              <dd>
                <code>{JSON.stringify(request.params)}</code>
              </dd>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Approvals" />
          <CardBody>
            <ApprovalProgress request={request} />
            {request.approvals.length === 0 && (
              <EmptyState
                sprite={HOURGLASS}
                title="No decisions"
                hint={
                  pending
                    ? 'Waiting on the owning service team or an admin.'
                    : 'This request was never decided.'
                }
              />
            )}
            {request.approvals.map((a, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <b>{a.approver}</b> {a.decision}
                {a.note ? ` — ${a.note}` : ''}
                <span className="sc-muted"> · {formatTs(a.at)}</span>
              </div>
            ))}
            {pending && canApprove && (
              <div style={{ marginTop: 14 }}>
                <Input
                  placeholder="Note (optional)"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
                <div className="sc-row" style={{ marginTop: 10 }}>
                  <Button disabled={busy} onClick={() => decide('approve')}>
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => decide('reject')}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            )}
            {pending && !canApprove && (
              <div className="sc-muted" style={{ marginTop: 10 }}>
                Only the owning service team or an admin can decide this request.
              </div>
            )}
            {!pending && isTerminal(request.state) && (
              <div className="sc-muted" style={{ marginTop: 10 }}>
                This request is closed.
              </div>
            )}
            {error && (
              <div
                style={{ color: 'hsl(var(--sc-destructive))', marginTop: 8 }}
              >
                {error}
              </div>
            )}
          </CardBody>
        </Card>

        {request.state === 'AWAITING_INPUT' &&
          (request.suspendedNodes?.length ?? 0) > 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <SuspendPanel
                requestId={request.id}
                nodes={request.suspendedNodes ?? []}
                canResume={canApprove}
                onResumed={load}
              />
            </div>
          )}

        {request.workflowName && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Card>
              <CardHeader
                title={`Workflow — ${request.workflowName}`}
                description={request.workflowPhase ?? undefined}
              />
              <CardBody>
                <WorkflowGraph
                  id={request.id}
                  live={!isTerminal(request.state)}
                />
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </Page>
  );
}
