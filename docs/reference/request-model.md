# Reference: request model

## Kinds

`CREATE` · `UPDATE` · `DELETE` — the verb a request performs on a resource.

## States

```
PENDING_APPROVAL ──approve──▶ APPROVED ──(workflow submitted)──▶ IN_PROGRESS
       │                                                              │
       └──reject──▶ REJECTED                        Succeeded ──▶ SUCCEEDED
                                                    Failed/Error ─▶ FAILED
```

| State | Meaning |
|---|---|
| `PENDING_APPROVAL` | awaiting a decision |
| `APPROVED` | decision met the policy; workflow about to submit |
| `IN_PROGRESS` | Argo workflow running (polled) |
| `SUCCEEDED` | workflow succeeded (completion-gated) |
| `FAILED` | workflow failed/errored |
| `REJECTED` | rejected |

`SUCCEEDED`, `FAILED`, `REJECTED` are terminal.

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
| `requester` | who filed it |
| `ownerGroup` | the owning team (from the template owner); drives the gate |
| `policy` | SINGLE / N_OF_M |
| `argoSubmit` | the submit spec (per-request) |
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
| `GET /resources/:name/data` | resolved resource data (for the tab/edit) |
