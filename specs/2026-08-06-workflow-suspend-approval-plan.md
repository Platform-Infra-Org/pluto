# Mid-workflow suspend approval — plan

**Goal:** when a provisioning workflow hits an Argo `suspend` step, the request
notices, shows the step yellow in the graph with the parameters the step was
given, and offers an approver a **Resume** action that actually resumes the
real workflow.

This is the second approval gate. The first one decides *whether to start*; this
one decides *whether to continue*, with the workflow's own intermediate values in
front of the approver — a plan output, a diff, a cost estimate, a dry-run result.

---

## What Argo actually gives us

Four facts drive the whole design. Three of them are traps.

**1. A suspended node's phase is `Running`, not `Suspended`.** There is no
suspended phase. The only reliable signal is the pair:

```
node.type === 'Suspend' && node.phase === 'Running'
```

Anything that keys off phase alone will never see it.

**2. The workflow's own phase is also `Running`.** So the existing poller
(`plugin.ts:229`) sees a perfectly healthy `IN_PROGRESS` request and does
nothing — indefinitely. A workflow can sit suspended for a week and today the
request looks identical to one actively provisioning.

**3. The list call we already make returns the nodes.** `statusFor` lists
workflows by label and reads only `status.phase`, `message` and
`status.outputs` — but the response already contains `status.nodes` in full.
Detecting suspension costs **zero extra requests**; it is a parsing change, not
a polling change.

**4. Resuming is two calls, and only one of them is always needed.**

- Supplying values the suspend step declared as `valueFrom: supplied: {}`:
  `PUT /api/v1/workflows/{ns}/{name}/set` with `nodeFieldSelector` and
  `outputParameters`.
- Releasing the node:
  `PUT /api/v1/workflows/{ns}/{name}/resume` with `{ namespace, name, nodeFieldSelector }`.

`nodeFieldSelector` is a comma-separated field match — `id=<nodeId>` is the
precise form; `displayName=approve` is the readable one. **Use `id`**: a
workflow may contain several suspend steps with the same display name across
loop iterations, and resuming the wrong one is silent.

