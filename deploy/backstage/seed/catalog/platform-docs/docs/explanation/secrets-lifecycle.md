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

A sweep runs on a schedule as a safety net, deleting managed Secrets whose
request is no longer active or that are older than `maxAgeHours`. It is a net,
not the mechanism — Secrets labelled `platform.io/keep` (resource-owned, meant to
outlive the workflow) are left alone.

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

## What this does not protect against

- **A compromised backend process.** It holds the key and decrypts by design.
- **A compromised cluster.** Kubernetes Secrets are base64, not encrypted, unless
  you've enabled encryption at rest in etcd. That's a cluster concern, not this
  plugin's.
- **A malicious approver.** Approval is the trigger to write the Secret; the
  policy engine decides who may approve, and that's a separate control.

The threat this *does* close is the boring, common one: secrets sitting in
plaintext in an application database, a log line, or a Git commit.
