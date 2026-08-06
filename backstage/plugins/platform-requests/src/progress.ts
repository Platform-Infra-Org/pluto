import { WorkflowNode } from './api';

/**
 * Node types that represent actual work.
 *
 * Argo's `status.nodes` mixes real steps with the structure holding them:
 * `Steps`, `StepGroup` and `DAG` are containers. A live review-gate run
 * reported **7 nodes for 3 real steps**, so counting everything would put a
 * progress bar past halfway before anything had run.
 */
const LEAF_TYPES = new Set(['Pod', 'Suspend']);

/** Phases that mean a step is done with, one way or another. */
const FINISHED = new Set(['Succeeded', 'Failed', 'Error', 'Skipped', 'Omitted']);

export interface Progress {
  done: number;
  total: number;
}

/**
 * How much of a workflow has actually happened.
 *
 * `previousDone` is a high-water mark. Argo expands the DAG as it runs, so the
 * honest count can go **down** between polls — a step that was 1-of-1 becomes
 * 1-of-3 when the next branch appears. A bar that goes backwards reads as a
 * bug even when it is accurate, so the count never decreases.
 */
export function workflowProgress(
  nodes: WorkflowNode[],
  previousDone: number = 0,
): Progress {
  const leaves = nodes.filter(n => LEAF_TYPES.has(n.type ?? ''));
  const done = leaves.filter(n => FINISHED.has(n.phase ?? '')).length;
  return {
    done: Math.max(done, previousDone),
    total: leaves.length,
  };
}

/**
 * The fill, 0..1.
 *
 * Zero nodes is the state every request is in for its first seconds, and it
 * must not be a division by zero — an empty bar is the truthful answer there.
 */
export function progressFraction({ done, total }: Progress): number {
  if (total <= 0) return 0;
  return Math.min(1, done / total);
}
