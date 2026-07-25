import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Link } from '@backstage/core-components';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import {
  Page,
  PageHeader,
  Card,
  Button,
  Dialog,
  Field,
  Input,
} from '@internal/plugin-platform-ui';
import { requestsApiRef } from '../api';

interface ResourceRow {
  name: string;
  type: string;
  owner: string;
  spec: Record<string, unknown>;
}

function toRow(e: Entity): ResourceRow {
  const def = (e.spec?.definition ?? {}) as { spec?: Record<string, unknown> };
  return {
    name: e.metadata.name,
    type: (e.spec?.type as string) ?? 'resource',
    owner: (e.spec?.owner as string) ?? '',
    spec: def.spec ?? {},
  };
}

export function ResourcesPage() {
  const catalog = useApi(catalogApiRef);
  const requests = useApi(requestsApiRef);
  const [rows, setRows] = useState<ResourceRow[]>();
  const [edit, setEdit] = useState<ResourceRow>();
  const [del, setDel] = useState<ResourceRow>();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<number>();

  useEffect(() => {
    catalog
      .getEntities({ filter: { kind: 'Resource' } })
      .then(res => setRows(res.items.map(toRow)));
  }, [catalog]);

  const openEdit = (r: ResourceRow) => {
    setEdit(r);
    setFields(
      Object.fromEntries(Object.entries(r.spec).map(([k, v]) => [k, String(v)])),
    );
  };

  const submitEdit = async () => {
    if (!edit) return;
    const req = await requests.create({
      kind: 'UPDATE',
      resourceType: edit.type,
      resourceName: edit.name,
      params: fields,
    });
    setEdit(undefined);
    setNotice(req.id);
  };

  const submitDelete = async () => {
    if (!del) return;
    const req = await requests.create({
      kind: 'DELETE',
      resourceType: del.type,
      resourceName: del.name,
      params: {},
    });
    setDel(undefined);
    setNotice(req.id);
  };

  return (
    <Page>
      <PageHeader
        title="Resources"
        subtitle="Catalog resources — edit / delete via approval"
      />
      {notice && (
        <div style={{ marginBottom: 12 }} className="sc">
          Request created —{' '}
          <Link to={`/requests/${notice}`} className="sc-link">
            #{notice}
          </Link>{' '}
          (pending approval).
        </div>
      )}
      <Card>
        <table className="sc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Owner</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map(r => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td>{r.type}</td>
                <td className="sc-muted">{r.owner}</td>
                <td>
                  <div
                    className="sc-row"
                    style={{ justifyContent: 'flex-end' }}
                  >
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDel(r)}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows && <div className="sc-card-b sc-muted">Loading…</div>}
      </Card>

      <Dialog
        open={!!edit}
        onClose={() => setEdit(undefined)}
        title={`Edit ${edit?.name}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setEdit(undefined)}>
              Cancel
            </Button>
            <Button onClick={submitEdit}>Request update</Button>
          </>
        }
      >
        {edit && Object.keys(fields).length === 0 && (
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
        open={!!del}
        onClose={() => setDel(undefined)}
        title={`Delete ${del?.name}?`}
        footer={
          <>
            <Button variant="outline" onClick={() => setDel(undefined)}>
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
    </Page>
  );
}
