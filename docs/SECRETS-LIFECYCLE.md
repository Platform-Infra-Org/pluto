# Plan: secret lifecycle for provisioning (standalone Backstage)

How the requests suite collects a secret from a user (e.g. a DB password) and
gets it to the provisioning Argo Workflow, so the value **never** appears in the
request row, Argo params/spec/UI, Git, or logs.

## Fixed decisions (from design review)

1. **One K8s Secret per request** (fields as keys), not a shared keyed Secret —
   object-level RBAC, clean per-object lifecycle, no write contention.
2. **The Workflow owns the Secret.** The Secret carries an `ownerReference` to the
   Argo Workflow object; Argo's `ttlStrategy` deletes the Workflow, and K8s
   cascade-deletes the Secret. **The workflow decides when the secret dies.**
3. **Create the Secret only at approval** — never at submit.
4. **Backstage deletes only on reject** (and even then there's nothing in the
   cluster to delete — see below).
5. **Safety nets stay, and are configurable.**

## The timing tension, and how it resolves

The value is only in hand during the scaffolder run (at **submit**, in
`ctx.secrets`), but we create the Secret at **approval** (later). Two secret
sources close the gap:

- **Generated secret** (preferred — e.g. a fresh DB password the user shouldn't
  choose): nothing is captured at submit. The backend **generates it at approval**,
  straight into the Secret. `don't create until approved` holds trivially.
- **User-provided secret** (an API key the user already owns): captured at submit,
  stored **envelope-encrypted** in the request row (a `secret_enc` column,
  encrypted with a config/KMS key — never plaintext, never a K8s Secret). At
  approval it's decrypted → written into the Secret → the column is cleared.

So at submit the only thing that ever persists is an **encrypted blob** (for the
provided case) or **nothing** (generated). No K8s Secret exists before approval.

## Lifecycle

```
SUBMIT     request.secretSpec = { fields:[{name, source: generate|provided}],
                                  secret_enc?: <encrypted for provided> }
           → no K8s Secret, no plaintext.

APPROVE    1. submitWorkflow → Argo creates Workflow, returns {name, uid, namespace}
           2. create Secret platform-req-<rand> in the workflow namespace:
                ownerReferences: [{ Workflow, uid, blockOwnerDeletion: true }]
                labels:          { platform.io/request-id: <id> }
                data:            generated-now or decrypted-from-secret_enc
           3. clear request.secret_enc
           Workflow pods read it via env.valueFrom.secretKeyRef (never logged).

SUCCESS /  Backstage does NOTHING. Workflow ttlStrategy deletes the Workflow →
FAILURE    K8s cascade-deletes the Secret. (The workflow owns the timing.)

REJECT     No Workflow, no Secret was ever created. Backstage just clears
           request.secret_enc (idempotent). This is the ONLY Backstage cleanup.
```

### The create-order race (and the clean fix)

The Workflow's pods reference the Secret via `secretKeyRef`, but we create the
Secret just *after* submitting the Workflow (needed for the `ownerReference` —
the owner must exist first). If a pod starts before the Secret lands, the kubelet
returns `CreateContainerConfigError` and **retries until the Secret appears** —
self-healing, small window. For a zero-race path, submit the Workflow **suspended**
(Argo `suspend`), create the Secret, then resume — recommended when the first step
is time-sensitive.

### ownerReference notes

- Owner and dependent must be **same namespace** → put the Secret in the workflow
  namespace (e.g. `argo`), locked down by RBAC, not a separate namespace.
- `blockOwnerDeletion: true` so foreground deletion removes the Secret with the
  Workflow.
- Deletion timing is entirely the Workflow's `ttlStrategy`
  (`secondsAfterCompletion/Success/Failure`) — no Backstage timer for the happy path.

## Safety nets (configurable)

`ownerReference` handles the happy path, but nets catch the gaps (a Workflow that
lingers with no TTL, a Secret whose owner GC didn't fire, a stuck request):

- **Orphan sweep** — a scheduled task lists Secrets labeled `platform.io/request-id`
  and deletes any whose request is REJECTED/terminal, whose owner Workflow is gone,
  or that are past a max-age TTL.
- **Config schema** (`platform.secrets`):

  ```yaml
  platform:
    secrets:
      enabled: true
      namespace: argo                 # where Secrets + Workflows live (ownerRef)
      encryptionKeyRef: ${SECRET_ENC_KEY}   # envelope key for provided secrets
      sweep:
        enabled: true                 # opt-out available
        frequency: { minutes: 15 }
        maxAgeHours: 24               # hard cap even if everything else fails
  ```

## Code shape

- **`SecretStore` interface** (new file, one responsibility):
  `create(reqId, fields, owner) → {name, keys}` · `delete(name)` ·
  `sweep(activeReqIds) → count`. K8s implementation talks to the API with a SA that
  has `create`/`delete` Secrets in the namespace (never `get` — it never reads back).
- **Request model** (`store.ts`): `secretSpec` + `secret_enc` column; **redact** in
  the router responses so the UI never receives it.
- **Approval hook** (`plugin.ts` `submitWorkflow`): after `argo.submitSpec` returns
  the Workflow ref, call `secretStore.create(..., ownerWorkflow)`, then clear
  `secret_enc`.
- **Reject hook** (`router.ts`/`stateMachine.ts` REJECTED path, beside
  `notify.decided`): clear `secret_enc`.
- **Sweep** runs on the **existing `platform-requests-argo-poll` scheduled task**
  (it already sees every terminal transition) or its own task, gated by config.

## "Define a scaffolder action to run on approve/reject?" — overkill

Recommend **no**. The post-decision behaviors are well-defined backend operations,
already parameterized by the template's `platform.io/verb-*` annotations (which name
the WorkflowTemplate + params per verb). Running full **scaffolder actions** after a
decision fights the scaffolder's model — the task finished at submit, so you'd need a
headless action runner or a second task, and it duplicates what the Workflow already
does. The lightweight, sufficient extension (if ever needed) is to let the verb
annotation optionally name an `onReject` workflow — *not* a general post-decision
action engine. Express custom post-approval behavior as a WorkflowTemplate, which is
already how provisioning works.

## Threat model recap

Value lives only in: the browser (submit), backend memory (submit + approval), an
**encrypted** DB column (submit→approval, provided secrets only), and the K8s Secret
(approval→workflow-GC). It never appears in: request params (plaintext), Argo
params/spec/UI, Git, or logs.

## Build order

1. `platform.secrets` config schema + `SecretStore` interface + K8s impl (ownerRef create, delete, sweep) + SA/RBAC.
2. Request model: `secretSpec` + `secret_enc` (envelope-encrypted) + response redaction.
3. Scaffolder: secret input → `ctx.secrets`; capture (encrypt) for *provided*, or mark *generate*.
4. Approval hook: submit Workflow → create Secret (ownerRef) → clear `secret_enc`.
5. Reject hook: clear `secret_enc`.
6. Sweep scheduled task (config-gated) + safety nets.
7. Example `postgres` template + WorkflowTemplate using `secretKeyRef` env + `ttlStrategy`.
8. Tests: request row never holds plaintext; rejected request leaves no Secret; approved Secret has the Workflow `ownerReference` and cascade-deletes with it.
```
