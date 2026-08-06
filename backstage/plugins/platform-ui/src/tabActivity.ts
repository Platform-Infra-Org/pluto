import { useEffect } from 'react';

/**
 * A four-frame block spinner for the document title, so a tab in the background
 * shows that work is still running.
 *
 * Quadrant blocks rather than a braille or slash spinner: they are the same
 * vocabulary as the rest of the interface, and they render in every font.
 */
export const FRAMES = ['▖', '▘', '▝', '▗'] as const;

/** The frame for a given tick. Pure, so the sequence is testable. */
export function frameAt(tick: number): string {
  return FRAMES[((tick % FRAMES.length) + FRAMES.length) % FRAMES.length];
}

/** Title with any previous frame stripped, so ticks never accumulate. */
export function baseTitle(title: string): string {
  const frames = FRAMES.join('');
  return title.replace(new RegExp(`^[${frames}]\\s+`), '');
}

/**
 * Tick the document title while `active`.
 *
 * Paused whenever the tab is hidden: a title animating in a background tab
 * burns battery for nobody, and browsers throttle the timer unpredictably
 * anyway. The original title is restored on the way out, including when the
 * component unmounts mid-tick.
 */
export function useTabActivity(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;

    const original = baseTitle(document.title);
    let tick = 0;
    let timer: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
      document.title = original;
    };
    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        document.title = `${frameAt(tick++)} ${original}`;
      }, 1000);
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [active]);
}
