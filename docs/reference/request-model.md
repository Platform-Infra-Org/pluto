# Reference: request model

## Kinds

`CREATE` · `UPDATE` · `DELETE` — the verb a request performs on a resource.

## States

```
PENDING_APPROVAL ──approve──▶ APPROVED ──(workflow submitted)──▶ IN_PROGRESS
       │                                                              │ ▲
       ├──reject──▶ REJECTED                                          │ │
       │                                          suspend step ───────┘ │
       └──(nobody decides)──▶ EXPIRED                     │             │
                                                   AWAITING_INPUT ──────┘
                                                          resume
                                             Succeeded ──▶ SUCCEEDED
                                             Failed/Error ─▶ FAILED
```

| State | Meaning |
|---|---|
| `PENDING_APPROVAL` | awaiting a decision |
| `APPROVED` | decision met the policy; workflow about to submit. Momentary — a request does not rest here |
| `IN_PROGRESS` | Argo workflow running (polled) |
| `AWAITING_INPUT` | the workflow stopped at a `suspend` step and needs an approver |
| `SUCCEEDED` | workflow succeeded (completion-gated) |
| `FAILED` | workflow failed/errored, an approver stopped it, **or the workflow could not be submitted at all** |
| `REJECTED` | rejected |
| `EXPIRED` | nobody decided in time; set by the retention task |

`SUCCEEDED`, `FAILED`, `REJECTED` and `EXPIRED` are terminal.

**Nothing rests in `APPROVED`.** Approval and submission happen in one step: the
decision is recorded, the workflow is submitted, and the request moves straight
to `IN_PROGRESS`. If the submit itself fails — the batch-refusal guard is the
usual reason, see [`<< resourcesJson >>`](tokens.md) — the request goes to
`FAILED` with the reason in `error`. A request left showing `APPROVED` would be
one no poller could ever advance, because the poller only follows requests that
have a workflow.

`AWAITING_INPUT` is **not** terminal and is reversible in both directions: the
poller moves a request into it when a suspend step appears and back out when
none remains — including when somebody resumes the step in the Argo UI rather
than here. It is never deleted or expired by retention, because it is waiting
on a human and can sit for weeks. See
**[Approve a workflow mid-run](../how-to/add-a-review-gate.md)**.

## Suspend steps

While a request is `AWAITING_INPUT`, `suspendedNodes` describes what the
workflow is waiting for. It is refreshed on every poll and is a cache of Argo's
answer, never the source of truth — the resume endpoint re-reads the live
workflow before acting on it.

```ts
interface SuspendedNode {
  id: string;              // Argo node id — the only safe resume selector
  name: string;            // displayName, as shown in the graph
  templateName?: string;
  message?: string;        // the suspend template's message, if it set one
  inputs: { name: string; value?: string }[];
  suppliedOutputs: {
    name: string;
    description?: string;  // help text under the field
    enum?: string[];       // renders a dropdown; enforced server-side too
    default?: string;      // a default makes the answer optional
    required: boolean;     // true when the step declared no default
  }[];
}
```

`required` is Argo's own semantics rather than a platform convention: a default
is precisely what lets Argo resume without a value, so its absence is the
workflow author saying the answer is load-bearing.

## Approval policy

```ts
type ApprovalPolicy =
  | { mode: 'SINGLE' }              // one approval
  | { mode: 'N_OF_M'; n: number };  // n distinct approvers
```
Every approval also passes **the gate** (admin, or a member of the request's
owning team) — see **[Per-team RBAC](../explanation/rbac.md)**.

## Request fields (selected)

| Field | Meaning |
|---|---|
| `kind`, `resourceType`, `resourceName`, `params` | what's requested |
| `resourceNames` | bulk requests only: every resource acted on. Absent for a single-resource request, where `resourceName` is the whole story. When present, `resourceName` holds the same names joined, so lists, notifications and search keep working on one string |
| `error` | why it failed, when it failed. Set by the poller for a workflow that fails, and by the approve endpoint for one that could never be submitted. Shown on the request page |
| `requester` | who filed it |
| `ownerGroup` | the owning team (from the template owner); drives the gate |
| `policy` | SINGLE / N_OF_M |
| `argoSubmit` | the submit spec (per-request). Its `parameters` are merged **over** the request's `params`, each of which is forwarded to Argo as its own named parameter unless `forwardParams: false`. See [Submit tokens](tokens.md) |
| `resultOutput` / `resultRef` | which Argo output to read → the created resource ref |
| `workflowName` / `workflowNamespace` / `workflowPhase` | Argo tracking |
| `approvals[]` | recorded decisions (approver, decision, note, timestamp) |
| `createdAt` / `updatedAt` | timestamps |

## REST (plugin `platform-requests`)

| Method + path | Purpose |
|---|---|
| `POST /requests` | create a request |
| `GET /requests` | list (scoped; `?mine=1`, `?scope=approval`, `?state=`) |
| `GET /requests/:id` | one request |
| `GET /requests/:id/workflow` | the workflow DAG |
| `POST /requests/:id/approve` \| `/reject` | decide |
| `DELETE /requests/:id` | destroy the request + its approvals (admin or owning team; deletable states only) |
| `GET /resources/:name/data` | resolved resource data (for the tab/edit) |

`DELETE` is retention's rule with a person behind it, not a second one: the same
states may go (`SUCCEEDED`, `FAILED`, `REJECTED`, `EXPIRED` — `DELETABLE_STATES`
in `platform-common`, which `planRetention` is typed against so the two cannot
drift). `APPROVED`, `IN_PROGRESS` and `AWAITING_INPUT` are refused because a
live workflow still references its request and the secret sweep reads
`IN_PROGRESS` ids; `PENDING_APPROVAL` is refused because it has a decision ahead
of it. Authorisation matches `/stop`: the `platform.request.delete` permission,
then admin-or-owning-service-team on the request itself.
