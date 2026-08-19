/**
 * One tree, one request, one timer — however many fields are reading it.
 *
 * A cascade is several fields pointed at the SAME endpoint: five coordinate
 * levels all want the whole hierarchy. Polling that per field would be five
 * requests per tick, and worse than the waste is the skew — field three could
 * refresh a beat before field four and briefly offer options from a tree its
 * neighbour has not seen yet, which in a cascade means offering an island that
 * no longer belongs to the selected region.
 *
 * So subscription, not fetching: fields subscribe to a URL, the store owns the
 * single timer and the single request, and every subscriber is handed the same
 * snapshot from the same response. Consistency across the cascade is then a
 * property of the design rather than something each field has to be careful
 * about.
 */

export type TreeFetcher = (url: string) => Promise<unknown>;

/** Last good data, plus whatever the most recent attempt had to say. */
export interface TreeState {
  data?: unknown;
  error?: string;
}

type Listener = (state: TreeState) => void;

interface Entry {
  data?: unknown;
  error?: string;
  /** When `data` last succeeded, for the late-joiner TTL below. */
  at: number;
  listeners: Set<Listener>;
  /** Each listener's requested interval; the timer runs at the smallest. */
  intervals: Map<Listener, number>;
  timer?: ReturnType<typeof setInterval>;
  inFlight?: Promise<void>;
}

/**
 * How long a late subscriber may reuse an existing response before the store
 * refetches for it. This is not the poll: it exists so mounting five fields in
 * the same tick makes one request rather than five.
 */
export const TREE_TTL_MS = 30_000;

const entries = new Map<string, Entry>();

function emit(entry: Entry) {
  const snapshot: TreeState = { data: entry.data, error: entry.error };
  for (const listener of entry.listeners) listener(snapshot);
}

function load(url: string, fetcher: TreeFetcher): Promise<void> {
  const entry = entries.get(url);
  if (!entry) return Promise.resolve();
  // A tick that lands while the previous request is still out must not stack a
  // second one; slow endpoint plus short interval is exactly how a poll turns
  // into a pile-up.
  if (entry.inFlight) return entry.inFlight;

  entry.inFlight = fetcher(url)
    .then(data => {
      entry.data = data;
      entry.error = undefined;
      entry.at = Date.now();
    })
    .catch(err => {
      // Keep the last good tree. A refresh that fails should leave the form
      // usable with the options it already had, the same bargain the flat
      // DynamicSelect makes.
      entry.error = String((err as Error)?.message ?? err);
    })
    .finally(() => {
      entry.inFlight = undefined;
      emit(entry);
    });

  return entry.inFlight;
}

/** Run the timer at the most eager interval anyone asked for, or not at all. */
function retime(url: string, fetcher: TreeFetcher) {
  const entry = entries.get(url);
  if (!entry) return;
  const wanted = [...entry.intervals.values()].filter(ms => ms > 0);
  const next = wanted.length ? Math.min(...wanted) : 0;
  if (entry.timer) {
    clearInterval(entry.timer);
    entry.timer = undefined;
  }
  if (next > 0) entry.timer = setInterval(() => load(url, fetcher), next);
}

/**
 * Subscribe to a tree. Returns an unsubscribe that also stops the timer once
 * the last reader has gone — a poll outliving its form is a leak that only
 * shows up as mystery traffic.
 */
export function subscribeTree(
  url: string,
  intervalMs: number | undefined,
  fetcher: TreeFetcher,
  listener: Listener,
): () => void {
  let entry = entries.get(url);
  if (!entry) {
    entry = { at: 0, listeners: new Set(), intervals: new Map() };
    entries.set(url, entry);
  }
  const current = entry;
  current.listeners.add(listener);
  current.intervals.set(listener, intervalMs ?? 0);
  retime(url, fetcher);

  if (current.data !== undefined && Date.now() - current.at < TREE_TTL_MS) {
    // Fresh enough: hand over what we have instead of asking again.
    listener({ data: current.data, error: current.error });
  } else {
    load(url, fetcher);
  }

  return () => {
    current.listeners.delete(listener);
    current.intervals.delete(listener);
    if (current.listeners.size === 0) {
      if (current.timer) clearInterval(current.timer);
      current.timer = undefined;
    } else {
      retime(url, fetcher);
    }
  };
}

/** Test seam: the store is module state, so a suite must be able to clear it. */
export function resetTreeStore() {
  for (const entry of entries.values()) {
    if (entry.timer) clearInterval(entry.timer);
  }
  entries.clear();
}
