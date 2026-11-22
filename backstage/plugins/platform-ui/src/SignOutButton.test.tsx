import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { identityApiRef } from '@backstage/core-plugin-api';
import { SignOutButton } from './SignOutButton';

it('signs out from the sidebar footer', () => {
  const signOut = jest.fn();
  render(
    <TestApiProvider apis={[[identityApiRef, { signOut }]] as never}>
      <SignOutButton />
    </TestApiProvider>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Sign out')).toHaveClass('sc-nav-tx');
});
