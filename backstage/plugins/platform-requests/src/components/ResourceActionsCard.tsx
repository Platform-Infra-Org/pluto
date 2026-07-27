import { useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Link } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Dialog,
  Field,
  Input,
} from '@internal/plugin-platform-ui';
import { requestsApiRef } from '../api';

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
  const [fields, setFields] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<number>();

  const type = (entity.spec?.type as string) ?? 'resource';
  const name = entity.metadata.name;

  // Load the resource's data (ref'd file or spec.resourceData) and offer its
  // scalar fields for editing.
  const openEdit = async () => {
    const data = await requests.getResourceData(name).catch(() => ({}));
    setFields(
      Object.fromEntries(
        Object.entries(data)
          .filter(([, v]) => v !== null && typeof v !== 'object')
          .map(([k, v]) => [k, String(v)]),
      ),
    );
    setEdit(true);
  };

  const submitEdit = async () => {
    const req = await requests.create({
      kind: 'UPDATE',
      resourceType: type,
      resourceName: name,
      params: fields,
    });
    setEdit(false);
    setNotice(req.id);
  };

  const submitDelete = async () => {
    const req = await requests.create({
      kind: 'DELETE',
      resourceType: type,
      resourceName: name,
      params: {},
    });
    setDel(false);
    setNotice(req.id);
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
          <Button size="sm" variant="destructive" onClick={() => setDel(true)}>
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
        {Object.keys(fields).length === 0 && (
          <div className="sc-muted">No editable spec fields.</div>
        )}
        {Object.keys(fields).map(k => (
          <Field key={k} label={k}>
            <Input
              value={fields[k]}
              onChange={e => setFields(f => ({ ...f, [k]: e.target.value }))}
            />
          </Field>
        ))}
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
        <div className="sc-muted">
          This raises a delete request for approval. On approval the workflow
          runs and the resource is removed from the catalog.
        </div>
      </Dialog>
    </Card>
  );
}
