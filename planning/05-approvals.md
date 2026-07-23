# 05 — Requests & Approvals

The research flagged that **concrete multi-team approval-workflow modeling was not covered by
verified claims** (see [09](09-research-findings.md), open questions). This design is therefore
**[D]** throughout — standard state-machine modeling, open to change.

## The Request entity

A Request is the unit of change. One row in Postgres, plus an append-only history for audit.

```
Request {
  id
  kind           : RESOURCE_CHANGE | SERVICE_ONBOARDING   // selects the approver-resolution rule
  action         : CREATE | UPDATE | DELETE
  resource_type
  resource_id    : null for CREATE
  owner_team     : resolved at submit time (drives approval routing)
  payload        : jsonb  (proposed new/updated JSON, or delete target)
  requester      : user id (from OIDC sub)
  state          : see state machine
  approval_policy: resolved at submit — { mode: SINGLE | N_OF_M | RBAC, n? }  // per-resource, see below
  approvals[]    : { approver_id, at, note }          // distinct approvers so far
  workflow_ref   : Argo workflow namespace/name, once submitted
  created_at, updated_at
}
RequestEvent {  // append-only audit trail
  request_id, at, actor, from_state, to_state, note
}
```

## State machine

```
   DRAFT ──submit──▶ PENDING_APPROVAL ──approve──▶ APPROVED ──trigger──▶ EXECUTING
     │                   │      │                                            │
   (discard)          reject  (auto-reject                          ┌────────┴────────┐
     ▼                   ▼      on payload stale)               SUCCEEDED          FAILED
  DISCARDED          REJECTED                                   (Git updated)   (failed step
                                                                                 surfaced)
```

- `DRAFT` — optional; supports save-before-submit. Can be skipped. **[D]**
- `PENDING_APPROVAL` — awaiting approvers (notified). Each approval appends to `approvals[]`; stays
  here until the resource's **approval policy is satisfied** (see below) or an admin bypass. (In
  `RBAC` auto-approve mode a permitted requester may skip straight through — no wait.)
- `APPROVED` — policy satisfied (or admin bypass); BFF is about to submit to Argo.
- `EXECUTING` — Argo Workflow running; live status streamed ([06](06-argo-integration.md)).
- `SUCCEEDED` / `FAILED` — terminal; requester notified; on failure the failed step + message are
  stored on the request.
- `REJECTED` / `DISCARDED` — terminal, no execution.

Every transition writes a `RequestEvent` — this is the audit log auditors read.

## Two approval lanes (by `kind`)

The same state machine serves two kinds of request; `kind` selects who approves:

| `kind` | What's approved | Approver | Policy |
|--------|-----------------|----------|--------|
| `RESOURCE_CHANGE` | create/update/delete of a resource *instance* | **owner team** (or RBAC-permitted) | **per-resource policy**: SINGLE / N_OF_M / RBAC |
| `SERVICE_ONBOARDING` | a new/updated service *type* + its form + workflow binding ([10](10-service-request-builder.md)) | **platform-admin** | admin sign-off |

Everything below describes the `RESOURCE_CHANGE` lane; the onboarding lane is detailed in
[10](10-service-request-builder.md) and differs only in approver resolution (admins, not owner team).

## Approval routing & authorization (RESOURCE_CHANGE)

- At submit, the BFF resolves `owner_team` from the target resource (or resource type for CREATE) —
  see ownership rules in [04](04-resource-catalog.md).
- The request appears in the **approval queue** of every user whose `groups` claim includes
  `owner_team` (plus `platform-admin`). Authorization is enforced server-side using the
  `groups`-claim → permission mapping from [03](03-auth-rbac.md). **[R for the mechanism; D for the policy]**
- **Approval policy is per-resource and data-driven — not a hardcoded type list.** **[decided]**
  Each **Service Definition** ([10](10-service-request-builder.md)) declares a default
  `approval_policy`, and an individual resource may **override** it in its JSON
  (`metadata.approvalPolicy`). Resolved at submit (resource override → definition default). Three
  modes:

  | `mode` | Meaning | Approved when |
  |--------|---------|---------------|
  | `SINGLE` | one approval | one distinct authorized approver approves |
  | `N_OF_M` | quorum of N | `count(distinct approvers) >= n` from the eligible approvers |
  | `RBAC` | permission-gated, no quorum | a single action by **any principal whose RBAC grants approve** on the resource; if the requester holds that grant, it may **auto-approve** (straight to `APPROVED`) |

  `SINGLE`/`N_OF_M` draw approvers from the **owner team**; `RBAC` draws them from **whoever RBAC
  authorizes to approve that resource** (role-based, may include self). The request records the
  resolved `approval_policy` and the `approvals[]` collected; a policy-satisfied guard fires
  `APPROVED`. Types themselves are dynamic (authored in the builder), so no resource kinds are
  hardcoded. **[decided]**
  - Cross-cutting resources with multiple owner teams (SINGLE/N_OF_M): express as per-team quorum —
    each listed team must reach its own. **[D]**
  - **Confirm:** in `RBAC` mode, may a permitted requester auto-approve their own request, or must a
    *different* RBAC-permitted principal approve? Default assumed: **auto-approve if the requester is
    permitted** (self-service); flip to "different principal" if you want an eyes-on rule. **[D]**

- **Admin bypass:** a `platform-admin` can **approve-and-override**, satisfying the requirement
  in a single action regardless of N. **[decided]** Every bypass writes a `RequestEvent` flagged
  `admin_bypass` with the actor and a required reason, so it is fully auditable. Use it for
  emergencies / stuck approvals, not routine flow. **[D]**

- **Separation of duties:** a requester cannot count as one of their own approvers. An admin
  bypassing their *own* request is allowed but is always logged as `admin_bypass` (never silent). **[D]**

## Concurrency & staleness **[D]**

- A request targets a specific `git_sha` of the resource. If the resource changes in Git between
  submit and approval, the request is **stale** — the approver sees a warning; approving requires a
  re-confirm (or the request auto-moves back for the requester to rebase). Prevents approving a diff
  against an outdated base.
- Only one in-flight request per resource at a time (later requests queue or conflict). **[D]**

## UI surfaces

- **My requests** — requester's own requests with live state.
- **Approval queue** — for approvers: pending requests for their team(s), with a clear diff (current
  JSON vs proposed), requester, and approve/reject + note. **[D]**
- **Request detail** — full state history, the diff, linked workflow status, failed step on error.

## Decided policy

- **Per-resource approval policy** (data-driven, dynamic types): `SINGLE`, `N_OF_M(n)`, or `RBAC`.
  Set on the Service Definition, overridable per resource. No hardcoded type list.
- **Admin bypass** via `platform-admin`, always audit-logged with a reason (enabled in prod).
- Requester cannot count as one of their own approvers (except `RBAC` auto-approve, by design);
  admin self-bypass is allowed but logged.
- **Retiring a type with live resources: blocked until they're removed** ([10](10-service-request-builder.md)).
- **Auditor role: in scope for v1** — read-only across all requests/approvals/bypass events.

## Still open (for review)

- Auto-reject on staleness vs. manual rebase (see Concurrency below)?
- `RBAC` mode self-approve semantics (see the Confirm note above).
- Cross-team resources: per-team quorum vs. a single combined pool — default is per-team.
