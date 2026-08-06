import { useEffect, useRef, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { RequestState } from '@internal/plugin-platform-common';
import { PixelRupee, PixelCreep } from '@internal/plugin-platform-ui';
import { requestsApiRef } from '../api';
import { progressFraction, workflowProgress, Progress } from '../progress';

const CREEPS = 3;
const POLL_MS = 4000;

/** The one-shot that plays when a run settles, or nothing. */
type Finale = 'levelup' | 'gameover' | undefined;

/**
 * Workflow progress as an experience bar.
 *
 * The bar is decoration over a real number: the count beside it is the same
 * `done/total` the fill is drawn from, so nothing here can imply progress the
 * workflow has not made. The creatures live inside the filled portion for the
 * same reason.
 */
export function ExperienceBar({
  requestId,
  state,
  live,
}: {
  requestId: number;
  state: RequestState;
  live: boolean;
}) {
  const api = useApi(requestsApiRef);
  const [progress, setProgress] = useState<Progress>({ done: 0, total: 0 });
  const [finale, setFinale] = useState<Finale>();
  const highWater = useRef(0);
  // What the state was last render. The finale plays on the transition into a
  // terminal state — opening a request that failed last week must not throw a
  // game over at whoever opens it.
  const previousState = useRef<RequestState | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const read = async () => {
      const wf = await api.getWorkflow(requestId).catch(() => undefined);
      if (cancelled || !wf) return;
      const next = workflowProgress(wf.nodes, highWater.current);
      highWater.current = next.done;
      setProgress(next);
    };
    read();
    if (!live) return () => {
      cancelled = true;
    };
    const timer = setInterval(read, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [api, requestId, live]);

  useEffect(() => {
    const was = previousState.current;
    previousState.current = state;
    if (was === undefined || was === state) return undefined;
    if (state === 'SUCCEEDED') setFinale('levelup');
    else if (state === 'FAILED') setFinale('gameover');
    else return undefined;
    const timer = setTimeout(() => setFinale(undefined), 2400);
    return () => clearTimeout(timer);
  }, [state]);

  const fraction = state === 'SUCCEEDED' ? 1 : progressFraction(progress);
  const pct = Math.round(fraction * 100);
  // A suspended workflow is not progressing, so its creatures stop. Anything
  // else would animate a claim the run is not making.
  const running = state === 'IN_PROGRESS' && pct > 0 && pct < 100;

  /**
   * The bar's colour is the run's status, not the picked accent: yellow while
   * it works, green when it lands, red when it does not. Those three readings
   * mean the same thing in every scheme, which is the point — a bar that is
   * violet on Tuesday and amber on Wednesday says nothing at a glance.
   *
   * This is the persistent state. The level-up and game-over classes below it
   * are the one-shot on top, and they expire.
   */
  const TONES: Partial<Record<RequestState, string>> = {
    SUCCEEDED: 'done',
    FAILED: 'failed',
  };
  const tone = TONES[state] ?? 'running';

  return (
    <div
      className={`sc-xp sc-xp-${tone}${finale ? ` sc-xp-${finale}` : ''}`}
    >
      <PixelRupee className="sc-xp-rupee" />
      <div
        className="sc-xp-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
        aria-label={`${progress.done} of ${progress.total} steps complete`}
      >
        <div className="sc-xp-fill" style={{ width: `${pct}%` }}>
          {running &&
            Array.from({ length: CREEPS }, (_, i) => (
              <PixelCreep key={i} className={`sc-xp-creep sc-xp-creep-${i}`} />
            ))}
        </div>
      </div>
      {/* Numbers beside the bar, never a bar alone: it is the NES convention
          and the readable one at the same time. */}
      <span className="sc-xp-count">
        {running ? (
          <>
            LOADING<span className="sc-xp-dots" aria-hidden="true">...</span>{' '}
          </>
        ) : null}
        {progress.done}/{progress.total} STEPS
      </span>
      {finale === 'levelup' && <span className="sc-xp-banner">LEVEL UP</span>}
      {finale === 'gameover' && <span className="sc-xp-banner">GAME OVER</span>}
    </div>
  );
}
