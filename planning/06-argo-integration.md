# 06 — Argo Workflows Integration

This is the most concretely-verified area. Every API detail below is backed by primary Argo docs —
see [09](09-research-findings.md). **[R]**

## How the BFF talks to Argo

- Argo **ships an API server** (default port **2746**) with configurable auth — a REST/HTTP surface
  the BFF calls. **[R]**
- The BFF authenticates with a **bearer token** generated when Argo runs with **`--auth-mode
  client`** (e.g. from `argo auth token` or a Kubernetes ServiceAccount secret); passed as
  `Authorization: Bearer <token>` on each call. **[R]** This is the BFF's own identity, separate
  from the end user (user authz happens in the BFF first — see [03](03-auth-rbac.md)).

## Trigger a workflow (on approval)

- **Submit:** `POST /api/v1/workflows/{namespace}/submit` (from a WorkflowTemplate), or **create:**
  `POST /api/v1/workflows/{namespace}` with a full workflow manifest. **[R]**
  - Note: the submit body wraps the workflow under a top-level object
    (`{namespace, workflow:{metadata, spec}}`) rather than bare metadata+spec. **[R — caveat]**
- The BFF passes the request payload (resource JSON, action, target path) as **workflow
  parameters**. The Argo template does the real work: mutate the resource + **commit back to Git**,
  and touch any live systems. **[D — template design is ours]**
- **File-upload fields** ([10](10-service-request-builder.md)) are passed as Argo **input
  artifacts** (object store / artifact repository), not inlined into parameters or Git — the payload
  carries only the artifact reference (URI + checksum). **[D]**
- Store the returned workflow `namespace/name` on the Request as `workflow_ref`; move request to
  `EXECUTING`.

## Watch live status

- **Stream:** `GET /api/v1/workflow-events/{namespace}` streams `WorkflowWatchEvent` objects — the
  same mechanism Argo's own UI uses (delivered as **SSE**). **[R]** The BFF's **Argo watcher**
  consumes this stream.
- **Poll fallback:** `GET /api/v1/workflows/{namespace}/{name}` returns the full workflow with
  `status` for reconciliation / missed events. **[R]** Note a pending workflow may omit
  `status.phase` until the controller first operates on it — treat missing phase as "pending", not
  an error. **[R — caveat]**
- The BFF maps Argo phase → Request state and **pushes SSE updates to the requester's browser**
  ([07](07-notifications.md) shares the SSE channel). **[R for SSE choice]**

## Report the failed step

- On completion, the BFF reads **`status.nodes`** — a map of every workflow node (step) with its
  **phase** and **message**. **[R]**
- To surface the failure: find node(s) with phase `Failed`/`Error`, take the deepest/leaf failing
  node, and present its **step name + message** on the Request. **[R]** This is exactly requirement
  (6): "show the step in the workflow that failed."
- Store `{ failed_node_name, failed_node_message, phase }` on the Request so the failure is
  inspectable after the fact, not just live. **[D]**

## Status mapping **[D]**

| Argo phase | Request state | Shown to user |
|------------|---------------|---------------|
| (none) / Pending | EXECUTING | "Queued…" |
| Running | EXECUTING | live node tree / progress |
| Succeeded | SUCCEEDED | "Done" + link to Git change |
| Failed / Error | FAILED | failed step name + message |

## UI: workflow status view **[D]**

- A live **node tree / step list** for the running workflow (from `status.nodes`), each step with
  status icon; the failed step highlighted with its message expanded.
- Reuses the same data the BFF already parses — no direct browser→Argo calls (browser never holds
  the Argo token).

## Failure & resilience notes **[D]**

- If the BFF restarts, the Argo watcher re-subscribes and reconciles via the GET poll — no lost
  terminal states (Git + `status.nodes` are the durable truth).
- Idempotency: submitting is tied to the Request id (put it in a workflow label/annotation) so a
  retry doesn't double-execute.
- Timeouts / stuck workflows: a max-duration guard flips the Request to `FAILED` with a clear
  message if Argo never reports terminal state.
