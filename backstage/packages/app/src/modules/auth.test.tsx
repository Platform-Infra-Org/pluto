import { render, screen } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { configApiRef, errorApiRef } from '@backstage/core-plugin-api';
import { ConfigReader } from '@backstage/config';
import { PlatformSignInPage, oidcAuthApiRef } from './auth';

/**
 * The sign-in page renders two different cards and only one carries the scheme
 * picker, which made "the potion box is missing" hard to diagnose from the
 * outside. These pin which card is which.
 */
function renderPage(getBackstageIdentity: jest.Mock) {
  return render(
    <TestApiProvider
      apis={
        [
          [oidcAuthApiRef, { getBackstageIdentity }],
          [errorApiRef, { post: jest.fn() }],
          // PlatformMark reads app.branding.mark.
          [configApiRef, new ConfigReader({})],
        ] as never
      }
    >
      <PlatformSignInPage onSignInSuccess={jest.fn()} />
    </TestApiProvider>,
  );
}

describe('PlatformSignInPage', () => {
  it('offers the scheme picker once the session check has resolved', async () => {
    const { container } = renderPage(jest.fn(async () => undefined));
    await screen.findByText(/press start/i);
    expect(container.querySelectorAll('.sc-login-pick')).toHaveLength(1);
    // One bottle plus a toggle: the sign-in card uses the same collapsed box
    // the app does, because a flat shelf of every scheme outgrew the card.
    expect(container.querySelectorAll('.sc-potion')).toHaveLength(1);
    expect(container.querySelector('.sc-picker-toggle')).not.toBeNull();
  });

  it('shows no picker while it is still restoring a session', () => {
    // The restoring card is a different card. It never resolves here, which is
    // exactly the state that looks like a login page with a missing picker.
    const { container } = renderPage(jest.fn(() => new Promise(() => {})));
    expect(screen.getByText(/signing you in/i)).toBeInTheDocument();
    expect(container.querySelectorAll('.sc-potion')).toHaveLength(0);
  });
});
