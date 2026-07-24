import { Link } from '@tanstack/react-router'
import { type Notification } from '@/lib/notifications'

export function NotificationDropdown({
  items,
  onMarkAllRead,
}: {
  items: Notification[]
  onMarkAllRead: () => void
}) {
  const recent = items.slice(0, 10)
  return (
    <div
      role="menu"
      className="absolute right-0 mt-2 w-80 rounded border bg-white shadow-lg z-10"
    >
      <div className="flex items-center justify-between border-b p-2">
        <span className="text-sm font-medium">Notifications</span>
        <button onClick={onMarkAllRead} className="text-xs text-blue-600 hover:underline">
          Mark all read
        </button>
      </div>
      {recent.length === 0 ? (
        <p className="p-4 text-sm text-gray-500">No notifications.</p>
      ) : (
        <ul>
          {recent.map((n) => {
            const inner = (
              <div className={`border-b p-2 text-sm ${n.read_at ? 'text-gray-500' : 'font-medium'}`}>
                <div>{n.title}</div>
                {n.body && <div className="text-xs text-gray-400">{n.body}</div>}
              </div>
            )
            return (
              <li key={n.id}>
                {n.request_id != null ? (
                  <Link
                    to="/requests/$requestId"
                    params={{ requestId: String(n.request_id) }}
                    className="block hover:bg-gray-50"
                  >
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            )
          })}
        </ul>
      )}
      <Link
        to="/notifications"
        className="block border-t p-2 text-center text-xs text-blue-600 hover:underline"
      >
        View all
      </Link>
    </div>
  )
}
