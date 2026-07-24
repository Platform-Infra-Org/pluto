import { notificationLink } from '@/lib/notifications'
import { useNotifications } from './useNotifications'

// Full notification history. Same live hook as the bell, rendered as a page.
export function NotificationsPage() {
  const { items, unread, markAllRead } = useNotifications()

  return (
    <div className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        {unread > 0 && (
          <button onClick={markAllRead} className="text-sm text-blue-600 hover:underline">
            Mark all read ({unread})
          </button>
        )}
      </div>
      {items.length === 0 && <p className="text-gray-500">No notifications.</p>}
      <ul className="space-y-2">
        {items.map((n) => {
          const link = notificationLink(n)
          return (
            <li key={n.id} className={`rounded border p-3 text-sm ${n.read_at ? '' : 'bg-blue-50'}`}>
              {link ? (
                <a href={link} className="text-blue-600 hover:underline">
                  {n.title}
                </a>
              ) : (
                <span>{n.title}</span>
              )}
              {n.body && <p className="mt-1 text-gray-500">{n.body}</p>}
              <span className="ml-2 text-xs text-gray-400">{n.type}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
