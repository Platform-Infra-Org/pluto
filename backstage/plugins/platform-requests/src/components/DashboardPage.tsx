import { Page, PageHeader, GrafanaFrame } from '@internal/plugin-platform-ui';

export function DashboardPage() {
  return (
    <Page>
      <PageHeader title="Dashboard" subtitle="Platform metrics" />
      <GrafanaFrame title="Platform dashboard" height={800} />
    </Page>
  );
}
