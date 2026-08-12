import { useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Link } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  Card, CardHeader, CardBody, Button, Dialog, Field, Input, JsonTree,
  leavesOf, mergeDeepEdits, pathKey, type Leaf,
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
  // Every scalar in the document, at any depth, in document order. Held in
  // state rather than recomputed so the merge writes back against exactly the
  // shape the form was built from.
  const [leaves, setLeaves] = useState<Leaf[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<number>();

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
    const { data, errors: problems } = mergeDeepEdits(original, leaves, fields);
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
        {leaves.map(leaf => {
          const k = pathKey(leaf.path);
          // The label carries the whole path, so a field is identifiable
          // without hunting for which group it sits under; the leading
          // segments are dimmed so the leaf name still reads first.
          const parents = leaf.path.slice(0, -1);
          const own = leaf.path[leaf.path.length - 1];
          return (
            <div key={k} style={{ marginLeft: parents.length * 12 }}>
              <Field
                label={
                  <>
                    {parents.length > 0 && (
                      <span className="sc-muted">
                        {parents.map(p => `${p} / `).join('')}
                      </span>
                    )}
                    {String(own)}
                    {leaf.type !== 'string' && (
                      <span className="sc-muted"> ({leaf.type})</span>
                    )}
                  </>
                }
              >
                <Input
                  value={fields[k] ?? ''}
                  onChange={e =>
                    setFields(f => ({ ...f, [k]: e.target.value }))
                  }
                />
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
            </div>
          );
        })}
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
    </Card>
  );
}
