import { useApi, configApiRef } from '@backstage/core-plugin-api';
import {
  Page,
  PageHeader,
  Card,
  EmptyState,
  SCROLL,
  GrafanaFrame,
  isGrafanaConfigured,
} from '@internal/plugin-platform-ui';

export function DashboardPage() {
  const config = useApi(configApiRef);

  return (
    <Page>
      <PageHeader title="Dashboard" subtitle="Platform metrics" />
      {isGrafanaConfigured(config) ? (
        <GrafanaFrame title="Platform dashboard" height={800} />
      ) : (
        // The nav entry to this page always exists, so an unconfigured
        // deployment needs to say why the page is empty rather than just
        // showing a blank body under a title.
        <Card>
          <div className="sc-card-b">
            <EmptyState
              sprite={SCROLL}
              title="No dashboard configured"
              hint="Set platform.grafana.baseUrl and dashboard.uid/slug in app-config.yaml to embed one here."
            />
          </div>
        </Card>
      )}
    </Page>
  );
}
