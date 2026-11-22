import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { notificationsApiRef } from '@backstage/plugin-notifications';

const REFRESH_INTERVAL_MS = 30_000;

export function NotificationBadge() {
  const notificationsApi = useApi(notificationsApiRef);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;

    const refresh = () => {
      notificationsApi
        .getStatus()
        .then(status => {
          if (active) setUnread(status.unread);
        })
        // A notification failure should not break the global app shell.
        .catch(() => undefined);
    };

    refresh();
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refresh);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [notificationsApi]);

  if (unread === 0) {
    return <span data-testid="notification-badge-empty" />;
  }

  const accessibleCount =
    unread === 1 ? '1 unread notification' : `${unread} unread notifications`;
  return (
    <span className="sc-nav-count" aria-label={accessibleCount}>
      {unread > 99 ? '99+' : unread}
    </span>
  );
}
