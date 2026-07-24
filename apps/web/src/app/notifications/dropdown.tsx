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
      className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-semibold">Notifications</span>
        <button onClick={onMarkAllRead} className="text-xs font-medium text-primary hover:underline">
          Mark all read
        </button>
      </div>
      {recent.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">No notifications.</p>
      ) : (
        <ul className="max-h-96 overflow-auto">
          {recent.map((n) => {
            const inner = (
              <div className="border-b border-border px-3 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  {!n.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  <span className={n.read_at ? 'text-muted-foreground' : 'font-medium'}>{n.title}</span>
                </div>
                {n.body && <div className="mt-0.5 text-xs text-muted-foreground">{n.body}</div>}
              </div>
            )
            return (
              <li key={n.id}>
                {n.request_id != null ? (
                  <Link
                    to="/requests/$requestId"
                    params={{ requestId: String(n.request_id) }}
                    className="block transition-colors hover:bg-accent"
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
        className="block border-t border-border px-3 py-2 text-center text-xs font-medium text-primary hover:underline"
      >
        View all
      </Link>
    </div>
  )
}
