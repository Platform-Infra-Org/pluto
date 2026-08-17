import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { requestsApiRef } from '../api';
import { StopWorkflowButton } from './StopWorkflowButton';

const OWNER = 'group:default/team-a';
const FINANCE = 'group:default/finance';
const REQUESTER = 'dana';

/**
 * Abandoning a run, as opposed to refusing one gate (SuspendPanel.test.tsx).
 *
 * These cases moved here with the control: it used to sit at the foot of the
 * suspend panel, which meant it only existed while a step happened to be
 * waiting on somebody. It lives beside the workflow graph now and is offered
 * for as long as the run is.
 */
describe('StopWorkflowButton', () => {
  const stop = jest.fn(async () => ({ stopped: true }) as any);

  beforeEach(() => stop.mockClear());

  const show = (who: { isAdmin?: boolean; groups?: string[]; actor?: string }) =>
    render(
      <TestApiProvider apis={[[requestsApiRef, { stop } as any]]}>
        <StopWorkflowButton
          requestId={1}
          isAdmin={who.isAdmin ?? false}
          groups={who.groups ?? []}
          // Defaults to somebody who is neither the requester nor in any group.
          actor={who.actor ?? 'nobody'}
          requester={REQUESTER}
          ownerGroup={OWNER}
          onStopped={() => {}}
        />
      </TestApiProvider>,
    );

  const button = () => screen.queryByRole('button', { name: /Stop workflow/ });

  it('offers the owning team a way out even when it may answer no gate', () => {
    // The reason this is a separate control: a request whose every gate names
    // another team leaves the owner able to answer nothing, and they still own
    // the request.
    show({ groups: [OWNER] });
    expect(button()).toBeEnabled();
  });

  it('lets the person who filed it abandon their own request', () => {
    // Not an admin, in no group at all — but it is theirs, and they should not
    // have to find an approver to withdraw it.
    show({ actor: REQUESTER });
    expect(button()).toBeEnabled();
  });

  it('withholds it from a team that owns only a gate', () => {
    show({ groups: [FINANCE] });
    expect(button()).toBeNull();
  });

  it('never lets an unresolved identity match an unrecorded requester', () => {
    // Both empty compared equal in the first cut, which opened this to anyone
    // whose identity had not loaded yet. The emptiness was the bug; it must not
    // also be the key.
    render(
      <TestApiProvider apis={[[requestsApiRef, { stop } as any]]}>
        <StopWorkflowButton
          requestId={1}
          isAdmin={false}
          groups={[]}
          actor=""
          requester=""
          onStopped={() => {}}
        />
      </TestApiProvider>,
    );
    expect(button()).toBeNull();
  });

  it('asks before it acts, and does nothing if the answer is no', () => {
    show({ actor: REQUESTER });
    fireEvent.click(button()!);

    // The dialog says what will happen, and offers the reason field that
    // reaches the same audit trail an approval note does.
    expect(screen.getByText(/This ends the run/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Reason (optional)')).toBeInTheDocument();
    expect(stop).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(stop).not.toHaveBeenCalled();
  });

  it('sends the reason with the stop, and no nodeId', () => {
    show({ actor: REQUESTER });
    fireEvent.click(button()!);
    fireEvent.change(screen.getByPlaceholderText('Reason (optional)'), {
      target: { value: 'wrong region' },
    });
    // The confirm button inside the dialog, not the one that opened it.
    const confirm = screen
      .getAllByRole('button', { name: /Stop workflow/ })
      .pop()!;
    fireEvent.click(confirm);

    // No nodeId: this is the request-level stop, which is what makes the
    // backend ask the request-level question rather than a gate's.
    expect(stop).toHaveBeenCalledWith(1, 'wrong region');
  });

  it('turns red only under the pointer', () => {
    // A control that ends a running workflow sits in a toolbar beside ordinary
    // ones; red at rest would read as an error the page is reporting.
    show({ actor: REQUESTER });
    expect(button()!.className).toContain('sc-btn-outline');
    expect(button()!.className).toContain('sc-btn-danger');
    expect(button()!.className).not.toContain('sc-btn-destructive');
  });
});
