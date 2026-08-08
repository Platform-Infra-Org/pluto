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

## The second gate

A workflow can stop halfway and ask. Where step 4 polls for a terminal phase, it
also reads the workflow's nodes for an Argo `suspend` step that is waiting, and
moves the request to `AWAITING_INPUT` when it finds one.

This is a second approval, later in the run and with better information: the
first decides whether to start, on nothing but the request; this one decides
whether to continue, with what the workflow has computed in the meantime — a
plan, a cost, a diff.

Three details make it work, and each is a trap for anything written against
Argo:

- **A waiting suspend node reports `phase: Running`.** There is no "Suspended"
  phase, so detection is the pair `type: Suspend` **and** `phase: Running`.
  Nothing that keys off phase alone will ever see it.
- **The workflow's phase is `Running` too.** Without the node check, a request
  parked at a gate is indistinguishable from one busily provisioning, and would
  sit that way indefinitely.
- **The poll already had the answer.** The list call it makes to read the phase
  returns `status.nodes` as well, so noticing a gate costs no extra request.

The transition is reversible in both directions. If somebody resumes the step in
the Argo UI instead of here, the next poll finds no suspended node and returns
the request to `IN_PROGRESS` — the platform never becomes the only way to move a
workflow along.

Resuming supplies the step's declared answers and releases the node; stopping
ends the run through Argo's `/stop`, so the workflow's own `onExit` handlers
still clean up. Both are gated like any approval and both are recorded in the
same audit trail. See
**[Add a mid-workflow review gate](../how-to/add-a-review-gate.md)**.

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

`APPROVED`, `IN_PROGRESS` and `AWAITING_INPUT` are never deleted or expired,
whatever the configuration. A live workflow still references its request, and
`AWAITING_INPUT` is the longest-lived of the three — it waits on a human and
can sit for weeks, which makes it the state most likely to look stale to
anything that only reads timestamps.

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

## A request may name more than one resource

A bulk request holds `resourceNames` and acts on all of them under one
approval. Nothing about the lifecycle changes: the same states, the same gate,
the same mirroring of the workflow phase.

Two consequences worth stating. The approver approves the *set* — so the
request page lists every name in full rather than a count, because the list is
the thing being decided on. And the states keep meaning what they meant:
`FAILED` means the workflow failed, not that nothing happened. A bulk delete
that fails on its fourth resource has already deleted three, and the workflow
graph — one node per resource — is where that is legible.

There is one exception, and it is deliberate: a batch naming a resource that
cannot be resolved is **refused whole**, before any workflow is submitted. The
alternative is worse than failing — an unreadable resource would be deleted
with an empty payload, so a workflow that decommissions from `data` would skip
the real teardown, remove the files anyway, and report success. A batch is
all-or-nothing about *knowing what it is doing*, even though it is not
all-or-nothing about doing it.

## Failing before there is a workflow

Almost every failure is a workflow failure, discovered by the poller. One is
not: the submit itself can fail, and by then the decision is already recorded.

That request goes to `FAILED` with the reason stored on it, rather than staying
in `APPROVED`. The distinction matters because `APPROVED` claims the request
was accepted and is on its way, and a request stuck there is unrecoverable by
design — the poller only advances requests that have a workflow, and this one
never got far enough to have one.

The reason is kept on the request rather than only returned to whoever clicked
approve. A failure that exists solely as a toast is a failure nobody can
investigate an hour later.

## Correlation, precisely

The single correlation key is the Argo label `platform.io/request-id=<id>`,
injected on submit and always winning over any user-set label. Status, the DAG
view, and completion gating all key on it.
