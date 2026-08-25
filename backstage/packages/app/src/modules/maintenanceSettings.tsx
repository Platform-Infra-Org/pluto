import { useState } from 'react';
import {
  createFrontendModule,
  SubPageBlueprint,
} from '@backstage/frontend-plugin-api';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Page, PageHeader, Card, CardHeader, CardBody, Button, Badge,
  useMaintenance, useIsAdmin,
} from '@internal/plugin-platform-ui';

/**
 * The switch nobody could flip: `useMaintenance`/`MaintenanceGate` already
 * read `GET /maintenance`, but nothing in the app called `PUT /maintenance`.
 * Lives under Settings rather than as its own nav item — it's an admin
 * on/off switch, not something anyone browses to day-to-day.
 *
 * Non-admins get a short note instead of the toggle. That's decluttering,
 * not the access check — the backend 403s a non-admin PUT regardless
 * (router.ts), so hiding the button here can't be the real gate.
 */
function MaintenanceSettingsPage() {
  const isAdmin = useIsAdmin();
  const maintenance = useMaintenance();
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  // Overrides what useMaintenance() last reported once we have a fresher
  // answer from our own PUT's response body.
  const [override, setOverride] = useState<boolean>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const known = override ?? maintenance;
  let statusLabel = 'Loading…';
  if (known !== undefined) statusLabel = known ? 'On' : 'Off';

  const toggle = async () => {
    setSaving(true);
    setError(false);
    try {
      const base = await discovery.getBaseUrl('platform-requests');
      const res = await fetchApi.fetch(`${base}/maintenance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !known }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const body = (await res.json()) as { enabled: boolean };
      setOverride(body.enabled);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <PageHeader title="Maintenance" />
      <Card>
        <CardHeader
          title="Maintenance mode"
          description="Pauses new requests for everyone but admins."
        />
        <CardBody>
          {/* Same rule ResourceActionsCard uses: undefined (still loading)
              behaves like non-admin, so this can only flash the note, never
              the toggle, for someone who turns out not to be one. */}
          {!isAdmin ? (
            <p className="sc-muted">Platform admins only.</p>
          ) : (
            <>
              <div className="sc-row" style={{ marginBottom: 12 }}>
                <Badge tone={known ? 'warning' : 'success'}>
                  {statusLabel}
                </Badge>
              </div>
              <Button onClick={toggle} disabled={saving || known === undefined}>
                {known ? 'Turn off maintenance' : 'Turn on maintenance'}
              </Button>
              {error && (
                <p className="sc-muted" style={{ marginTop: 12 }}>
                  Could not update maintenance mode. Try again.
                </p>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </Page>
  );
}

export const maintenanceSettingsModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    SubPageBlueprint.make({
      name: 'maintenance',
      attachTo: { id: 'page:user-settings', input: 'pages' },
      params: {
        path: 'maintenance',
        title: 'Maintenance',
        loader: async () => <MaintenanceSettingsPage />,
      },
    }),
  ],
});
