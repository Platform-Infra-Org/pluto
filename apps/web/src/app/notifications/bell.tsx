import { useState } from 'react'
import { Bell } from 'lucide-react'
import { useNotifications } from './useNotifications'
import { NotificationDropdown } from './dropdown'

// Bell with unread badge; toggles a dropdown of recent notifications.
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { items, unread, markAllRead } = useNotifications()

  return (
    <div className="relative">
      <button
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span
            aria-label={`${unread} unread`}
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-xs text-white"
          >
            {unread}
          </span>
        )}
      </button>
      {open && <NotificationDropdown items={items} onMarkAllRead={markAllRead} />}
    </div>
  )
}
