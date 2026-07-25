import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Link } from '@backstage/core-components';
import { Page, PageHeader, Card, Badge } from '@internal/plugin-platform-ui';
import { Request, RequestState } from '@internal/plugin-platform-common';
import { requestsApiRef } from '../api';

export function stateBadge(s: RequestState) {
  switch (s) {
    case 'PENDING_APPROVAL':
      return (
        <Badge tone="warning" dot>
          Pending approval
        </Badge>
      );
    case 'APPROVED':
    case 'IN_PROGRESS':
      return (
        <Badge tone="primary" dot>
          {s === 'APPROVED' ? 'Approved' : 'In progress'}
        </Badge>
      );
    case 'SUCCEEDED':
      return (
        <Badge tone="success" dot>
          Succeeded
        </Badge>
      );
    case 'FAILED':
      return (
        <Badge tone="destructive" dot>
          Failed
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge tone="muted" dot>
          Rejected
        </Badge>
      );
    default:
      return <Badge>{s}</Badge>;
  }
}

export function RequestsPage() {
  const api = useApi(requestsApiRef);
  const [rows, setRows] = useState<Request[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.list().then(setRows).catch(e => setError(String(e)));
  }, [api]);

  return (
    <Page>
      <PageHeader title="Requests" subtitle="Resource requests + approvals" />
      <Card>
        <div className="sc-table-wrap"><table className="sc-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Kind</th>
              <th>Type</th>
              <th>Resource</th>
              <th>Requester</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map(r => (
              <tr key={r.id}>
                <td>
                  <Link to={`/requests/${r.id}`} className="sc-link">
                    #{r.id}
                  </Link>
                </td>
                <td>{r.kind}</td>
                <td>{r.resourceType}</td>
                <td>{r.resourceName}</td>
                <td>{r.requester}</td>
                <td>{stateBadge(r.state)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {error && <div className="sc-card-b sc-muted">{error}</div>}
        {rows && rows.length === 0 && (
          <div className="sc-card-b sc-muted">No requests yet.</div>
        )}
        {!rows && !error && <div className="sc-card-b sc-muted">Loading…</div>}
      </Card>
    </Page>
  );
}
