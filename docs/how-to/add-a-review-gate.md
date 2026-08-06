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
  parameters:
    request: "<< paramsJson >>"
```

## What the approver gets

When the workflow reaches the step, the request moves to `AWAITING_INPUT` on
the next poll, the node turns yellow in the graph, and a panel appears above
the approvals card with the step's inputs, its questions, and two actions:

- **Resume** — supplies the answers (Argo `/set`) and releases the node
  (`/resume`), in that order. If setting fails, nothing is resumed: a step
  released without its answer cannot be suspended again.
- **Stop** — ends the run (Argo `/stop`, so the workflow's `onExit` handlers
  still run and clean up what it created). The request lands in `FAILED`.

Both are recorded in the same audit trail as the first approval, and both are
gated the same way: **an admin or a member of the owning team**. The requester
cannot wave their own request through unless they are also an approver.

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
