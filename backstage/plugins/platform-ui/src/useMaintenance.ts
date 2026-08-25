import { useEffect, useState } from 'react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';

/**
 * Is the platform in maintenance mode?
 *
 * Reads `GET /maintenance` from platform-requests-backend. `undefined` while
 * the first answer is in flight, so a caller can render children instead of
 * flashing a maintenance page at every user on every load.
 *
 * Fails open: a fetch that errors resolves `false`, never `true`. The backend
 * is the real gate (it refuses new requests from non-admins while maintenance
 * is on); this hook is a courtesy that must never lock everyone out of a form
 * the backend would have accepted just because the frontend couldn't reach it.
 */
export function useMaintenance(): boolean | undefined {
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [enabled, setEnabled] = useState<boolean | undefined>();

  useEffect(() => {
    let live = true;
    (async () => {
      const base = await discovery.getBaseUrl('platform-requests');
      const res = await fetchApi.fetch(`${base}/maintenance`);
      if (!res.ok) throw new Error(`${res.status}`);
      const body = (await res.json()) as { enabled: boolean };
      if (live) setEnabled(body.enabled);
    })().catch(() => {
      if (live) setEnabled(false);
    });
    return () => {
      live = false;
    };
  }, [discovery, fetchApi]);

  return enabled;
}
