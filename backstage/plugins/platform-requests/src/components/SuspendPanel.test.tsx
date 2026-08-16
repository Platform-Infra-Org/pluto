// Registered here rather than in a shared setup file: this is the only suite in
// the repo using jest-dom's matchers, and toBeDisabled/toBeEnabled are what make
// the assertions read as the thing being tested — whether the control is
// offered — instead of as a className check.
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { SuspendedNode } from '@internal/plugin-platform-common';
import { requestsApiRef } from '../api';
import { SuspendPanel } from './SuspendPanel';

const OWNER = 'group:default/team-a';
const FINANCE = 'group:default/finance';
const DBA = 'group:default/dba';

/**
 * `approverGroup` is spread in only when the case supplies one, so an omitted
 * annotation stays genuinely `undefined` — the distinction the whole gate turns
 * on. A helper that defaulted it to `''` would test the wrong thing.
 */
const node = (
  id: string,
  approverGroup?: string,
): SuspendedNode => ({
  id,
  name: id,
  templateName: id,
  ...(approverGroup === undefined ? {} : { approverGroup }),
  inputs: [],
  suppliedOutputs: [],
});

const REQUESTER = 'user:default/dana';

const show = (
  nodes: SuspendedNode[],
  who: {
    isAdmin?: boolean;
    groups?: string[];
    /** Defaults to somebody who is neither the requester nor in any group. */
    actor?: string;
  } = {},
) =>
  render(
    <TestApiProvider apis={[[requestsApiRef, {} as any]]}>
      <SuspendPanel
        requestId={1}
        nodes={nodes}
        isAdmin={who.isAdmin ?? false}
        groups={who.groups ?? []}
        actor={who.actor ?? 'user:default/someone-else'}
        requester={REQUESTER}
        ownerGroup={OWNER}
        onResumed={() => {}}
      />
    </TestApiProvider>,
  );

/** The card for one step, so per-node assertions cannot read a sibling's. */
const step = (id: string) =>
  within(screen.getByText(id).closest('.sc-suspend') as HTMLElement);

describe('SuspendPanel gating', () => {
  it('lets the owning team answer an unannotated step, and says so', () => {
    show([node('deploy')], { groups: [OWNER] });
    expect(step('deploy').getByText(`Answered by ${OWNER}, the owning team`))
      .toBeInTheDocument();
    expect(step('deploy').getByRole('button', { name: /Resume/ })).toBeEnabled();
  });

  it('excludes the owning team from a step that names another team, while still showing it', () => {
    show([node('approve-cost', FINANCE)], { groups: [OWNER] });
    // Visible — that is how the owner learns whom to chase.
    expect(step('approve-cost').getByText(`Answered by ${FINANCE}`))
      .toBeInTheDocument();
    expect(step('approve-cost').getByRole('button', { name: /Resume/ }))
      .toBeDisabled();
    expect(step('approve-cost').getByText(new RegExp(`Only ${FINANCE}`)))
      .toBeInTheDocument();
  });

  it('lets the named team answer its own step', () => {
    show([node('approve-cost', FINANCE)], { groups: [FINANCE] });
    expect(step('approve-cost').getByRole('button', { name: /Resume/ }))
      .toBeEnabled();
  });

  it('names an unresolvable group rather than leaving the stall a mystery', () => {
    show([node('approve-cost', '')], { groups: [OWNER, FINANCE] });
    // Said twice on purpose, and both are asserted: the line under the step
    // title describes the state, and the reason beside the disabled button is
    // gate.reason verbatim -- the same sentence the API would return on a 403,
    // so the button and the error cannot tell different stories. A fail-closed
    // stall is only survivable if it is legible.
    const said = step('approve-cost').getAllByText(/could not be resolved/);
    expect(said).toHaveLength(2);
    expect(step('approve-cost').getByRole('button', { name: /Resume/ }))
      .toBeDisabled();
  });

  it('decides node by node when two teams hold two gates at once', () => {
    show([node('approve-cost', FINANCE), node('approve-schema', DBA)], {
      groups: [FINANCE],
    });
    expect(step('approve-cost').getByRole('button', { name: /Resume/ }))
      .toBeEnabled();
    expect(step('approve-schema').getByRole('button', { name: /Resume/ }))
      .toBeDisabled();
    expect(step('approve-schema').getByText(new RegExp(`Only ${DBA}`)))
      .toBeInTheDocument();
  });

  it('lets an admin answer every gate, including an unresolvable one', () => {
    show([node('a', FINANCE), node('b', ''), node('c')], { isAdmin: true });
    for (const id of ['a', 'b', 'c']) {
      expect(step(id).getByRole('button', { name: /Resume/ })).toBeEnabled();
    }
  });

  it('offers Stop to the owning team even when it may answer no step', () => {
    // The backend gates stopping on the request, not the step, so an owner
    // locked out of every gate can still refuse the run.
    show([node('approve-cost', FINANCE)], { groups: [OWNER] });
    expect(screen.getByRole('button', { name: /Stop/ })).toBeEnabled();
  });

  it('withholds the global Stop from a team that owns only a step', () => {
    // Finance may refuse its own gate — that control sits beside the step —
    // but abandoning the whole request is not theirs to do.
    show([node('approve-cost', FINANCE)], { groups: [FINANCE] });
    expect(
      screen.queryByRole('button', { name: /Stop the whole workflow/ }),
    ).toBeNull();
    expect(
      step('approve-cost').getByRole('button', { name: /Refuse and stop/ }),
    ).toBeEnabled();
  });

  it('lets the person who filed it abandon their own request', () => {
    // Not in the owning team, not an admin, owns no gate — but it is theirs.
    show([node('approve-cost', FINANCE)], { actor: REQUESTER });
    expect(
      screen.getByRole('button', { name: /Stop the whole workflow/ }),
    ).toBeEnabled();
  });

  it('never lets an unresolved identity match an unrecorded requester', () => {
    // Both empty compared equal in the first cut of mayStopWorkflow, which
    // opened the global Stop to anyone whose identity had not resolved yet.
    // The emptiness is the bug; it must not also be the key.
    render(
      <TestApiProvider apis={[[requestsApiRef, {} as any]]}>
        <SuspendPanel
          requestId={1}
          nodes={[node('approve-cost', FINANCE)]}
          isAdmin={false}
          groups={[]}
          actor=""
          requester=""
          ownerGroup={OWNER}
          onResumed={() => {}}
        />
      </TestApiProvider>,
    );
    expect(
      screen.queryByRole('button', { name: /Stop the whole workflow/ }),
    ).toBeNull();
  });

  it('gives a refusing team no confirmation, and the requester one', () => {
    // Refusing a gate is the answer the team was asked for, so it acts at once.
    // Abandoning the run throws away work that may already exist, so it asks.
    show([node('approve-cost', FINANCE)], { groups: [FINANCE] });
    fireEvent.click(
      step('approve-cost').getByRole('button', { name: /Refuse and stop/ }),
    );
    expect(screen.queryByText(/This ends the run/)).toBeNull();

    cleanup();
    show([node('approve-cost', FINANCE)], { actor: REQUESTER });
    fireEvent.click(
      screen.getByRole('button', { name: /Stop the whole workflow/ }),
    );
    expect(screen.getByText(/This ends the run/)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Reason (optional)'),
    ).toBeInTheDocument();
  });
});
