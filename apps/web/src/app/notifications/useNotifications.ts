import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchNotifications,
  markNotificationsRead,
  notificationsStreamUrl,
  type Notification,
} from '@/lib/notifications'

export interface UseNotifications {
  items: Notification[]
  unread: number
  markAllRead: () => void
}

// Loads REST history, then keeps it live over SSE. At-least-once delivery means
// the same notification may arrive twice (history + push, or reconnect replay),
// so we de-dup by id. Native EventSource auto-reconnects on drop.
export function useNotifications(): UseNotifications {
  const [items, setItems] = useState<Notification[]>([])
  const esRef = useRef<EventSource | null>(null)

  const upsert = useCallback((incoming: Notification[]) => {
    setItems((prev) => {
      const byId = new Map<number, Notification>()
      for (const n of prev) byId.set(n.id, n)
      for (const n of incoming) byId.set(n.id, { ...byId.get(n.id), ...n })
      return [...byId.values()].sort((a, b) => b.id - a.id)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchNotifications()
      .then((r) => {
        if (!cancelled) upsert(r.items)
      })
      .catch(() => {})

    const es = new EventSource(notificationsStreamUrl(), { withCredentials: true })
    esRef.current = es
    es.addEventListener('notification', (e) => {
      try {
        upsert([JSON.parse((e as MessageEvent).data) as Notification])
      } catch {
        /* ignore malformed frame */
      }
    })

    return () => {
      cancelled = true
      es.close()
      esRef.current = null
    }
  }, [upsert])

  const unread = items.filter((n) => !n.read_at).length

  const markAllRead = useCallback(() => {
    const nowIso = new Date().toISOString()
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: nowIso })))
    markNotificationsRead().catch(() => {})
  }, [])

  return { items, unread, markAllRead }
}
