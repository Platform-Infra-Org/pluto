import { useEffect, useRef, useState } from 'react';
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

/** Long enough for the page to render its own heading. */
const SETTLE_MS = 1200;

/**
 * What to call this page.
 *
 * `document.title` is the obvious source and the wrong one: Backstage sets it
 * once, to the app name, so every visit would be recorded as "Platform".
 * The page's own heading is what a person would call the page, and the
 * prettified path is the fallback when a page has no heading yet.
 */
export function visitTitle(path: string, heading?: string | null): string {
  const trimmed = heading?.trim();
  if (trimmed) return trimmed.replace(/█/g, '').trim();
  const last = path.split('?')[0].split('/').filter(Boolean).pop() ?? '';
  if (!last) return path;
  return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
}

/**
 * Selectors in preference order — ours first, the framework's last.
 *
 * They cannot be one comma-separated selector: querySelector returns the first
 * match in *document order*, not in list order, and the framework's outer
 * header sits above our page title. That is how /requests/15 came out titled
 * "platform-requests".
 */
const HEADING_SELECTORS = [
  '.sc-h1',
  '[class*="bui-HeaderTitle"]',
  '[class*="BackstageContentHeader-title"]',
  '[class*="BackstageHeader-title"]',
  'h1',
];

function currentHeading(): string | null {
  for (const sel of HEADING_SELECTORS) {
    const text = document.querySelector(sel)?.textContent?.trim();
    if (text) return text;
  }
  return null;
}

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
  // The list as the server last reported it. snapshot() alone is not enough:
  // straight after a page load it is still empty, so writing on top of it
  // replaces the stored history with a single entry every time.
  const known = useRef<Visit[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    const bucket = storage.forBucket(VISITS_BUCKET);
    const sub = bucket.observe$<Visit[]>(VISITS_KEY).subscribe(next => {
      known.current = next.value ?? [];
      loaded.current = true;
    });
    const snap = bucket.snapshot<Visit[]>(VISITS_KEY);
    if (snap.presence !== 'unknown') {
      known.current = snap.value ?? [];
      loaded.current = true;
    }
    return () => sub.unsubscribe();
  }, [storage]);

  useEffect(() => {
    if (!isRecordable(path)) return undefined;
    const timer = setTimeout(async () => {
      // Never write before the stored list has arrived, or the write is a
      // truncation dressed up as an append.
      if (!loaded.current) return;
      const bucket = storage.forBucket(VISITS_BUCKET);
      const next = recordVisit(known.current, {
        path,
        title: visitTitle(path, currentHeading()),
        at: new Date().toISOString(),
      });
      known.current = next;
      await bucket.set(VISITS_KEY, next);
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [storage, path]);
}
