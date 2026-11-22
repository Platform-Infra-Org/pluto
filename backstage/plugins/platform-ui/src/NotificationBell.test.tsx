import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { notificationsApiRef } from '@backstage/plugin-notifications';
import { NotificationBadge } from './NotificationBell';

const renderBadge = (unread: number) =>
  render(
    <TestApiProvider
      apis={
        [
          [
            notificationsApiRef,
            { getStatus: jest.fn().mockResolvedValue({ unread }) },
          ],
        ] as never
      }
    >
      <NotificationBadge />
    </TestApiProvider>,
  );

describe('NotificationBadge', () => {
  it('caps the visible unread count at 99+', async () => {
    renderBadge(125);
    expect(await screen.findByText('99+')).toHaveClass('sc-nav-count');
  });

  it('renders no badge when there are no unread notifications', async () => {
    renderBadge(0);
    await screen.findByTestId('notification-badge-empty');
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
