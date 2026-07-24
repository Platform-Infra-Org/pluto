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
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span
            aria-label={`${unread} unread`}
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white ring-2 ring-background"
          >
            {unread}
          </span>
        )}
      </button>
      {open && <NotificationDropdown items={items} onMarkAllRead={markAllRead} />}
    </div>
  )
}
