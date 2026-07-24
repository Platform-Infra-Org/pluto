import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/lib/notifications'
import type { Notification } from '@/lib/notifications'
import { useNotifications } from './useNotifications'

vi.mock('@/lib/notifications', async (orig) => ({
  ...(await orig<typeof api>()),
  fetchNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
  notificationsStreamUrl: vi.fn(() => 'http://test/stream'),
}))

class MockEventSource {
  static last: MockEventSource | null = null
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {}
  closed = false
  url: string
  constructor(url: string) {
    this.url = url
    MockEventSource.last = this
  }
  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    ;(this.listeners[type] ??= []).push(cb)
  }
  emit(type: string, data: unknown) {
    for (const cb of this.listeners[type] ?? []) cb({ data: JSON.stringify(data) } as MessageEvent)
  }
  close() {
    this.closed = true
  }
}

function notif(over: Partial<Notification> & { id: number }): Notification {
  return {
    type: 'REQUEST_APPROVED',
    request_id: over.id,
    title: `n${over.id}`,
    body: '',
    read_at: null,
    created_at: null,
    ...over,
  }
}

beforeEach(() => {
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource)
  vi.mocked(api.fetchNotifications).mockResolvedValue({ items: [], unread: 0 })
  vi.mocked(api.markNotificationsRead).mockResolvedValue({ updated: 0, unread: 0 })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('useNotifications', () => {
  it('loads REST history and counts unread', async () => {
    vi.mocked(api.fetchNotifications).mockResolvedValue({
      items: [notif({ id: 1 }), notif({ id: 2, read_at: 't' })],
      unread: 1,
    })
    const { result } = renderHook(() => useNotifications())
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    expect(result.current.unread).toBe(1)
  })

  it('an incoming SSE event bumps the unread badge', async () => {
    const { result } = renderHook(() => useNotifications())
    await waitFor(() => expect(MockEventSource.last).not.toBeNull())

    act(() => MockEventSource.last!.emit('notification', notif({ id: 5 })))
    await waitFor(() => expect(result.current.unread).toBe(1))
    expect(result.current.items.map((n) => n.id)).toEqual([5])
  })

  it('de-dups by id across REST and SSE', async () => {
    vi.mocked(api.fetchNotifications).mockResolvedValue({ items: [notif({ id: 5 })], unread: 1 })
    const { result } = renderHook(() => useNotifications())
    await waitFor(() => expect(result.current.items).toHaveLength(1))

    act(() => MockEventSource.last!.emit('notification', notif({ id: 5 })))
    act(() => MockEventSource.last!.emit('notification', notif({ id: 6 })))
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    expect(result.current.items.map((n) => n.id)).toEqual([6, 5])
  })

  it('mark-all-read clears unread and calls the API', async () => {
    vi.mocked(api.fetchNotifications).mockResolvedValue({ items: [notif({ id: 1 })], unread: 1 })
    const { result } = renderHook(() => useNotifications())
    await waitFor(() => expect(result.current.unread).toBe(1))

    act(() => result.current.markAllRead())
    await waitFor(() => expect(result.current.unread).toBe(0))
    expect(api.markNotificationsRead).toHaveBeenCalledOnce()
  })

  it('closes the EventSource on unmount', async () => {
    const { unmount } = renderHook(() => useNotifications())
    await waitFor(() => expect(MockEventSource.last).not.toBeNull())
    const es = MockEventSource.last!
    unmount()
    expect(es.closed).toBe(true)
  })
})
