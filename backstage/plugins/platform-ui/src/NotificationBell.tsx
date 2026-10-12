import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { notificationsApiRef } from '@backstage/plugin-notifications';
import NotificationsNoneIcon from '@material-ui/icons/NotificationsNone';
import { Link } from 'react-router-dom';

const REFRESH_INTERVAL_MS = 30_000;

export function NotificationBell() {
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

  const accessibleCount =
    unread === 1 ? '1 unread notification' : `${unread} unread notifications`;

  return (
    <Link
      to="/notifications"
      className="sc-notification-bell"
      aria-label={`Notifications, ${accessibleCount}`}
      title="Notifications"
    >
      <NotificationsNoneIcon aria-hidden="true" />
      {unread > 0 && (
        <span className="sc-notification-count" aria-hidden="true">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
