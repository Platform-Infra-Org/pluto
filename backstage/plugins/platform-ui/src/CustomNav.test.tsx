import '@testing-library/jest-dom';
import { screen, within } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { CustomNav } from './CustomNav';

jest.mock('./useIsAdmin', () => ({ useIsAdmin: () => false }));
jest.mock('./NotificationBell', () => ({
  NotificationBadge: () => <span>7</span>,
}));
jest.mock('./SignOutButton', () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

const items = [
  { href: '/', title: 'Home', icon: <span>H</span> },
  { href: '/notifications', title: 'Notifications', icon: <span>N</span> },
];
const navItems = {
  withComponent: (
    renderItem: (item: (typeof items)[number]) => JSX.Element,
  ) => {
    const rendered = items.map(renderItem);
    return {
      take: () => rendered[0],
      rest: () => rendered.slice(1),
    };
  },
};

it('puts the unread count on Notifications and sign out in the footer', async () => {
  await renderInTestApp(<CustomNav navItems={navItems} />);

  const notifications = screen.getByRole('link', { name: /Notifications/ });
  expect(within(notifications).getByText('7')).toBeInTheDocument();
  expect(screen.getByText('Sign out').closest('.sc-nav-footer')).not.toBeNull();
});
