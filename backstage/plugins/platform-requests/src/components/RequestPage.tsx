import { useCallback, useEffect, useState } from 'react';
import {
  useApi,
  identityApiRef,
  configApiRef,
} from '@backstage/core-plugin-api';
import { useRouteRefParams } from '@backstage/frontend-plugin-api';
import { Link } from '@backstage/core-components';
import { useNavigate } from 'react-router-dom';
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
  JsonTree,
  GraphDirectionPicker,
  useGraphDirection,
  HOURGLASS,
  GrafanaFrame,
  requestDashboardUrl,
} from '@internal/plugin-platform-ui';
import {
  Request,
  isTerminal,
  isDeletable,
  approvalProgress,
  catalogPath, actorIdOf } from '@internal/plugin-platform-common';
import { RefreshResult, requestsApiRef } from '../api';
import { requestRouteRef } from '../routes';
import { useCatalogNamespace } from '../useCatalogNamespace';
import { titleOf, useResourceTitles } from '../useResourceTitles';
import { parseResultRefs } from '../resultRefs';
import { argoWorkflowUrl } from '../argoUrl';
import { WorkflowGraph } from './WorkflowGraph';
import { StopWorkflowButton } from './StopWorkflowButton';
import { SuspendPanel } from './SuspendPanel';
import { ExperienceBar } from './ExperienceBar';
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

/**
 * One sentence per outcome of a re-check. The button must say what it found
 * even when it found nothing — a control that returns silently invites a
 * second click.
 */
const RECHECK_SAID: Record<RefreshResult['reason'], string> = {
  'moved-to-in-progress': 'The workflow is running again — tracking it here.',
  'moved-to-awaiting-input': 'The workflow is waiting for an approver again.',
  'moved-to-succeeded': 'The workflow finished successfully.',
  'still-failed': 'The workflow is still failed.',
  'workflow-gone':
    'The workflow no longer exists in Argo — it was cleaned up, so there is nothing left to track.',
  'not-failed': 'Nothing to do — this request is not failed.',
};

