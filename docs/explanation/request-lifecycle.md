# Explanation: the request lifecycle

A request is the unit of change. Understanding its lifecycle explains most of the
backend.

## From template run to done

1. **A template run files a request.** The `platform:request:submit` scaffolder
   action POSTs to the requests backend on behalf of the user. Nothing is
   provisioned — the request starts `PENDING_APPROVAL`. At creation the backend
   resolves the **owning team** (from the template owner) and, for update/delete,
   the **verb workflow config** and the **resource's data + git paths**.
2. **A decision is applied.** `applyDecision` (a pure state machine) checks the
   gate (admin or owning-team member) and the policy (SINGLE / N_OF_M). Approval
   → `APPROVED`; rejection → `REJECTED`.
3. **The workflow submits.** On `APPROVED`, the backend submits the Argo workflow
   described by `argoSubmit` (resolving `<< tokens >>`), labelled with the request
   id, and flips the request to `IN_PROGRESS`.
4. **Completion gating.** A scheduled poll reads the workflow's phase back *by
   that label*. The request stays `IN_PROGRESS` until the workflow is terminal —
   `Succeeded` → `SUCCEEDED`, `Failed`/`Error` → `FAILED`. **This is the "don't
   show done until the workflow is done" guarantee.**
5. **Result linking.** On success, the backend reads the configured output
   parameter (`resultOutput`) off the finished workflow and stores it as
   `resultRef` — the request page links to the created resource.

## When nobody decides

A request can also end without a decision. If it sits in `PENDING_APPROVAL`
longer than `platform.requests.retention.pendingExpiryDays`, the retention task
moves it to **`EXPIRED`** — a terminal state like `REJECTED`, visible in the
list with its own badge.

Expiry is not deletion, and that is the point: a request that silently
disappeared from the requester's list would be indistinguishable from a bug.

Expiring clears the held secret. A request carrying a *provided* secret keeps it
envelope-encrypted until a decision; approve consumes it, reject clears it, and
expiry clears it for the same reason — a request nobody ever decided must not
keep its ciphertext indefinitely.

## What is kept, and for how long

Nothing is deleted unless `platform.requests.retention.enabled` is set. With it
on, each terminal state has its own window, counted from when the request was
last touched:

| State | Default window |
|---|---|
| `SUCCEEDED` | 90 days |
| `FAILED` | 90 days |
| `REJECTED` | 30 days |
| `EXPIRED` | 30 days |

Deleting a request deletes its approvals with it. Any window set to `0` means
that state is kept forever.

**`APPROVED` and `IN_PROGRESS` are never deleted**, at any age, and that is not
configurable. A live Argo workflow still references its request, and the secret
sweep reads the set of `IN_PROGRESS` ids to decide which Kubernetes Secrets are
orphaned — removing one of those rows would make the sweep delete a Secret a
running workflow is mounting.

## Why poll instead of webhooks

Argo is the source of truth for workflow state; the backend **mirrors** it by
polling by label every few seconds. It's simple and self-healing (a missed read
just retries), at the cost of up-to-5s latency — a fine trade at this scale. A
watch/webhook would be the optimization if it grew.

## Notifications

The requester is alerted on every meaningful transition — approved (workflow
running), rejected, and the terminal succeeded/failed (with the created resource
ref). Approvers are alerted when a new request needs a decision. Notifications are
best-effort and never block the flow.

## Correlation, precisely

The single correlation key is the Argo label `platform.io/request-id=<id>`,
injected on submit and always winning over any user-set label. Status, the DAG
view, and completion gating all key on it.
