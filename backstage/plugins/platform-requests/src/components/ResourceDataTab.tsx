import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Card, CardHeader, CardBody, JsonTree } from '@internal/plugin-platform-ui';
import { requestsApiRef } from '../api';

/**
 * Entity tab (Resource pages): renders the resource's data JSON as a collapsible
 * tree. The data is resolved server-side from the `platform.io/resource-data`
 * ref (a JSON/YAML file next to the resource, fetched via the reader), falling
 * back to `spec.resourceData`.
 */
export function ResourceDataTab() {
  const { entity } = useEntity();
  const api = useApi(requestsApiRef);
  const [data, setData] = useState<Record<string, unknown>>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    api
      .getResourceData(entity.metadata.name)
      .then(setData)
      .catch(e => setError(String(e)));
  }, [api, entity.metadata.name]);

  const empty = data && Object.keys(data).length === 0;

  return (
    <div style={{ padding: 16 }}>
      <Card>
        <CardHeader
          title="Resource data"
          description="The full description of this resource."
        />
        <CardBody>
          {error && <div className="sc-muted">{error}</div>}
          {!data && !error && <div className="sc-muted">Loading…</div>}
          {data && empty && (
            <div className="sc-muted">No resource data available.</div>
          )}
          {data && !empty && <JsonTree data={data} />}
        </CardBody>
      </Card>
    </div>
  );
}
