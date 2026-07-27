import { useEntity } from '@backstage/plugin-catalog-react';
import { Card, CardHeader, CardBody, JsonTree } from '@internal/plugin-platform-ui';

const RESOURCE_DATA = 'platform.io/resource-data';

/**
 * Entity tab (Resource pages): renders the resource's full data JSON in a
 * collapsible tree. Prefers the `platform.io/resource-data` annotation (a JSON
 * string); falls back to `spec.definition` for resources that don't set it.
 */
export function ResourceDataTab() {
  const { entity } = useEntity();
  const raw = entity.metadata.annotations?.[RESOURCE_DATA];

  let data: unknown;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw; // not valid JSON — show the raw string
    }
  } else {
    data = entity.spec?.definition ?? undefined;
  }

  return (
    <div style={{ padding: 16 }}>
      <Card>
        <CardHeader
          title="Resource data"
          description="The full description of this resource."
        />
        <CardBody>
          {data === undefined ? (
            <div className="sc-muted">No resource data available.</div>
          ) : (
            <JsonTree data={data} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