export function RequestPage() {
  const api = useApi(requestsApiRef);
  const identity = useApi(identityApiRef);
  const config = useApi(configApiRef);
  const adminGroups = config.getOptionalStringArray(
    'platform.rbac.adminGroups',
  ) ?? ['group:default/platform-admins'];
  const argoUiUrl = config.getOptionalString('platform.argo.uiUrl');
  const namespace = useCatalogNamespace();
  const { id } = useRouteRefParams(requestRouteRef);
  const [request, setRequest] = useState<Request>();
  // Owned here rather than inside the graph, so its control can sit in the card
  // header opposite the title instead of floating above the canvas.
  const [workflowDirection, setWorkflowDirection] = useGraphDirection(
    'platform-workflow-dir',
    'LR',
  );
  const [myGroups, setMyGroups] = useState<string[]>([]);
  // The viewer's own user entityRef. Stopping a run asks whether you filed it,
  // which group membership cannot answer.
  const [me, setMe] = useState<string>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // What the last re-check said, already rendered as a sentence. Kept as text
  // rather than a reason code because it must survive the state moving off
  // FAILED — that is the case where the user most needs to be told why the
  // button just vanished.
  const [recheckSaid, setRecheckSaid] = useState<string>();
  // Deleting is the one irreversible thing this page can do, so it takes two
  // deliberate clicks rather than a modal — the confirmation reads in place,
  // beside the record it is about to destroy.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();

  // While this request's workflow runs, the tab says so — the page is worth
  // leaving open and coming back to.
  useTabActivity(request?.state === 'IN_PROGRESS');

  const load = useCallback(() => {
    api.get(Number(id)).then(setRequest).catch(e => setError(String(e)));
  }, [api, id]);
  useEffect(load, [load]);

  // Poll while the request is still moving. Without this the page is a
  // snapshot from whenever it was opened: a workflow could suspend, be
  // resumed and finish while the badge still said IN_PROGRESS, and anything
  // watching for a state change — the experience bar's level-up — would never
  // see one. Stops as soon as the request settles.
  useEffect(() => {
    if (!request || isTerminal(request.state)) return undefined;
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [load, request]);

  useEffect(() => {
    identity
      .getBackstageIdentity()
      .then(i => {
        setMyGroups(i.ownershipEntityRefs);
        // Normalised the same way the router stores it — a raw entityRef would
        // never match and would deny the requester their own Stop button.
        setMe(actorIdOf(i.userEntityRef));
      });
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

  // On success the page it is standing on no longer exists, so it leaves for
  // the list rather than re-reading a 404. `busy` is deliberately not cleared
  // on that path — the component is on its way out.
  const remove = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await api.delete(Number(id));
      navigate('/requests');
    } catch (e) {
      setError(String(e));
      setConfirmDelete(false);
      setBusy(false);
    }
  };

  // Re-read the workflow in Argo. This never restarts anything: it only asks
  // the backend to look again, for the case where an operator retried the
  // workflow by hand. Setting the returned request updates the badge at once,
  // and if the state moved off FAILED the page's existing poll takes over.
  const recheck = async () => {
    setBusy(true);
    setRecheckSaid(undefined);
    try {
      const res = await api.refresh(Number(id));
      setRequest(res.request);
      const said: string | undefined = RECHECK_SAID[res.reason];
      setRecheckSaid(said ?? `The workflow was re-checked (${res.reason}).`);
    } catch (e) {
      setRecheckSaid(`Could not re-check the workflow: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  // Every catalog name this page shows, resolved to titles in **one** call:
  // the resource(s) the request acts on plus the ref(s) the workflow reported.
  // Above the loading return because it is a hook, and harmless there — an
  // empty list never calls the catalog.
  const resultRefs = parseResultRefs(request?.resultRef);
  const resourceNames =
    request?.resourceNames ?? (request ? [request.resourceName] : []);
  const titles = useResourceTitles([...resourceNames, ...resultRefs]);

  /**
   * A result ref as a link: the catalog entity page for a bare name, the URL
   * itself for anything carrying a scheme. The href is always name-based —
   * only the text becomes the title — and `title` keeps the addressable name
   * one hover away.
   */
  const refLink = (ref: string) =>
    ref.includes('://') ? (
      <Link key={ref} to={ref} className="sc-link">
        {ref}
      </Link>
    ) : (
      <Link
        key={ref}
        to={catalogPath(namespace, 'resource', ref)}
        className="sc-link"
        title={ref}
      >
        {titleOf(ref, titles)}
      </Link>
    );

  if (!request) {
    return (
      <Page>
        <PageHeader title={`Request #${id}`} />
        <div className="sc-muted">{error ?? 'Loading…'}</div>
      </Page>
    );
  }

  const pending = request.state === 'PENDING_APPROVAL';
  // Undefined whenever the Argo UI is not configured or the request has no
  // workflow yet — both render the name as the plain text it always was.
  const workflowUrl = argoWorkflowUrl(
    argoUiUrl,
    request.workflowNamespace,
    request.workflowName,
  );
  // Only an admin, or a member of the owning service team, may decide it.
  const isAdmin = myGroups.some(g => adminGroups.includes(g));
  const canApprove =
    isAdmin || (!!request.ownerGroup && myGroups.includes(request.ownerGroup));

  return (
    <Page>
      <PageHeader
        title={`Request #${request.id}`}
        subtitle={`${request.kind} · ${request.resourceType}/${titleOf(
          request.resourceName,
          titles,
        )}`}
        actions={stateBadge(request.state)}
      />
      {request.state === 'SUCCEEDED' && resultRefs.length > 0 && (
        <div className="sc-notice" style={{ marginBottom: 12 }}>
          {/* One ref reads as a sentence; several need the count up front and
              a list, because the count is what the reader is checking. */}
          {resultRefs.length === 1 ? (
            <>✓ Created resource: {refLink(resultRefs[0])}</>
          ) : (
            <>
              ✓ Created {resultRefs.length} resources:
              <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                {resultRefs.map(ref => (
                  <li key={ref}>{refLink(ref)}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {/* Gated on the state as well as the message: rows written before the
          store enforced "a succeeded request has no error" are still in the
          database, and this is what stops them rendering without a migration. */}
      {request.state === 'FAILED' && request.error && (
        <div className="sc-notice sc-notice-fail" style={{ marginBottom: 12 }}>
          <strong>Failed:</strong> {request.error}
        </div>
      )}
      {/* Rendered while failed, and afterwards for as long as there is an
          outcome to show — a re-check that moved the request would otherwise
          take its own answer off the screen with it. */}
      {(request.state === 'FAILED' || recheckSaid) && (
        <div style={{ marginBottom: 12 }}>
          {request.state === 'FAILED' && (
            <div className="sc-row">
              <Button variant="outline" disabled={busy} onClick={recheck}>
                Re-check status
              </Button>
              <span className="sc-muted">
                Re-reads the workflow in Argo. It does not restart anything.
              </span>
            </div>
          )}
          {recheckSaid && (
            <div className="sc-muted" style={{ marginTop: 8 }}>
              {recheckSaid}
            </div>
          )}
        </div>
      )}
      {request.workflowName && (
        <ExperienceBar
          requestId={request.id}
          state={request.state}
          live={!isTerminal(request.state)}
        />
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
              <dt>{request.resourceNames ? 'Resources' : 'Resource'}</dt>
              <dd>
                {request.resourceNames ? (
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {/* `title` because the name is the addressable id — it is
                        what appears in Argo logs and tickets, and the title
                        that replaces it here is not. */}
                    {request.resourceNames.map(n => (
                      <li key={n} title={n}>
                        {titleOf(n, titles)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span title={request.resourceName}>
                    {titleOf(request.resourceName, titles)}
                  </span>
                )}
              </dd>
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
              <dd>
                {workflowUrl ? (
                  <Link to={workflowUrl} className="sc-link">
                    {request.workflowName}
                  </Link>
                ) : (
                  (request.workflowName ?? '—')
                )}
              </dd>
              <dt>Phase</dt>
              <dd>{request.workflowPhase ?? '—'}</dd>
              <dt>Created</dt>
              <dd>{formatTs(request.createdAt)}</dd>
              <dt>Updated</dt>
              <dd>{formatTs(request.updatedAt)}</dd>
              <dt>Params</dt>
              <dd>
                {/* The tree rather than a stringified one-liner: a template
                    that dumps an object into a single param produced an
                    unreadable escaped string that ran off the card's edge.
                    JsonTree collapses it, parses an embedded document into a
                    subtree, and offers raw/parsed. */}
                <JsonTree data={request.params} />
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
              {/* Not `canApprove`: a suspend step may name its own approving
                  team, so the panel decides node by node. */}
              <SuspendPanel
                requestId={request.id}
                nodes={request.suspendedNodes ?? []}
                isAdmin={isAdmin}
                groups={myGroups}
                ownerGroup={request.ownerGroup}
                onResumed={load}
              />
            </div>
          )}

        {request.workflowName && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Card>
              <CardHeader
                title={
                  <>
                    Workflow —{' '}
                    {workflowUrl ? (
                      <Link to={workflowUrl} className="sc-link">
                        {request.workflowName}
                      </Link>
                    ) : (
                      request.workflowName
                    )}
                  </>
                }
                description={request.workflowPhase ?? undefined}
                action={
                  // Beside the direction picker, and present for as long as the
                  // run is: stopping used to live in the suspend panel, so it
                  // existed only while something happened to be waiting on a
                  // human. A workflow is worth abandoning whenever it is still
                  // going. Gone once the state is terminal — there is nothing
                  // left to stop, and the backend would record a rejection
                  // against a request that already has an outcome.
                  <div className="sc-row">
                    <GraphDirectionPicker
                      value={workflowDirection}
                      onChange={setWorkflowDirection}
                      id="workflow-dir"
                    />
                    {!isTerminal(request.state) && (
                      <StopWorkflowButton
                        requestId={request.id}
                        isAdmin={isAdmin}
                        groups={myGroups}
                        actor={me}
                        requester={request.requester}
                        ownerGroup={request.ownerGroup}
                        onStopped={load}
                      />
                    )}
                  </div>
                }
              />
              <CardBody>
                <WorkflowGraph
                  direction={workflowDirection}
                  id={request.id}
                  live={!isTerminal(request.state)}
                />
              </CardBody>
            </Card>
          </div>
        )}

        {/* Bound to this request's own timestamps rather than a bookmarked
            dashboard: the window is exactly what happened while the workflow
            ran. Three independent reasons not to render, all readable here:
            no workflow has shown up yet, the state says there is nothing to
            plot, or platform.grafana.requests is off / absent. */}
        {request.workflowName &&
          ['IN_PROGRESS', 'AWAITING_INPUT', 'SUCCEEDED', 'FAILED'].includes(
            request.state,
          ) &&
          (() => {
            const target = requestDashboardUrl(config, {
              requestId: request.id,
              resourceName: request.resourceName,
              resourceType: request.resourceType,
              requester: request.requester,
              workflowName: request.workflowName,
              workflowNamespace: request.workflowNamespace,
              from: String(new Date(request.createdAt).getTime()),
              to: String(new Date(request.updatedAt).getTime()),
            });
            if (!target) return null;
            return (
              <div style={{ gridColumn: '1 / -1' }}>
                <Card>
                  <CardHeader title="Metrics" />
                  <CardBody>
                    <GrafanaFrame
                      target={target}
                      title={`Metrics for request #${request.id}`}
                      height={420}
                    />
                  </CardBody>
                </Card>
              </div>
            );
          })()}

        {/* Last on the page on purpose: you scroll past the whole record —
            params, approvals, workflow — before you reach the thing that
            destroys it. Only shown for states whose workflow cannot still be
            live; the backend refuses the rest regardless. */}
        {canApprove && isDeletable(request.state) && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Card>
              <CardHeader
                title="Delete this request"
                description="Removes the request and its approval history. This cannot be undone."
              />
              <CardBody>
                {confirmDelete ? (
                  <div className="sc-row">
                    <Button
                      variant="destructive"
                      disabled={busy}
                      onClick={remove}
                    >
                      Yes, delete request #{request.id}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete request
                  </Button>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </Page>
  );
}
