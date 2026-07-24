import { Link } from '@tanstack/react-router'
import { useNotifications } from './useNotifications'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// Full notification history. Same live hook as the bell, rendered as a page.
export function NotificationsPage() {
  const { items, unread, markAllRead } = useNotifications()

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            Mark all read ({unread})
          </Button>
        )}
      </div>
      {items.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">No notifications.</Card>
      )}
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id}>
            <Card className={`p-4 text-sm ${n.read_at ? '' : 'border-primary/30 bg-primary/5'}`}>
              <div className="flex items-start justify-between gap-3">
                {n.request_id != null ? (
                  <Link
                    to="/requests/$requestId"
                    params={{ requestId: String(n.request_id) }}
                    className="font-medium text-primary hover:underline"
                  >
                    {n.title}
                  </Link>
                ) : (
                  <span className="font-medium">{n.title}</span>
                )}
                <Badge variant="muted">{n.type}</Badge>
              </div>
              {n.body && <p className="mt-1 text-muted-foreground">{n.body}</p>}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
