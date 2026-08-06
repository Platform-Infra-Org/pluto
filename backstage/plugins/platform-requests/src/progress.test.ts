import { workflowProgress, progressFraction } from './progress';
import { WorkflowNode } from './api';

const node = (
  id: string,
  type: string,
  phase: string,
): WorkflowNode => ({ id, name: id, type, phase, children: [] });

/**
 * The shape a real run reports: three steps, seven nodes. Taken from the
 * review-gate workflow while it sat at its suspend step.
 */
const REVIEW_GATE_MIDRUN: WorkflowNode[] = [
  node('wf', 'Steps', 'Running'),
  node('[0]', 'StepGroup', 'Succeeded'),
  node('plan', 'Pod', 'Succeeded'),
  node('[1]', 'StepGroup', 'Running'),
  node('approve', 'Suspend', 'Running'),
  node('[2]', 'StepGroup', 'Pending'),
  node('apply', 'Pod', 'Pending'),
];

describe('workflowProgress', () => {
  it('counts real steps and ignores the structure around them', () => {
    // 7 nodes, 3 of them work. Counting all 7 would read 57% before anything
    // had happened.
    expect(workflowProgress(REVIEW_GATE_MIDRUN)).toEqual({ done: 1, total: 3 });
  });

  it('counts a suspend step as work, because waiting is part of the run', () => {
    const total = workflowProgress(REVIEW_GATE_MIDRUN).total;
    expect(total).toBe(3);
  });

  it('does not count a failed step as ground covered', () => {
    // Counting failures fills the bar to 100% the moment a run dies, which
    // reads as "all the work completed" — the opposite of what happened.
    const nodes = [
      node('a', 'Pod', 'Succeeded'),
      node('b', 'Pod', 'Failed'),
      node('c', 'Pod', 'Skipped'),
      node('d', 'Pod', 'Running'),
    ];
    expect(workflowProgress(nodes)).toEqual({ done: 2, total: 4 });
  });

  it('freezes a stopped run where it got to', () => {
    // The review-gate shape after an approver refuses the gate: one step done,
    // the suspend stopped. Half a bar, not a full one.
    const nodes = [
      node('plan', 'Pod', 'Succeeded'),
      node('approve', 'Suspend', 'Failed'),
    ];
    expect(workflowProgress(nodes)).toEqual({ done: 1, total: 2 });
  });

  it('never goes backwards when the DAG expands', () => {
    // Two steps done of two, then a third appears: honestly 2/3, but the bar
    // must not retreat.
    const later = [
      node('a', 'Pod', 'Succeeded'),
      node('b', 'Pod', 'Succeeded'),
      node('c', 'Pod', 'Pending'),
    ];
    expect(workflowProgress(later, 2).done).toBe(2);
    // And a genuine advance still moves it.
    expect(workflowProgress(later, 1).done).toBe(2);
  });

  it('survives a workflow that has no nodes yet', () => {
    // Every request is here for its first seconds.
    expect(workflowProgress([])).toEqual({ done: 0, total: 0 });
  });
});

describe('progressFraction', () => {
  it('is zero before anything exists, with no division by zero', () => {
    expect(progressFraction({ done: 0, total: 0 })).toBe(0);
  });

  it('is the ratio in between', () => {
    expect(progressFraction({ done: 1, total: 4 })).toBe(0.25);
  });

  it('never exceeds full', () => {
    // The high-water mark can outlive a shrinking total.
    expect(progressFraction({ done: 5, total: 3 })).toBe(1);
  });
});
