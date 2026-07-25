import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  Content,
  Header,
  Page,
  Progress,
  StatusOK,
  StatusPending,
  StatusRunning,
  StatusError,
  StatusAborted,
  Table,
  TableColumn,
  Link,
} from '@backstage/core-components';
import { Request, RequestState } from '@internal/plugin-platform-common';
import { requestsApiRef } from '../api';

function StateChip({ state }: { state: RequestState }) {
  switch (state) {
    case 'PENDING_APPROVAL':
      return <StatusPending>Pending approval</StatusPending>;
    case 'APPROVED':
    case 'IN_PROGRESS':
      return <StatusRunning>{state === 'APPROVED' ? 'Approved' : 'In progress'}</StatusRunning>;
    case 'SUCCEEDED':
      return <StatusOK>Succeeded</StatusOK>;
    case 'FAILED':
      return <StatusError>Failed</StatusError>;
    case 'REJECTED':
      return <StatusAborted>Rejected</StatusAborted>;
    default:
      return <>{state}</>;
  }
}

export function RequestsPage() {
  const api = useApi(requestsApiRef);
  const [rows, setRows] = useState<Request[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.list().then(setRows).catch(e => setError(String(e)));
  }, [api]);

  const columns: TableColumn<Request>[] = [
    {
      title: 'ID',
      field: 'id',
      width: '60px',
      render: r => <Link to={`/requests/${r.id}`}>#{r.id}</Link>,
    },
    { title: 'Kind', field: 'kind', width: '90px' },
    { title: 'Type', field: 'resourceType' },
    { title: 'Resource', field: 'resourceName' },
    { title: 'Requester', field: 'requester' },
    {
      title: 'State',
      field: 'state',
      render: r => <StateChip state={r.state} />,
    },
  ];

  return (
    <Page themeId="tool">
      <Header title="Requests" subtitle="Resource requests + approvals" />
      <Content>
        {error && <StatusError>{error}</StatusError>}
        {!rows && !error && <Progress />}
        {rows && (
          <Table
            title={`${rows.length} request(s)`}
            options={{ paging: true, pageSize: 20, search: true }}
            columns={columns}
            data={rows}
          />
        )}
      </Content>
    </Page>
  );
}
