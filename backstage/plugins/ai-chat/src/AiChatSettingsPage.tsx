import { useCallback, useEffect, useState } from 'react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import {
  Page,
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Badge,
  useIsAdmin,
} from '@internal/plugin-platform-ui';
import type { ChatAvailability } from './AiChatShell';

/** The SAME admin-group UI guard as Settings > Maintenance. Server checks too. */
export function AiChatSettingsPage() {
  const discovery = useApi(discoveryApiRef),
    api = useApi(fetchApiRef);
  const isAdmin = useIsAdmin();
  const [status, setStatus] = useState<ChatAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    try {
      const base = await discovery.getBaseUrl('ai-chat');
      const response = await api.fetch(`${base}/availability`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setStatus((await response.json()) as ChatAvailability);
      setError('');
    } catch {
      setError('לא ניתן לקרוא את מצב הצ׳אט.');
    } finally {
      setLoading(false);
    }
  }, [api, discovery]);
  useEffect(() => {
    void reload();
  }, [reload]);
  const toggle = async () => {
    if (saving || !status || !isAdmin || !status.canManage) return;
    setSaving(true);
    setError('');
    try {
      const base = await discovery.getBaseUrl('ai-chat');
      const response = await api.fetch(`${base}/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !status.enabled }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setStatus((await response.json()) as ChatAvailability);
      window.dispatchEvent(new Event('platform-ai-availability-changed'));
    } catch {
      setError('העדכון נכשל. בדוק הרשאות או חיבור לשרת.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Page>
      <PageHeader title="AI Chat" />
      <Card>
        <CardHeader
          title="Platform AI assistant"
          description="Enable or disable the floating chat for all Backstage users."
        />
        <CardBody>
          {loading ? (
            <p className="sc-muted">Loading…</p>
          ) : (
            <>
              <div className="sc-row" style={{ marginBottom: 12 }}>
                <Badge tone={status?.enabled ? 'success' : 'warning'}>
                  {status?.enabled ? 'On' : 'Off'}
                </Badge>
              </div>
              {!isAdmin || !status?.canManage ? (
                <p className="sc-muted">
                  Platform admins only — the same permissions as Maintenance
                  mode.
                </p>
              ) : (
                <>
                  <Button
                    onClick={() => void toggle()}
                    disabled={saving || !status || !status.configured}
                  >
                    {status?.enabled ? 'Turn off AI Chat' : 'Turn on AI Chat'}
                  </Button>
                  {status && !status.configured && (
                    <p className="sc-muted" style={{ marginTop: 12 }}>
                      AI_CHAT_DEMO_ENABLED is off on the backend; enable it in
                      the server environment first.
                    </p>
                  )}
                </>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="sc-muted" style={{ marginTop: 12 }}>
              {error}
            </p>
          )}
          <p className="sc-muted" style={{ marginTop: 12 }}>
            Off hides the floating button for everyone and blocks AI chat, draft
            editing, review and submission at the backend. Existing Scaffolder
            tasks are not canceled.
          </p>
        </CardBody>
      </Card>
    </Page>
  );
}
