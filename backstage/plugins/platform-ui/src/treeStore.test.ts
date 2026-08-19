import { resetTreeStore, subscribeTree } from './treeStore';

/**
 * The store exists so a cascade polls once rather than once per level, and so
 * every level reads the same snapshot. Both are properties nothing else can
 * check: a field test sees one field and cannot tell how many requests its
 * neighbours made.
 */
describe('subscribeTree', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetTreeStore();
  });
  afterEach(() => {
    resetTreeStore();
    jest.useRealTimers();
  });

  const treeAt = (n: number) => ({ coordinates: { [`v${n}`]: {} } });

  it('makes one request for the whole cascade, not one per level', async () => {
    let calls = 0;
    const fetcher = jest.fn(async () => {
      calls += 1;
      return treeAt(calls);
    });
    const seen: unknown[] = [];
    // Five levels subscribing in the same tick, as a form mount does.
    const stops = [1, 2, 3, 4, 5].map(() =>
      subscribeTree('/tree', 0, fetcher, s => seen.push(s.data)),
    );
    await jest.runOnlyPendingTimersAsync();

    expect(fetcher).toHaveBeenCalledTimes(1);
    stops.forEach(stop => stop());
  });

  it('gives every subscriber the same snapshot', async () => {
    const fetcher = jest.fn(async () => treeAt(1));
    const a: unknown[] = [];
    const b: unknown[] = [];
    const stopA = subscribeTree('/tree', 0, fetcher, s => a.push(s.data));
    const stopB = subscribeTree('/tree', 0, fetcher, s => b.push(s.data));
    await jest.runOnlyPendingTimersAsync();

    // Same object, not merely equal: a cascade offering options from two
    // different fetches of the same tree is how a child ends up listing an
    // island its parent no longer has.
    expect(a[a.length - 1]).toBe(b[b.length - 1]);
    stopA();
    stopB();
  });

  it('polls once per interval however many levels are listening', async () => {
    const fetcher = jest.fn(async () => treeAt(1));
    const stops = [1, 2, 3].map(() => subscribeTree('/tree', 1000, fetcher, () => {}));
    // Flush microtasks only. runOnlyPendingTimers would also fire the interval
    // and count its poll as part of the initial load.
    await jest.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1000);
    expect(fetcher).toHaveBeenCalledTimes(3);

    stops.forEach(stop => stop());
  });

  it('runs at the most eager interval when levels disagree', async () => {
    const fetcher = jest.fn(async () => treeAt(1));
    const slow = subscribeTree('/tree', 5000, fetcher, () => {});
    const fast = subscribeTree('/tree', 1000, fetcher, () => {});
    await jest.runOnlyPendingTimersAsync();
    fetcher.mockClear();

    await jest.advanceTimersByTimeAsync(1000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Drop the eager one and the timer relaxes to what is left.
    fast();
    fetcher.mockClear();
    await jest.advanceTimersByTimeAsync(1000);
    expect(fetcher).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(4000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    slow();
  });

  it('stops polling once the last level unmounts', async () => {
    const fetcher = jest.fn(async () => treeAt(1));
    const stop = subscribeTree('/tree', 1000, fetcher, () => {});
    await jest.runOnlyPendingTimersAsync();
    stop();
    fetcher.mockClear();

    await jest.advanceTimersByTimeAsync(10_000);
    // A poll outliving its form is a leak that only ever shows up as traffic
    // nobody can account for.
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not stack requests when a tick lands on a slow one', async () => {
    let resolve!: (v: unknown) => void;
    const fetcher = jest.fn(() => new Promise(r => (resolve = r)));
    const stop = subscribeTree('/tree', 1000, fetcher as never, () => {});
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Three ticks while the first request is still out.
    await jest.advanceTimersByTimeAsync(3000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolve(treeAt(1));
    stop();
  });

  it('keeps the last good tree when a refresh fails', async () => {
    let ok = true;
    const fetcher = jest.fn(async () => {
      if (!ok) throw new Error('502 Bad Gateway');
      return treeAt(1);
    });
    const states: { data?: unknown; error?: string }[] = [];
    const stop = subscribeTree('/tree', 1000, fetcher, s => states.push(s));
    await jest.runOnlyPendingTimersAsync();

    ok = false;
    await jest.advanceTimersByTimeAsync(1000);

    const last = states[states.length - 1];
    // The form stays usable with the options it already had, and the failure
    // is still reported rather than swallowed.
    expect(last.data).toEqual(treeAt(1));
    expect(last.error).toMatch(/502/);
    stop();
  });
});
