import { useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Link } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  Card, CardHeader, CardBody, Button, Dialog, Field, Input, Textarea,
  mergeResourceEdits,
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
  const [original, setOriginal] = useState<Record<string, unknown>>({});
  const [fields, setFields] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<number>();

  const type = (entity.spec?.type as string) ?? 'resource';
  const name = entity.metadata.name;

  // Load the resource's full data and offer every key for editing — scalars as
  // inputs, objects and arrays as JSON. `original` is kept so submit merges over
  // the whole document rather than replacing it with what the form showed.
  const openEdit = async () => {
    const data = await requests.getResourceData(name).catch(() => ({}));
    setOriginal(data);
    setFields(
      Object.fromEntries(
        Object.entries(data).map(([k, v]) => [
          k,
          v !== null && typeof v === 'object'
            ? JSON.stringify(v, null, 2)
            : String(v),
        ]),
      ),
    );
    setErrors({});
    setEdit(true);
  };

  const submitEdit = async () => {
    const { data, errors: problems } = mergeResourceEdits(original, fields);
    if (Object.keys(problems).length) {
      setErrors(problems);
      return;
    }
    const req = await requests.create({
      kind: 'UPDATE',
      resourceType: type,
      resourceName: name,
      params: data,
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
        {Object.keys(fields).map(k => {
          const multiline =
            original[k] !== null && typeof original[k] === 'object';
          return (
            <Field key={k} label={k}>
              {multiline ? (
                <Textarea
                  value={fields[k]}
                  onChange={e =>
                    setFields(f => ({ ...f, [k]: e.target.value }))
                  }
                />
              ) : (
                <Input
                  value={fields[k]}
                  onChange={e =>
                    setFields(f => ({ ...f, [k]: e.target.value }))
                  }
                />
              )}
              {errors[k] && (
                <div
                  role="alert"
                  style={{
                    color: 'hsl(var(--sc-destructive))',
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
                  {errors[k]}
                </div>
              )}
            </Field>
          );
        })}
        {Object.keys(fields).length === 0 && (
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
        <div className="sc-muted">
          This raises a delete request for approval. On approval the workflow
          runs and the resource is removed from the catalog.
        </div>
      </Dialog>
    </Card>
  );
}
