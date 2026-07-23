# E07 — In-App Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development / executing-plans. `- [ ]` steps.

**Goal:** An in-app notification center: users are told when their request needs approval, was
approved/rejected, or finished (success/error), delivered live over SSE and backed by a persisted,
read/unread inbox.

**Architecture:** Domain events (from E05/E06) raise persisted `Notification` rows; a per-user **SSE**
channel pushes them live; the inbox also loads history over REST. **Persist-then-push** — SSE is the
fast path, Postgres is the system of record. Multi-replica fan-out via Postgres `LISTEN/NOTIFY`. **[R for SSE]/[D]**

**Tech Stack:** `sse-starlette`, Postgres `LISTEN/NOTIFY`, native `EventSource` in the SPA.

## Global Constraints
Server→client push only (SSE, not WebSockets) [R]. At-least-once; client de-dups by id. See README.

## File structure
- `apps/bff/app/notifications/model.py` — `Notification`
- `apps/bff/app/notifications/service.py` — `notify(...)`, mark-read, list
- `apps/bff/app/notifications/sse.py` — per-user SSE endpoint + fan-out (LISTEN/NOTIFY)
- `apps/bff/app/notifications/events.py` — subscribe to request/workflow events → notify recipients
- `apps/web/src/app/notifications/*` — bell, dropdown, page; `useNotifications()` (EventSource)
- tests under `tests/notifications/`

---

### Task 1: Model + service (persist, list, read-state)
**Files:** Create `app/notifications/model.py`, `service.py`, migration, `tests/notifications/test_service.py`
**Interfaces:** Produces `Notification(id, user_id, type, request_id, title, body, read_at,
created_at)`; `async notify(user_id, type, request_id, title, body) -> Notification`;
`list(user_id, unread_only)`; `mark_read(user_id, ids)`; unread count = `read_at IS NULL`.
- [ ] Failing test (notify persists; list unread; mark_read flips) → fail → implement+migrate → pass →
  commit `feat(notif): model + service`.

### Task 2: Event subscribers (who gets told what)
**Files:** Create `app/notifications/events.py`, `tests/notifications/test_events.py`
**Interfaces:** Produces handlers mapping domain events → recipients: request submitted →
owner-team approvers (`APPROVAL_NEEDED`); approved/rejected → requester; workflow succeeded/failed →
requester (`WORKFLOW_SUCCEEDED`/`WORKFLOW_FAILED`, failed includes the step). **[D]**
- [ ] Failing test (each event notifies the right recipients) → fail → implement (hook into E05/E06
  transitions) → pass → commit `feat(notif): event → recipient mapping`.

### Task 3: SSE endpoint + multi-replica fan-out
**Files:** Create `app/notifications/sse.py`, `tests/notifications/test_sse.py`
**Interfaces:** Produces `GET /api/notifications/stream` (SSE, auth'd) yielding notification + a
workflow-status event type on one channel; a `pg_notify` on insert + `LISTEN` in each replica so the
replica holding the user's connection pushes. **[D]**
- [ ] **Step 1: Failing test** — a `notify` on "replica A" is delivered to a stream opened on
  "replica B" (simulated via two sessions + LISTEN/NOTIFY); event carries the notification id.
- [ ] Steps 2–4: implement sse-starlette stream + LISTEN/NOTIFY bridge; pass.
- [ ] Commit `feat(notif): sse stream + pg fan-out`.

### Task 4: SPA — bell, dropdown, page, live updates
**Files:** Create `src/app/notifications/{bell,dropdown,page}.tsx`, `useNotifications.ts`, tests
**Interfaces:** Consumes `/api/notifications/stream` via `EventSource` (auto-reconnect) + REST history;
unread badge; mark-all-read; clicking deep-links to the request/status view.
- [ ] Failing test (incoming event bumps unread badge; mark-read clears; de-dup by id) → fail →
  implement → pass → commit `feat(web): notification center`.

## Env vars used
None new (Postgres + auth from E01/E02).

## Exit / DoD
Submitting a request notifies the owner team's approvers live; approving/finishing notifies the
requester; the bell shows unread counts, survives reconnect, and works across BFF replicas.
