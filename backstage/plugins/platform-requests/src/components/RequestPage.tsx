import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { useRouteRefParams } from '@backstage/frontend-plugin-api';
import {
  Content,
  Header,
  Page,
  Progress,
  StructuredMetadataTable,
  InfoCard,
} from '@backstage/core-components';
import { Button, Grid, TextField } from '@material-ui/core';
import { Request, isTerminal } from '@internal/plugin-platform-common';
import { requestsApiRef } from '../api';
import { requestRouteRef } from '../routes';
import { WorkflowGraph } from './WorkflowGraph';

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
      <Page themeId="tool">
        <Header title={`Request #${id}`} />
        <Content>{error ?? <Progress />}</Content>
      </Page>
    );
  }

  const pending = request.state === 'PENDING_APPROVAL';

  return (
    <Page themeId="tool">
      <Header
        title={`Request #${request.id}`}
        subtitle={`${request.kind} ${request.resourceType}/${request.resourceName}`}
      />
      <Content>
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <InfoCard title="Details">
              <StructuredMetadataTable
                metadata={{
                  state: request.state,
                  kind: request.kind,
                  type: request.resourceType,
                  resource: request.resourceName,
                  requester: request.requester,
                  policy: JSON.stringify(request.policy),
                  workflow: request.workflowName ?? '—',
                  phase: request.workflowPhase ?? '—',
                  params: JSON.stringify(request.params),
                }}
              />
            </InfoCard>
          </Grid>
          {request.workflowName && (
            <Grid item xs={12}>
              <InfoCard title={`Workflow — ${request.workflowName} (${request.workflowPhase ?? '…'})`}>
                <WorkflowGraph id={request.id} live={!isTerminal(request.state)} />
              </InfoCard>
            </Grid>
          )}
          <Grid item xs={12} md={5}>
            <InfoCard title="Approvals">
              {request.approvals.length === 0 && <>No decisions yet.</>}
              {request.approvals.map((a, i) => (
                <div key={i}>
                  <b>{a.approver}</b> {a.decision}
                  {a.note ? ` — ${a.note}` : ''}
                </div>
              ))}
              {pending && (
                <div style={{ marginTop: 16 }}>
                  <TextField
                    label="Note (optional)"
                    fullWidth
                    value={note}
                    onChange={e => setNote(e.target.value)}
                  />
                  <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    <Button
                      variant="contained"
                      color="primary"
                      disabled={busy}
                      onClick={() => decide('approve')}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outlined"
                      disabled={busy}
                      onClick={() => decide('reject')}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              )}
              {!pending && isTerminal(request.state) && (
                <div style={{ marginTop: 12 }}>This request is closed.</div>
              )}
              {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
            </InfoCard>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}