Sources: [Suspend template outputs example](https://github.com/argoproj/argo-workflows/blob/main/examples/suspend-template-outputs.yaml) ·
[Suspending walk-through](https://argo-workflows.readthedocs.io/en/latest/walk-through/suspending/)

---

## Design

### The request gets a state, not a flag

Add `AWAITING_INPUT` to `RequestState` (`platform-common/src/index.ts:8`).

The alternative — keep `IN_PROGRESS` and hang a boolean off the row — was
rejected because every surface that would need to react is already
state-driven: the badge, the sprite (`STATE_SPRITES`), the list filter, the
approval-queue scope, the notifier, the retention planner. A flag means
building a parallel path through all six; a state reuses them.

Consequences to handle, each of which is a real edit and not a formality:

| Surface | What it needs |
|---|---|
| `STATE_SPRITES` | A sprite. `TORCH` — the thing already drawn for "running, wants attention". |
| Badge variant | `warning`, matching the yellow in the graph. |
| `stateMachine.ts` | `IN_PROGRESS → AWAITING_INPUT → IN_PROGRESS`, repeatable. Not terminal. |
| `retention.ts` | **Never deleted, never expired.** It is in flight and waiting on a human, exactly like `PENDING_APPROVAL` is not deleted. Add it to the same non-terminal set, and make `planRetention` prove it in a test. |
| Approval queue | A request awaiting input belongs in the same "needs me" list as one awaiting first approval. |

### Detection: parse what we already fetch

Extend `WorkflowStatus` (`argo.ts:118`) with:

```ts
suspendedNodes?: Array<{
  id: string;
  name: string;          // displayName
  templateName?: string;
  message?: string;      // the suspend template's message, if it set one
  inputs: Record<string, string>;   // status.nodes[id].inputs.parameters
  suppliedOutputs: string[];        // outputs with valueFrom.supplied — what resume may set
}>;
```

filled by the same `statusFor` response. The poller then does, per in-progress
request:

- suspended nodes present, state is `IN_PROGRESS` → `AWAITING_INPUT`, persist the
  node list, `notify.approvalNeeded` (the notifier already exists and already
  targets the owning group).
- none present, state is `AWAITING_INPUT` → back to `IN_PROGRESS`. This covers
  someone resuming from the Argo UI directly, which must not leave the request
  stuck.

Storage: a `suspended_nodes` JSON column on `platform_requests`, written through
`store.setWorkflow` (`store.ts:159`) alongside `phase`. It is a cache of Argo's
truth, refreshed every poll — never the source of truth for whether a node is
still suspended.

### The graph turns the node yellow

`WorkflowGraph.tsx:15` maps phase → colour. Phase is `Running` for a suspended
node, so the colour cannot come from phase alone. Derive a synthetic phase in
`toFlow`:

```ts
const phase = n.type === 'Suspend' && n.phase === 'Running' ? 'Suspended' : n.phase;
```

and add `Suspended: 'hsl(var(--sc-warning))'` to `PHASE_COLOR`, plus a thicker
border so it reads without relying on colour alone. Colour is never the only
signal: the node label already renders `name\nphase`, so it will read
`plan\nSuspended`.

The frontend `WorkflowNode` type (`api.ts:8`) gains `inputs` and the suspend
metadata, so the same fetch feeds both the graph and the panel below.

### The panel: what the approver reads before deciding

On the request detail, when the request is `AWAITING_INPUT`, above the approvals
card:

- Which step is waiting, and its message if the template set one.
- **The step's input parameters**, as a key/value table in the existing `sc-kv`
  style. This is the point of the whole feature — the approver is reading what
  the workflow computed, not what the requester typed.
- Any `supplied` outputs the step declares, as editable fields. A suspend step
  that declares `valueFrom: supplied: {}` is asking a question; the resume form
  is where it gets answered.
- **Resume** and, if the step is refusable, **Abort** (stop the workflow).

**Redaction, and this one is not optional.** Node inputs are workflow-authored
and can contain anything the workflow interpolated — including a value that came
from the request's own secret. Before returning inputs to the client, drop any
parameter whose value matches a held secret value, and any whose name matches
the request's `secrets.schema` keys. Render those as `••••` with the key still
visible, so the approver knows a value exists without it being disclosed. The
secret-lifecycle docs already commit to secrets never touching params, Argo
logs, or Git; an approval panel that prints them would break that promise in the
one place a human is looking.

### Resume

`POST /requests/:id/resume` with `{ nodeId, note?, parameters? }`.

Authorisation is the existing approve path, unchanged: `requestApprovePermission`
plus the owning-group-or-admin check that `applyDecision` already performs
(`router.ts:290`). Someone who may approve the request may resume it. **The
requester may not resume their own request** unless they are also an approver —
same rule as the first gate, and it is the rule that makes this an approval
rather than a speed bump.

Order of operations, and it matters:

1. Re-read the workflow from Argo and confirm `nodeId` is **still suspended**.
   The stored list is a cache; two approvers on the same page is the normal case.
2. If `parameters` were supplied, `PUT /set` with them first. If this fails,
   stop — do not resume a step whose answer did not land.
3. `PUT /resume` with `nodeFieldSelector=id=<nodeId>`.
4. Record an `Approval`-shaped audit row: who, when, note, which node, which
   parameters (redacted the same way). The audit trail is why this is worth
   building rather than telling people to use the Argo UI.
5. Set the request back to `IN_PROGRESS` and let the existing poller take over.

Idempotency: a node already resumed returns an Argo error. Treat "not suspended"
as success-with-a-note rather than a 500 — the other approver got there first,
and the outcome the user wanted is the outcome that happened.

---

## What this is not

- **Not a replacement for the first approval gate.** A workflow only runs
  because someone approved it; this gates a later point in the same run.
- **Not workflow-level suspend** (`spec.suspend: true`). Detectable and
  resumable by the same endpoints, but it has no node, no inputs and nothing to
  review — out of scope until something needs it.
- **Not an editor for arbitrary workflow parameters.** Only outputs the step
  itself declared as `supplied` are settable. Argo rejects the rest, and a UI
  that offers what the API refuses is worse than no UI.
- **Not automatic resume on a timer.** A suspend step with `duration` already
  resumes itself; the request will simply return to `IN_PROGRESS` on the next
  poll with no human involved. That works today and needs no code.

## Risks

| Risk | Mitigation |
|---|---|
| Suspend node inputs leak a secret into the approver's browser | Redact by value against held secrets and by key against `secrets.schema`; render masked with the key visible. Test with a request whose secret value is also a node input. |
| Two approvers resume simultaneously | Confirm still-suspended immediately before resuming; treat "not suspended" as success. |
| Resume targets the wrong iteration of a looped suspend step | `nodeFieldSelector=id=`, never `displayName=`. |
| Request stuck in `AWAITING_INPUT` after someone resumes in the Argo UI | The poller clears the state when no suspended node remains — the transition is bidirectional by design. |
| A new non-terminal state gets swept by retention | Add it to the non-terminal set and assert it in `planRetention`'s existing "never plans deletion for a state still in flight" test. |
| `/set` succeeds and `/resume` fails | Ordered so the answer lands first; the node stays suspended with its outputs set, and a retry resumes it. The reverse order would resume with no answer, which is unrecoverable. |

## Verification

- **Unit:** suspend-node extraction from a real `status.nodes` fixture, including
  a workflow with two suspend steps where only one is Running; redaction; the
  state transitions both ways; retention leaving `AWAITING_INPUT` alone.
- **Live, against the dev Argo:** add a `suspend` step with an input parameter
  and a `supplied` output to the `provision-postgres` example workflow. Submit a
  request, approve it, and confirm: the node goes yellow, the panel shows the
  input, resume with a supplied value releases the workflow, and the value
  reaches the downstream step. That last check is the one that proves the
  feature — everything else can pass while the workflow stays stuck.
