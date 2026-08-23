import { Navigate } from 'react-router-dom';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import {
  Page,
  PageHeader,
  GrafanaFrame,
  globalDashboardUrl,
} from '@internal/plugin-platform-ui';

export function DashboardPage() {
  const config = useApi(configApiRef);
  const target = globalDashboardUrl(config);

  // No Grafana, no page. The nav entry is hidden in this case too
  // (navVisibility.ts), so this only catches a typed or bookmarked URL —
  // sending it home beats a title over an empty body explaining itself.
  if (!target) return <Navigate to="/" replace />;

  return (
    <Page>
      <PageHeader title="Dashboard" subtitle="Platform metrics" />
      <GrafanaFrame target={target} title="Platform dashboard" height={800} />
    </Page>
  );
}
