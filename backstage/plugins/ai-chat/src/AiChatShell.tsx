import { useCallback, useEffect, useState } from 'react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { AiChatPage } from './AiChatPage';
import { PlatformBrandTile } from './PlatformBrandTile';
import './chat.css';

export interface ChatAvailability {
  enabled: boolean;
  configured: boolean;
  canManage: boolean;
}

/** Mounted once at app-root level, so SPA navigation does not remount the chat. */
export function AiChatShell() {
  const discovery = useApi(discoveryApiRef),
    fetchApi = useApi(fetchApiRef);
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const base = await discovery.getBaseUrl('ai-chat');
      const response = await fetchApi.fetch(`${base}/availability`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Availability not accessible');
      const data = (await response.json()) as ChatAvailability;
      setEnabled(data.enabled === true);
      if (data.enabled !== true) setOpen(false);
    } catch {
      setEnabled(false);
      setOpen(false);
    }
  }, [discovery, fetchApi]);
  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10000);
    const onFocus = () => void refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('platform-ai-availability-changed', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('platform-ai-availability-changed', onFocus);
    };
  }, [refresh]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (!enabled) return null;
  return (
    <div className="platform-ai-widget">
      {!open && (
        <button
          type="button"
          className="platform-ai-launcher"
          aria-label="פתח עוזר פלטפורמה"
          title="פתח עוזר פלטפורמה"
          onClick={() => {
            void refresh();
            setOpen(true);
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 18.4 3 21v-5.1A8 8 0 0 1 2 12a9 9 0 0 1 9-9h2a9 9 0 0 1 9 9v1a9 9 0 0 1-9 9H9.2A8.4 8.4 0 0 1 5 20.8" />
            <path d="M8 12h8M8 16h5" />
          </svg>
          <span>Assistant</span>
          <span className="platform-ai-launcher-indicator" aria-hidden="true" />
        </button>
      )}
      <aside
        className={`platform-ai-drawer${open ? ' is-open' : ''}`}
        aria-label="עוזר הפלטפורמה"
        aria-hidden={!open}
      >
        <header className="platform-ai-drawer-top" dir="rtl">
          <PlatformBrandTile size="header" />
          <div className="platform-ai-brand-copy">
            <strong>Platform Assistant</strong>
            <span>
              <i className="platform-ai-status-dot" /> סביבת Demo · זמין לעזרה
            </span>
          </div>
          <button
            type="button"
            className="platform-ai-icon-button platform-ai-close"
            aria-label="סגור צ'אט"
            title="סגור"
            onClick={() => setOpen(false)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        {/* Keep the component mounted while the drawer is closed or route changes.
          Unmounting after admin disable intentionally drops all in-browser context. */}
        <AiChatPage compact />
      </aside>
    </div>
  );
}
