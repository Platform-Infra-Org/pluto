import { useCallback, useEffect, useState } from 'react';
import { storageApiRef, useApi } from '@backstage/core-plugin-api';
import { QUICKSTART_VERSION } from './steps';

const BUCKET = 'platform.quickstart';
const KEY = 'completedVersion';

/**
 * Whether the tour should be showing, and how to start or finish it.
 *
 * The auto-run waits for the stored value to arrive. This storage is
 * network-backed, so acting on "nothing stored yet" the moment the page mounts
 * would flash the tour at everyone on every load — including people who
 * finished it months ago.
 */
export function useQuickstart(): {
  open: boolean;
  start: () => void;
  close: () => void;
} {
  const storage = useApi(storageApiRef);
  const [open, setOpen] = useState(false);
  const [decided, setDecided] = useState(false);

  useEffect(() => {
    const bucket = storage.forBucket(BUCKET);
    const consider = (value: number | undefined, known: boolean) => {
      if (!known || decided) return;
      setDecided(true);
      if ((value ?? 0) < QUICKSTART_VERSION) setOpen(true);
    };

    const snap = bucket.snapshot<number>(KEY);
    consider(snap.value, snap.presence !== 'unknown');

    const sub = bucket
      .observe$<number>(KEY)
      .subscribe(next => consider(next.value, true));
    return () => sub.unsubscribe();
  }, [storage, decided]);

  const close = useCallback(() => {
    setOpen(false);
    setDecided(true);
    // Recorded whether it was completed or skipped: both mean "has seen it".
    storage.forBucket(BUCKET).set(KEY, QUICKSTART_VERSION);
  }, [storage]);

  const start = useCallback(() => setOpen(true), []);

  return { open, start, close };
}
