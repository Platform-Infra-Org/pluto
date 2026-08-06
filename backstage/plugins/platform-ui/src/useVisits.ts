import { useEffect, useState } from 'react';
import { storageApiRef, useApi } from '@backstage/core-plugin-api';

/**
 * One page the user landed on, newest first in the stored list.
 *
 * A type alias rather than an interface: StorageApi is typed against
 * JsonValue, and an interface has no index signature so it does not satisfy
 * JsonObject. The alias does, and the shape is identical.
 */
export type Visit = {
  path: string;
  title: string;
  at: string;
};

/** Where the log lives. Server-side per user, so it follows the person. */
export const VISITS_BUCKET = 'platform.visits';
const VISITS_KEY = 'recent';
const CAP = 20;

/**
 * Add a visit to the front of the log.
 *
 * Deduped by path, because a page you bounced through five times would
 * otherwise crowd out five you actually used, and the newest timestamp wins.
 */
export function recordVisit(
  list: Visit[],
  visit: Visit,
  cap: number = CAP,
): Visit[] {
  return [visit, ...list.filter(v => v.path !== visit.path)].slice(0, cap);
}

/**
 * Whether a path is worth remembering.
 *
 * Home is where the list is shown, so listing it is noise. A path carrying a
 * `state=` query is the OAuth handshake coming back, not somewhere anyone
 * chose to go.
 */
export function isRecordable(path: string): boolean {
  if (!path || path === '/') return false;
  if (path.startsWith('/?') || path.includes('state=')) return false;
  return true;
}

/** The page title, once the page has had a chance to set its own. */
const SETTLE_MS = 900;

/**
 * The visit log for the signed-in user.
 *
 * Reads render as empty and fill in when the server answers — storage here is
 * network-backed, so blocking a render on it would stall the page.
 */
export function useVisits(): Visit[] {
  const storage = useApi(storageApiRef);
  const [visits, setVisits] = useState<Visit[]>([]);

  useEffect(() => {
    const bucket = storage.forBucket(VISITS_BUCKET);
    const sub = bucket
      .observe$<Visit[]>(VISITS_KEY)
      .subscribe(next => setVisits(next.value ?? []));
    setVisits(bucket.snapshot<Visit[]>(VISITS_KEY).value ?? []);
    return () => sub.unsubscribe();
  }, [storage]);

  return visits;
}

/**
 * Record the current page.
 *
 * The title is read after a settle delay: pages set `document.title` once
 * their data arrives, and a visit recorded too early is titled "Platform" for
 * every page in the app.
 */
export function useRecordVisit(path: string) {
  const storage = useApi(storageApiRef);

  useEffect(() => {
    if (!isRecordable(path)) return undefined;
    const timer = setTimeout(async () => {
      const bucket = storage.forBucket(VISITS_BUCKET);
      const current = bucket.snapshot<Visit[]>(VISITS_KEY).value ?? [];
      await bucket.set(
        VISITS_KEY,
        recordVisit(current, {
          path,
          title: document.title,
          at: new Date().toISOString(),
        }),
      );
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [storage, path]);
}
