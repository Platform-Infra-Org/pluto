import { useCallback, useEffect, useState } from 'react';
import { useApi, identityApiRef } from '@backstage/core-plugin-api';
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
} from '@internal/plugin-platform-ui';
import { Request, isTerminal } from '@internal/plugin-platform-common';
import { requestsApiRef } from '../api';
import { requestRouteRef } from '../routes';
import { WorkflowGraph } from './WorkflowGraph';
import { stateBadge, formatTs } from './RequestsPage';

const ADMIN_GROUP = 'group:default/platform-admins';

export function RequestPage() {
  const api = useApi(requestsApiRef);
  const identity = useApi(identityApiRef);
  const { id } = useRouteRefParams(requestRouteRef);
  const [request, setRequest] = useState<Request>();
  const [myGroups, setMyGroups] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

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
  const resourceLink = request.resultRef
    ? request.resultRef.includes('://')
      ? request.resultRef
      : `/catalog/default/resource/${request.resultRef}`
    : undefined;
  // Only an admin, or a member of the owning service team, may decide it.
  const canApprove =
    myGroups.includes(ADMIN_GROUP) ||
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
            {request.approvals.length === 0 && (
              <div className="sc-muted">No decisions yet.</div>
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
