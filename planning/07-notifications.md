# 07 — In-App Notifications

The research verified the **transport** (SSE) but flagged that **notification architecture beyond
transport — persistence, read/unread, fan-out, delivery guarantees — was not covered by verified
claims** ([09](09-research-findings.md), open questions). Transport is **[R]**; the rest is **[D]**.

## Three-layer model **[D]**

```
  Event source            Notification service           Delivery
  (BFF domain events) ──▶  persist + fan-out       ──▶   in-app inbox (SSE push
   request submitted        (notifications table)          + REST for history)
   approval needed
   approved / rejected
   workflow done/failed
```

1. **Backend orchestration** — domain events raise notifications.
2. **Persistence** — every notification is a row in Postgres (survives reconnects/offline). **[D]**
3. **Delivery** — pushed live over **SSE**; the inbox also loads history over REST. **[D]**

## Why SSE (not WebSockets) **[R]**

Notifications and workflow status are **server→client only** — the client just listens. SSE is the
recommended transport for exactly this (live feeds, dashboards, status): unidirectional, HTTP-native,
built-in auto-reconnect via the browser `EventSource`, ~half the code and no connection-state
management vs WebSockets. If we ever need bidirectional interaction, WebSockets remain the escape
hatch — but we don't need it here. **[R]**

**One SSE channel per user** carries both notification events and workflow-status updates
(distinguished by event type), so the browser holds a single connection. **[D]**

## Notification model **[D]**

```
Notification {
  id, user_id,
  type       : APPROVAL_NEEDED | REQUEST_APPROVED | REQUEST_REJECTED |
               WORKFLOW_SUCCEEDED | WORKFLOW_FAILED,
  request_id : link back to the Request,
  title, body,
  read_at    : null until read,
  created_at
}
```

## Events that raise notifications **[D]**

| Event | Recipients |
|-------|-----------|
| Request submitted → needs approval | owner-team approvers |
| Request approved / rejected | the requester |
| Workflow succeeded | the requester |
| Workflow failed (+ failed step) | the requester (and optionally owner team) |

## Delivery guarantees **[D]**

- **Persist-then-push:** write the notification row, then emit over SSE. If the user is offline or
  the SSE drops, nothing is lost — the inbox reloads unread from Postgres on next connect. SSE is a
  fast path, not the system of record.
- **Read state:** `read_at` set when the user opens/acknowledges; unread badge count = `read_at IS
  NULL`.
- **De-dup:** at-least-once push may repeat; the client keys by notification `id`.

## Multi-replica fan-out **[D]**

SSE connections are per-BFF-replica, but a notification may be raised on a different replica than
the one holding the user's connection. Options, cheapest first:

1. **Postgres `LISTEN/NOTIFY`** — replicas subscribe; the replica holding the user's SSE connection
   pushes. No new infrastructure. **Recommended start.**
2. **Redis pub/sub** — if notification volume outgrows Postgres NOTIFY.

Don't build for (2) until (1) measurably strains — YAGNI.

## UI **[D]**

- **Notification bell** with unread count; dropdown of recent; "mark all read".
- **Notifications page** for full history, filterable by type/request.
- Clicking a notification deep-links to the relevant Request/workflow-status view.

## Future channels (out of scope now) **[D]**

The model (typed events + persisted notifications) leaves room to add email/Slack later by adding
delivery adapters off the same events — but in-app only for v1.
