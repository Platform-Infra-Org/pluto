# Explanation: the secret lifecycle

Some requests need a secret to provision — a database password, an API key. The
design goal is narrow and absolute: **the value never appears in the request row,
in Argo's parameters or workflow spec, in the UI, in Git, or in logs.**

Everything below follows from that.

## Two sources, one destination

The destination is always a **Kubernetes Secret, one per request**, whose keys
are the field names. One Secret per request buys object-level RBAC, a clean
per-object lifetime, and no write contention between concurrent requests.

Where the value comes from splits the flow in two:

- **Generated** (preferred — a fresh DB password nobody needs to choose). Nothing
  is captured at submit. The backend mints the value **at approval**, straight
  into the Secret. It never exists before it is needed.
- **Provided** (an API key the user already owns). The value only exists during
  the scaffolder run, at **submit** — but the Secret isn't created until
  **approval**, which may be hours later. Something has to hold it in between.

That gap is the only reason encryption exists here.

## Why the held value is encrypted, not stored

A provided value is encrypted the instant it reaches the backend and kept as an
opaque blob on the request row (`secret_enc`). It is decrypted exactly once, in
memory, when the Kubernetes Secret is written at approval — then the blob is
cleared. Rejection clears it too, without ever decrypting.

So a database dump, a `SELECT *`, or a leaked backup yields ciphertext. The
router redacts the column from every API response, so the value is never sent
back to a browser either — not even to the user who typed it.

The scheme is AES-256-GCM. The stored blob is `iv:tag:ciphertext`, all base64.
GCM is authenticated, so tampering with a stored blob fails loudly at decrypt
rather than silently yielding garbage that gets written into a Secret.

## The lifecycle, end to end

```text
SUBMIT     request.secretSpec = { fields: [{name, source: generate|provided}],
                                  secret_enc?: <encrypted, provided only> }
           → no Kubernetes Secret, no plaintext anywhere.

APPROVE    1. submit the workflow → Argo returns {name, uid, namespace}
           2. create Secret platform-req-<rand> in the workflow namespace:
                ownerReferences: [{ Workflow, uid, blockOwnerDeletion: true }]
                labels:          { platform.io/request-id: <id> }
                data:            generated now, or decrypted from secret_enc
           3. clear request.secret_enc
           Workflow pods read it via env.valueFrom.secretKeyRef — never logged.

SUCCESS /  Backstage does nothing. The workflow's ttlStrategy deletes the
FAILURE    Workflow, and Kubernetes cascade-deletes the Secret with it.

REJECT     No workflow, no Secret ever existed. Backstage clears secret_enc.
           This is the only cleanup Backstage performs.
```

## The Workflow owns the Secret

The Secret carries an `ownerReference` pointing at the Argo Workflow that
consumes it. Argo's `ttlStrategy` deletes the Workflow when it's done, and
Kubernetes cascade-deletes the Secret with it. **The workflow decides when the
secret dies** — no timer in Backstage has to guess.

This creates an ordering constraint: the Secret's owner must exist before the
Secret does. So the backend generates the Secret's (unguessable) *name* first,
passes it to the workflow as a parameter, submits, and only then creates the
Secret with the returned workflow UID as its owner. The workflow's first step
waits for the Secret to appear.

Three constraints come with `ownerReference`, and they explain the shape:

- Owner and dependent must be in the **same namespace**, which is why the Secret
  lives in the workflow's namespace (`argo`), locked down by RBAC, rather than
  one of its own.
- `blockOwnerDeletion: true`, so foreground deletion takes the Secret with the
  Workflow.
- Timing is entirely the workflow's `ttlStrategy` — there is no Backstage timer
  on the happy path.

### The create-order race

The workflow's pods reference the Secret via `secretKeyRef`, but the Secret is
created *just after* the workflow is submitted, because the owner must exist
first. If a pod starts before the Secret lands, the kubelet returns
`CreateContainerConfigError` and **retries until it appears** — self-healing,
and the window is small.

