import { useCallback, useEffect, useState } from 'react';
import { QUICKSTART_STEPS } from './steps';

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Where the highlighted element is, or null if it is not on the page. */
function rectOf(selector: string): Box | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * How long to wait for a step's element before giving up on it.
 *
 * Filtering the list once at mount was the first attempt and it dropped a step
 * every time: the tour is hosted at the app root and starts before the routed
 * page has rendered its own markup. Elements are resolved when their step is
 * shown, with a short grace period for the page to catch up.
 */
const RESOLVE_TRIES = 12;
const RESOLVE_INTERVAL_MS = 120;

/**
 * The guided tour.
 *
 * A dialogue box in the corner rather than a modal per step: the point is to
 * show people the app, and a modal hides the app.
 */
export function Quickstart({ onClose }: { onClose: () => void }) {
  const steps = QUICKSTART_STEPS;
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);

  const step = steps[index];

  // Measured when the step is shown, then re-measured whenever the layout
  // moves: the sidebar is drag-resizable and the page scrolls, so a fixed
  // offset drifts within seconds of anyone touching it.
  useEffect(() => {
    if (!step) return undefined;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;

    const measure = () => {
      const found = rectOf(step.selector);
      if (found) {
        setBox(found);
        return;
      }
      setBox(null);
      tries += 1;
      if (tries < RESOLVE_TRIES) {
        timer = setTimeout(measure, RESOLVE_INTERVAL_MS);
        return;
      }
      // Never framed empty space: a step whose element never appears is
      // skipped, and said so in development where the selector can be fixed.
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn(`quickstart: no element for "${step.selector}" (${step.id})`);
      }
      setIndex(i => (i + 1 < steps.length ? i + 1 : i));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [step, steps.length]);

  const finish = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [finish]);

  if (!step) return null;

  const last = index === steps.length - 1;

  return (
    <div className="sc sc-qs" role="dialog" aria-label="Quickstart tour">
      {box && (
        <div
          className="sc-qs-ring"
          style={{
            top: box.top - 4,
            left: box.left - 4,
            width: box.width + 8,
            height: box.height + 8,
          }}
          aria-hidden="true"
        />
      )}
      <div className="sc-qs-box">
        <div className="sc-qs-count">
          {index + 1}/{steps.length}
        </div>
        <h2 className="sc-qs-title">{step.title}</h2>
        <p className="sc-qs-body">{step.body}</p>
        <div className="sc-row sc-qs-actions">
          <button
            type="button"
            className="sc-btn sc-btn-ghost"
            onClick={finish}
          >
            Skip
          </button>
          <button
            type="button"
            className="sc-btn sc-btn-outline"
            disabled={index === 0}
            onClick={() => setIndex(i => Math.max(0, i - 1))}
          >
            Back
          </button>
          <button
            type="button"
            className="sc-btn"
            onClick={() => (last ? finish() : setIndex(i => i + 1))}
          >
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
