import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Notification } from '@/lib/notifications'
import { NotificationBell } from './bell'
import * as hook from './useNotifications'

vi.mock('./useNotifications')

function notif(id: number, over: Partial<Notification> = {}): Notification {
  return {
    id, type: 'APPROVAL_NEEDED', request_id: id, title: `Needs approval ${id}`,
    body: 'please review', read_at: null, created_at: null, ...over,
  }
}

describe('NotificationBell', () => {
  it('shows the unread badge and opens the dropdown with deep links', () => {
    const markAllRead = vi.fn()
    vi.mocked(hook.useNotifications).mockReturnValue({
      items: [notif(7)], unread: 3, markAllRead,
    })
    render(<NotificationBell />)

    // Badge reflects unread count.
    expect(screen.getByLabelText('3 unread')).toHaveTextContent('3')

    // Dropdown is closed until the bell is clicked.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Notifications'))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    // Notification deep-links to its request.
    expect(screen.getByText('Needs approval 7').closest('a')).toHaveAttribute('href', '/requests/7')

    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }))
    expect(markAllRead).toHaveBeenCalledOnce()
  })

  it('hides the badge when there is nothing unread', () => {
    vi.mocked(hook.useNotifications).mockReturnValue({
      items: [], unread: 0, markAllRead: vi.fn(),
    })
    render(<NotificationBell />)
    expect(screen.queryByLabelText(/unread/)).not.toBeInTheDocument()
  })
})