If the first step is time-sensitive and you want a zero-race path, submit the
workflow suspended, create the Secret, then resume.

### The sweep

A scheduled sweep deletes managed Secrets whose request is no longer active or
that are older than `maxAgeHours`. It exists for the gaps `ownerReference` can't
close: a workflow lingering with no TTL, an owner GC that didn't fire, a stuck
request. It is a net, not the mechanism — Secrets labelled `platform.io/keep`
(resource-owned, meant to outlive the workflow) are left alone.

**Active means "the workflow may still need it"**, not "the request is in
progress":

| State | Kept | Why |
|---|---|---|
| `IN_PROGRESS` | yes | the workflow is running and mounting it |
| `AWAITING_INPUT` | yes | suspended at a review gate; the step after the gate still has to mount it, possibly hours later |
| `FAILED` | yes | the workflow may still exist and be retried — see *Re-checking a failed request* in the request lifecycle |
| `SUCCEEDED` / `REJECTED` / `EXPIRED` / `PENDING_APPROVAL` | no | nothing left that can mount it |

`maxAgeHours` still applies to **every** state, including the kept ones. That
backstop is why this is a narrowing of the sweep rather than switching it off:
a template with no `ttlStrategy` keeps its workflow forever, and without the age
bound its Secret would live forever too.

In practice a kept Secret rarely reaches that bound — it is owned by the
Workflow, so Argo's `ttlStrategy.secondsAfterFailure` deletes both together. That
same window is the window in which a retry is possible at all, so a retry that
can happen is a retry whose Secret is still there.

## Key rotation

The encryption key comes from `platform.secrets.encryptionKey`, which accepts
either a single string or a **list**:

```yaml
platform:
  secrets:
    encryptionKey:
      - ${PLATFORM_SECRET_KEY}          # encrypts everything from now on
      - ${PLATFORM_SECRET_KEY_PREVIOUS} # only opens blobs written before the swap
```

The first key encrypts. Every key is tried on decrypt. That asymmetry is what
makes rotation cheap: **prepend** the new key and nothing needs re-encrypting,
because the old key is still there to open blobs written under it.

To rotate:

1. Prepend the new key, keep the old one, restart.
2. Wait until no request that was pending at the swap is still pending. Held
   blobs are short-lived by design — cleared at approval or rejection — so this
   is usually minutes, and you can confirm with a `PENDING_APPROVAL` count.
3. Drop the old key.

Skipping step 2 and simply *replacing* the key is the failure mode worth naming:
every blob written under the old key becomes permanently unreadable, and those
requests can never be approved. The backend detects this case — when every
configured key fails, the error says the key was most likely rotated without
keeping the previous one, rather than surfacing a bare auth-tag failure from the
crypto layer.

If no key is configured at all, there is no cipher, and any request carrying a
**provided** secret is rejected at submit. Generated secrets don't touch this
path and keep working.

## Why not a scaffolder action on approve or reject

It was considered and rejected. The post-decision behaviours are well-defined
backend operations, already parameterised per resource type by the template's
`platform.io/verb-*` annotations. Running a scaffolder action after a decision
fights the scaffolder's own model — its task finished at submit, so you would
need a headless runner or a second task, and it would duplicate what the
workflow already does.

If a hook is ever genuinely needed, the small version is letting a verb
annotation name an `onReject` workflow — not a general post-decision action
engine. Custom post-approval behaviour belongs in a WorkflowTemplate, which is
already how provisioning works.

## What this does not protect against

- **A compromised backend process.** It holds the key and decrypts by design.
- **A compromised cluster.** Kubernetes Secrets are base64, not encrypted, unless
  you've enabled encryption at rest in etcd. That's a cluster concern, not this
  plugin's.
- **A malicious approver.** Approval is the trigger to write the Secret; the
  policy engine decides who may approve, and that's a separate control.

The threat this *does* close is the boring, common one: secrets sitting in
plaintext in an application database, a log line, or a Git commit.
