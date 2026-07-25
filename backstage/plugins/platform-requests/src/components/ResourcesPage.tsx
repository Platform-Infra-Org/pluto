import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import {
  Content,
  Header,
  Link,
  Page,
  Progress,
  Table,
  TableColumn,
} from '@backstage/core-components';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@material-ui/core';
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
  const [notice, setNotice] = useState<{ id: number } | string>();

  const load = () =>
    catalog
      .getEntities({ filter: { kind: 'Resource' } })
      .then(res => setRows(res.items.map(toRow)));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = (r: ResourceRow) => {
    setEdit(r);
    setFields(
      Object.fromEntries(
        Object.entries(r.spec).map(([k, v]) => [k, String(v)]),
      ),
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
    setNotice({ id: req.id });
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
    setNotice({ id: req.id });
  };

  const columns: TableColumn<ResourceRow>[] = [
    { title: 'Name', field: 'name' },
    { title: 'Type', field: 'type' },
    { title: 'Owner', field: 'owner' },
    {
      title: 'Actions',
      render: r => (
        <>
          <Button size="small" onClick={() => openEdit(r)}>
            Edit
          </Button>
          <Button size="small" color="secondary" onClick={() => setDel(r)}>
            Delete
          </Button>
        </>
      ),
    },
  ];

  return (
    <Page themeId="home">
      <Header title="Resources" subtitle="Catalog resources — edit / delete via approval" />
      <Content>
        {notice && typeof notice === 'object' && (
          <Typography style={{ marginBottom: 12 }}>
            Request created —{' '}
            <Link to={`/requests/${notice.id}`}>#{notice.id}</Link> (pending approval).
          </Typography>
        )}
        {!rows && <Progress />}
        {rows && (
          <Table
            title={`${rows.length} resource(s)`}
            options={{ paging: true, pageSize: 20, search: true }}
            columns={columns}
            data={rows}
          />
        )}

        <Dialog open={!!edit} onClose={() => setEdit(undefined)} fullWidth>
          <DialogTitle>Edit {edit?.name}</DialogTitle>
          <DialogContent>
            {edit &&
              Object.keys(fields).map(k => (
                <TextField
                  key={k}
                  label={k}
                  fullWidth
                  margin="dense"
                  value={fields[k]}
                  onChange={e =>
                    setFields(f => ({ ...f, [k]: e.target.value }))
                  }
                />
              ))}
            {edit && Object.keys(fields).length === 0 && (
              <Typography variant="body2">No editable spec fields.</Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEdit(undefined)}>Cancel</Button>
            <Button color="primary" onClick={submitEdit}>
              Request update
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={!!del} onClose={() => setDel(undefined)}>
          <DialogTitle>Delete {del?.name}?</DialogTitle>
          <DialogContent>
            <Typography>
              This raises a delete request for approval. On approval the workflow
              runs and the resource is removed from the catalog.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDel(undefined)}>Cancel</Button>
            <Button color="secondary" onClick={submitDelete}>
              Request delete
            </Button>
          </DialogActions>
        </Dialog>
      </Content>
    </Page>
  );
}
