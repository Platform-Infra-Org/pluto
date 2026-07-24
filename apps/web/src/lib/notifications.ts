import { apiFetch } from './api'
import { getAccessToken } from './token'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export interface Notification {
  id: number
  user_id?: string
  type: string
  request_id: number | null
  title: string
  body: string
  read_at: string | null
  created_at: string | null
}

export function fetchNotifications() {
  return apiFetch<{ items: Notification[]; unread: number }>('/notifications')
}

export function markNotificationsRead(ids?: number[]) {
  // ids omitted => mark all unread read.
  return apiFetch<{ updated: number; unread: number }>('/notifications/read', {
    method: 'POST',
    body: JSON.stringify({ ids: ids ?? null }),
  })
}

// Native EventSource can't set an Authorization header, so the BFF stream also
// accepts the bearer token as a query param.
export function notificationsStreamUrl(): string {
  const token = getAccessToken()
  const q = token ? `?access_token=${encodeURIComponent(token)}` : ''
  return `${API_BASE_URL}/notifications/stream${q}`
}

// Deep-link target for a notification (the related request), or null.
export function notificationLink(n: Notification): string | null {
  return n.request_id != null ? `/requests/${n.request_id}` : null
}
