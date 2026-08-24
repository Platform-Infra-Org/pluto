import { useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Link } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  Card, CardHeader, CardBody, Button, Dialog, JsonTree, JsonEditTree,
  leavesOf, mergeDeepEdits, pathKey, useMaintenance, useIsAdmin, type Leaf,
} from '@internal/plugin-platform-ui';
import { requestsApiRef } from '../api';

// `RequestsClient.create` throws `Error('${status}: ${body}')` on a non-ok
// response (see `api.ts`'s `json()`). The pre-flight `blocked` check above is
// only ever an optimisation — this is the actual source of truth, since it
// reads the response the backend just sent for *this* request, not a flag
// fetched once whenever the page happened to load.
function isMaintenance503(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith('503');
}

/**
 * Entity card (Resource pages): raise an edit/delete request for the current
 * catalog resource, right where it lives. Both go through the approval flow —
 * on approval an Argo workflow applies the change to the catalog repo.
 */
export function ResourceActionsCard() {
  const { entity } = useEntity();
  const requests = useApi(requestsApiRef);
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const [original, setOriginal] = useState<Record<string, unknown>>({});
  const [fields, setFields] = useState<Record<string, string>>({});
  // Every scalar in the document, at any depth, in document order. Held in
  // state rather than recomputed so the merge writes back against exactly the
  // shape the form was built from.
  const [leaves, setLeaves] = useState<Leaf[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<number>();
  const [maint, setMaint] = useState(false);

  const maintenance = useMaintenance();
  const isAdmin = useIsAdmin();
  // Same rule as MaintenanceGate: undefined (still loading) behaves like
  // non-admin, so nothing is submitted into the 503 while identity resolves.
  // This is only ever a pre-flight optimisation to skip a pointless round
  // trip — `useMaintenance` fetches once on mount and never refetches, so a
  // page left open across someone else flipping the switch would have a
  // stale `false` here. The backend's actual 503 (caught below, in
  // `submitEdit`/`submitDelete`) is what the dialog really depends on.
  const blocked = Boolean(maintenance) && !isAdmin;

  const type = (entity.spec?.type as string) ?? 'resource';
  const name = entity.metadata.name;

  // Load the resource's full data and offer every scalar for editing, however
  // deep. `original` is kept so submit merges over the whole document rather
  // than replacing it with what the form showed.
  const openEdit = async () => {
    const data = await requests.getResourceData(name).catch(() => ({}));
    const ls = leavesOf(data);
    setOriginal(data);
    setLeaves(ls);
    setFields(Object.fromEntries(ls.map(l => [pathKey(l.path), l.value])));
    setErrors({});
    setEdit(true);
  };

  const submitEdit = async () => {
    if (blocked) {
      setEdit(false);
      setMaint(true);
      return;
    }
    const { data, errors: problems } = mergeDeepEdits(original, leaves, fields);
    if (Object.keys(problems).length) {
      setErrors(problems);
      return;
    }
    try {
      const req = await requests.create({
        kind: 'UPDATE',
        resourceType: type,
        resourceName: name,
        params: data,
      });
      setEdit(false);
      setNotice(req.id);
    } catch (e) {
      // Only a 503 gets a dialog. Anything else is left exactly as it was
      // before this fix existed — this card has never had a general error
      // display, so there is nothing new to show for it — but caught rather
      // than left as an unhandled rejection, same as `getResourceData`
      // above.
      if (isMaintenance503(e)) {
        setEdit(false);
        setMaint(true);
      }
    }
  };

  const submitDelete = async () => {
    if (blocked) {
      setDel(false);
      setMaint(true);
      return;
    }
    try {
      const req = await requests.create({
        kind: 'DELETE',
        resourceType: type,
        resourceName: name,
        params: {},
      });
      setDel(false);
      setNotice(req.id);
    } catch (e) {
      // See submitEdit's catch — only a 503 gets a dialog.
      if (isMaintenance503(e)) {
        setDel(false);
        setMaint(true);
      }
    }
  };

  return (
    <Card className="sc">
      <CardHeader
        title="Manage resource"
        description="Changes go through approval, then an Argo workflow."
      />
      <CardBody>
        {notice && (
          <div style={{ marginBottom: 12 }}>
            Request created —{' '}
            <Link to={`/requests/${notice}`} className="sc-link">
              #{notice}
            </Link>{' '}
            (pending approval).
          </div>
        )}
        <div className="sc-row">
          <Button size="sm" variant="outline" onClick={openEdit}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={async () => {
              const data = await requests.getResourceData(name).catch(() => ({}));
              setOriginal(data);
              setDel(true);
            }}
          >
            Delete
          </Button>
        </div>
      </CardBody>

      <Dialog
        open={edit}
        onClose={() => setEdit(false)}
        title={`Edit ${name}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setEdit(false)}>
              Cancel
            </Button>
            <Button onClick={submitEdit}>Request update</Button>
          </>
        }
      >
        <JsonEditTree
          data={original}
          leaves={leaves}
          fields={fields}
          errors={errors}
          onChange={(k, v) => setFields(f => ({ ...f, [k]: v }))}
        />
        {leaves.length === 0 && (
          <div className="sc-muted">This resource has no data to edit.</div>
        )}
      </Dialog>

      <Dialog
        open={del}
        onClose={() => setDel(false)}
        title={`Delete ${name}?`}
        footer={
          <>
            <Button variant="outline" onClick={() => setDel(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitDelete}>
              Request delete
            </Button>
          </>
        }
      >
        {Object.keys(original).length > 0 && (
          <>
            <div className="sc-muted" style={{ marginBottom: 8 }}>
              This resource's data:
            </div>
            <JsonTree data={original} />
          </>
        )}
        <div className="sc-muted">
          This raises a delete request for approval. On approval the workflow
          runs and the resource is removed from the catalog.
        </div>
      </Dialog>

      <Dialog
        open={maint}
        onClose={() => setMaint(false)}
        title="Maintenance"
        footer={<Button onClick={() => setMaint(false)}>Close</Button>}
      >
        {/* Same copy as MaintenancePage — the two surfaces must agree. */}
        <p className="sc-muted">
          New requests are paused while the platform is being worked on.
          Anything already filed is unaffected.
        </p>
      </Dialog>
    </Card>
  );
}
