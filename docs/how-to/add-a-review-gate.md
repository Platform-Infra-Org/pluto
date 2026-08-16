# How-to: add a mid-workflow review gate

The first approval decides whether a workflow **starts**. A review gate decides
whether it **continues** — with the workflow's own computed values in front of
the approver: a plan, a diff, a cost estimate, a dry-run result.

You need an Argo `suspend` step. The platform notices it, shows the request as
`AWAITING_INPUT`, renders the step's inputs for review, and offers Resume and
Stop to whoever may approve the request.

## 1. Add a suspend step to the workflow

```yaml
- name: approve
  inputs:
    parameters:
      - { name: plan }   # what the approver reads
      - { name: cost }
  suspend: {}
  outputs:
    parameters:
      # No default => the platform will not resume without an answer.
      # enum => rendered as a dropdown, and enforced server-side too.
      - name: decision
        description: Apply the plan, or apply nothing and finish clean.
        enum: [apply, skip]
        valueFrom:
          supplied: {}
      # A default => optional. Left blank, the default is what gets supplied.
      - name: ticket
        description: Change ticket to record against this decision.
        default: none
        valueFrom:
          supplied: {}
```

Everything about the approver's form comes from this declaration:

| You write | The approver sees |
|---|---|
| `inputs.parameters` | a read-only table of values to review |
| `description` | help text under the field |
| `enum` | a dropdown, and the API refuses anything else |
| `default` | the field pre-filled, and the answer optional |
| no `default` | a required field; Resume stays disabled until answered |

A working example lives in `deploy/dev/argo/review-gate.yaml`, wired to
the **Provision With Review** template.

## 2. Feed the answer to the next step

The supplied output arrives as a normal step output:

```yaml
- - name: apply
    template: apply
    arguments:
      parameters:
        - name: decision
          value: "{{steps.approve.outputs.parameters.decision}}"
```

Make the downstream step **fail** on an empty value. If a resume ever delivers
nothing, you want the run to stop loudly rather than apply a change nobody
answered for:

```bash
if [ -z "${DECISION}" ]; then
  echo "ERROR: resumed without the approver's answer" >&2
  exit 1
fi
```

## 3. Point a template at it

```yaml
argoSubmit:
  namespace: argo
  workflowTemplate: review-gate
```

No `parameters` block is needed: every request param is forwarded to Argo as its
own named parameter, so a request with `region` reaches a workflow that declares

```yaml
arguments:
  parameters:
    - { name: region, value: "eu-west-1" }
```

Declare each request field the workflow reads — see
**[Submit tokens](../reference/tokens.md)**.

## What the approver gets

When the workflow reaches the step, the request moves to `AWAITING_INPUT` on
the next poll, the node turns yellow in the graph, and a panel appears above
the approvals card with the step's inputs, its questions, and two actions:

- **Resume** — supplies the answers (Argo `/set`) and releases the node
  (`/resume`), in that order. If setting fails, nothing is resumed: a step
  released without its answer cannot be suspended again.
- **Stop** — ends the run (Argo `/stop`, so the workflow's `onExit` handlers
  still run and clean up what it created). The request lands in `FAILED`.

Both are recorded in the same audit trail as the first approval. By default both
are gated the same way: **an admin or a member of the owning team**. The
requester cannot wave their own request through unless they are also an
approver.

A step may override that for itself — see **[Handing a gate to another
team](#handing-a-gate-to-another-team)** below.

Stopping appears in two places, because Argo cannot stop a single node: `/stop`
ends the run, so refusing a gate and abandoning a request are the same call
reached from two directions, and they are gated differently.

| control | means | who may |
|---|---|---|
| **Refuse and stop**, beside a step | refuse *this* gate | whoever may resume that step — the named team, or the owner where no team is named |
| **Stop the whole workflow**, at the foot of the card | abandon the request | an admin, the owning team, **or whoever filed it** |

A team locked out of a gate cannot refuse it either — otherwise naming a team
would only move who says yes, and leave anyone able to say no. The request-level
Stop is wider on purpose: someone who no longer wants what they asked for should
not have to find an approver to withdraw it. It is the only one behind a
confirmation, because it throws away a run that may already have provisioned
something, and its reason field reaches the same audit trail as an approval
note — stopping is recorded as a rejection, because that is what refusing a
request is.

## Handing a gate to another team

A gate does not have to belong to the team that owns the request. Put
`platform.io/approver-group` on the **suspend template** and that step is
answered by the group you name:

```yaml
templates:
  - name: approve-cost
    metadata:
      annotations:
        platform.io/approver-group: group:default/payments
    suspend: {}
```

The annotation goes on the template, not on the step that calls it and not in
`arguments`. Three states, and the middle one is what you get by writing
nothing:

| the suspend template | who may resume it |
|---|---|
| names a group that has members | an admin, or that group |
| carries no annotation | an admin, or the request's owning team |
| names a group nobody is in, or is empty | an admin, and nobody else |

Two things about the first row are worth saying plainly, because both surprise
people:

- **It replaces the owner, it does not add to them.** The owning team approved
  the request at the start; a cost gate means little if the team spending the
  money can release it. A request its own owner filed can therefore reach a gate
  its owner cannot answer — the step stays visible on the request page, naming
  the team, so they know whom to chase.
- **The decision is per step, not per request.** Two gates in the same step
  group suspend at the same time and are answered independently by two different
  teams, in either order.

The last row is deliberate. An unresolvable group narrows to admins rather than
falling back to the owner, so a typo stalls in the open instead of quietly
widening the gate. The request page names the group it could not resolve.

A worked example with all three states in one run lives in
`deploy/dev/argo/team-gates.yaml`, wired to the **Provision With Team Gates**
template: checkout owns the request, payments answers the cost gate, search
answers the schema gate, and a third unannotated gate returns to checkout.

## Things worth knowing

- **A suspended node reports `phase: Running`.** Argo has no "Suspended" phase,
  so anything you write that keys off phase alone will never see it — the pair
  is `type: Suspend` **and** `phase: Running`.
- **Several gates in one workflow are fine.** Each is resumed by node id, so a
  suspend step inside a loop resumes the iteration you clicked and not another.
- **A gate can wait indefinitely.** `AWAITING_INPUT` is never expired or deleted
  by retention. If you want a time limit, give the suspend step a `duration` —
  Argo resumes it itself and the request returns to `IN_PROGRESS` with no human
  involved.
- **Do not pass secrets as suspend inputs.** They would be displayed to the
  approver. Secrets reach a workflow through the per-request Kubernetes Secret
  and `secretKeyRef` — see **[Secret lifecycle](../explanation/secrets-lifecycle.md)**.
