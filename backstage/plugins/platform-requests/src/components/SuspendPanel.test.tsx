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

const show = (
  nodes: SuspendedNode[],
  who: {
    isAdmin?: boolean;
    groups?: string[];
  } = {},
) =>
  render(
    <TestApiProvider apis={[[requestsApiRef, {} as any]]}>
      <SuspendPanel
        requestId={1}
        nodes={nodes}
        isAdmin={who.isAdmin ?? false}
        groups={who.groups ?? []}
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


  it('offers the team that owns a gate a way to refuse it', () => {
    // Abandoning the whole request is a different question and a different
    // control — see StopWorkflowButton.test.tsx. This panel only refuses steps.
    show([node('approve-cost', FINANCE)], { groups: [FINANCE] });
    expect(
      step('approve-cost').getByRole('button', { name: /Refuse and stop/ }),
    ).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Stop workflow/ })).toBeNull();
  });



});
