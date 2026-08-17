import { useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Button, Dialog, Input } from '@internal/plugin-platform-ui';
import { mayStopWorkflow } from '@internal/plugin-platform-common';
import { requestsApiRef } from '../api';

/**
 * Abandon the whole run.
 *
 * Distinct from the per-step *Refuse and stop* in the suspend panel, which asks
 * the step's own question. This one asks the request's: an admin, the owning
 * team, or whoever filed it. Argo cannot stop a single node either way — `/stop`
 * ends the workflow — so the two controls are the same call, told apart by
 * whether a `nodeId` goes with it.
 *
 * It lives beside the workflow graph rather than inside the suspend panel,
 * because a run is worth abandoning whenever it is still running, not only
 * while something happens to be waiting on a human. It is hidden once the state
 * is terminal: there is nothing left to stop, and the backend would record a
 * rejection against a request that already has an outcome.
 *
 * Behind a confirmation, because it throws away a run that may already have
 * provisioned something, and the reason field sits where an approval note sits
 * and reaches the same audit trail — stopping is recorded as a rejection,
 * because that is what refusing a request is.
 */
export function StopWorkflowButton({
  requestId,
  isAdmin,
  groups,
  actor,
  requester,
  ownerGroup,
  onStopped,
}: {
  requestId: number;
  /** Viewer is in one of `platform.rbac.adminGroups`. */
  isAdmin: boolean;
  /** The viewer's own group entityRefs. */
  groups: string[];
  /** The viewer's own short id, as the router records a requester. */
  actor: string;
  /** Who filed the request. */
  requester: string;
  /** The request's owning service team, if it has one. */
  ownerGroup?: string;
  onStopped: () => void;
}) {
  const api = useApi(requestsApiRef);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const gate = mayStopWorkflow({
    isAdmin,
    groups,
    actor,
    ownerGroup,
    requester,
  });
  if (!gate.allowed) return null;

  const stop = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await api.stop(requestId, note || undefined);
      setOpen(false);
      setNote('');
      onStopped();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* sc-btn-danger colours it on hover only: at rest it is one control among
          several beside the graph, and a permanently red button in a toolbar
          reads as an error state rather than as an action. */}
      <Button
        variant="outline"
        className="sc-btn-danger"
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        Stop workflow
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Stop this workflow?"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="sc-btn-danger" disabled={busy} onClick={stop}>
              {busy ? 'Working…' : 'Stop workflow'}
            </Button>
          </>
        }
      >
        <p>
          This ends the run rather than any one step. The workflow's own exit
          handlers still run, so what it already created is cleaned up, and the
          request lands in FAILED.
        </p>
        <Input
          placeholder="Reason (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
        {error && (
          <div className="sc-muted" style={{ marginTop: 10 }}>
            {error}
          </div>
        )}
      </Dialog>
    </>
  );
}
