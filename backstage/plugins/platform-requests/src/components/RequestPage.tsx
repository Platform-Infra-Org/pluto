import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { useRouteRefParams } from '@backstage/frontend-plugin-api';
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
import { stateBadge } from './RequestsPage';

export function RequestPage() {
  const api = useApi(requestsApiRef);
  const { id } = useRouteRefParams(requestRouteRef);
  const [request, setRequest] = useState<Request>();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(() => {
    api.get(Number(id)).then(setRequest).catch(e => setError(String(e)));
  }, [api, id]);
  useEffect(load, [load]);

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

  return (
    <Page>
      <PageHeader
        title={`Request #${request.id}`}
        subtitle={`${request.kind} · ${request.resourceType}/${request.resourceName}`}
        actions={stateBadge(request.state)}
      />
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
              <dt>Policy</dt>
              <dd>{JSON.stringify(request.policy)}</dd>
              <dt>Workflow</dt>
              <dd>{request.workflowName ?? '—'}</dd>
              <dt>Phase</dt>
              <dd>{request.workflowPhase ?? '—'}</dd>
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
              </div>
            ))}
            {pending && (
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
